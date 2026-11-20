"""Start two fresh local Geth databases and verify the withdrawal from the receiver."""
import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import time
import urllib.request
from contextlib import ExitStack

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE.parents[1] / "evidence"
FIXTURE = EVIDENCE / "console-withdrawal-20261116"
ZERO = "0x" + "00" * 32


def rpc(port, method, params, secret=None):
    headers = {"Content-Type": "application/json"}
    if secret:
        def enc(data):
            return base64.urlsafe_b64encode(data).rstrip(b"=")
        token = enc(b'{"alg":"HS256","typ":"JWT"}') + b"." + enc(json.dumps({"iat": int(time.time())}).encode())
        headers["Authorization"] = "Bearer " + (token + b"." + enc(hmac.digest(secret, token, "sha256"))).decode()
    body = json.dumps(dict(jsonrpc="2.0", id=1, method=method, params=params)).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{port}", body, headers)
    with urllib.request.urlopen(req, timeout=4) as response:
        reply = json.load(response)
    if "error" in reply:
        raise RuntimeError(f"{method}: {reply['error']}")
    return reply["result"]


def ports():
    with ExitStack() as stack:
        sockets = [stack.enter_context(socket.socket()) for _ in range(6)]
        for s in sockets:
            s.bind(("127.0.0.1", 0))
        return [s.getsockname()[1] for s in sockets]


def stop(proc):
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def payload(h, txs):
    result = {k: h[k] for k in ("parentHash", "stateRoot", "receiptsRoot", "logsBloom", "gasLimit",
                                 "gasUsed", "timestamp", "extraData", "baseFeePerGas", "withdrawals")}
    result.update(blockHash=h["hash"], blockNumber=h["number"], prevRandao=h["mixHash"],
                  feeRecipient=h["miner"], transactions=txs)
    return result


def forkchoice(port, target, secret):
    choice = dict(headBlockHash=target, safeBlockHash=ZERO, finalizedBlockHash=ZERO)
    return rpc(port, "engine_forkchoiceUpdatedV2", [choice, None], secret)["payloadStatus"]["status"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geth", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    out = args.output.resolve()
    exe = args.geth.resolve()
    if shutil.disk_usage(out.parent).free < 2 * 1024**3:
        raise RuntimeError("Need 2 GiB free before starting nodes")
    version = subprocess.check_output([exe, "version"], text=True)
    if "Git Commit: 1df30b18d9ed35ee9d28ffd4648442c2204554ad" not in version:
        raise RuntimeError("Expected the pinned Geth 1.17.10 release")
    out.mkdir()
    node = shutil.which("node")
    subprocess.run([node, HERE / "prepare-withdrawal-checkpoint.mjs", out], check=True)
    checkpoint = json.loads((out / "checkpoint.json").read_bytes())
    target = checkpoint["hash"]
    capture = json.loads((FIXTURE / "capture.json").read_bytes())["blocks"]
    src, src_engine, src_p2p, dst, dst_engine, dst_p2p = ports()
    env = dict(os.environ, GOMEMLIMIT="256MiB", GOMAXPROCS="2")
    with ExitStack() as stack:
        keys = []
        for name, http, engine, peer in [("source", src, src_engine, src_p2p), ("receiver", dst, dst_engine, dst_p2p)]:
            secret = secrets.token_bytes(32)
            keys.append(secret)
            jwt = out / (name + ".jwt")
            jwt.write_text(secret.hex())
            jwt.chmod(0o600)
            stack.callback(jwt.unlink, missing_ok=True)
            cmd = [exe, "--datadir", out / name, "--cache", "64"]
            log = stack.enter_context((out / (name + ".log")).open("wb"))
            subprocess.run(cmd + ["init", EVIDENCE / "withdrawal-effects-20261116/genesis.json"],
                           stdout=log, stderr=log, check=True, env=env, timeout=60)
            proc = subprocess.Popen(cmd + ["--networkid", "31337", "--syncmode", "full", "--nodiscover",
                "--netrestrict", "127.0.0.0/8", "--nat", "none", "--maxpeers", "4", "--port", str(peer),
                "--http", "--http.addr", "127.0.0.1", "--http.port", str(http), "--http.api", "eth,net,admin",
                "--authrpc.addr", "127.0.0.1", "--authrpc.port", str(engine), "--authrpc.jwtsecret", jwt,
                "--ipcdisable", "--verbosity", "4"], stdout=log, stderr=log, env=env)
            stack.callback(stop, proc)
            for _ in range(100):
                if proc.poll() is not None:
                    raise RuntimeError(name + " exited. See node log.")
                try:
                    if rpc(http, "eth_chainId", []) == "0x7a69":
                        break
                except OSError:
                    pass
                time.sleep(.1)
            genesis = rpc(http, "eth_getBlockByNumber", ["latest", False])
            if genesis["number"] != "0x0" or genesis["hash"] != capture[0]["block"]["hash"]:
                raise RuntimeError(name + " did not start at the fixture genesis")
        # Only the source receives execution payloads. The receiver gets a head hint only.
        child = json.loads((out / "child.json").read_bytes())
        for b in capture[1:] + [dict(block=child, rawTransactions=[])]:
            h = b["block"]
            result = rpc(src_engine, "engine_newPayloadV2", [payload(h, b["rawTransactions"])], keys[0])
            if result["status"] != "VALID" or result["latestValidHash"] != h["hash"]:
                raise RuntimeError(f"Source rejected block {h['number']}: {result}")
            if forkchoice(src_engine, h["hash"], keys[0]) != "VALID":
                raise RuntimeError("Source fork choice failed")
        if rpc(dst, "eth_getBlockByHash", [target, False]) is not None:
            raise RuntimeError("Receiver already knows checkpoint")
        enode = rpc(src, "admin_nodeInfo", [])["enode"].split("@")[0] + f"@127.0.0.1:{src_p2p}"
        if not rpc(dst, "admin_addPeer", [enode]):
            raise RuntimeError("Peer not added")
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            status = forkchoice(dst_engine, target, keys[1])
            tip = rpc(dst, "eth_getBlockByNumber", ["latest", False])
            if status == "VALID" and tip["hash"] == target:
                break
            time.sleep(1)
        else:
            raise RuntimeError("Peer sync timed out. See receiver.log")
        selection = json.loads((FIXTURE / "withdrawal-selection.json").read_bytes())
        # Reacquire the signed transaction, receipt and all ten account proofs.
        # Only the field selection and claimed balances come from the original;
        # the offline verifier checks those claims against the receiver's roots.
        bundle = json.loads((out / "proofs.json").read_bytes())
        ev = bundle["evidence"]
        for side, pin in [("before", selection["startHash"]), ("after", selection["endHash"])]:
            boundary = ev[side]
            block = rpc(dst, "eth_getBlockByNumber", [boundary["header"]["number"], False])
            if block["hash"] != pin:
                raise RuntimeError("Receiver canonical block does not match selection")
            boundary["header"] = {k: block[k] for k in boundary["header"]}
            for name, old in list(boundary["proofs"].items()):
                slots = [s["key"] for s in old["storageProof"]]
                boundary["proofs"][name] = rpc(dst, "eth_getProof", [old["address"], slots,
                    {"blockHash": pin, "requireCanonical": True}])
        tx = selection["transactionHash"]
        ev["rawTransactions"] = [rpc(dst, "eth_getRawTransactionByHash", [tx])]
        receipt = rpc(dst, "eth_getTransactionReceipt", [tx])
        ev["receipts"] = [{k: receipt[k] for k in ev["receipts"][0]}]
        ev["receipts"][0]["logs"] = [{k: entry[k] for k in ("address", "topics", "data")} for entry in receipt["logs"]]
        (out / "receiver-proofs.json").write_text(json.dumps(bundle))
        read_headers = subprocess.check_output([node, HERE / "collect-checkpoint-headers.mjs",
            f"http://127.0.0.1:{dst}", selection["startHash"], target], timeout=40)
        (out / "headers.json").write_bytes(read_headers)
        checked = json.loads(subprocess.check_output([node, HERE / "verify-withdrawal-package.mjs",
            out / "receiver-proofs.json", FIXTURE / "withdrawal-selection.json", out / "headers.json", target], timeout=40))
        if checked["checkpoint"] != dict(hash=target, headerCount=3, withdrawalAncestryVerified=True, finalityVerified=False):
            raise RuntimeError("Unexpected verifier result")
        result = dict(checkpoint=checkpoint, receiverInitialHeight=0, receiverInitiallyHadCheckpoint=False,
            receiverSyncedHeight=int(tip["number"], 16), receiverPeerCount=int(rpc(dst, "net_peerCount", []),16),
            withdrawalBlockHash=selection["endHash"], withdrawalTransaction=selection["transactionHash"],
            headersSha256=hashlib.sha256(read_headers).hexdigest(), verifier=checked["checkpoint"],
            receiverAccountProofs=10, receiverSignedTransactions=1, receiverReceipts=1,
            gethCommit="1df30b18d9ed35ee9d28ffd4648442c2204554ad",
            independentlyOperatedCheckpoint=False, historicalDescendantVerified=False)
        (out / "result.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
