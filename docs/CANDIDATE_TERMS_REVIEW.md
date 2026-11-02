# Candidate terms: asset, registration and one-action economics

Prepared 2026-11-02 against `1cec8df581f302d9d3bd9dc6dc7970ae5a4490fc`. This is a decision package for the [integrated action milestone](PUBLIC_ACTION_MILESTONE.md). No deployment or source interpretation is approved here.

## Asset and registration boundary

| Route | Useful evidence | Boundary / decision |
| --- | --- | --- |
| Retained original-token local experiment | Historical token behavior, custody, signed posting and conditional reconstruction | Local state installation and fixed IDs do not establish public registration or current public-chain state |
| Public synthetic diagnostic | Could exercise independent submission, public acquisition and observer recovery on a separately specified candidate | Must use a distinct identity and label. Cannot close original-token compatibility or literal-zero mint burning. No chain or candidate selected yet |
| Original-asset protocol candidate | Intended integration target | C-001 needs a defensible mechanism or an explicitly agreed source change; no arbitrary burn address, replacement token or mainnet spending is selected |

The existing probe's token address is a constant, not a chain-independent asset identifier. Changing it is a new artifact requiring review and fresh evidence. Its three fixed IDs bypass registration. A limited diagnostic may be useful in parallel, but must not be advertised as satisfying permissionless username minting.

**Recommended next action:** preserve C-001 as open in [issue #1](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/1), and prepare the one-action state machine without selecting a burn workaround. Any synthetic public diagnostic needs a separate reviewed chain/asset/authority/funding plan before deployment.

## Current code versus decisions

The following facts are observed in [CawPaidActionProbe.sol](../experiments/paid-action/CawPaidActionProbe.sol), not inferred from passing frontend tests.

| Term | Current experiment | Decision needed before a candidate freeze |
| --- | --- | --- |
| Fee | 5,000 × 10^18 base units; immutable constant | Denomination/source evidence and accepted experimental schedule |
| Stake | Amounts locked within account credits; owner can stake/unstake under current epoch checks | Open account population, bounded updates/claims and withdrawal behavior |
| Exclusion | `_allocate` excludes payer ID, not other IDs with the same owner | Meaning of “other stakers”; address grouping is not person identity |
| Commitment | `distributionHash()` commits stakes of IDs 1, 2, 3, including payer | Which changes must invalidate an intent, and whether adversarial churn can obstruct progress |
| Timing | Current stake vector must match at execution | Snapshot, expiry, transfer and retry rules; no unilateral reinterpretation by a relay |
| Zero pool | Reverts before charging the fee | Explicit zero-eligible-stake behavior |
| Rounding | Floor each recipient's allocation; remainder retained in `poolDust` | Long-term ownership/use of dust; current probe has no dust-withdrawal path |
| Submission | Any submitter may present the exact signed request; submitter pays transaction gas and gets no protocol reward | Sustainable, replaceable submission and source compatibility; no perpetual subsidy assumption |
| Text | Exact strict UTF-8; 1–420 scalars, at most 1,680 bytes | Provisional C-004 rule; not a resolved meaning of “characters” |

## Reproducible economic comparison

[`compare_candidate_terms.py`](../experiments/paid-action/compare_candidate_terms.py) compares two exclusion readings using exact integer arithmetic. It does not execute Solidity, recover signatures or implement a scalable pool.

```sh
python experiments/paid-action/compare_candidate_terms.py
```

For payer ID 1, stakes `[10, 1, 2]` base units and owners `[A, A, B]`, current account exclusion allocates `floor(F/3)` to ID 2 and `floor(2F/3)` to ID 3, retaining one base unit as dust for `F = 5000 × 10^18`. Thus another account held by the payer's owner receives a share. The unimplemented same-owner exclusion comparison gives all F to ID 3. This is a policy distinction, not evidence that the current behavior is a coding defect.

Changing only payer stake from 10 to 11 leaves these allocations unchanged, but changes an input to the current signed stake-vector commitment. The contract rejects a request whose commitment no longer matches; this calculation does not evaluate Keccak or execute that rejection. A future design must justify which economically irrelevant changes can invalidate pending work. No current field is removed by this review.

With stakes `[10, 1, 0]`, account exclusion has one eligible recipient; same-owner exclusion has none. The choice therefore changes both recipients and whether an action can proceed. Owner-address exclusion would still permit multiple addresses controlled by one person; no identity oracle is proposed.

## Review requested

Use [issue #5](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/5) for exclusion, scalable accounting, commitment churn and dust decisions. State the source reading, exact account/owner model, snapshot and conservation rules, negative cases and bounded posting/claim/withdrawal costs. An accumulator or deferred-claim design must account for transfer, payer exclusion and rounding rather than merely move work to an operator.

Use [issue #7](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/7) for submission costs and liveness, and [issue #8](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/8) for text interpretation. Existing contributor examples remain attributed evidence. Silence is not a choice among these alternatives.

No new full-suite, public transaction, scalable settlement, registration or release result follows from this package. The next implementation should follow an explicit provisional profile and prove its integrated state transitions; it must not silently select an alternative presented here.


## Execution receipt

The comparison ran successfully on pinned Python 3.12.14 under existing resource guards. A separate copy with the expected one-unit dust deliberately changed to two failed at that assertion. [Results and source hashes](../evidence/CANDIDATE_TERMS_COMPARISON.json). These are arithmetic decision examples, not Solidity execution or additional Node-suite passes.
