# Protocol specification v1 — draft decision baseline

Status: DRAFT_RESEARCH_NOT_ADOPTED. This records the frozen research implementation and the decisions required to replace it. It is not a production specification, community-approved interpretation or release authorization. Primary source passages remain in sources/MANIFESTO_REQUIREMENTS.tsv; full competing readings and acceptance criteria remain in sources/SPEC_CONFLICTS.md.

## Observed baseline and decisions

| Surface | Current research behavior | Decision gate |
|---|---|---|
| Asset/registration | Constructor token address; tests use an unrestricted mock. No public NFT admission. | C-001/C-003/C-013: original asset proof, compatible payment, username bounds and pricing. |
| Ownership | Three fixed accounts; mutable owner/epoch per fixture, current-owner checks. No ERC-721 registry. | C-005/C-009/C-013: NFT interface, transfer effects and session/DM consequences. |
| Posting fee | 5000 ×10^18 base units; synthetic profile label. This assumes fixture units, not independent token-decimal proof. | C-002/C-003/C-007: exact adopted price, distribution and snapshot. |
| Text | Strict UTF-8, limit420Unicode scalar values, exact bytes hashed; no grapheme counting or implicit normalization. | C-004: agree on the character interpretation. |
| Settlement | Only account1 pays; stake2+stake3 weights recipients; zero eligible stake rejects. | C-007: arbitrary accounts, payer exclusion identity, scalable accounting and zero-pool policy. |
| Rounding | Integer floor allocations; remainder accumulates as poolDust outside credited liabilities. | C-007: explicit dust ownership/disposal and arithmetic bounds. No treasury authority is implied. |
| Signing | EIP-712 name CAW C007 Synthetic Action, version1, chain/contract; signed account, epoch, nonce, validAfter, deadline, stakeRoot, textHash, fee, profile. | C-009: final domain, sessions and wallet compatibility. |
| Timing | validAfter<deadline; timestamp>=validAfter and timestamp<deadline. | C-009: adopted window/snapshot rules and execution race behavior. |
| Contract wallets | Signature cap4096bytes, staticcall100000gas, bounded return handling. | C-009/C-012: this profile is not universal ERC-1271 or EIP-7702 support. |
| Availability | Preserved signed fixtures and synthetic replay; no general public storage/relay service. | C-006/C-008/C-014: independently replaceable acquisition, relay and content recovery. |
| Release | Draft PRs and finite research results. | C-010/C-011/C-012/C-015/C-016: hosting, public review, authority, release and future-security decisions. |

FACT means observed code or source text; the table does not promote an observed experimental behavior into a required final rule. No choice among conflicting source readings is settled here. The machine-readable register covers all16conflicts with UNRESOLVED status and empty acceptance-evidence lists. Empty lists mean this register claims no accepted resolution; they do not mean no related engineering evidence exists.

## Decision record required before changing a gate

Record exact source passage/requirement IDs; competing interpretations; proposed behavior and parameter units; rationale and rejected alternatives; affected contract/ABI/storage/history/client surfaces; deterministic acceptance and failure tests; reviewer evidence/objections; and explicit disposition. Distinguish a proposal, implementation choice for a bounded experiment, and accepted protocol rule. Never infer agreement from silence, tests, poll counts or one maintainer.

## Reproduce the register check

`python3 integration/core-baseline-v1/check-protocol-parameters.py sources/PROTOCOL_PARAMETERS_V1.json integration/core-baseline-v1/compiler-input.json sources/SPEC_CONFLICTS.md`

Eight constant observations are mechanically matched to exact frozen source literals. All16conflict IDs and section hashes are checked. Four authored negative controls reject fee drift, missing conflict coverage, an unsupported adoption label and a source-hash mismatch. This is not a parser proving full Solidity semantics, an economics audit, or a test of every statement in the table. The JSON verifier deliberately cannot authorize a release; a future adopted schema needs separate review.

Next: turn C-001 and C-007 into concrete reviewable decision packets, with existing compatibility/rounding evidence and alternatives. Keep the one-command baseline acceptance gate as the starting point for subsequent implementation changes. No financial behavior changed. CI remains deferred and README edits paused.


## Review packets

[C-001 registration](C001_REGISTRATION_DECISION_PACKET.md) and [C-007 distribution](C007_DISTRIBUTION_DECISION_PACKET.md) enumerate alternatives and acceptance evidence. Both remain unresolved; no constants or contracts changed.
