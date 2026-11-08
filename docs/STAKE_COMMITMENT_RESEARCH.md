# Bounded stake-state commitment research

2026-11-08; parent `d7579d6851e7d4a5873df38ec3130272ed47b90b`.
**IDEA / PROPOSED:** a fixed-depth sparse Merkle sum tree for the
[one-action profile](ONE_ACTION_PROFILE_PROPOSAL.md). This is a Python research
kernel, not an accepted signed encoding, authenticated registry or Solidity
implementation. No economic rule changes and no developer-selected canonical
root follow from publishing it.

## Problem addressed

The existing three-account probe hashes three stake amounts. The transition
oracle compares an entire sorted tuple. Neither is an open-population commitment
update algorithm. This [kernel](../experiments/paid-action/stake_commitment.py)
updates one account's path of fixed depth 256 and proves one leaf against an
explicitly supplied root. It does not implement reward allocation, signed action
verification, registration or custody.

## Exact research encoding

`H` is Python standard-library SHA-256. Integers below are exactly 32-byte
unsigned big-endian values; inputs outside uint256 and booleans used as integers
are rejected. Hashes are exactly 32 bytes.

| Object | Hash preimage | Associated sum |
| --- | --- | --- |
| Absent leaf | `0x00` | 0 |
| Present account | `0x01 || accountId || stake` | stake |
| Branch | `0x02 || leftHash || leftSum || rightHash || rightSum` | leftSum + rightSum, checked against uint256 |
| Public research root | ASCII `CAW_STAKE_TREE_RESEARCH_V1` followed by NUL, then `namespace || topHash || topSum` | topSum |

The namespace must be supplied as exactly 32 bytes. It is opaque in this kernel;
no chain, registry or protocol identity is inferred from it. A future signed
profile must specify its derivation and bind the actual chain, contract, registry
and configuration. Identical namespace bytes are not proof of common authority.

Account ID bits identify the path: bit 0 selects left/right at the leaf's parent,
then successive bits ascend to height 256. Proof siblings are ordered leaf to
root and contain `(hash, sum)` pairs. An absent subtree is recursively constructed
from two absent children. Present zero-stake accounts differ from absent leaves.
The kernel accepts the entire uint256 key range, including zero; protocol account
admission remains separate and may reject IDs that this data structure represents.

Verification requires exact depth, node shape, types, sums, namespace and expected
root. A valid absence proof proves absence relative to those supplied bytes; it
does **not** admit an account. Root authentication and presence admission remain
mandatory consumer obligations. There is no fallback root or provider vote.

## Work, storage and semantics

`set_account` reads 256 siblings, hashes one leaf and 256 branches, then writes
257 staged nodes and the supplied account record. All input and sum-overflow
checks precede mutation. Initialization computes 257 default hashes; constructing
a populated tree by repeated insertion costs O(256 × account count). Stored nodes
also grow with populated paths. Dictionary lookup overhead is implementation
dependent. Atomic rejection here means precondition failure before dictionary
writes, not durability against process failure or Python allocation failure.

Generating a proof reads 256 nodes and writes no tree state. Verifying one uses
257 path hashes plus one root-envelope hash. Reading the public root adds its
envelope hash. These are logical counts, not gas measurements or a throughput
claim. A fixed 256-level path may be expensive on chain.

With 32-byte hashes and 32-byte sums, the uncompressed sibling payload alone is
`256 × 64 = 16,384 bytes`. Python tuples and integers consume additional memory.
This is a size calculation, not an implemented wire encoder or measured calldata
cost. Compression, alternative depths and alternate hash functions are unsupported
here and would require distinct formats and tests.

No owner or ownership epoch appears in the leaf: this follows the proposed
account-ID eligibility alternative, not an accepted policy. Restoring the exact
registered account/stake map restores the root. This remains current-state
commitment, not permanent cancellation. The model's separate payer ownership
epoch and nonce cancellation are still required. Adding a registered zero-stake
account changes the map/root even though total stake and allocations may stay
the same; pending-intent invalidation from registration is an explicit liveness
objection. A zero-stake omission policy would need a separately reviewed encoding.

There is no deletion operation, account admission authority or verified registry
adapter. The caller of `set_account` is trusted. A future contract must prevent
arbitrary callers from installing stake or roots and derive changes from its
authorized, backed accounting transitions without a privileged root-setting key.

## Executed evidence

**FACT:** [eight unittest methods](../tests/test_stake_commitment.py) passed
internally on Python 3.12.14, with the executable hash and resource limits in
[run.json](../evidence/stake-commitment-20261108/run.json) and the retained
[log](../evidence/stake-commitment-20261108/tests.log).

- A separately implemented eager rebuild agrees after 96 deterministic inserts
  and updates across up to 64 accounts, including sparse/high-bit/maximal keys.
  It independently serializes and hashes all levels but shares standard-library
  SHA-256; this is same-author differential checking, not outside peer review.
- Actual instrumented updates at populations 4, 17 and 65 each performed 256 node
  reads, 257 writes and 257 hashes; proof generation performed 256 reads, no writes.
- Each of 256 one-sibling-hash mutations was rejected. Separate single-field
  changes to namespace, expected root/total, account, stake, presence, proof depth
  and sibling sum were also rejected. These are subcases, not 256 new test methods.
- Empty versus present-zero state, insertion-order independence, restored roots,
  stale proof rejection, strict proof shapes and overflow rejection preserving
  the complete tree state were checked. A reduced stake allows a previously
  overflowing insertion while preserving the exact uint256 total cap.

These checks neither establish collision resistance independently nor validate
live roots, signatures, EVM arithmetic/gas, recipient eligibility or settlement.
The transition-model suite and full repository suite were not rerun because
their source/dependencies were unchanged. No new Ubuntu user run is attributed.

```sh
python3 -I -B tests/test_stake_commitment.py
```

This standalone command uses the Python standard library. The recorded internal
run applied 512 MiB address-space, 15 CPU seconds and 30 seconds wall timeout after
checking at least 2 GiB free disk and 1 GiB available memory. Those outer limits
are not installed by the command itself. No CI or dependency installation ran.

## Remaining gate

This addresses bounded logical work for a stake commitment only. Exact per-post
flooring still requires a scalable settlement design or an explicitly reviewed
rounding-policy change; no accumulator is adopted here. Next compare a contract
implementation's gas/storage/proof costs and its atomic accounting-to-root
updates, including unauthenticated update attempts and registration churn, before
binding this format into any signed profile. Preserve root authentication,
separate cancellation, unsupported-mode negatives and public recovery requirements.

Original code/documentation use the repository MIT license. The
[provenance inventory](../evidence/stake-commitment-20261108/provenance.json) records
source parents, transforms and byte identities. No settlement implementation,
economic acceptance, authenticated network or production-readiness claim follows.

## Solidity follow-up — 2026-11-08

[The isolated proof verifier](STAKE_PROOF_EVM_RESEARCH.md) now has 23 passing local
bytecode calls and measured Shanghai execution gas. This follow-up measures proof
checking only; tree updates, authenticated roots and settlement remain unimplemented.
