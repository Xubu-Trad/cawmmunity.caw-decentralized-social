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

## Next bounded experiment

A local fork-data root/digest consistency module and six test cases have been prepared but **not executed or published**. The resource guard stopped before test startup because free disk space remained below its existing 2 GiB minimum. No new passing count is claimed. The proposed cases compare the pinned fixture's fork version and full genesis root to its recorded digest, then alter each input, encoding and unsupported authority fields. Even a passing result would establish metadata consistency only.

After reconciling the latest source snapshot, run those checks under the unchanged guard and review the short-digest limitation before integration. Then define supported network/schedule inputs and obtain independently reviewable trust-anchor/BLS requirements. Hosted CI remains deferred. Public test candidate and production remain blocked.
