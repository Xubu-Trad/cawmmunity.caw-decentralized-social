# Verify a block's receipt record

Alpha.38 adds a bounded offline check that recomputes a complete block's receipt trie and matches its root to a header whose hash has also been checked. This binds the supplied receipt status, cumulative gas, bloom and log payloads to that selected header's receipt commitment.

**41 focused checks and 704/704 full-suite tests passed.** The separate build retained 22 byte-identical frontend assets. The guide example passed; tests reuse retained local captures and independently assembled synthetic cases.

This is a standalone [reference module](../reference/ethereum-block-receipts.mjs). It does not yet connect receipt verification to paid-history adoption or provider comparison. It accepts the explicit `london-16` header layout and receipt types `0x0`, `0x1` and `0x2`. Earlier receipt formats, later types and other header layouts are rejected by this interface. Selecting a layout does not establish which fork is active on a network.

## Reproduce a retained block

Run this as an ES module from the repository root with the pinned Node runtime. The input is an existing controlled local capture; this example makes no network request.

```js
import { readFileSync } from 'node:fs';
import { inspectBlockReceipts } from './reference/ethereum-block-receipts.mjs';

const history = JSON.parse(readFileSync(
  'experiments/paid-reorg/history-left-number.json', 'utf8'));
const block = history.blocks[11];
const result = inspectBlockReceipts(
  block.header,
  block.transactions.map(item => item.receipt),
  { schema: 'caw-block-receipts-selection/1', profile: 'london-16', hash: block.header.hash }
);
console.log(result.receiptCount); // 1
console.log(result.receiptCommitmentVerified); // true
console.log(result.receiptSetCompleteUnderRoot); // true
console.log(result.receipts[0].status); // 0x1
console.log(result.transactionAssociationVerified); // false
console.log(result.endpointAuthenticated); // false
```

The selected hash comes from the retained fixture for reproduction. It is not a separately authenticated public-chain checkpoint. The complete set must include every receipt in its original index order, including receipts unrelated to CAW. A filtered set of interesting events is insufficient.

## What is checked

The checker captures the three inputs, validates their schemas and limits, and recomputes the header hash with the existing [header inspector](EXECUTION_HEADER_INTEGRITY.md). No partial result is returned after a failure.

For each receipt, the trie key is the RLP encoding of its numeric index, without hashing that key first. The value contains status, cumulative gas, bloom and ordered log payloads. Legacy receipts use the RLP list directly; types 1 and 2 prepend their type byte to that encoded list. The checker rebuilds the full trie and requires its hash to equal the header's `receiptsRoot`. These encoding rules come from [EIP-2718](https://eips.ethereum.org/EIPS/eip-2718), [EIP-2930](https://eips.ethereum.org/EIPS/eip-2930) and [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559).

Status is restricted to failure or success, following [EIP-658](https://eips.ethereum.org/EIPS/eip-658). Each log has an address, zero to four topics and byte data. Blooms are recomputed from addresses and topics; data bytes do not contribute to the bloom. The combined bloom must match the header. Cumulative gas must increase with each receipt and end at the header's gas-used value. Empty receipt sets require the empty trie root, zero gas used and an empty bloom. Trie construction follows the [Ethereum trie specification](https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/); the bloom bit convention can also be checked in the [client implementation](https://github.com/ethereum/go-ethereum/blob/master/core/types/bloom9.go).

The RPC receipt index must match its array position, and its block hash and number must match the selected header. Supplied log `blockHash`, `blockNumber` and `transactionIndex` must match the enclosing block and receipt; `logIndex`, when present, must equal its derived global position in the block. A log marked removed is rejected. Log transaction hashes and timestamps are only captured within the input bounds and omitted from the result. These metadata checks catch contradictions; they do not add fields to the receipt commitment. The header's gas-used value must also fit its gas limit.

## Read the result correctly

The immutable result uses schema `caw-block-receipts-integrity/1`. It includes the profile, block hash and number, receipt count, matched root, the header-integrity result, and ordered consensus-only receipt records. Each record includes its numeric `index`, receipt type, status, cumulative gas, bloom, normalized log payloads and canonical `encoded` bytes.

`receiptCommitmentVerified` and `receiptSetCompleteUnderRoot` are true only after the complete comparison succeeds. Completeness is relative to the selected root and the supported encoding, relying on the cryptographic hash commitment. It does not authenticate the root's origin.

**A receipt does not commit to the transaction hash, sender, recipient or calldata.** Those RPC fields are omitted from the verified result. The checker does not prove that a given message produced a given receipt, that receipt and transaction types correspond, or that a transaction exists under the header's transaction root. It does not verify signatures, execute transactions or reconstruct CAW accounting. The unchanged [checked provider comparison](HEADER_CHECKED_PROVIDERS.md) therefore cannot yet treat this new evidence as an authenticated action result.

`transactionAssociationVerified`, `transactionsVerified`, `executionVerified`, `endpointAuthenticated`, `consensusVerified`, `finalityVerified` and `freshnessVerified` remain false. The nested header report retains its earlier flags, including `bodyCommitmentsVerified: false`; the new receipt-specific flags describe the narrower work done by this module. Transaction inclusion and an independently justified endpoint policy remain separate requirements.

## Bounds and evidence

| Limit | Bound |
| --- | --- |
| Receipts per block | 256 |
| Logs | 64 per receipt, 512 per block |
| Topics and log data | Four topics; 8 KiB data per log |
| Encoded receipts | 16 KiB each; 1 MiB combined |
| Plain-data capture | 4 MiB weighted data; 100,000 values; depth 20; arrays up to 2,048 entries |

The inherited per-header and hash-input limits also apply. Limits are admission bounds, not exact serialized sizes or operating-system memory guarantees. Accessors, cycles, sparse arrays and exotic prototypes are rejected. Hostile Proxy traps and replaced native built-ins remain outside the same-process plain-data boundary.

The [tests](../tests/block-receipts.test.mjs) check the unchanged retained branch captures against their recorded receipt roots. Additional [synthetic fixtures](../reference/fixtures/block-receipts-v1.json) exercise typed receipts, empty sets and multi-receipt trie branching. Their [Python generator](../reference/fixtures/generate-block-receipts-fixtures.py) assembles expected encodings and roots separately from the JavaScript module while reusing the project's pinned Python primitives. This is cross-language construction evidence, not an external audit or another independent cryptographic implementation. Synthetic fixtures are encoding cases, not claims of valid executed blocks.

To regenerate those fixtures, run `python reference/fixtures/generate-block-receipts-fixtures.py` under the existing resource limits, then run the tests. The generator performs no network request and writes only its adjacent JSON fixture. Current commands, hashes and limits are in the [review guide](REVIEW_GUIDE.md) and [test receipt](../evidence/TEST_RESULTS.json).

Next: bind complete signed transaction bytes to the header's transaction root, associate transactions and receipts by the committed index, then compose that evidence with selected-history adoption. Authentication, confirmation policy and deployment remain [open gates](ROADMAP.md).
