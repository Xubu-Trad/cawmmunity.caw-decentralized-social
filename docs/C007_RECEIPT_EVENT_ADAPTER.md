# C-007 — Receipt-commitment event adapter

RESEARCH_NOT_ADOPTED. Parent `d5f6c022310f1b38cca47b0efef57ddc3132a5fa`, draft PR19. Extends [admission record consistency](C007_ADMISSION_BINDING_RESEARCH.md). No settlement contract or economic decision changed.

## Composition with the existing reader

`inspectCandidateReceiptEvents(header, receipts, receiptSelection, context)` directly calls the unchanged `inspectBlockReceipts` reader. That reader recomputes the selected execution-header hash, receipt trie, blooms and contiguous receipt associations. It does not accept a caller's verified flag. The adapter then:

1. Rejects any failed receipt that contains logs; an empty failed receipt produces no candidate events.
2. Selects logs only from the explicitly supplied emitter; unrelated emitters are ignored. A selected-emitter log outside the draft candidate ABI fails closed in this restricted profile.
3. Decodes exact candidate layouts and checks admission record consistency under the supplied chain/contract/profile context.
4. Returns immutable event rows in receipt/log order, retaining block hash/number, transaction index and receipt-local log index. It does not copy unproven transaction hashes from RPC metadata.

The output status is RECEIPT_COMMITMENT_ONLY. Receipt commitments are verified under a caller-selected header. Transaction association, execution, signature, fee backing, chain authentication, consensus and finality remain false. Claim amounts are decoded, not proven economically valid by this layer; the stake proofs and claim-state rules remain separate.

## Evidence and limitations

The existing Python fixture generator and pinned Keccak/RLP/trie primitives assemble synthetic London headers and receipt sets. The existing JavaScript reader independently recomputes those commitments; the Python helper is reused, not a newly independent cryptographic library.

The valid fixture has admission in receipt0, an empty failed receipt1 and claim in receipt2. Two events are returned in positions(0,0) and(2,0); an unrelated-emitter fixture returns no events. Ten cases reject: failed receipt with logs, changed fee under the old record ID, missing/duplicate/reordered receipt, changed payload/status, wrong selected header, removed log and caller verified flag. Nested output mutation also rejects. A second retained run added the nested immutability check and reproduced the original fixture/result bytes exactly.

These fixtures are **not mined blocks or executed transactions**. Their transaction and state roots are explicitly synthetic placeholders from the existing generator; no body or state proof is claimed. A cryptographically self-consistent receipt set is not proof that a real contract emitted it. A failed receipt containing a log is deliberately assembled as an invalid-execution counterexample that the adapter must reject, even though its receipt commitment is consistent.

## Reproduction

With the existing ethers6.16.0 dependency:

`node --max-old-space-size=256 integration/core-baseline-v1/test-c007-receipt-events.mjs evidence/claim-receipts-20261108/fixtures.json`

To regenerate fixtures into a new path:

`python3 integration/core-baseline-v1/make-claim-receipt-fixtures.py /absolute/path/to/repository /absolute/path/to/new-fixtures.json evidence/admission-binding-20261108/vectors.json`

[Source pins](../evidence/claim-receipts-20261108/source-pins.json), [fixtures](../evidence/claim-receipts-20261108/fixtures.json) and [results](../evidence/claim-receipts-20261108/result.json) preserve the boundary. Node20.20.2, existing dependencies and resource guards were used. No receipt-reader source was modified.

## Remaining gates

Bind these observations to verified raw transaction bodies/senders and an authenticated deployment/checkpoint; preserve ABI generation and ordered-event completeness. Then connect authorized fee debits and stake membership to claim-state reconstruction and independently reconcile real backing. No production producer exists for these candidate events yet. Do not treat receipt inclusion or the chainId context field as an authorization or canonical-chain decision.

C-007, real-token evidence, NFT beneficiary/withdrawal rules and mainnet readiness remain unresolved. README updates remain paused; CI remains deferred.
