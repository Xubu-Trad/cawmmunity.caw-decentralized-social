# Signed history through the existing readers

## Result — November 8, 2026

The constructor lifecycle was reacquired on a fresh local Anvil run. The existing execution-header, transaction-trie, receipt-trie and secp256k1 sender readers reconstruct the ordered 26-transaction history across blocks 1–26: 18 successful receipts and eight expected failures. The output retains decoded signed transactions, recovered senders, receipt status/logs and index-bound associations. Sender recovery here uses the existing reference implementation rather than ethers, which signed the transactions.

Nine altered-input controls reject: missing middle block, missing tail, reordered blocks, changed raw transaction, missing transaction, changed receipt status, missing receipt, wrong chain ID and altered event bytes. The existing three reader regression files pass 167/167 tests, with their source/fixtures verified against the preceding PR head. This is a scoped regression run, not the full repository suite.

## Explicit boundaries

Transaction, receipt and sender readers now admit the explicit Shanghai header profile as well as London. Shanghai permits at most 32 KiB per encoded transaction and 24 KiB calldata to accommodate the full stake proofs; London's original 16 KiB/8 KiB limits remain. Other aggregate limits remain unchanged. Only legacy/type-1/type-2 envelopes are supported.

The first attempted run rejected Anvil's genesis because it exposes extra fork fields. That failed lane remains preserved locally. No header fields were stripped and no hash checks disabled. The raw genesis is retained, while verified history starts at block 1 as an explicit checkpoint; genesis ancestry is not verified. Both deployment transactions are within the checked interval.

The selected first/last hashes come from this local capture. They are assumptions, not independently authenticated endpoints. A fabricated self-consistent chain is outside this guarantee. Transaction and receipt roots, hashes and recovered senders establish internal consistency, not consensus, finality, contract execution correctness or account authorization. State roots are not replayed. The lifecycle harness separately checks accounting against the running local EVM; this reader result does not independently reconstruct final balances or NFT ownership.

## Reproduce

No packages are required for the offline reader step (recorded Node 20.20.2):

```sh
node --max-old-space-size=256 experiments/c007-constructor/check-history.mjs evidence/c007-history-reader-20261108/acquired-history.json /absolute/path/to/new-verified-history.json
node --test --test-concurrency=1 tests/block-transactions.test.mjs tests/block-receipts.test.mjs tests/block-senders.test.mjs
```

The [complete raw capture and checked history](../evidence/c007-history-reader-20261108) are synthetic local data. The signed lifecycle harness now also saves every block/raw transaction/receipt from genesis to tip. Its earlier evidence remains unchanged. The [signed lifecycle instructions](SIGNED_LOCAL_LIFECYCLE.md) describe fresh acquisition.

Follow-up: [accounting and ownership reconstruction](ACCOUNTING_RECONSTRUCTION.md) now matches all 18 local final snapshot fields, with ten semantic rejection controls. Final-state storage proofs, independent acquisition and endpoint trust remain open. Three synthetic accounts, mock token, provisional economics/text policy, NFT admission and production gates remain unresolved. Draft PR #19 remains stacked on #18, not merged or release-approved.
