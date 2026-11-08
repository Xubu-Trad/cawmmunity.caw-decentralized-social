# Bootstrap trust requirements — research design, not accepted policy

## Current boundary

At `03e23fa38755b821c3df04948c8d268a943d41c0`, explicit profile, retained metadata and committee-inclusion checks compose for a minimal Capella fixture. Those checks bind supplied bytes to supplied commitments. They do not establish that the selected root belongs to the intended live chain. The [latest composition record](BOOTSTRAP_PROFILE_COMPOSITION_20261107.md) and [historical hash correction](BOOTSTRAP_BINDING_PROVENANCE_CORRECTION_20261107.md) remain the evidence references.

The following is a proposed acceptance checklist, not a newly accepted manifesto interpretation, working light client or production release rule.

## Separate gates

| Gate | Evidence needed before acceptance | Required rejection case |
|---|---|---|
| Network identity | Explicit full genesis validators root and supported network configuration, with retained provenance and a separately justified selection | A self-consistent checkpoint from a different network |
| Fork/profile | Supported preset, fork version and applicable slot/epoch schedule; exact schema and proof indices | Wrong fork at the selected slot, unknown fork or mainnet512 passed to minimal32 |
| Checkpoint origin | A documented external trust assumption, acquisition method and retained root/slot/source evidence that another operator can evaluate | Metadata that silently chooses its own trusted root |
| Recency | An explicit, reviewed freshness/weak-subjectivity policy and time assumptions | An old but internally consistent checkpoint; unavailable or contradictory timing evidence |
| Cryptography | Selected BLS implementation, encoding/subgroup/aggregate/signature controls and upstream positive/negative vectors | Malformed points, infinity/disallowed keys, invalid aggregation, wrong signing domain and invalid signatures |
| Update transition | Defined committee periods, finality/update rules and atomic state changes after all checks | Out-of-period updates, conflicting roots, partial writes and replay after rejection |
| Operator independence | A second operator can obtain and evaluate the required state without Xubu credentials or a mandatory Xubu service | Original endpoint disappears, an alternative provider supplies conflicting evidence |

Passing one row never substitutes for another. In particular, a valid signature under a supplied committee does not by itself authenticate how that committee became trusted.

## Fork metadata is not identity authentication

The pinned Ethereum specification defines [ForkData and its SSZ root](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/phase0/beacon-chain.md#compute_fork_data_root) and the [four-byte fork digest](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/phase0/p2p-interface.md#compute_fork_digest). A four-byte digest is a short discriminator, not a collision-resistant identity or trust proof. A consistency check must preserve the full genesis root and fork version, and must not infer authenticity from a digest match. The current fixture's configuration is not an implemented live-network schedule.

## Sourcing and disagreement

IDEA — Retain separately acquired checkpoint records with their exact bytes, acquisition times, full network identity, source provenance and declared assumptions. Compare evidence without converting provider count into authority: multiple URLs may share the same operator, backend or compromised source. Neither majority agreement nor an operator-entered pin alone establishes canonicality.

UNRESOLVED — Which external trust model, network configuration and freshness rule should this implementation support? No provider quorum, deadline or checkpoint service is selected by this document. A mandatory Xubu feed, emergency admin override or automatic fallback to an unverified root would undermine the independence objective.

Proposed behavior pending that decision: remain in research/inspection mode, retain conflicting evidence, and refuse live acceptance rather than silently choose a winner. This is a design proposal; there is no live adoption path added here.

## Fixture fork-data follow-up — 2026-11-07

FACT — The original staged experiment was stopped by the disk-space guard before execution. After moving the worktree to Linux storage without reducing the guard, a separate [fork-data consistency experiment](BOOTSTRAP_FORK_DATA_CONSISTENCY_20261107.md) passed 7 Python oracle checks, 9 initial JavaScript checks, and 13 corrected JavaScript checks. The failed intermediate patch attempt and its 9-test rerun remain historical evidence, not a corrected V2 pass.

FACT — The corrected research verifier admits the exact 46-key layout of the retained minimal Capella config and rejects added or replaced keys. The fixture computes digest `0x856842be`. A coherent alternative fork/digest also passes its narrow consistency check while every authentication and acceptance flag remains false. Other config values, including slot duration, are not fully validated.

INFERENCE — ForkData consistency is not proof of the intended live network, trusted checkpoint, authoritative fork schedule, BLS validity, freshness or consensus. Matching four digest bytes cannot establish those properties.

NEXT — Independently justify anchor provenance, define a real supported network and fork schedule, and verify BLS and update-transition requirements before any adoption. Public-test and production gates remain blocked. Hosted CI remains deferred.


## Individual BLS G1 prerequisite — 2026-11-07

[The isolated G1 adapter](BLS_G1_VALIDATION_20261107.md) matches all thirteen retained external decoder vectors after canonical re-encoding checks; 30 final focused and separate 44 regression tests pass. The initial raw-library mismatch remains documented, with 28 passes/1 failure preserved. Individual curve/subgroup validity does not establish committee membership, aggregate relationship or signatures. Next retained minimal-committee composition and aggregate-key relation, then G2/domain/signature and trust-policy gates. No root dependencies or acceptance changes; full suite/declared runtime not run, CI deferred.


## G2 and single-signature POP vectors — 2026-11-07

[The isolated signature adapter](BLS_POP_SIGNATURES_20261107.md) passes 48 focused, separate 42 key/committee and 73 bootstrap checks. Explicit POP succeeds where the pinned default NUL fails on the same positive vector. The BLS ciphersuite tag is not the Ethereum consensus signing domain. No aggregate/participation, checkpoint authority or update acceptance is established. Next external fast-aggregate cases and separately evidenced consensus-domain/signing-root derivation; full suite/declared runtime not run, CI deferred.


## Supplied-key aggregate equations — 2026-11-08

[The bounded aggregate experiment](BLS_POP_AGGREGATE_20261108.md) passed 21 focused checks plus separate 90 BLS and 73 bootstrap regressions. Canonical key validation and a passing aggregate equation do not establish each participant's possession or authorization; a compensating-key control preserves that distinction. No participant-selection or update-acceptance integration. Next extend existing ForkData work with consensus-domain/SigningData evidence, and separately define authenticated participant selection and enrollment/possession prerequisites. Full suite and declared runtime remain unrun; CI remains deferred.
