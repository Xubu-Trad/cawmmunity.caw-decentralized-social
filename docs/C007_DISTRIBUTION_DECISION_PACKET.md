# C-007 — Stake distribution decision packet

Baseline: `2067e032dc14b771667c4654baf3beedc75f9676`, draft PR19. Related gates: C-002 action routing, C-003 prices, C-005 ownership/DM transfer and C-009 signed permissions. See [source conflicts](../sources/SPEC_CONFLICTS.md#c-007).

## Source requirement and current limit

M-015, `37399aeb55974d4b09d404014865b5ef8918e9de`, README.md:L51-L52:

> i. Making a CAW (Akin to tweeting). 
>    a. This cost will be taken in CAW, and then distributed proportionally to all other stakers.

FACT — The frozen candidate permits posting only from account1, divides fees between stake2 and stake3, rejects zero eligible stake and retains integer remainder as poolDust. It binds the signed intent to a stake root. This is a three-account research profile, not arbitrary-account settlement or an adopted stake model.

## Choices to settle before scaling

| Choice | Alternatives and observable effect |
| --- | --- |
| Stake unit and eligibility | Explicit locked account credit versus another selected staking model. NFT possession alone does not define a weight. Record source of each weight and when it becomes eligible. |
| Payer exclusion | Exclude the paying account, or all accounts with its current owner. The latter still cannot establish one-person identity and introduces ownership-dependent eligibility. Neither reading is adopted. |
| Snapshot | Signed-root snapshot, execution-time state, or an explicitly defined interval. State changes can invalidate a signed-root action; accepting stale weights requires defined history and withdrawal semantics. |
| Zero eligible pool | Reject without charging; defer without hidden locks; or explicitly amended routing. The current fixture rejects. No builder recipient or silent treasury fallback. |
| Rounding and batching | Per-action floor allocation, an accumulator retaining fractional entitlement, or another disclosed algorithm. Batching cannot silently change recipients' entitlement. |
| Dust | Explicit immutable retention/distribution rule and liability classification. Current poolDust is not a withdrawal entitlement or developer revenue. |
| Transfer and pending actions | Define account identity, epoch invalidation, who owns accrued credit and whether claims follow the NFT. Avoid paying stale owners. |
| Repeated/self actions | Define like/reCAW/follow repetition and reversals separately; a posting experiment does not decide these. |

## Reproducible arithmetic counterexamples

The [offline examples](../integration/core-baseline-v1/c007-decision-examples.py) use exact rational arithmetic, tiny illustrative integer fees and a floor-allocation scenario. These are NOT the frozen fee, contract executions, a new settlement implementation or evidence of an existing contract defect.

- At weights 1:2, a fee of 5 allocates 1 and 3 with dust1. Twice separately: credits2 and6, dust2. Combined fee10: credits3 and6, dust1. An optimized batch must preserve the chosen per-action meaning or disclose a changed rule.
- At weights1:1, fee10 allocates5 and5. After changing weights to3:1, it allocates7 and2 with dust1. Snapshot selection changes economic results.
- If an owner's second account and an unrelated account each have weight1, excluding only the paying account leaves both eligible (5 each). Excluding every account owned by that owner leaves only the unrelated account (10). Wallet identity is not proof of distinct humans.

Run `python3 integration/core-baseline-v1/c007-decision-examples.py`. The saved result checks conservation/dust bounds and recipient permutation across735 small-domain examples, plus five invalid input rejections. Python unbounded integers do not establish Solidity overflow safety. No external independent review or contract differential execution was performed here.

## Acceptance obligations for a selected design

Record exact units, denominator, exclusion identity, snapshot, rounding, dust and claim timing. Prove every deducted base unit is credited or retained under that rule; distinguish token custody from liabilities and unclaimed fractional entitlements. Test zero/one/many recipients, maximum amounts, stake changes, account transfers, retries/replays/reorgs, adversarial token/wallet callbacks and withdrawal interleavings. A scalable implementation must bound work without a required operator choosing beneficiaries or resetting roots. Independent history readers must derive the same final balances and claims.

NEXT — Compare a proposed bounded-work algorithm against the agreed arithmetic and lifecycle semantics before replacing fixed accounts. Keep all alternatives UNRESOLVED until that choice and review evidence are recorded; do not resolve C-002 pricing/allocation by implication.

## Decision status

UNRESOLVED. This is a review packet, not an adopted rule or deployment authorization. The frozen research baseline remains unchanged. Proposed interpretations require a public rationale, affected interfaces and history rules, negative-case evidence, reviewer objections and an explicit acceptance record. No quorum or privileged approver is invented here. R2 recovery establishes the text, not its author's identity.

R2-004, `8f9da9c32b3aa4ff9f3fb095d9995fd38a8f54a6`, layers/R2-020_hex_transposition/EVIDENCE/reading_rotation.txt:L6:

> 2- that dev and others contribute to it according to the manifesto (or if clear changes were agreed)

R2-005, `8f9da9c32b3aa4ff9f3fb095d9995fd38a8f54a6`, layers/R2-020_hex_transposition/EVIDENCE/reading_rotation.txt:L7:

> 3- eventually we have a thing that is solid, peer reviewed, contributed to by many and it is agreed to be released


## Follow-up research

[Exact-rational reward index](C007_REWARD_INDEX_RESEARCH.md) compares a recipient-loop-free candidate with eager allocation. Its arithmetic exceeds256bits and its fractional carry differs from per-action flooring. No policy is adopted.


[Stake-prefix allocation research](C007_PREFIX_ALLOCATION_RESEARCH.md) explores exact per-fee allocation using the existing tree encoding. Numeric account order affects rounding; snapshot/claim semantics and implementation remain unresolved.
