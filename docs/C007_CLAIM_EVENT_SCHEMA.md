# C-007 — Candidate claim-event layout

DRAFT_EVENT_LAYOUT_NOT_ADOPTED. Parent `376012c5adbe57ea199a82a8fde3f884a7163e31`, draft PR19. A preparatory codec for [claim reconstruction](C007_CLAIM_RECONSTRUCTION_RESEARCH.md); not a deployed ABI, accepted protocol rule or extension of the frozen settlement contract.

## Proposed events

```solidity
event ResearchFeeAdmitted(
    bytes32 indexed recordId, uint256 indexed payerAccount,
    uint256 epoch, uint256 nonce, uint256 fee, bytes32 stakeRoot,
    uint256 totalStake, uint256 payerStake, bytes32 profile
);
event ResearchFeeClaimed(
    bytes32 indexed recordId, uint256 indexed accountId, uint256 amount
);
```

The first carries the proposed earning snapshot and debit amount. The second identifies an account credit, not a payment to the submitting wallet. The candidate record commitment uses chain and emitting contract from an independently selected context, plus payer/epoch/nonce/fee/root/total/profile; payerStake must be separately checked against that root. These event definitions do not implement those checks or adopt the research SHA256 commitment as a production signing scheme.

Any eventual producer must emit admission only after authorized nonce consumption, fee debit and snapshot binding succeed atomically. Claim emission must follow allocation verification and duplicate-claim marking in the same successful transition. A codec cannot enforce that a contract follows those rules.

## Codec boundary

`decodeCandidateLog(log, expectedEmitter)` takes a minimal plain object with exactly address/topics/data. It checks selected emitter, exact topic count and word widths, recognized event selector, and exact static data length. Integers are returned as decimal strings, preserving uint256 values without JavaScript number truncation. All outputs carry `verification: UNVERIFIED_EVENT_LAYOUT_ONLY`.

The function does NOT check receipt inclusion/status, canonical chain, block/transaction/log ordering, runtime hash, signature, fee transfer, record commitment, stake proof or claim amount. A selected emitter address alone is not deployment authentication. Do not strip provenance from a raw log and then call the result verified. A future adapter must retain validated receipt and selection context alongside the decoded fields.

Inputs are locally captured plain data. This is not a hardened parser for hostile JavaScript accessors/proxies, a network collector or a complete receipt validator. It deliberately rejects extra fields such as a caller-supplied verified flag; raw RPC envelopes require a separately reviewed adapter.

## Reproduction

With the existing pinned ethers6.16.0 dependency available:

`node --max-old-space-size=256 integration/core-baseline-v1/test-c007-claim-event-codec.mjs`

FACT — Node20.20.2 and ethers6.16.0 encoded candidate logs that the manual fixed-word decoder read correctly in four cases: admission, claim, maximum uint256 claim and zero claim. Ten mutations were rejected: wrong emitter, unknown/missing/extra topic, short/nonhex indexed word, short/trailing/nonhex data and extra field. [Saved result](../evidence/claim-event-codec-20261108/result.json) records selectors and scope. No dependency was installed for this run.

An altered fee999 encoded correctly and remained explicitly unverified. This control prevents interpreting ABI readability as proof of authorization or custody. Ethers is a separate ABI implementation, but these fixtures and checks were authored in this work; they are not external peer review.

## Remaining integration gates

1. Explicitly review rounding, account entitlement, snapshot timing and funded admission policy before claiming the schema represents agreed C-007 behavior.
2. Bind decoded admission fields to the selected chain/contract generation and exact authorized action; verify the fee debit and account epoch/nonce, not just an event ID.
3. Consume only successful, ordered events through existing header/body/receipt/sender verification. A failed transaction, duplicate/reordered observation, unrelated emitter or orphan branch must not create claim state.
4. Verify claim allocation against the earning snapshot, reconcile credited/unclaimed totals with independently observed contract state and backing, and preserve transfer/withdrawal rights under reviewed rules.

No contract or parameter changed. Original-token proof and C-007 decisions remain open. README updates remain paused; hosted CI remains deferred.
