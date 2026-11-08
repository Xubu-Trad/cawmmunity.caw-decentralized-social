#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path

w, d, b, o = map(Path, sys.argv[1:5])
pin = sys.argv[5]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

original = json.loads((d / "results.json").read_text())
candidate = json.loads((b / "results.json").read_text())

source_path = w / "experiments/paid-action/CawPaidActionProbe.sol"
source = source_path.read_text()

assert original["parent_commit"] == pin
assert candidate["public_parent_commit"] == pin
assert candidate["parent_results_sha256"] == sha(d / "results.json")

assert original["source_sha256"] == sha(source_path)
assert candidate["source_sha256"] == sha(source_path)

assert "return keccak256(abi.encode(stakes[1], stakes[2], stakes[3]));" in source
assert "if (request.distributionHash != distributionHash()) revert DistributionChanged();" in source
assert "if (id != payer) eligible += stakes[id];" in source

assert original["fixture_vector_match"] is True
assert original["signing_execution_digest_equal"] is True
assert original["negative_control_stake2_plus_one"]["differs"] is True

assert candidate["existing_digest_unchanged"] is True
assert candidate["candidate_digest_changed"] is True
assert candidate["candidate_accepted_by_current_contract"] is False

assert candidate["fixed_stake_hash"] == original["distribution_hash"]
assert candidate["fixed_request"] == original["request"]
assert candidate["fixed_selection"] == original["selection"]

old = original["signing"]["digest"]
assert old == original["execution"]["digest"]
assert old == candidate["existing_digest"]
assert old == "0xf1f18d46be5eb89acd461ce5ba31b12222a1a671fdfbc78b56e4c963af0fd07e"

before = candidate["signing"]
after = candidate["execution"]

assert before["digest"] == "0x328d3838ec727ad23a239303fdcec780c55162a0eece2a9bd3ef3e26adf1a69c"
assert after["digest"] == "0xceefa453826cf45e60d4e6a9a9264383486996b8077dd171da90100ec26026de"

assert before["digest"] != after["digest"]
assert before["ownerHash"] != after["ownerHash"]
assert before["combinedHash"] != after["combinedHash"]
assert before["domain"] == after["domain"]
assert before["domain"] == original["signing"]["domainSeparator"]

assert original["signing_owners"] == {"1": "A", "2": "A", "3": "B"}
assert original["execution_owners"] == {"1": "A", "2": "B", "3": "B"}

fee = int(original["fee_base_units"])

for key in ("signing_allocation", "execution_allocation"):
    row = original[key]
    paid = sum(map(int, row["allocations_base_units"].values()))
    assert paid + int(row["dust_base_units"]) == fee

assert original["signature_verified"] is False
assert candidate["signature_verified"] is False
assert original["evm_executed"] is False
assert candidate["evm_executed"] is False
assert candidate["policy_adopted"] is False
assert candidate["c007"] == "OPEN"

results = {
    "schema": "caw-c007-commitment-boundary-review/1",
    "public_parent": pin,
    "digest_parent_sha256": sha(d / "results.json"),
    "candidate_parent_sha256": sha(b / "results.json"),
    "source_sha256": sha(source_path),
    "source_rule": "account-ID exclusion; stake-only commitment",
    "candidate_rule": "hypothetical owner-bound commitment",
    "fixed_event": "NFT2 owner A to B",
    "original_digest": old,
    "candidate_signing_digest": before["digest"],
    "candidate_execution_digest": after["digest"],
    "original_digest_equal": True,
    "candidate_digest_changed": True,
    "conservation": "PASS",
    "source_guard_rejects_candidate_hash": True,
    "signature_verified": False,
    "evm_executed": False,
    "policy_adopted": False,
    "c007": "OPEN",
    "c001": "BLOCKED",
}

(o / "review.json").write_text(
    json.dumps(results, indent=2, sort_keys=True) + "\n"
)

md = f"""# C-007 commitment boundary review

Public parent: `{pin}`

Status: C-007 OPEN. C-001 BLOCKED.

## FACTS

The current contract commits stakes of NFT IDs 1, 2 and 3.
Its allocation excludes the payer NFT account ID.

The original EIP-712 digest remains unchanged when NFT2
transfers A to B with the same stakes and request:

`{old}`

A hypothetical combined stake-and-owner commitment produces:

- Signing owner A: `{before["digest"]}`
- Execution owner B: `{after["digest"]}`

The candidate digests differ. Both underlying allocation
models preserve exact integer fee conservation.

The unmodified Solidity distributionHash() guard does not
accept either hypothetical combined hash.

No EVM execution or signature verification was performed.

## INFERENCE

The original signature structure does not commit recipient
ownership. The candidate structure detects the fixed
ownership change.

Binding the complete owner vector could invalidate an
otherwise pending post after an unrelated recipient NFT
transfer. This is a possible liveness and churn concern,
not a demonstrated live attack.

## IDEA

Resolve these specification boundaries before implementation:

1. Account-ID or wallet-owner payer exclusion.
2. Signing-time or execution-time ownership snapshot.
3. Which ownership changes invalidate a pending post.
4. Who may force invalidation, and how retry works.
5. Whether owner commitments can be verified with bounded
   posting and withdrawal work at scale.

No candidate economics or commitment design is adopted.

## STOP CONDITIONS

A passing digest comparison alone does not establish
signature authority, registry state, live token backing,
successful settlement, scalable execution or liveness.

C-007 remains OPEN. Production remains BLOCKED.
"""
(o / "review.md").write_text(md)

print("SOURCE=PINNED")
print("DIGEST_PARENTS=VERIFIED")
print("EXISTING_DIGEST_UNCHANGED=PASS")
print("OWNER_BOUND_DIGEST_CHANGED=PASS")
print("INTEGER_CONSERVATION=PASS")
print("CANDIDATE_SOURCE_COMPATIBILITY=FALSE")
print("SIGNATURE_VERIFICATION=NOT_RUN")
print("EVM_EXECUTION=NOT_RUN")
print("C007=OPEN")
print("PASS: C007 commitment boundary review V1")
