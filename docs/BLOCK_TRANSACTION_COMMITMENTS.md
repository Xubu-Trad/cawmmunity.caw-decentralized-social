# Transactions and their receipts

Alpha.39 checks complete encoded transaction bytes against a selected block header. It then offers a separate check that associates each transaction with the receipt at the same index. This is a reference component for future recovery work; the frontend remains a local simulation.

A receipt contains status and logs. Its transaction hash is supplied as RPC metadata and does not enter the receipt trie. To associate that status with a particular destination and message, the complete encoded transaction must also match the transaction root in the same checked header. [EIP-2718](https://eips.ethereum.org/EIPS/eip-2718) defines both index-keyed tries and requires matching transaction and receipt types.

## Inputs and use

The new [module](../reference/ethereum-block-transactions.mjs) exports two explicit APIs:

- `inspectBlockTransactions(header, rawTransactions, selection)` checks the complete ordered transaction set.
- `inspectBlockTransactionReceipts(header, rawTransactions, receipts, selection)` checks both sets and associates their consensus payloads by index and type.

Both require exactly their declared arguments. The selection is exactly `{schema: 'caw-block-transactions-selection/1', profile: 'london-16', hash}`. The hash and fork profile are caller-selected assumptions. Omission, a later profile or an unknown field fails. Transaction input is an array of lowercase `0x`-prefixed byte strings; it is not an array of RPC transaction summaries or hashes.

```js
import { readFileSync } from 'node:fs';
import { inspectBlockTransactionReceipts } from './reference/ethereum-block-transactions.mjs';

const fixtures = JSON.parse(readFileSync('reference/fixtures/block-transactions-v1.json', 'utf8'));
const sample = fixtures.cases.find(value => value.name === 'mixed-types-contract-creation-and-data-boundaries');
const checked = inspectBlockTransactionReceipts(
  sample.header, sample.raw_transactions, sample.receipts, sample.selection
);
console.log(checked.transactionCommitmentVerified);
console.log(checked.receiptCommitmentVerified);
console.log(checked.transactionAssociationVerified);
console.log(checked.signaturesVerified);
console.log(checked.executionVerified);
console.log(checked.endpointAuthenticated);
```

This synthetic example is expected to print three `true` values followed by three `false` values. It creates no wallet, connection or transaction.

## What is checked

The unchanged [execution-header inspector](EXECUTION_HEADER_INTEGRITY.md) first checks the London-format header encoding and selected hash. Each transaction then undergoes bounded parsing with exact RLP consumption: canonical length forms, minimal integer encodings, exact field counts, destination length and access-list structure. Legacy transactions and typed envelopes 1 and 2 are supported. The type byte belongs outside the typed payload's RLP list. Unknown types and later formats fail explicitly.

Legacy envelopes contain exactly nine fields; type 1 contains eleven and type 2 contains twelve. Each integer must be a minimal unsigned value of at most 32 bytes, with zero encoded as an empty RLP byte string. This is a structural bound, not verification of each field's consensus limits. A destination must be empty for contract creation or exactly 20 bytes. Typed `yParity` must be zero or one; legacy `v` must be 27, 28 or at least 35. The latter admits the [EIP-155](https://eips.ethereum.org/EIPS/eip-155) shape without selecting or verifying a network.

The transaction hash is Keccak-256 of the complete supplied encoding, including signature fields. The transaction trie uses the un-hashed RLP encoding of the unsigned index as its key and the complete transaction encoding as its value. Reordering, removing or altering entries changes the commitment and fails against an unchanged selected header. The empty list must match the empty trie root.

The composition calls the unchanged [receipt inspector](BLOCK_RECEIPT_COMMITMENTS.md). Both complete roots must match the same selected header; transaction and receipt counts and types must match at every index. Returned associations use calculated transaction hashes and verified receipt encodings. Supplied RPC `transactionHash`, `from` and similar summaries are not used to establish the association. Header `transactions` metadata is also not the source of transaction bytes.

Outputs are frozen and contain captured data. Verification flags describe only the relevant commitment check. The older header inspector and receipt-only inspector keep their original flags; the new composition supplies the narrower transaction-association result.

The standalone result uses schema `caw-block-transactions-integrity/1` and includes `transactionCount`, `transactionsRoot`, `header_integrity` and `transactions`. Each transaction contains its numeric `index`, hex-quantity `type`, computed `hash`, complete `encoded` bytes and decoded fields. These include `nonce`, `gasLimit`, `to`, `value`, `data`, the applicable fee fields and signature fields. Typed transactions additionally include `chainId` and `accessList` entries shaped as `{address, storageKeys}`. Integers are returned as canonical hex quantities; an empty destination is `0x`. Legacy `v` is returned directly; a legacy chain ID is not derived, and no `from` address is returned.

The combined schema is `caw-block-transaction-receipts-integrity/1`. It includes both inspector results as `transaction_integrity` and `receipt_integrity`, both checked lists, and `associations` containing `{index, transactionHash, transactionEncoded, transactionType, receiptEncoded, receiptType}`. Only this combined result sets `transactionAssociationVerified` to `true`, after both roots and the corresponding counts and types pass. This association remains conditional on the supplied checked header.

## What remains open

The module does not recover a sender, check an ECDSA signature, establish network identity or replay EVM execution. Correctly shaped signature fields can still describe an invalid signature: zero `r` or `s` and high-`s` values are accepted if their integer encodings satisfy the structural checks. `signaturesVerified`, `senderVerified`, `transactionsVerified` and `executionVerified` remain `false`. A hash binds bytes; it does not prove that a transaction was valid or executed.

Root consistency under a supplied header does not authenticate the endpoint, establish consensus, choose a canonical chain, prove freshness or establish finality. The selected fork profile is not an independently verified fork schedule. Gas affordability, account nonce state and protocol accounting are outside this component.

No existing recovery reader, action observer or provider comparison calls these new APIs yet. Adoption integration requires complete signed-byte acquisition and explicit handling of unsupported profiles, failed checks and trust policy. The retained alpha.28 histories contain transaction call summaries such as `from`, `to`, `data`, `gas`, `gasPrice` and `value`; they omit the complete signed envelopes needed here. Their receipt checks remain useful, but those summaries cannot substitute for missing transaction bytes.

## Bounds

The complete invocation is captured before semantic checks using own data descriptors. Getters, sparse arrays, unexpected prototypes and cycles fail. Hostile Proxy traps and replaced native built-ins remain outside this same-process plain-data boundary.

| Admission measure | Maximum |
| --- | ---: |
| Transactions per block | 256 |
| Encoded bytes per transaction | 16,384 |
| Total encoded transaction bytes | 1,048,576 |
| Calldata bytes per transaction | 8,192 |
| Access-list entries per transaction | 64 |
| Total access-list storage keys per transaction | 256 |
| Combined weighted input capture | 8 MiB |

These bounds apply together; a transaction combining maximum calldata and maximum access-list contents may exceed the encoded-byte limit. Per-transaction RLP parsing also allows at most 2,048 items and a maximum depth of 8. Capture permits 100,000 visited values, depth 20, 2,048 array elements, 64 object keys and 262,144 UTF-16 code units per string, subject to the shared weighted-byte budget.

The complete combined invocation is captured first. Composition subsequently calls both public inspectors, so their own capture and semantic limits still apply, including the unchanged 64 KiB header capture and 4 MiB receipt-invocation capture. The 8 MiB combined budget does not replace those smaller limits. These are finite reference-implementation admission limits, not Ethereum block limits or exact process-memory guarantees. Access-list duplicates remain ordered and are permitted by [EIP-2930](https://eips.ethereum.org/EIPS/eip-2930).

## Reproduction and evidence

**86 focused checks and 790/790 full-suite tests passed.** The separate build retained 22 byte-identical frontend assets. The guide example passed. New vectors are synthetic and independently assembled in Python with the disclosed shared primitives.

The [Python generator](../reference/fixtures/generate-block-transactions-fixtures.py) assembles the [synthetic vectors](../reference/fixtures/block-transactions-v1.json) without importing the JavaScript checker. It reuses the pinned Python Keccak/RLP/trie primitives and receipt assembly code; this is independent transaction assembly, not another independent implementation of every primitive. Cases demonstrate formatting and commitment behavior, not actual signed or executed network transactions.

The [tests](../tests/block-transactions.test.mjs) cover independent roots and encoded-byte hashes, transaction ordering and content changes, malformed envelopes and canonical encodings, index boundaries, inconsistent transaction/receipt types and counts, untrusted RPC metadata, frozen capture and admission limits. No new network capture or blockchain experiment is claimed.

From the repository root, using the pinned runtime and existing resource guard:

```sh
python3 -B reference/fixtures/generate-block-transactions-fixtures.py
node --max-old-space-size=256 --test --test-isolation=none --test-concurrency=1 --test-timeout=30000 tests/block-transactions.test.mjs
```

The generator writes only its adjacent fixture file. Source and fixture hashes are in the [source manifest](../evidence/CODE_SHA256SUMS.txt); measured checks and limits are in the [current receipt](../evidence/TEST_RESULTS.json). Previous alpha.38 evidence is preserved separately.

Primary encoding references: [EIP-2718](https://eips.ethereum.org/EIPS/eip-2718), [EIP-2930](https://eips.ethereum.org/EIPS/eip-2930), [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559), [RLP](https://ethereum.org/developers/docs/data-structures-and-encoding/rlp/) and the [transaction trie](https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/). No third-party implementation code was copied into this increment.

Alpha.40 adds [live local acquisition of complete encoded bodies](BLOCK_BODY_ACQUISITION.md). The separate wrapper requires RPC transaction-hash labels to match hashes of the captured bytes after both roots pass. These local envelopes use impersonated accounts; no sender, signature or execution proof is added. The alpha.39 APIs remain unchanged.
