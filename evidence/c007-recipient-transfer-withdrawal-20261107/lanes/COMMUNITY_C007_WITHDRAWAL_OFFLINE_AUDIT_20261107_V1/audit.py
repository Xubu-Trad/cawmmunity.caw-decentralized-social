#!/usr/bin/env python3
import hashlib, json, sys
from pathlib import Path

w,b,s,p,v,o,mode = sys.argv[1:]
assert mode in ("create","verify")

def load(path):
    return json.loads(Path(path).read_bytes())

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def word(n):
    n=int(n,16) if isinstance(n,str) else int(n)
    return n.to_bytes(32,"big")

base=load(b)
intent=load(s)
prior=load(p)
run=load(v)
pair=run["paired_comparison"]
normalized=load(str(Path(v).with_name("withdrawal.json")))

assert base["schema"]=="caw-c007-wsl-funding-staking/1"
assert run["schema"]=="caw-c007-wsl-paired-withdrawal/1"
assert normalized["schema"]=="caw-c007-withdrawal-comparison/2"
assert len(run["transactions"])==run["local_transactions"]==17

oracle=Path(w)/"reference/fixtures/generate-ethereum-proof-fixtures.py"
ns={"__name__":"caw_independent_keccak","__file__":str(oracle)}
exec(compile(oracle.read_bytes(),str(oracle),"exec"),ns)
keccak=ns["digest"]
assert keccak(b"").hex()==(
    "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
)

build=load(str(Path(w)/"experiments/paid-action/paid-build.json"))
selector=build["contracts"]["CawPaidActionProbe"][
    "methodIdentifiers"]["withdraw(uint256,uint256,uint256)"]
assert selector==keccak(b"withdraw(uint256,uint256,uint256)")[:4].hex()

A=base["owners"]["1"]
B=base["owners"]["3"]
probe=base["probe"]
token="0xf3b9569f82b18aef890de263b84189bd33ebe452"
amount=100*10**18

assert base["owners"]=={"1":A,"2":A,"3":B}
assert intent["signer"]==A
assert pair["control"]["owner2"]==A
assert pair["treatment"]["owner2"]==B
assert pair["control"]["epoch2"]==0
assert pair["treatment"]["epoch2"]==1

assert pair["control"]["posted"]==pair["treatment"]["posted"]
assert pair["control"]["post_state"]==pair["treatment"]["post_state"]
assert pair["control"]["posted"]==prior["control"]["posted"]
assert pair["control"]["post_state"]==prior["control"]["post_state"]

txs=run["transactions"]
assert [x["label"] for x in txs[-5:]]==[
    "control_signed_post",
    "control_B_withdraw_rejected",
    "treatment_nft2_transfer",
    "treatment_signed_post",
    "treatment_B_withdraw"
]

control=pair["control"]["withdrawal"]
treatment=pair["treatment"]["withdrawal"]
assert normalized["control"]==control
assert normalized["treatment"]==treatment

error="0x"+keccak(b"NotAccountOwner()")[:4].hex()
assert control["dry_error"]["data"].lower()==error
assert pair["control_revert_selector"].lower()==error

def expected_call(epoch):
    return "0x"+selector+(word(2)+word(epoch)+word(amount)).hex()

for item,tx,epoch,status in [
    (control,txs[-4],0,"0x0"),
    (treatment,txs[-1],1,"0x1")
]:
    assert item["request"]==tx["request"]
    assert item["receipt"]==tx["receipt"]
    assert tx["request"]["from"].lower()==B
    assert tx["request"]["to"].lower()==probe
    assert tx["request"]["data"].lower()==expected_call(epoch)
    assert tx["receipt"]["from"].lower()==B
    assert tx["receipt"]["to"].lower()==probe
    assert tx["receipt"]["status"]==status
    assert item["status"]==status

assert control["receipt"]["logs"]==[]
assert control["state_unchanged"] is True
assert treatment["events_verified"] is True
assert treatment["accounting_conserved"] is True

post=pair["treatment"]["post_state"]
after=treatment["after"]

assert post["credits"][1]-post["stakes"][1]>=amount
expected=dict(post)
expected["credits"]=post["credits"][:]
expected["credits"][1]-=amount
expected["totalCredits"]-=amount
expected["vault"]-=amount
expected["balanceB"]+=amount

assert after==expected
assert sum(after["credits"])==after["totalCredits"]
assert after["vault"]==after["totalCredits"]+after["poolDust"]
assert treatment["recipient_balance_delta"]==amount
assert treatment["vault_delta"]==-amount
assert int(treatment["amount"])==amount

def event(signature,indexed,values):
    return (
        ["0x"+keccak(signature.encode()).hex()]
        + ["0x"+word(x).hex() for x in indexed],
        "0x"+b"".join(word(x) for x in values).hex()
    )

logs=treatment["receipt"]["logs"]
assert len(logs)==2

checks=[
    (logs[0],token,*event(
        "Transfer(address,address,uint256)",
        [probe,B],[amount]
    )),
    (logs[1],probe,*event(
        "Withdrawn(uint256,address,uint256,uint256,uint256)",
        [2,B],[amount,after["credits"][1],1]
    ))
]

for row,emitter,topics,data in checks:
    assert row["address"].lower()==emitter
    assert [x.lower() for x in row["topics"]]==topics
    assert row["data"].lower()==data

report={
    "schema":"caw-c007-withdrawal-independent-audit/1",
    "parent_results_sha256":sha(Path(v).read_bytes()),
    "parent_intent_sha256":sha(Path(s).read_bytes()),
    "control_receipt":"0x0",
    "treatment_receipt":"0x1",
    "control_revert_selector":error,
    "withdrawal_amount_base_units":str(amount),
    "recipient_balance_delta":str(amount),
    "vault_balance_delta":str(-amount),
    "posted_events_equal":True,
    "post_states_equal":True,
    "withdrawal_event_bytes_valid":True,
    "withdrawal_accounting_conserved":True,
    "original_rpc_execution_rerun":False,
    "synthetic_only":True,
    "c007":"OPEN"
}
raw=(json.dumps(report,sort_keys=True,indent=2)+"\n").encode()

if mode=="create":
    with open(o,"xb") as f: f.write(raw)
else:
    assert Path(o).read_bytes()==raw

print("CONTROL_REVERT_SELECTOR=PASS")
print("WITHDRAWAL_CALLDATA=PASS")
print("BOTH_RECEIPTS=PASS")
print("WITHDRAWAL_EVENT_BYTES=PASS")
print("TOKEN_AND_CREDIT_DELTAS=PASS")
print("POST_STATES_EQUAL=PASS")
print("ACCOUNTING_CONSERVATION=PASS")
print("BYTE_REPLAY="+("PASS" if mode=="verify" else "PENDING"))
print("C007=OPEN")
