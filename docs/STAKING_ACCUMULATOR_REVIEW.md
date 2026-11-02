# Account-excluding accumulator: mathematical comparison

Research only, 2026-11-02. This follows [candidate terms](CANDIDATE_TERMS_REVIEW.md) and [issue #5](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/5). It is not a selected protocol, token ledger, Solidity implementation or gas benchmark.

## Proposed recurrence

For this experiment only, retain account-ID payer exclusion. Let `S` be total stake, `s[p]` payer stake, and `F` the amount to distribute. If `S - s[p]` is zero, reject before mutation. Otherwise add `F / (S - s[p])` to a global exact-rational index `A`.

An account's reward entitlement is `credit[i] + s[i] * A - debt[i]`. Before changing an account's stake, settle its entitlement and reset its debt against the new stake. Before posting, settle the payer; after advancing A, reset that payer's debt to `s[p] * A`. This excludes the payer from its own reward increment while leaving other accounts to settle later.

The update path writes global state and one account rather than iterating all recipients. That is a source-level logical-access property, **not constant gas or constant CPU cost**: the arbitrary-precision rational arithmetic can grow. The verification harness deliberately enumerates every account afterward to compare with a separate eager implementation.

## Executed comparisons

Run the standard-library-only research script:

```sh
python experiments/paid-action/staking_accumulator_model.py
```

Four deterministic cases use 3, 8, 64 and 256 accounts. Each performs 96 operations: 32 stake changes and 64 posts. After every operation, the lazy and separately expressed eager allocation models agree exactly; entitlements are nonnegative and sum to the externally supplied distribution amounts. A payer's reward entitlement does not increase from its own post. A separate zero-pool case rejects without state mutation.

A deliberately altered copy omitting the payer debt correction fails with `PAYER_REWARDED`. [Output, source hashes and run boundaries](../evidence/STAKING_ACCUMULATOR_RESULTS.json) retain both results. These finite sequences are not a proof over all inputs, and the two implementations share this author's interpretation and Python Fraction implementation; they are not independent external review.

## Two reasons this cannot be deployed as written

**Arithmetic growth:** the observed largest rational numerator/denominator bit lengths were 117, 159, 268 and 366 respectively. Even these short examples exceed a single 256-bit integer. No fixed-width encoding, overflow proof or verification-cost bound has been supplied. Increasing account count alone is not a scalability demonstration.

**Rounding changes economics:** take two posts with F = 5,000 × 10^18 and eligible weights 1 and 2. Flooring each recipient on every post leaves two base units of dust in total. Accumulating exact fractional entitlements and flooring at claim leaves one. The first recipient receives one extra base unit under the latter rule. Both conserve their own accounting, but they are different policies.

The current probe floors per post and retains `poolDust`. This model must not silently replace it. A fixed-point accumulator introduces further truncation questions; preserving fractional remainders, assigning dust, stake changes and payer corrections all require a reviewed integer design.

## Deliberate exclusions and next gate

The model tracks reward entitlements only. It does not debit a payer's custody balance, execute withdrawals, authorize stake changes, register NFTs, transfer ownership, verify signed commitments or establish canonical chain state. Account creation, owner-address exclusion, pending-intent churn, mempool behavior and full settlement are outside this run. Arrays are finite initialized populations, not a permissionless registration mechanism.

Next: review rounding/carry ownership and account exclusion in issue #5, then define bounded-integer invariants and resource limits before an executable contract candidate. Compare any proposed fixed-point or alternative scheme against explicitly selected semantics, including changing stakes and withdrawals. Do not infer safety from the rational model or adopt an operator-managed distribution list.

The existing 1,251-test Node suite count is unchanged. No public deployment, full-suite rerun, production gate or specification conflict is closed.
