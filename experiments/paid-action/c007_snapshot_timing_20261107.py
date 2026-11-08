#!/usr/bin/env python3
import hashlib
import json
import sys
from fractions import Fraction
from pathlib import Path

worktree, parent, output, commit = sys.argv[1:]
w, p, o = map(Path, (worktree, parent, output))

source_path = w / "experiments/paid-action/CawPaidActionProbe.sol"
source = source_path.read_text()

assert "return keccak256(abi.encode(stakes[1], stakes[2], stakes[3]));" in source
assert "if (id != payer) eligible += stakes[id];" in source
assert "address owner = _ownerAt(request.accountId, request.epoch);" in source

base = json.loads((p / "results.json").read_text())
assert base["parent_commit"] == "7d93e0c74cd18308bd3057f4cdf79d82365aa8cd"

fee = 5000 * 10**18
assert int(base["fee_base_units"]) == fee

accounts = {a["id"]: a for a in base["accounts"]}
assert sorted(accounts) == [1, 2, 3]
assert [accounts[i]["owner"] for i in (1, 2, 3)] == ["A", "A", "B"]
assert [accounts[i]["stake"] for i in (1, 2, 3)] == [
    10**19, 10**18, 2 * 10**18
]

# Fixed event: NFT 2 transfers A -> B after signing.
signing_owners = {1: "A", 2: "A", 3: "B"}
execution_owners = {1: "A", 2: "B", 3: "B"}

# One variable: which ownership snapshot defines eligibility.
# The wallet-owner rule here is hypothetical, not adopted.
def allocate(owners):
    payer_owner = owners[1]
    eligible = [
        i for i in (1, 2, 3)
        if owners[i] != payer_owner
    ]
    pool = sum(accounts[i]["stake"] for i in eligible)
    assert pool > 0

    amounts = {}
    for i in (1, 2, 3):
        amount = (
            fee * accounts[i]["stake"] // pool
            if i in eligible else 0
        )
        oracle = (
            int(Fraction(fee * accounts[i]["stake"], pool))
            if i in eligible else 0
        )
        assert amount == oracle
        amounts[str(i)] = amount

    dust = fee - sum(amounts.values())
    assert dust >= 0
    assert sum(amounts.values()) + dust == fee

    return {
        "eligible_ids": eligible,
        "allocations_base_units": {
            k: str(v) for k, v in amounts.items()
        },
        "dust_base_units": str(dust),
    }

signing = allocate(signing_owners)
execution = allocate(execution_owners)

assert signing["eligible_ids"] == [3]
assert execution["eligible_ids"] == [2, 3]

assert signing["allocations_base_units"]["2"] == "0"
assert signing["allocations_base_units"]["3"] == str(fee)
assert signing["dust_base_units"] == "0"

assert execution["allocations_base_units"]["2"] == str(fee // 3)
assert execution["allocations_base_units"]["3"] == str(2 * fee // 3)
assert execution["dust_base_units"] == "1"

assert allocate(signing_owners) == signing
assert allocate(execution_owners) == execution

result = {
    "schema": "caw-c007-owner-snapshot-timing/1",
    "parent_commit": commit,
    "source_sha256": hashlib.sha256(
        source_path.read_bytes()
    ).hexdigest(),
    "policy": "HYPOTHETICAL wallet-owner exclusion",
    "variable": "owner snapshot selected at signing or execution",
    "fixed_event": "NFT2 transfers A to B between signing and execution",
    "fixed_stakes_base_units": {
        str(i): str(accounts[i]["stake"]) for i in (1, 2, 3)
    },
    "fixed_fee_base_units": str(fee),
    "signing_owners": signing_owners,
    "execution_owners": execution_owners,
    "signing_snapshot": signing,
    "execution_snapshot": execution,
    "payer_owner_unchanged": True,
    "stake_vector_unchanged": True,
    "source_stake_only_commitment": True,
    "actual_signature_digest_computed": False,
    "evm_executed": False,
    "production_policy_adopted": False,
    "c007": "OPEN",
}

(o / "results.json").write_text(
    json.dumps(result, indent=2, sort_keys=True) + "\n"
)

print("PARENT=VERIFIED")
print("EXCLUSION_POLICY=FIXED_HYPOTHETICAL_WALLET")
print("SNAPSHOT_VARIABLE=SIGNING_VS_EXECUTION")
print("SIGNING_NFT2=0")
print("EXECUTION_NFT2=" + str(fee // 3))
print("SIGNING_DUST=0")
print("EXECUTION_DUST=1")
print("CONSERVATION=PASS")
print("RATIONAL_ORACLE=PASS")
print("C007=OPEN")
print("PASS: C007 snapshot timing V1")
