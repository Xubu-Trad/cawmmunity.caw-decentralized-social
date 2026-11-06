# Reward precision and counter budget

This extends the existing [fixed-point reward research](STAKING_FIXED_REVIEW.md), without selecting its economics or changing the paid-action contract.

The [calculator](../experiments/paid-action/staking_budget.py) uses exact integer arithmetic to expose two independent limits. For fee F, eligible stake E, scale Q=2^64 and index increment D=floor(FQ/E), the index permits at most floor((INDEX_CAP-currentIndex)/D) more identical posts. The funded counter permits at most floor((MAX-currentFunded)/(FQ)). Their minimum is a counter ceiling, not a guarantee all those posts can execute. A zero increment is rejected, not unlimited capacity. Per-post unassigned value is exactly (FQ-DE)/Q base units, strictly less than E/Q.

## What the numbers show

At the experimental 5,000-token fee and 18-decimal convention, a constant eligible pool of **one base unit** reaches the chosen index cap after at most **15,845,632 posts** from zero. One whole token of eligible stake yields a much larger ceiling. These scenarios hold the fee and eligible stake constant and are not throughput, calendar-lifetime or attack-cost predictions. The maximum-total-stake scenario is an aggregate mathematical bound, not a demonstrated practical account population.

This exposes why a large 256-bit field alone is not evidence of permanent operation: low eligible stake consumes more index capacity per fee. Claiming rewards does not reset this index. The global unassigned remainder and account claim fractions are different quantities; this report does not assign either to a developer or change their disposition.

## Executed checks

[Recorded results](../evidence/STAKING_BUDGET_RESULTS.json) include five unittest cases: remainder/conservation comparisons against the existing model, an injected two-post index boundary followed by unchanged-state rejection, the separate funded-counter limit, zero-increment rejection, and invalid input rejection. The near-cap state is constructed for the boundary test; millions of historical transactions were not executed. The separate calculator run completed on Python3.12.14 under the existing resource guard.

Reproduce using only the Python standard library:

```sh
python -I -B tests/test_staking_budget.py
python -I -B experiments/paid-action/staking_budget.py
```

These are arithmetic tests, not Solidity execution, gas measurement, custody or signed-action verification. No Node full-suite total changes. The runtime identity is recorded; an earlier startup attempt rejected a stale runtime hash before running tests, and the currently installed binary was inspected and pinned for these runs. Resource thresholds were unchanged.

## Decision still required

Issue #5 remains open for the precision/error budget, dust ownership and a long-lived indexing strategy. A replacement must preserve each account's accrued entitlement across any normalization, reject stale/replayed operations and avoid an operator-controlled reset key. Raising precision merely trades rounding against capacity. This evidence does not select a rollover design, an economic rule or a minimum stake, and no production or public-test gate closes.
