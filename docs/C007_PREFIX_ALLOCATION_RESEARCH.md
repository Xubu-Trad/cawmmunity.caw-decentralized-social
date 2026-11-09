# C-007 — Stake-prefix integer allocation candidate

RESEARCH_NOT_ADOPTED. Parent `9d7ffd8d5051e377e87a9cea8581f20289cbb7d8`, draft PR19. This follows the [fixed-point counterexamples](C007_FIXED_INDEX_LIMITS.md). No contract, frozen parameter, production admission or C-007 decision changed.

## Existing encoding and proposed extension

FACT — The frozen DeployedCustodyStakeResearch source (SHA256 `d97dd9157a81611630ac876556684f7354f412e35a7a360662aab6ce2984e02c`) commits account ID and stake in a SHA256 leaf, ordered child hashes and sums in each branch, and a namespace-wrapped root and total. Its derive function uses256 sibling nodes. This experiment reuses that encoding in Python. It does not run the Solidity verifier or prove on-chain acceptance.

IDEA — While verifying a recipient's path, add the sum of each left sibling encountered when the path goes right. This derives the stake before that account in numeric-ID order. Verify both payer and recipient membership against the same snapshot root/total. Remove the payer's weight from the total and, if it precedes the recipient, from the prefix.

For fee F, eligible total D, eligible prefix P and recipient weight W, the proposed amount is:

`floor(F*(P+W)/D) - floor(F*P/D)`

Exclude the payer and reject a zero eligible pool. The intervals partition all eligible stake, so the differences telescope to F when all eligible recipients are considered. Each individual allocation differs from its exact rational share by less than one base unit; this is an arithmetic property, not agreement that the rounding rule is appropriate. A tiny fee can still pay some participants zero. Unlike the prior reserve model, this rule allocates every unit somewhere.

## Reproduced evidence

Run `python3 integration/core-baseline-v1/c007-prefix-allocation.py`. [Results](../evidence/prefix-allocation-20261108/result.json) include three synthetic snapshot roots. The comparison uses a direct integer-ticket enumeration rather than the prefix quotient formula:210 payer/fee cases conserved the complete fee and matched that reference. Zero weights, boundary account IDs and payer positions were included. An additional maximum-uint256 fee/total example conserved the fee using Python's full-width intermediates.

Seven altered inputs were rejected: sibling sum, sibling hash, shortened proof, payer proof from a different snapshot, wrong account, wrong weight and wrong total. Both the tree builder and verifier are authored here; this is finite same-author evidence, not external cryptographic review. Snapshot roots are generated fixtures, not authenticated chain state.

## Material tradeoffs

- **Ordering affects rounding.** With fee5, A weight1 and B weight2, A receives1 if ordered before B and2 if ordered after B. The source does not select this tie-breaking rule.
- **Account positioning matters.** With fee1 and three equal eligible accounts, only the last receives1. An owner holding the first two receives0; holding the first and last receives1. No distinct-person identity or account-position manipulation defense is established. This is a placement example, not a claim of an exploit in deployed code.
- **Claims need recorded earning snapshots.** Updating the current stake tree must not change an earlier fee's allocation. The fee record, payer, root, total and profile need authenticated, durable binding.
- **Bounded path work is not cheap gas.** A straightforward individual claim checks two256-node paths. The uncompressed hash/sum pairs alone occupy32768bytes, before other call data. Proof compression, shared paths or aggregations require separate verification; no gas claim is made.
- **No complete claims mechanism yet.** There is no fee debit/escrow, per-fee/account duplicate-claim protection, asset transfer, withdrawal handling or rule for claims after NFT ownership transfer. The model calculates amounts only. Unclaimed amounts remain an obligation, not a builder fund.
- **No lifetime-index growth, but other limits remain.** Products need full-width arithmetic even when the result fits uint256. Fee-record and claimed-state storage may grow. Snapshot availability and continued claim acquisition need a builder-disappears test.

## Decision before implementation

Compare three recorded alternatives: exact fractional carry (unbounded rational representation), fixed-point carry (precision/reserve attribution problems), and per-fee interval allocation (ordering and claim-cost problems). None is adopted or a drop-in replacement for the frozen floor/dust profile. Document which economics, beneficiary identity, rounding fairness, storage and liveness constraints are required before selecting one.

The next bounded engineering item is a snapshot-bound claim-state reference with duplicate-claim and stale-root negatives, explicitly labelled under this candidate's assumptions. It must not be represented as production settlement or used to close C-007. README updates remain paused.


## Snapshot-claim follow-up

[Snapshot-bound claim reference](C007_SNAPSHOT_CLAIMS_RESEARCH.md) checks duplicate and wrong-snapshot rejection with synthetic account credits. It adds no token backing, withdrawal authority or production admission.
