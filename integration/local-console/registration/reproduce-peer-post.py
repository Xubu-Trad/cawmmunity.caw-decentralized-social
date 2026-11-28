"""Re-mine the archived signed post, sync a fresh Geth peer and check its checkpoint."""

import argparse
from contextlib import ExitStack
from dataclasses import dataclass
import hashlib
from importlib import import_module
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
peer = import_module("reproduce-withdrawal-peer")
PINNED_COMMIT = "1df30b18d9ed35ee9d28ffd4648442c2204554ad"
ORIGINAL = "0x81473ce06a2add0ef448b70e2cbca60f0b557eebbde2345fb147ec04e69e2a0d"
POST_TX = "0xa7145ef7bbc6e88cf0db0824b8e3b635dba8d5834b2865570d5c625c130066d7"
ARCHIVE = HERE / "samples/branch-check/archive.json"
GETH_SHA256 = "45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea"
STAKER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
SECOND_STAKER = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
ZERO_ADDRESS = "0x" + "00" * 20


def demand(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


@dataclass
class Node:
    http: int
    engine: int
    p2p: int
    secret: bytes
    proc: subprocess.Popen

    def rpc(self, method, params):
        return peer.rpc(self.http, method, params)

    def auth(self, method, params):
        return peer.rpc(self.engine, method, params, self.secret)

    def block(self, height="latest"):
        return self.rpc("eth_getBlockByNumber", [height, False])


def verify_listeners(pid, ports):
    # Linux exposes all listening sockets in the namespace. Keep only this child's inodes.
    fds = Path(f"/proc/{pid}/fd")
    owned = set()
    for fd in fds.iterdir():
        try:
            owned.add(os.readlink(fd))
        except FileNotFoundError:
            continue
    found = set()
    for table in ("tcp", "tcp6"):
        for row in Path(f"/proc/{pid}/net/{table}").read_text().splitlines()[1:]:
            fields = row.split()
            if fields[3] != "0A" or f"socket:[{fields[9]}]" not in owned:
                continue
            address, port = fields[1].split(":")
            demand(table == "tcp" and address == "0100007F", "Non-loopback TCP listener")
            found.add(int(port, 16))
    demand(found == set(ports), "Expected exactly three loopback listeners")


def start(stack, name, ports, exe, out, genesis):
    http, engine, p2p = ports
    secret = secrets.token_bytes(32)
    jwt = out / (name + ".jwt")
    with os.fdopen(os.open(jwt, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as f:
        f.write(secret.hex())
    stack.callback(jwt.unlink, missing_ok=True)
    log = stack.enter_context((out / (name + ".log")).open("xb"))
    cmd = [str(exe), "--datadir", str(out / name), "--cache", "64"]
    env = dict(os.environ, GOMEMLIMIT="256MiB", GOMAXPROCS="2")
    subprocess.run(cmd + ["init", str(genesis)], check=True, timeout=60, env=env, stdout=log, stderr=log)
    api = "eth,net,admin,miner,txpool" if name == "source" else "eth,net,admin"
    config = out / (name + ".toml")
    listener = f'ListenAddr = "127.0.0.1:{p2p}"'
    config.write_text('[Node.P2P]\n' + listener + '\nBootstrapNodes = []\nBootstrapNodesV5 = []\n')
    launch = cmd + ["--config", str(config), "--bootnodes", "", "--networkid", "1337", "--syncmode", "full", "--nodiscover",
        "--netrestrict", "127.0.0.0/8", "--nat", "none", "--maxpeers", "2",
        "--http", "--http.addr", "127.0.0.1", "--http.port", str(http), "--http.api", api,
        "--authrpc.addr", "127.0.0.1", "--authrpc.port", str(engine), "--authrpc.jwtsecret", str(jwt),
        "--ipcdisable"]
    effective = subprocess.check_output(launch + ["dumpconfig"], text=True, env=env)
    for setting in (listener, "BootstrapNodes = []", "NoDiscovery = true"):
        demand(setting in effective.splitlines(), f"Missing effective setting: {setting}")
    proc = subprocess.Popen(launch, env=env, stdout=log, stderr=log)
    stack.callback(peer.stop, proc)
    node = Node(http, engine, p2p, secret, proc)
    for _ in range(150):
        demand(proc.poll() is None, f"{name} exited. See {name}.log")
        try:
            if node.rpc("eth_chainId", []) == "0x539" and node.block()["number"] == "0x0":
                verify_listeners(proc.pid, ports)
                return node
        except OSError:
            pass
        time.sleep(.1)
    raise RuntimeError(f"{name} failed to start at the chain-1337 genesis")


def mine(node, parent, transactions):
    expected = [node.rpc("eth_sendRawTransaction", [raw]) for raw in transactions]
    # Pool admission and promotion are asynchronous. Confirm these exact hashes
    # are ready before asking Geth to build a block.
    deadline = time.monotonic() + 10
    while transactions:
        pending = node.rpc("txpool_content", [])["pending"]
        hashes = {tx["hash"] for sender in pending.values() for tx in sender.values()}
        if hashes == set(expected):
            break
        demand(time.monotonic() < deadline, "Signed fixture transactions did not enter the pending pool")
        time.sleep(.05)
    choice = dict(headBlockHash=parent["hash"], safeBlockHash=peer.ZERO, finalizedBlockHash=peer.ZERO)
    attributes = dict(timestamp=hex(int(parent["timestamp"], 16) + 1), prevRandao=peer.ZERO,
                      suggestedFeeRecipient=ZERO_ADDRESS, withdrawals=[])
    build = node.auth("engine_forkchoiceUpdatedV2", [choice, attributes])
    demand(build["payloadStatus"]["status"] == "VALID" and build["payloadId"], "Could not start payload")
    # Geth starts the payload builder asynchronously. Resolving its ID too early
    # can seal an empty payload. The full body below must match before import.
    time.sleep(.5)
    payload = node.auth("engine_getPayloadV2", [build["payloadId"]])["executionPayload"]
    demand(payload["transactions"] == transactions, f"Payload body mismatch at {payload['blockNumber']}")
    result = node.auth("engine_newPayloadV2", [payload])
    h = payload["blockHash"]
    demand(result["status"] == "VALID" and result["latestValidHash"] == h, f"Invalid source block {h}")
    demand(peer.forkchoice(node.engine, h, node.secret) == "VALID", f"Source fork choice rejected {h}")
    block = node.block()
    demand(block["hash"] == h and block["transactions"] == expected, f"Wrong canonical source body at {h}")
    return block


def synchronize(source, receiver, tip):
    demand(receiver.block()["number"] == "0x0" and receiver.rpc("eth_getBlockByHash", [tip, False]) is None,
           "Receiver was not fresh before connecting")
    enode = source.rpc("admin_nodeInfo", [])["enode"].split("@")[0] + f"@127.0.0.1:{source.p2p}"
    demand(receiver.rpc("admin_addPeer", [enode]), "Could not connect receiver to its source")
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        status = peer.forkchoice(receiver.engine, tip, receiver.secret)
        if status == "VALID" and receiver.block()["hash"] == tip:
            connections = int(receiver.rpc("net_peerCount", []), 16)
            demand(connections == 1, "Unexpected receiver peer count")
            return connections
        time.sleep(.5)
    raise RuntimeError("Peer sync did not reach the hinted head. See receiver.log")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("--geth", "--input", "--output"):
        parser.add_argument(flag, type=Path, required=True)
    parser.add_argument("--following-browser", action="store_true",
                        help="Check the source portal against a pin read from the synced receiver")
    args = parser.parse_args()
    exe, output = args.geth.resolve(), args.output.resolve()
    demand(shutil.disk_usage(output.parent).free >= 2 * 1024**3, "Need 2 GiB free for test nodes")
    if Path("/proc/sys/kernel/osrelease").exists() and "microsoft" in Path("/proc/sys/kernel/osrelease").read_text().lower():
        demand(Path("/mnt/c").is_mount() and shutil.disk_usage("/mnt/c").free >= 2 * 1024**3,
               "Need 2 GiB free on the WSL host drive")
    demand(digest(exe) == GETH_SHA256, "Expected the pinned Linux amd64 Geth binary")
    demand(f"Git Commit: {PINNED_COMMIT}" in subprocess.check_output([exe, "version"], text=True),
           "Expected Geth 1.17.10 commit " + PINNED_COMMIT)
    fixture = json.loads(args.input.read_bytes())
    groups = fixture["blocks"]
    post_height = fixture["postHeight"]
    demand(fixture["genesis"]["config"]["chainId"] == 1337 and fixture["txHash"] == POST_TX and
           post_height == len(groups) == 35, "Expected the 35-block signed-post fixture")
    archive = json.loads(ARCHIVE.read_bytes())
    demand(groups[-1]["transactions"] == [archive["txBytes"]], "Final transaction differs from the archive")
    output.mkdir()
    genesis = output / "genesis.json"
    genesis.write_text(json.dumps(fixture["genesis"]) + "\n")
    ports = peer.ports()
    artifact = output / "located.json"
    checkpoint_height = post_height + 2
    bounds = [ORIGINAL, POST_TX, str(ARCHIVE)]
    cli = ["node", str(HERE / "locate-archived-post.mjs")]
    with ExitStack() as stack:
        source = start(stack, "source", ports[:3], exe, output, genesis)
        receiver = start(stack, "receiver", ports[3:], exe, output, genesis)
        # The historical fixture signed zero-tip transactions. Permit these
        # solely in the disposable source builder. The receiver uses defaults.
        source.rpc("miner_setGasPrice", ["0x0"])
        head = source.block()
        genesis_hash = head["hash"]
        demand(receiver.block()["hash"] == genesis_hash, "Different genesis")
        for group in groups:
            head = mine(source, head, group["transactions"])
        browser_transactions = []
        if args.following_browser:
            # The archived follow reverted at block 24. Preserve it and exercise
            # a real follow from reader01's new owner after the archived post.
            suffix = json.loads(subprocess.check_output(["node", str(HERE / "receiver-follow-fixture.mjs"), str(args.input)]))
            for raw in suffix:
                head = mine(source, head, [raw])
                tx_hash = head["transactions"][0]
                demand(source.rpc("eth_getTransactionReceipt", [tx_hash])["status"] == "0x1",
                       "Browser fixture transaction reverted at " + head["number"])
                browser_transactions.append(tx_hash)
            checkpoint_height += len(suffix)
        for _ in range(3):
            head = mine(source, head, [])
        demand(int(head["number"], 16) == checkpoint_height + 1, "Wrong tip height")
        connections = synchronize(source, receiver, head["hash"])
        browser_pin = None
        if args.following_browser:
            browser_pin = import_module("test-feed-receiver").check_receiver_feed(
                f"http://127.0.0.1:{source.http}", f"http://127.0.0.1:{receiver.http}",
                hex(checkpoint_height), POST_TX, ["2000.0 CAW · "+STAKER, "3000.0 CAW · "+SECOND_STAKER])
        peer.stop(source.proc)
        demand(source.proc.poll() is not None, "Source must be offline before acquisition")
        checkpoint = receiver.block(hex(checkpoint_height))
        demand(checkpoint["hash"] != head["hash"] and receiver.block()["parentHash"] == checkpoint["hash"],
               "Unexpected checkpoint below the receiver tip")
        reverted = []
        receipt_count = 0
        for height, group in enumerate(groups, 1):
            canonical = receiver.block(hex(height))
            demand(len(canonical["transactions"]) == len(group["transactions"]), f"Different body at {height}")
            for i, tx in enumerate(canonical["transactions"]):
                demand(receiver.rpc("eth_getRawTransactionByHash", [tx]) == group["transactions"][i],
                       f"Different signed bytes at {height}/{i}")
                receipt = receiver.rpc("eth_getTransactionReceipt", [tx])
                demand(receipt["blockHash"] == canonical["hash"] and receipt["transactionHash"] == tx and
                       receipt["status"] in ("0x0", "0x1"), f"Missing receiver receipt at {height}/{i}")
                receipt_count += 1
                if receipt["status"] == "0x0":
                    reverted.append(dict(height=height, transactionHash=tx))
        endpoint = f"http://127.0.0.1:{receiver.http}"
        subprocess.run(cli + ["capture", endpoint, *bounds, hex(checkpoint_height), str(artifact)], check=True)
        demand(json.loads(artifact.read_bytes())["checkpointHash"] == checkpoint["hash"],
               "Captured evidence selected a different receiver checkpoint")
    replay = json.loads(subprocess.check_output(cli + ["verify", *bounds, checkpoint["hash"], str(artifact)]))
    demand(replay["original"]["status"] == "different-block" and replay["located"]["status"] == "included",
           "Expected the same signed post on the new branch")
    demand(replay["post"]["body"] == "post before branch replacement" and replay["post"]["fee"] == "5000.0",
           "Post contents or settlement changed")
    demand(replay["post"]["credits"] == [dict(staker=STAKER, weight="200.0", amount="2000.0"),
           dict(staker=SECOND_STAKER, weight="300.0", amount="3000.0")], "Unexpected re-mined post credits")
    original_post = json.loads(subprocess.check_output(["node", str(HERE / "post-capsule.mjs"), "verify", *bounds]))
    demand(original_post["credits"] == [dict(staker=STAKER, weight="100.0", amount="5000.0")],
           "Unexpected original post credits")
    result = dict(originalBlockHash=ORIGINAL, txHash=POST_TX, genesisHash=genesis_hash, inputSha256=digest(args.input),
                  receiverInitialHeight=0, receiverInitiallyHadTip=False, receiverPeerCount=connections,
                  syncHint=dict(number=head["number"], hash=head["hash"]),
                  receiverCheckpoint=dict(number=checkpoint["number"], hash=checkpoint["hash"]),
                  sourceStoppedBeforeCapture=True, bothNodesStoppedBeforeReplay=True, operatorCount=1,
                  archiveSha256=digest(ARCHIVE), receiverEvidenceSha256=digest(artifact),
                  gethCommit=PINNED_COMMIT, gethBinarySha256=GETH_SHA256,
                  receiverReceiptCount=receipt_count, revertedTransactions=reverted,
                  originalCredits=original_post["credits"], replay=replay)
    if args.following_browser:
        demand(browser_pin == {"height": checkpoint["number"], "hash": checkpoint["hash"]},
               "Browser pin differs from the final receiver checkpoint")
        result["followingBrowserCheckpoint"] = browser_pin
        result["followingBrowserSetupTransactions"] = browser_transactions
    (output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
