#!/usr/bin/env python3
"""Replay the frozen synthetic C-007 history and run the live paid-post reader."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import runpy
import secrets
import shutil
import signal
import subprocess
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FIXTURE = ROOT / "evidence/c007-new-owner-replay-20261108"
PEER = runpy.run_path(str(HERE / "reproduce-withdrawal-peer.py"))
GETH_HASH = "45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea"
GENESIS_HASH = "0x6c383946adbe554271ffb1f227933d44864ce5f9a1633f3a646843a895903a9f"
INPUTS = {
    "genesis.json": "7a113bfbcce39f22659ab8021ed687553b51924930206c1f7e15dd5bdd7a2a11",
    "acquired-history.json": "689f880143cdc55f3016dcad42b70bb188af35ad296305e4ee42a9f058a76742",
    "blocks.json": "fd2acf1647da1f6c7338269b4e70cbfe349ff523bd4b2cf2a1c03bf3c2ad2e53",
}


def checked_input(name):
    data = (FIXTURE / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != INPUTS[name]:
        raise ValueError(f"C-007 input digest mismatch: {name}")
    return json.loads(data)


def verified_geth(exe):
    with exe.open("rb") as f:
        digest = hashlib.sha256()
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != GETH_HASH:
        raise ValueError("Expected the pinned Linux amd64 Geth binary")
    version = subprocess.check_output([exe, "version"], text=True, timeout=10)
    if "Git Commit: 1df30b18d9ed35ee9d28ffd4648442c2204554ad" not in version:
        raise ValueError("Expected Geth 1.17.10")


def replay(http, engine, secret, capture, records):
    rpc = PEER["rpc"]
    genesis = rpc(http, "eth_getBlockByNumber", ["0x0", False])
    if genesis["hash"] != GENESIS_HASH:
        raise ValueError("C-007 genesis header mismatch")
    parent = GENESIS_HASH
    for number in range(1, 33):
        record, source = records[number - 1], capture[number]
        # Rebuilt Shanghai headers use the recorded monotonic timestamps. The
        # retained signed transaction bytes and original fee recipient are reused.
        header = dict(source["block"], hash=record["hash"], parentHash=parent,
                      timestamp=hex(int(record["timestamp"])), stateRoot=record["stateRoot"],
                      extraData="0x", baseFeePerGas=hex(int(record["baseFeePerGas"])))
        payload = PEER["payload"](header, source["rawTransactions"])
        result = rpc(engine, "engine_newPayloadV2", [payload], secret)
        if result["status"] != "VALID" or PEER["forkchoice"](engine, header["hash"], secret) != "VALID":
            raise ValueError(f"Geth rejected C-007 block {number}: {result}")
        parent = header["hash"]
        yield number, parent


def include_pending_post(http, engine, secret):
    # Act as a private block producer. Inspect only the pinned fixture controllers.
    # The operator builds a block only after a wallet sends an actual transaction.
    rpc = PEER["rpc"]
    controllers = ("0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
                   "0x2b5ad5c4795c026514f8317c7a215e218dccd6cf")
    if not any(int(rpc(http, "eth_getTransactionCount", [a, "pending"]),16) >
               int(rpc(http, "eth_getTransactionCount", [a, "latest"]),16) for a in controllers):
        return
    parent = rpc(http, "eth_getBlockByNumber", ["latest", False])
    zero = "0x" + "00" * 32
    choice = dict(headBlockHash=parent["hash"], safeBlockHash=zero, finalizedBlockHash=zero)
    attrs = dict(timestamp=hex(int(parent["timestamp"], 16)+1), prevRandao=zero,
                 suggestedFeeRecipient="0x" + "00"*20, withdrawals=[])
    build = rpc(engine, "engine_forkchoiceUpdatedV2", [choice, attrs], secret)
    if build["payloadStatus"]["status"] != "VALID" or not build.get("payloadId"):
        raise RuntimeError("Geth could not start building the next block")
    # Geth may initially expose an empty candidate while its transaction worker runs.
    time.sleep(0.6)
    candidate = rpc(engine, "engine_getPayloadV2", [build["payloadId"]], secret)["executionPayload"]
    if not candidate["transactions"]:
        return
    result = rpc(engine, "engine_newPayloadV2", [candidate], secret)
    if result["status"] != "VALID" or PEER["forkchoice"](engine, candidate["blockHash"], secret) != "VALID":
        raise RuntimeError("Geth rejected the new wallet transaction block")
    print(f"Included {len(candidate['transactions'])} transaction(s) in {candidate['blockHash']}", flush=True)


def serve_console(geth, output, paid_rpc, produce):
    headers = ROOT / "evidence/wallet-headers-20261112"
    args = [sys.executable, str(HERE / "launch.py"), "--geth", str(geth),
            "--capture", str(headers / "capture.json"), "--genesis", str(headers / "genesis.json"),
            "--registry-proof", str(headers / "evidence.json"),
            "--selection", str(ROOT / "evidence/wallet-state-20261112/selection.json"),
            "--output", str(output), "--paid-post-rpc", paid_rpc]
    print(f"Paid-post wallet RPC: {paid_rpc} (disposable C-007 chain, ready at block 17).", flush=True)
    print("Starting the console. Press Ctrl+C to stop both local chains.", flush=True)
    launcher = subprocess.Popen(args, start_new_session=True)
    try:
        while launcher.poll() is None:
            produce()
            time.sleep(.5)
        code = launcher.returncode
        if code:
            raise RuntimeError(f"Console launcher exited with status {code}")
    except KeyboardInterrupt:
        pass
    finally:
        # The launcher owns its web server and the other fixture node. Give its
        # finally block time to stop those children and write the shutdown log.
        if launcher.poll() is None:
            launcher.send_signal(signal.SIGINT)
            try:
                launcher.wait(timeout=35)
            except subprocess.TimeoutExpired:
                os.killpg(launcher.pid, signal.SIGKILL)
                launcher.wait()
        print("Stopping the paid-post fixture.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geth", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--serve-console", action="store_true",
                      help="hold the paid fixture at block 17 and start the interactive console")
    mode.add_argument("--signing-test", action="store_true",
                      help="exercise the HTTP signing flow at block 17 before completing the replay")
    mode.add_argument("--inclusion-time-test", action="store_true",
                      help="mine one private test post that first becomes valid at inclusion")
    mode.add_argument("--mixed-post-test", action="store_true",
                      help="mine two native self-transfers around a signed paid post and verify its individual credits")
    mode.add_argument("--custody-post-test", action="store_true", help="mine withdrawals on both sides of a paid post")
    args = parser.parse_args()
    geth, out = args.geth.resolve(), args.output.resolve()
    verified_geth(geth)
    node = shutil.which("node")
    if not node or subprocess.check_output([node, "--version"], text=True).strip() != "v20.20.2":
        raise RuntimeError("Expected Node.js 20.20.2")
    if shutil.disk_usage(out.parent).free < 2 * 1024**3:
        raise RuntimeError("Need 2 GiB free before starting the test node")
    allocation = checked_input("genesis.json")["alloc"]
    capture = checked_input("acquired-history.json")["blocks"]
    records = checked_input("blocks.json")["records"]
    genesis = json.loads((ROOT / "evidence/withdrawal-effects-20261116/genesis.json").read_bytes())
    genesis.update(alloc=allocation, timestamp="0x0", baseFeePerGas=hex(1142857142))
    out.mkdir()
    env = dict(os.environ, GOMEMLIMIT="320MiB", GOMAXPROCS="2")
    with tempfile.TemporaryDirectory(prefix="c007-", dir=out) as temporary:
        work = Path(temporary)
        genesis_path, jwt = work / "genesis.json", work / "jwt"
        genesis_path.write_text(json.dumps(genesis))
        secret = secrets.token_bytes(32)
        jwt.write_text(secret.hex())
        jwt.chmod(0o600)
        http, engine, p2p = PEER["ports"]()[:3]
        binary = [str(geth), "--datadir", str(work / "data"), "--cache", "64", "--state.scheme", "hash"]
        # Both JSON-RPC interfaces bind only to loopback. No discovery or peers.
        serve = binary + [
            "--gcmode", "archive", "--networkid", "31337", "--syncmode", "full",
            "--nodiscover", "--netrestrict", "127.0.0.0/8", "--nat", "none", "--maxpeers", "0",
            "--port", str(p2p), "--ipcdisable", "--http", "--http.addr", "127.0.0.1",
            "--http.port", str(http), "--http.api", "eth", "--authrpc.addr", "127.0.0.1",
            "--authrpc.port", str(engine), "--authrpc.jwtsecret", str(jwt),
        ]
        with (out / "geth.log").open("xb") as log:
            subprocess.run(binary + ["init", genesis_path], env=env, check=True, timeout=60,
                           stdout=log, stderr=log)
            proc = subprocess.Popen(serve, env=env, stdout=log, stderr=log, start_new_session=True)
            try:
                for _ in range(100):
                    if proc.poll() is not None:
                        raise RuntimeError("Geth exited during startup. See local geth.log.")
                    try:
                        if PEER["rpc"](http, "eth_chainId", []) == "0x7a69":
                            break
                    except OSError:
                        time.sleep(.1)
                else:
                    raise RuntimeError("C-007 node startup timed out")
                rpc_url = f"http://127.0.0.1:{http}"
                for height, head in replay(http, engine, secret, capture, records):
                    if height == 17 and (args.inclusion_time_test or args.mixed_post_test or args.custody_post_test):
                        timing_test = [node, HERE / "test-paid-post-inclusion-time.mjs"]
                        if args.custody_post_test:
                            timing_test.append("--custody")
                        if args.mixed_post_test:
                            timing_test.append("--mixed")
                        tx_hash = subprocess.check_output(timing_test + ["send", rpc_url],
                                                          text=True, timeout=90).strip()
                        include_pending_post(http, engine, secret)
                        subprocess.run(timing_test + ["verify", rpc_url, tx_hash], cwd=out, check=True, timeout=90)
                        return
                    if height == 17 and (args.serve_console or args.signing_test):
                        current = PEER["rpc"](http, "eth_getBlockByNumber", ["latest", False])
                        if current["hash"] != head or current["number"] != "0x11":
                            raise RuntimeError("Expected the first reviewable C-007 head")
                        if args.serve_console:
                            serve_console(geth, out / "console", rpc_url,
                                          lambda: include_pending_post(http, engine, secret))
                            return
                        subprocess.run([node, HERE / "test-paid-post-http.mjs", rpc_url],
                                       check=True, timeout=90)
                subprocess.run([node, HERE / "test-paid-post-live.mjs", rpc_url],
                               check=True, timeout=90)
                subprocess.run([node, HERE / "test-paid-post-by-hash.mjs", rpc_url, "--historical"],
                               check=True, timeout=90)
            finally:
                PEER["stop"](proc)
    result = {"status": "PASS", "genesis": GENESIS_HASH, "headNumber": 32, "headHash": head,
              "gethSha256": GETH_HASH, "independentOperator": False, "publicNetwork": False}
    if args.signing_test:
        result["httpSigningTest"] = True
    (out / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
