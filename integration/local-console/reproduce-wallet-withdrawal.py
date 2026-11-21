"""Replay the published local fixture up to wallet ownership and mine a wallet withdrawal."""
import argparse
import json
import os
from pathlib import Path
import runpy
import secrets
import shutil
import subprocess
import time

here = Path(__file__).resolve().parent
peer = runpy.run_path(str(here / "reproduce-withdrawal-peer.py"))
rpc = peer["rpc"]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--geth", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument('--mixed', action='store_true', help='Include a signed sibling before the withdrawal and verify its receipt position')
args = parser.parse_args()
count = 2 if args.mixed else 1
suffix = '-mixed' if args.mixed else ''
out = args.output.resolve()
if shutil.disk_usage(out.parent).free < 2 * 1024**3:
    raise RuntimeError("Need 2 GiB free")
exe = args.geth.resolve()
if "Git Commit: 1df30b18d9ed35ee9d28ffd4648442c2204554ad" not in subprocess.check_output([exe,"version"],text=True):
    raise RuntimeError("Expected pinned Geth 1.17.10")
out.mkdir()
blocks = json.loads((peer["FIXTURE"] / "capture.json").read_bytes())["blocks"]
base = [exe,"--datadir",out/"data","--cache","64"]
http, engine, port = peer["ports"]()[:3]
env = dict(os.environ,GOMEMLIMIT="256MiB",GOMAXPROCS="2")
secret = secrets.token_bytes(32)
jwt = out/"jwt"
node = shutil.which("node")
with (out/"geth.log").open("wb") as log:
    subprocess.run(base+["init",peer["EVIDENCE"]/"withdrawal-effects-20261116/genesis.json"],check=True,stdout=log,stderr=log,env=env,timeout=60)
    jwt.write_text(secret.hex())
    jwt.chmod(0o600)
    proc = None
    try:
        proc = subprocess.Popen(base+["--networkid","31337","--syncmode","full","--nodiscover","--maxpeers","0","--port",str(port),
            "--nat","none","--ipcdisable","--http","--http.addr","127.0.0.1","--http.port",str(http),"--http.api","eth",
            "--authrpc.addr","127.0.0.1","--authrpc.port",str(engine),"--authrpc.jwtsecret",jwt],stdout=log,stderr=log,env=env)
        for _ in range(100):
            try:
                if rpc(http,"eth_chainId",[])=="0x7a69":
                    break
            except OSError:
                time.sleep(.1)
        for block in blocks[1:13]:
            header=block["block"]
            answer=rpc(engine,"engine_newPayloadV2",[peer["payload"](header,block["rawTransactions"])],secret)
            if answer["status"]!="VALID" or peer["forkchoice"](engine,header["hash"],secret)!="VALID":
                raise RuntimeError(f"Fixture block {header['number']} failed verification: {answer}")
        subprocess.run([node,here/"capture-fixture-wallet-check.mjs","submit"+suffix,str(http),out],check=True,timeout=30)
        header=blocks[12]["block"]
        choice=dict(headBlockHash=header["hash"],safeBlockHash=peer["ZERO"],finalizedBlockHash=peer["ZERO"])
        attrs=dict(timestamp=hex(int(header["timestamp"],16)+1),prevRandao=peer["ZERO"],
                   suggestedFeeRecipient=header["miner"],withdrawals=[])
        job=rpc(engine,"engine_forkchoiceUpdatedV2",[choice,attrs],secret)
        for _ in range(12):
            payload=rpc(engine,"engine_getPayloadV2",[job["payloadId"]],secret)["executionPayload"]
            if len(payload["transactions"])==count:
                break
            time.sleep(.5)
        if len(payload["transactions"])!=count:
            raise RuntimeError(f"Expected {count} local transactions")
        result=rpc(engine,"engine_newPayloadV2",[payload],secret)
        if result["status"]!="VALID" or peer["forkchoice"](engine,payload["blockHash"],secret)!="VALID":
            raise RuntimeError("Wallet block rejected")
        subprocess.run([node,here/"capture-fixture-wallet-check.mjs","check"+suffix,str(http),out],check=True,timeout=60)
    finally:
        if proc is not None:
            peer["stop"](proc)
        jwt.unlink(missing_ok=True)
