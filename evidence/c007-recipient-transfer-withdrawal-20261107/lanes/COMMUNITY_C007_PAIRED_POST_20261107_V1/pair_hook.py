# Executed inside the pinned, already verified WSL baseline runner.
# Control and treatment differ only by transfer of NFT account ID 2.
import os
import json
from pathlib import Path

INTENT_FILE = Path(os.environ["C007_INTENT_FILE"])
BASELINE_FILE = Path(os.environ["C007_BASELINE_FILE"])

assert sha(INTENT_FILE.read_bytes()) == (
    "0e4eff27c90454790ce8f0447219dedca42c02f1c64da00fa201720d32a8922a"
)

intent = json.loads(INTENT_FILE.read_bytes())
baseline = json.loads(BASELINE_FILE.read_bytes())

assert intent["schema"] == "caw-c007-signed-intent/1"
assert intent["parent_baseline_sha256"] == sha(BASELINE_FILE.read_bytes())
assert baseline["schema"] == "caw-c007-wsl-funding-staking/1"
assert baseline["post_staking"] == result["post_staking"]
assert baseline["registry"] == registry
assert baseline["probe"] == probe
assert intent["probe"] == probe
assert intent["signer"] == A
assert intent["chain_id"] == 31337
assert intent["accountId"] == 1
assert intent["epoch"] == 0
assert intent["nonce"] == 0
assert intent["distributionHash"] == result["distributionHash"]

POST_TIME = 1900000000
assert intent["validAfter"] <= POST_TIME < intent["deadline"]

POST_DATA = intent["post_calldata"]
DIGEST_DATA = intent["postDigest_calldata"]
DIGEST = intent["digest"]

assert POST_DATA.startswith("0x")
assert DIGEST_DATA.startswith("0x")
assert len(bytes.fromhex(DIGEST[2:])) == 32

sig = bytes.fromhex(intent["signature"][2:])
assert len(sig) == 65
assert sig[64] in (27, 28)
assert int.from_bytes(sig[32:64], "big") <= (
    0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0
)

text = bytes.fromhex(intent["text_hex"])
assert len(text) > 0

ALLOC2 = FEE * STAKES[2] // (STAKES[2] + STAKES[3])
ALLOC3 = FEE * STAKES[3] // (STAKES[2] + STAKES[3])
DUST = FEE - ALLOC2 - ALLOC3

assert DUST == 1

allowed.update({
    "eth_getBlockByNumber",
    "evm_snapshot",
    "evm_revert",
    "evm_setNextBlockTimestamp"
})

def auth(account):
    raw = view(registry, "authority(uint256)", account)
    assert len(raw) == 64
    return {
        "owner": addr(raw[:32]),
        "epoch": int.from_bytes(raw[32:], "big")
    }

def ethcall(to, data):
    return rpc("eth_call", [{
        "from": D,
        "to": to,
        "gas": "0x3d0900",
        "data": data
    }, "latest"])

def verify_digest_and_recovery():
    actual = ethcall(probe, DIGEST_DATA)
    assert actual.lower() == DIGEST.lower()

    recover_input = (
        bytes.fromhex(DIGEST[2:])
        + word(sig[64])
        + sig[:64]
    )

    recovered = ethcall(
        "0x" + "0" * 39 + "1",
        "0x" + recover_input.hex()
    )

    assert int(recovered, 16) == int(A, 16)
    return actual

def verify_post_log(receipt):
    assert len(receipt["logs"]) == 1

    log = receipt["logs"][0]
    assert log["address"].lower() == probe

    topic = "0x" + keccak(
        b"Posted(uint256,uint256,address,uint256,uint256,bytes,"
        b"uint256,bytes32,uint256,uint256,uint256,uint256)"
    ).hex()

    assert [x.lower() for x in log["topics"]] == [
        topic, "0x" + word(1).hex(),
        "0x" + word(1).hex(),
        "0x" + word(A).hex()
    ]

    raw = bytes.fromhex(log["data"][2:])
    expected_head = b"".join([
        word(0), word(0), word(288),
        word(FEE),
        word(intent["distributionHash"]),
        word(0), word(ALLOC2), word(ALLOC3), word(DUST)
    ])
    expected_tail = (
        word(len(text))
        + text
        + bytes((-len(text)) % 32)
    )

    assert raw == expected_head + expected_tail

    return {
        "topics": [x.lower() for x in log["topics"]],
        "data": log["data"].lower()
    }

def verify_post_state(state):
    assert state["credits"] == [
        DEPOSITS[1] - FEE,
        DEPOSITS[2] + ALLOC2,
        DEPOSITS[3] + ALLOC3
    ]
    assert state["stakes"] == [
        STAKES[i] for i in (1, 2, 3)
    ]
    assert state["nonces"] == [1, 0, 0]
    assert state["messageCount"] == 1
    assert state["poolDust"] == DUST
    assert state["totalCredits"] == sum(DEPOSITS.values()) - DUST
    assert state["vault"] == sum(DEPOSITS.values())
    assert state["vault"] == (
        state["totalCredits"] + state["poolDust"]
    )
    for field in (
        "balanceA", "balanceB", "allowanceA", "allowanceB"
    ):
        assert state[field] == final[field]

def execute_branch(label, expected_owner, expected_epoch):
    assert snapshot() == final
    assert auth(1) == {"owner": A, "epoch": 0}
    assert auth(2) == {
        "owner": expected_owner, "epoch": expected_epoch
    }
    assert auth(3) == {"owner": B, "epoch": 0}

    assert view(probe, "distributionHash()") == bytes.fromhex(
        intent["distributionHash"][2:]
    )

    onchain_digest = verify_digest_and_recovery()

    # eth_call must not mutate state.
    assert ethcall(probe, POST_DATA) == "0x"
    assert snapshot() == final

    # Equal posting time in both branches.
    rpc("evm_setNextBlockTimestamp", [POST_TIME])

    receipt = send(
        D, probe, POST_DATA, label + "_signed_post"
    )
    posted = verify_post_log(receipt)

    header = rpc(
        "eth_getBlockByNumber",
        [receipt["blockNumber"], False]
    )
    assert int(header["timestamp"], 16) == POST_TIME

    state = snapshot()
    verify_post_state(state)

    assert auth(1) == {"owner": A, "epoch": 0}
    assert auth(2) == {
        "owner": expected_owner, "epoch": expected_epoch
    }

    return {
        "owner2": expected_owner,
        "epoch2": expected_epoch,
        "onchain_digest": onchain_digest.lower(),
        "recovered_signer": A,
        "post_timestamp": POST_TIME,
        "receipt_status": receipt["status"],
        "gas_used": int(receipt["gasUsed"], 16),
        "posted": posted,
        "post_state": state
    }

latest = rpc("eth_getBlockByNumber", ["latest", False])
assert int(latest["timestamp"], 16) < POST_TIME
assert int(latest["number"], 16) == 12

snapshot_id = rpc("evm_snapshot", [])
assert snapshot_id is not None

control = execute_branch("control", A, 0)

assert rpc("evm_revert", [snapshot_id]) is True
assert int(rpc("eth_blockNumber", []), 16) == 12
assert snapshot() == final
assert auth(2) == {"owner": A, "epoch": 0}

# Only experiment variable: transfer recipient NFT account 2.
nft_selector = build["contracts"][
    "TestAccountRegistry"
]["methodIdentifiers"]["transferFrom(address,address,uint256)"]

transfer_receipt = send(
    A, registry,
    calldata(nft_selector, A, B, 2),
    "treatment_nft2_transfer"
)

assert len(transfer_receipt["logs"]) == 2

check_event(
    transfer_receipt["logs"][0],
    registry,
    "Approval(address,address,uint256)",
    [A, 0, 2],
    []
)
check_event(
    transfer_receipt["logs"][1],
    registry,
    "Transfer(address,address,uint256)",
    [A, B, 2],
    []
)

assert auth(1) == {"owner": A, "epoch": 0}
assert auth(2) == {"owner": B, "epoch": 1}
assert auth(3) == {"owner": B, "epoch": 0}
assert snapshot() == final

treatment = execute_branch("treatment", B, 1)

assert control["onchain_digest"] == treatment["onchain_digest"]
assert control["post_timestamp"] == treatment["post_timestamp"]
assert control["receipt_status"] == treatment["receipt_status"] == "0x1"
assert control["posted"] == treatment["posted"]
assert control["post_state"] == treatment["post_state"]

assert len(transactions) == 15
assert owns_listener(proc.pid)

pair = {
    "schema": "caw-c007-paired-recipient-transfer/1",
    "parent_intent_sha256": sha(INTENT_FILE.read_bytes()),
    "parent_baseline_sha256": sha(BASELINE_FILE.read_bytes()),
    "signed_calldata_sha256": sha(bytes.fromhex(POST_DATA[2:])),
    "signature_hex": intent["signature"],
    "digest": DIGEST,
    "payer": A,
    "recipient_before": A,
    "recipient_after": B,
    "recipient_account": 2,
    "post_time": POST_TIME,
    "allocation_id1": "0",
    "allocation_id2": str(ALLOC2),
    "allocation_id3": str(ALLOC3),
    "dust": str(DUST),
    "control": control,
    "treatment": treatment,
    "control_branch_reverted": True,
    "recipient_transfer_receipt_status": transfer_receipt["status"],
    "post_acceptance_equal": True,
    "posted_event_equal": True,
    "accounting_equal": True,
    "payer_authority_unchanged": True,
    "ownership_change_only_comparison": True,
    "synthetic_only": True,
    "withdrawal_tested": False,
    "owner_exclusion_policy_adopted": False,
    "c007": "OPEN"
}

result["schema"] = "caw-c007-wsl-paired-post/1"
result["paired_comparison"] = pair
result["baseline_local_transactions"] = 12
result["local_transactions"] = len(transactions)
result["posts_executed"] = True
result["nft_transfers_executed"] = True
result["signature_verification"] = "ONCHAIN_ECRECOVER_PASS"

print("ONCHAIN_DIGEST=PASS")
print("ONCHAIN_ECRECOVER=PASS")
print("IDENTICAL_SIGNED_CALLDATA=PASS")
print("CONTROL_POST_RECEIPT=PASS")
print("NFT2_OWNER_CHANGE=PASS")
print("TREATMENT_POST_RECEIPT=PASS")
print("POST_TIMESTAMP_EQUAL=PASS")
print("POST_EVENTS_EQUAL=PASS")
print("ALLOCATIONS_EQUAL=PASS")
print("ACCOUNTING_CONSERVATION=PASS")
print("ALLOCATION_ID2=" + str(ALLOC2))
print("ALLOCATION_ID3=" + str(ALLOC3))
print("DUST=" + str(DUST))
