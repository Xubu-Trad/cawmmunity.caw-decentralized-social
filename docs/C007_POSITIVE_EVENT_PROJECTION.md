# C-007 — Positive projection with explicitly synthetic receipts

SYNTHETIC_NOT_EXECUTED_EVENT_PROJECTION. Parent `dac7ff7500334938cccff95333d72d5252aa3598`, draft PR19. Closes the finite positive event-to-sender test gap identified in [body composition](C007_BLOCK_EVENT_COMPOSITION.md), but does not supply executed admission or funding evidence.

## What was constructed

The generator reuses one disposable-test signed transaction from the hash-pinned retained local capture. It independently constructs a new synthetic header, transaction root and receipt root using the existing Python primitives. The receipt contains the proposed admission and claim logs. **Those logs were not produced by the retained transaction.** Its original capture remains unchanged. The new file is named synthetic-not-executed.json and carries explicit synthetic/no-execution markers.

This deliberate fixture tests the boundary between commitment verification and execution truth. The synthetic header has no canonical ancestry or state-transition proof; its receipt gas and logs are fixture data, not the transaction's historical outcome. A valid signature on the reused transaction does not authorize these fabricated logs or any CAW fee.

## Results

The unchanged adapter reconstructed both transaction and receipt commitments and returned two events in positions(0,0) and(0,1), each attached to the transaction hash and recovered sender. Ethers6.16.0 independently agreed on the hash and recovered sender for the same signed bytes. This is another implementation comparison, not new external peer review.

Five changes rejected under the original selected header: altered signed bytes, changed claim-event payload, removed log, reordered logs and duplicate log. Forged RPC hash/sender labels did not affect the derived result. Returned event rows are immutable.

The adapter correctly retained false for executionVerified, cawActionAuthorityVerified, feeBackingVerified, chainAuthenticated, consensusVerified and finalityVerified. Its signature/commitment checks are therefore not an acceptance gate for funded protocol state by themselves. This is expected behavior, not a newly found failure of the existing readers.

## Reproduce

With existing ethers6.16.0:

`node --max-old-space-size=256 integration/core-baseline-v1/test-c007-positive-block.mjs evidence/positive-claim-block-20261108/synthetic-not-executed.json`

Regenerate into a new output path:

`python3 integration/core-baseline-v1/make-positive-claim-block.py /absolute/path/to/repository evidence/c007-new-owner-replay-20261108/acquired-history.json evidence/claim-receipts-20261108/fixtures.json /absolute/path/to/new-synthetic-not-executed.json`

The generator verifies the original capture hash and refuses to overwrite its output. [Fixture](../evidence/positive-claim-block-20261108/synthetic-not-executed.json) and [result](../evidence/positive-claim-block-20261108/result.json) preserve the synthetic distinction. No wallet service, transaction broadcast or deployment was used.

## What remains

The adapter's positive projection path now has finite coverage, while actual funded admission remains absent. Next work must validate the proposed producer's authorization/debit/state transitions or expose a deliberately unfunded producer as a negative control. Neither a decoder, a matching commitment nor an emitted event alone proves payment. Do not change accepted economics, NFT ownership rules or deployment authority to bypass these gates.

No contracts, constants or README changed. C-007 and original-token proof remain open; hosted CI remains deferred.


## Executed negative control

[Unfunded local emitter](C007_UNFUNDED_EMITTER_CONTROL.md) actually emits consistent records without moving mock tokens. This confirms why execution must remain separate from economic authorization and backing.
