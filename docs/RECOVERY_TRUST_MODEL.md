# Recovery trust model: next evidence gate

FACT — the current recovery reader accepts a bounded synthetic chain 31337 package and the fixed-registry-eoa/1 profile. A separately retained selection digest detects replacement relative to that digest. It does not authenticate its supplier, chain history, contract state, finality or acquisition independence. See [the implemented boundary](RECOVERY_BUNDLE.md) and [operator dependencies](OPERATOR_INDEPENDENCE.md).

INFERENCE — extending file comparison alone cannot close OI-02 or OI-03. Two matching provider labels can be one operator; a self-consistent alternative chain can satisfy commitment checks. Both findings require distinct evidence from byte integrity.

## Proposed sequence, not an adopted production trust model

1. Specify a separate acquisition profile before implementing it: supported chain and fork rules, chain identity, exact interval, contract/registry assumptions, maximum input sizes and required raw headers, transactions and receipts. Do not broaden the existing synthetic profile silently.
2. Document how a reader obtains and validates the selected chain anchor. Compare a user-retained trusted checkpoint with a consensus-verified anchor, explicitly listing the trust and finality assumptions of each. Neither is selected by this document. RPC agreement alone is insufficient.
3. Implement acquisition as an untrusted input producer separated from offline validation. Retain exact responses, endpoint/operator provenance, tool versions and input/output hashes. Never require Xubu's keys, server or private database. A replacement provider must satisfy the same evidence contract.
4. Have another builder acquire the selected interval in a fresh environment without the original capture. Record shared infrastructure and dependencies; separate process independence from operator independence. Do not infer either from two URLs.
5. Validate commitments using an explicit supported fork profile, then validate the required registry/account authority independently. EOA signature recovery does not establish contract-wallet authorization or execution correctness.
6. Demonstrate rejection before any state adoption. Only promote an individual evidence claim after its own acceptance check; no aggregate production-ready boolean follows from this experiment.

## Required negative evidence

| One changed input | Required result |
|---|---|
| Wrong chain or unsupported fork/account profile | Reject before reconstruction/adoption |
| Missing block/body/receipt or changed raw transaction | Reject incomplete or inconsistent evidence |
| Replacement package plus replacement selection | Reject against the independently retained selection; disclose the trust source of that selection |
| Two provider labels sharing one operator | Do not assert operator independence |
| Internally consistent history with an unauthenticated anchor | Keep endpoint authentication and finality unestablished |
| Divergent branches or stale checkpoint | Preserve both observations; do not choose by provider count or silently update the anchor |
| Unavailable original provider | Recover through a documented surviving source, or report unavailable evidence without claiming permanence |

UNRESOLVED — chain/fork profile, trust-anchor selection, consensus/finality verification, real registry/account authority, independent acquisition and external storage survival remain open. Existing tests are finite synthetic evidence. This document adds no executed network experiment and changes no acceptance flags.

The next implementation review must identify the selected profile and anchor assumptions before a network adapter is represented as authenticated recovery. Production and the public test candidate remain blocked. Record each artifact's parents, transformation, SHA-256, size and path; keep failed cases alongside successful ones.


## Implemented prerequisite: selected-header state relation

[Header-bound state proof composition](HEADER_BOUND_STATE_PROOF.md) now connects the existing header-hash and account/storage-proof readers. It removes a separately supplied state root, but trusts the caller-selected header hash. Its historical proof replay does not resolve the anchor, canonicality, freshness or account-authority questions above.


## Reproduced competing-anchor boundary -- 2026-10-26

[Six retained-capture checks](ANCHOR_TRUST_BOUNDARY.md) demonstrate two different same-height blocks sharing a parent and each satisfying selected integrity/sender checks. Neither obtains consensus/finality authority. Cross-selected hashes and an injected finality flag reject. This supplies concrete local evidence for the existing trust decision; it selects no production anchor policy.


## decision record -- 2026-10-28

[Anchor-authority review](ANCHOR_DECISION_REVIEW.md) consolidates the required decisions as AT-01 through AT-08 after joint signed-ledger acquisition. It adopts no production trust path and changes no flags.


## Profile/metadata composition follow-up — 2026-11-07

[The pinned composition](BOOTSTRAP_PROFILE_COMPOSITION_20261107.md) now checks supplied metadata bytes and explicit fixture selection before the existing structural committee/header checks. It adds no authenticated anchor, live network/fork policy, BLS verification or recovery adoption. [The additive provenance correction](BOOTSTRAP_BINDING_PROVENANCE_CORRECTION_20261107.md) records the historical binding-file digest discrepancy; original evidence remains unchanged. For read-only verification, run the Python decoder tests rather than the decoder's main command, which rewrites `binding.json`.


## Software commitment boundary — 2026-11-07

The [retained source experiment](SOURCE_COMMITMENT_INSPECTION_20261107.md) detects a changed fixture policy under an unchanged source commitment. It does not connect inspected bytes to executed bytes, verify dependencies/runtime, or independently establish the commitment's authority. The recovery application does not invoke this research inspector. A matching source hash alone must not be represented as authenticated recovery, consensus or permission to adopt a checkpoint.


## Dependency substitution — 2026-11-07

[Five focused checks and a separate 35-check regression](DEPENDENCY_SUBSTITUTION_20261107.md) passed on Node v24.22.1. A matching entrypoint hash does not verify its imports. The retained inventory detects the tested altered dependency, but neither comparison gates application recovery or binds verified bytes to execution. No full-suite or declared-runtime run, new adoption behavior, BLS or production claim; CI deferred.


## Verification-to-import boundary — 2026-11-07

[Four controlled scenarios and a separate 40-check regression](VERIFIED_IMPORT_BOUNDARY_20261107.md) pass on Node v24.22.1. Capturing the checked bytes isolates later acquisition-file changes; a writable snapshot still permits substitution before import. Next define the actor and execution-isolation assumptions before implementing a loader. No production source, authentication or adoption change; full suite and declared runtime not run, CI deferred.
