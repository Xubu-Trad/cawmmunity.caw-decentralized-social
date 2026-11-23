#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec, utils

w, bf, sf, pf, cf, output = map(Path, sys.argv[1:7])
mode = sys.argv[7]
assert mode in ("create", "verify")

def sha(b):
    return hashlib.sha256(b).hexdigest()

def word(n):
    n = int(n, 16) if isinstance(n, str) else int(n)
    return n.to_bytes(32, "big")

def blob(b):
    return word(len(b)) + b + bytes((-len(b)) % 32)

base = json.loads(bf.read_bytes())
intent = json.loads(sf.read_bytes())
run = json.loads(pf.read_bytes())
comp = json.loads(cf.read_bytes())

assert sha(sf.read_bytes()) == (
    "0e4eff27c90454790ce8f0447219dedca42c02f1c64da00fa201720d32a8922a"
)
assert base["schema"] == "caw-c007-wsl-funding-staking/1"
assert run["schema"] == "caw-c007-wsl-paired-post/1"
assert run["paired_comparison"] == comp
assert run["post_staking"] == base["post_staking"]
assert run["local_transactions"] == 15
assert len(run["transactions"]) == 15

assert intent["parent_baseline_sha256"] == sha(bf.read_bytes())
assert comp["parent_baseline_sha256"] == sha(bf.read_bytes())
assert comp["parent_intent_sha256"] == sha(sf.read_bytes())

A = base["owners"]["1"]
B = base["owners"]["3"]
probe = base["probe"]

assert base["owners"] == {"1": A, "2": A, "3": B}
assert comp["payer"] == A == intent["signer"]
assert comp["recipient_account"] == 2
assert comp["recipient_before"] == A
assert comp["recipient_after"] == B
assert comp["signature_hex"] == intent["signature"]
assert intent["probe"] == probe
assert intent["chain_id"] == 31337
assert (
    intent["accountId"], intent["epoch"], intent["nonce"]
) == (1, 0, 0)
assert intent["distributionHash"] == base["distributionHash"]

oracle = w / "reference/fixtures/generate-ethereum-proof-fixtures.py"
ns = {
    "__name__": "caw_keccak_offline_audit",
    "__file__": str(oracle)
}
exec(compile(oracle.read_bytes(), str(oracle), "exec"), ns)
k = ns["digest"]

assert k(b"").hex() == (
    "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
)

txt = bytes.fromhex(intent["text_hex"])
fee = int(intent["fee"])
dist = intent["distributionHash"]

domain_type = (
    b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
)
post_type = (
    b"Post(uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,"
    b"uint256 deadline,bytes32 distributionHash,bytes32 textHash,uint256 fee,bytes32 profile)"
)

domain = k(
    k(domain_type)
    + k(b"CAW Paid Action Experiment")
    + k(b"1")
    + word(31337)
    + word(probe)
)

body = k(
    k(post_type)
    + word(1) + word(0) + word(0)
    + word(intent["validAfter"])
    + word(intent["deadline"])
    + word(dist)
    + k(txt)
    + word(fee)
    + k(b"CAW_PAID_ACTION_THREE_ID_POOL_LOCKED_STAKE_UTF8_SCALARS_V1")
)

digest = k(b"\x19\x01" + domain + body)
assert "0x" + digest.hex() == intent["digest"] == comp["digest"]

sig = bytes.fromhex(intent["signature"][2:])
assert len(sig) == 65 and sig[64] in (27, 28)

r = int.from_bytes(sig[:32], "big")
s = int.from_bytes(sig[32:64], "big")
assert 1 <= s <= (
    0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0
)

key = ec.derive_private_key(0x1337ca200001, ec.SECP256K1())
key.public_key().verify(
    utils.encode_dss_signature(r, s),
    digest,
    ec.ECDSA(utils.Prehashed(hashes.SHA256()))
)

xy = key.public_key().public_numbers()
assert "0x" + k(word(xy.x) + word(xy.y))[-20:].hex() == A

build = json.loads(
    (w / "experiments/paid-action/paid-build.json").read_bytes()
)
selectors = build["contracts"]["CawPaidActionProbe"]["methodIdentifiers"]

post_sig = (
    "post((uint256,uint256,uint256,uint256,uint256,bytes32,bytes),bytes)"
)
digest_sig = (
    "postDigest((uint256,uint256,uint256,uint256,uint256,bytes32,bytes))"
)

tup = (
    word(1) + word(0) + word(0)
    + word(intent["validAfter"])
    + word(intent["deadline"])
    + word(dist)
    + word(224) + blob(txt)
)

post_bytes = (
    bytes.fromhex(selectors[post_sig])
    + word(64)
    + word(64 + len(tup))
    + tup
    + blob(sig)
)

digest_bytes = bytes.fromhex(selectors[digest_sig]) + word(32) + tup

assert "0x" + post_bytes.hex() == intent["post_calldata"]
assert "0x" + digest_bytes.hex() == intent["postDigest_calldata"]
assert sha(post_bytes) == comp["signed_calldata_sha256"]

state = {
    key: [int(v) for v in value] if isinstance(value, list) else int(value)
    for key, value in base["post_staking"].items()
}

assert state["stakes"] == [10 * 10**18, 10**18, 2 * 10**18]
assert state["nonces"] == [0, 0, 0]
assert state["messageCount"] == 0
assert state["vault"] == state["totalCredits"] == sum(state["credits"])
assert k(b"".join(word(v) for v in state["stakes"])) == bytes.fromhex(dist[2:])

alloc2 = fee * state["stakes"][1] // sum(state["stakes"][1:])
alloc3 = fee * state["stakes"][2] // sum(state["stakes"][1:])
dust = fee - alloc2 - alloc3

assert [alloc2, alloc3, dust] == [
    int(comp["allocation_id2"]),
    int(comp["allocation_id3"]),
    int(comp["dust"])
]
assert dust == 1

expected = dict(state)
expected["credits"] = [
    state["credits"][0] - fee,
    state["credits"][1] + alloc2,
    state["credits"][2] + alloc3
]
expected["nonces"] = [1, 0, 0]
expected["messageCount"] = 1
expected["poolDust"] = state["poolDust"] + dust
expected["totalCredits"] = state["totalCredits"] - dust

assert sum(expected["credits"]) == expected["totalCredits"]
assert expected["vault"] == expected["totalCredits"] + expected["poolDust"]

event_type = (
    b"Posted(uint256,uint256,address,uint256,uint256,bytes,"
    b"uint256,bytes32,uint256,uint256,uint256,uint256)"
)

topics = [
    "0x" + k(event_type).hex(),
    "0x" + word(1).hex(),
    "0x" + word(1).hex(),
    "0x" + word(A).hex()
]

event_data = (
    b"".join(
        word(v) for v in [
            0, 0, 288, fee, dist, 0, alloc2, alloc3, dust
        ]
    ) + blob(txt)
)

assert comp["post_time"] == 1900000000
assert intent["validAfter"] <= comp["post_time"] < intent["deadline"]

transactions = run["transactions"]
assert [tx["label"] for tx in transactions[-3:]] == [
    "control_signed_post",
    "treatment_nft2_transfer",
    "treatment_signed_post"
]

for branch, index, owner, epoch, block in [
    ("control", -3, A, 0, 13),
    ("treatment", -1, B, 1, 14)
]:
    branch_result = comp[branch]
    tx = transactions[index]
    receipt = tx["receipt"]

    assert branch_result["owner2"] == owner
    assert branch_result["epoch2"] == epoch
    assert branch_result["onchain_digest"] == intent["digest"]
    assert branch_result["recovered_signer"] == A
    assert branch_result["post_timestamp"] == comp["post_time"]
    assert branch_result["receipt_status"] == receipt["status"] == "0x1"

    assert tx["request"]["data"] == intent["post_calldata"]
    assert tx["request"]["from"] == "0x" + "3" * 40
    assert int(receipt["blockNumber"], 16) == block
    assert branch_result["post_state"] == expected
    assert branch_result["gas_used"] == int(receipt["gasUsed"], 16)

    assert branch_result["posted"] == {
        "topics": topics,
        "data": "0x" + event_data.hex()
    }
    assert len(receipt["logs"]) == 1
    log = receipt["logs"][0]
    assert log["address"].lower() == probe
    assert [t.lower() for t in log["topics"]] == topics
    assert log["data"].lower() == "0x" + event_data.hex()

transfer = transactions[-2]
assert transfer["request"]["from"].lower() == A
assert transfer["request"]["to"].lower() == base["registry"]
assert transfer["receipt"]["status"] == "0x1"
assert comp["recipient_transfer_receipt_status"] == "0x1"
assert int(transfer["receipt"]["blockNumber"], 16) == 13

selector = build["contracts"]["TestAccountRegistry"][
    "methodIdentifiers"
]["transferFrom(address,address,uint256)"]

assert transfer["request"]["data"] == (
    "0x" + selector + (word(A) + word(B) + word(2)).hex()
)

logs = transfer["receipt"]["logs"]
assert len(logs) == 2

for name, indexed, log in [
    (b"Approval(address,address,uint256)", [A, 0, 2], logs[0]),
    (b"Transfer(address,address,uint256)", [A, B, 2], logs[1])
]:
    assert log["address"].lower() == base["registry"]
    assert log["data"] == "0x"
    assert [t.lower() for t in log["topics"]] == [
        "0x" + k(name).hex()
    ] + ["0x" + word(v).hex() for v in indexed]

assert comp["control"]["posted"] == comp["treatment"]["posted"]
assert comp["control"]["post_state"] == comp["treatment"]["post_state"]
assert comp["control_branch_reverted"] is True
assert comp["withdrawal_tested"] is False
assert comp["synthetic_only"] is True
assert comp["c007"] == "OPEN"

report = {
    "schema": "caw-c007-independent-offline-replay/1",
    "parent_baseline_sha256": sha(bf.read_bytes()),
    "parent_intent_sha256": sha(sf.read_bytes()),
    "parent_results_sha256": sha(pf.read_bytes()),
    "parent_comparison_sha256": sha(cf.read_bytes()),
    "digest": intent["digest"],
    "signed_calldata_sha256": sha(post_bytes),
    "control_post_receipt": "0x1",
    "treatment_post_receipt": "0x1",
    "recipient_owner_control": A,
    "recipient_owner_treatment": B,
    "allocation_id2": str(alloc2),
    "allocation_id3": str(alloc3),
    "dust_base_units": str(dust),
    "posted_event_equal": True,
    "account_credit_state_equal": True,
    "wallet_withdrawal_rights_verified": False,
    "evm_rerun": False,
    "c007": "OPEN"
}

encoded = (
    json.dumps(report, indent=2, sort_keys=True) + "\n"
).encode()

if mode == "create":
    with output.open("xb") as f:
        f.write(encoded)
else:
    assert output.read_bytes() == encoded, "NONDETERMINISTIC_AUDIT"

print("EIP712_DIGEST_RECOMPUTED=PASS")
print("SIGNED_CALLDATA_RECONSTRUCTED=PASS")
print("BRANCH_RECEIPTS=PASS")
print("POST_EVENT_BYTES=PASS")
print("NFT_TRANSFER_EVENTS=PASS")
print("ACCOUNTING_RECALCULATION=PASS")
print("OWNER2_DIFFERENCE=VERIFIED_IN_RECORD")
print("WITHDRAWAL=NOT_RUN")
print("BYTE_REPLAY=" + ("PASS" if mode == "verify" else "NOT_YET_RUN"))
print("PASS: C007 independent offline audit " + mode)
