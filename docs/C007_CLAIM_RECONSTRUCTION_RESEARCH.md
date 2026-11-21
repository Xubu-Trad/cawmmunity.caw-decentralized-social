# C-007 — Synthetic claim-history reconstruction

RESEARCH_NOT_ADOPTED. Parent `877f4e4a9878fcf403a2b4232f632d385a7f063c`, draft PR19. Extends [snapshot-bound claims](C007_SNAPSHOT_CLAIMS_RESEARCH.md), without changing frozen contracts or C-007 policy.

## Replay and branch replacement

The reference encodes admission and claim operations in a versioned synthetic journal. A caller selects the exact journal digest. Preparation builds a fresh ledger; commit replaces the visible result only after complete replay. A new selection clears the ready result and invalidates earlier preparation tickets. The old branch's account credits, fee records and claim markers are not incrementally copied into the replacement.

This follows the selection/prepare/commit separation of the existing [paid header recovery reader](../reference/paid-header-recovery.mjs), inspected at the parent above (SHA256 `9c3ce2e6a943401fbf312a8783d0a585a2092e50a2e65ed066cafb859aaedb37`). It does not import that JavaScript reader or extend its accepted event format. The Python fixture is a separate finite state-machine experiment, not an independent implementation of Ethereum history validation.

## Observed checks

- Full selected journal: account2 credit1, account3 credit11, total12.
- Replacement journal retains only the earlier admission and account3's earlier claim: credit4. The later fee and its claims disappear; the removed account2 claim marker disappears as well.
- Applying account2's earlier claim on the replacement gives credits1 and4, total5, once. Re-selecting the original journal recreates its exact prior state rather than adding credits again.
- An admission-only prefix contains no credits and keeps its fee5 budget outstanding.
- Eight rejected cases: stale prepared branch, stale selection token, changed history under the selected digest, claim without its admission, duplicate claim, claim before admission, duplicate admission and malformed selection. The selected view remains unresolved after these tested failed replacements.
- Mutating a returned view does not alter retained reader state.

Run `python3 integration/core-baseline-v1/c007-claim-reconstruction.py`. Adjacent claim and prefix modules are required; all are Python standard-library scripts. [Result](../evidence/claim-reconstruction-20261108/result.json) records the exact generated journal digests. Scripts generate the fixtures deterministically. Journals are limited to32 events and4MiB for this run; these are research bounds, not a production schema.

## Existing-reader integration gate

FACT — Existing Ethereum header/body/receipt/sender readers validate different, already-defined input boundaries. No deployed claim-event ABI or authenticated admission/debit exists for this candidate. A matching journal hash authenticates only caller selection of bytes; it establishes neither canonical history nor completeness, signatures, finality or real balances. No generated journal was represented as an accepted Ethereum capture.

Before a chain adapter can be accepted:

1. Define and review the contract event and action schema, including fee debit, earning root, account, profile and immutable record identity. Do not infer economic facts from an arbitrary caller-authored journal.
2. Feed only events from successful, ordered transactions through existing header/body/receipt/sender checks with explicit chain/deployment/checkpoint selection. Bind emitting address and code generation; reject missing, duplicate, reordered or cross-contract observations.
3. Reconstruct fee backing and account claims from those validated events; independently compare final contract state. State-machine replay alone cannot prove what executed.
4. Test replacement branches from retained raw captures, including orphaned fee admissions, claims and transfers. Rebuild claim markers and budgets from the selected branch without an administrator reset.

No external audit, real token backing, production rollback, resource-hardening proof, NFT beneficiary rule or C-007 resolution is claimed. README updates remain paused.


## Candidate event codec

[Draft event layout](C007_CLAIM_EVENT_SCHEMA.md) provides a tested unverified decoder and producer/reader integration gates. It is not an authenticated event adapter or deployed ABI.
