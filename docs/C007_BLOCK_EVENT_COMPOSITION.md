# C-007 — Transaction-body, receipt and sender composition

RESEARCH_NOT_ADOPTED. Parent `befb4c530bd54dde7251874e43985ca96ff4fba4`, draft PR19. Extends [receipt event inspection](C007_RECEIPT_EVENT_ADAPTER.md). Existing verification readers and frozen contracts remain unchanged.

## What the wrapper adds

`inspectCandidateBlockEvents` calls the existing transaction/receipt association reader and sender reader under the same selected header and chain policy as the receipt adapter. Both roots are recomputed, receipt and transaction indices/types are joined, transaction signatures are checked and senders recovered. Unprotected legacy transactions are rejected by this profile. Event context chain must match the signature-selection chain.

The wrapper checks transaction hashes and raw encodings agree between the readers. Candidate events, when present, carry the hash and recovered sender from that index. The outer transaction sender is NOT assumed to be the CAW account owner: relays and contract wallets need separate action-level authority checks. A matching signed body and receipt commitment also do not prove that the claimed execution actually occurred on the canonical chain.

Outputs distinguish transaction signature verification from CAW action authority. Execution, fee backing, chain authentication, consensus and finality stay false. No caller-supplied verified flag is admitted. RPC from/to/transactionHash labels are not promoted into evidence.

## Retained-history reproduction

The input is the already-public local signed capture [acquired-history.json](../evidence/c007-new-owner-replay-20261108/acquired-history.json), SHA256 `689f880143cdc55f3016dcad42b70bb188af35ad296305e4ee42a9f058a76742`. Its bytes are checked before use. Blocks1–38 are checked with the existing Shanghai header-chain reader; retained genesis is outside this explicit checkpoint interval and no fields are stripped.

FACT — All38 transactions across38 blocks passed the composition. Eleven receipts report failure. There were **zero candidate claim events**, because the frozen research contract does not emit this proposed ABI. Therefore this run checks the body/receipt/sender composition and empty candidate-event path, NOT a successful candidate event-to-sender projection or funded admission.

Nine negative cases reject: altered raw transaction, missing/duplicate body, missing receipt, changed status, wrong signature chain, mismatched event-context chain, caller verified-selection flag, and the prior synthetic receipt-only fixture whose placeholder transaction root has no matching body. Forging RPC receipt from/to/transactionHash labels left the derived result unchanged.

No fresh local chain or EVM replay was run. Retained local signatures do not establish actual-token compatibility, canonical Ethereum finality, production correctness or new external review.

## Reproduce

With existing ethers6.16.0 available:

`node --max-old-space-size=256 integration/core-baseline-v1/test-c007-block-events.mjs evidence/c007-new-owner-replay-20261108/acquired-history.json evidence/claim-receipts-20261108/fixtures.json`

[Source pins](../evidence/claim-bodies-20261108/source-pins.json) and [result](../evidence/claim-bodies-20261108/result.json) capture the exact current-reader boundary. The run used Node20.20.2 and existing dependencies under resource guards.

## Open gate

A positive candidate event-to-sender fixture is still needed, clearly distinguishing a synthetic commitment from real executed evidence. Actual admission integration additionally requires the reviewed producer, authorized fee debit, authenticated deployment/checkpoint, stake membership and account-authority semantics. Keep C-007 open. Do not invent accepted economics to produce a green integration result. README updates remain paused; CI remains deferred.


## Positive projection follow-up

[Explicitly synthetic event projection](C007_POSITIVE_EVENT_PROJECTION.md) now exercises both event-to-sender rows. It deliberately does not claim that its constructed receipts were executed or funded.
