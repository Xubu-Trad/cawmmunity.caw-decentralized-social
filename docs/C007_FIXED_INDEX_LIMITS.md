# C-007 — Fixed-point reward-index limits

RESEARCH_NOT_ADOPTED. Parent `8aa70174e92932eed732816bc9b55820627d5688`. This follows [the exact-rational reference](C007_REWARD_INDEX_RESEARCH.md); no contract, parameter or C-007 decision is changed.

## Candidate tested

IDEA — For scale Q and eligible weight D, add floor(fee*Q/D) to the reward index. Keep the remainder in a separate unallocated scaled-unit reserve; account fractional rewards carry forward. Exclude the paying account and settle past rewards before stake changes. Selected state fields reject values outside uint256. Python computes intermediate products exactly; this is NOT Solidity arithmetic or a reviewed mulDiv implementation.

The candidate does not redistribute its reserve. No party receives ownership or a withdrawal right over that reserve. This is an explicit unresolved economic liability, not a treasury feature.

## Observed comparison

The same480-operation trace from the rational experiment was replayed at three scales. The direct eager rational model remains the reference. At every step, each account's cumulative reward plus claims did not exceed its exact entitlement, and the sum of all shortfalls equaled the unallocated reserve. The model also checked fees*Q = claims*Q + pending scaled rewards + reserve.

| Scale Q | Integer claims | Unallocated reserve in base units |
| --- | ---: | ---: |
| 1 | 10487 | 82740 |
| 1000000 | 46946 | 0.218493 |
| 1000000000000000000 | 46946 | 0.000000000000216527 |

All traces input93343 fee base units. Equal integer claims at the two larger scales do not mean exact entitlement agreement: residual shortfalls remain. The sample trace does not bound losses on other inputs.

## Counterexamples that block an unqualified implementation

1. **Positive fees, zero recipient reward.** Q=10^18, eligible weight10^30 and twenty separate fees of1 each produce no index increment. The only recipient can claim0; all20 units remain unallocated. These are synthetic units, not a claim about the actual CAW stake supply. For any fixed Q, a supported fee/weight range must address this condition.
2. **Global carry can move old fees to new stakers.** At Q=10, a fee1 and sole eligible weight11 create remainder10 and no reward. If that staker leaves and a new weight1 enters, combining the old remainder with the next fee1 pays the new recipient2. One unit came from the earlier participation period. This is a separate arithmetic counterexample to naive global carry, not behavior implemented by the tested reserve-retaining model.
3. **Index exhaustion rejects a later valid-looking action.** With Q=1 and eligible weight1, a fee of uint256 maximum fills the index. A later fee1 rejects without changing state; the earlier recipient can still claim the prior reward in this test. Rejecting overflow prevents corruption but is not indefinite liveness or an adequate production bound.
4. **Intermediate multiplication can overflow while the quotient fits.** fee=uint256 maximum, Q=10^18 and D=uint256 maximum give a valid quotient10^18 but an oversized product. A naive uint256 multiply is not equivalent to this Python model. Any full-width implementation needs separate review and tests.

These examples concern proposed research arithmetic, not a newly reproduced defect in the frozen Solidity baseline. No production staking range, precision, reserve beneficiary or migration/reset authority is adopted. An administrator reset is not an acceptable shortcut to index exhaustion.

## Reproduce

`python3 integration/core-baseline-v1/c007-fixed-index-reference.py evidence/reward-index-20261108/result.json`

The adjacent exact-reference script is loaded locally; no dependencies beyond Python's standard library or network access are required. [Saved output](../evidence/fixed-index-20261108/result.json) includes exact rational shortfalls. The portable command reproduced the initial output byte-for-byte; both local evidence runs were retained.

## Next design obligations

Specify supported fee/weight/lifetime ranges and acceptable loss, or select a design that preserves exact base-unit entitlement under an explicit rule. Attribute carry to its earning population if preserved across membership changes. Prove all stored and intermediate arithmetic bounds, denial-of-service behavior, and claim/transfer semantics. Compare adversarial orderings and boundaries with the rational reference before Solidity. An experiment can investigate alternatives, but cannot silently resolve the distribution decision.

Scope: same-author offline Python comparison, selected range checks and finite cases; no EVM gas certification, custody, signed debits, actual-token evidence, NFT transfers, external peer review or production readiness. README updates remain paused.
