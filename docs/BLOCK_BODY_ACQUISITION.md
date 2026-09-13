# Acquiring complete block bodies

Alpha.40 captures actual raw transaction bytes from a fresh isolated Anvil run. All 30 captured blocks pass the existing header, transaction-root and receipt-root checks. The stricter acquisition verifier rejects all 30 with `BLOCK_BODY_TRANSACTION_HASH`: Anvil's impersonated transaction labels differ from the standard Keccak hashes of the returned envelopes. The original observations and the rejection are retained unchanged.

The run acquired 15 blocks on each of two branches through 822 local RPC requests. The branches share a prefix and one synthetic node. All observed transaction envelopes are legacy type 0. These are complete byte captures under supplied London headers; they do not establish independently operated providers, authenticated senders, signatures, execution, consensus or finality.

## Capture and verification boundaries

The [runner](../experiments/paid-body-acquisition/run_body_acquisition.py) preserves the existing contracts, synthetic-node guard, number and hash history collectors, and controlled ancestor rollback. It retires the writer before each branch's read phase. After both history collectors agree, the [body collector](../experiments/paid-body-acquisition/collect_body.py) receives an explicit block number/hash selection and fetches its own headers and body.

For each selected block, it reads number and hash headers, fetches each complete envelope with `eth_getRawTransactionByHash` and its receipt, then repeats both header reads. Missing data, changed fields, inconsistent metadata and exceeded bounds reject acquisition. There is no reconstruction from transaction summaries, raw-encoding fallback or retry against another endpoint. The [new node wrapper](../experiments/paid-body-acquisition/body_node.py) allows raw requests only through a current body lease and only for transaction hashes learned from that lease's bounded header responses. Restoring or closing a branch retires its lease.

The [offline verifier](../experiments/paid-body-acquisition/verify_body.mjs) captures the supplied body and separate selection together. It calls the unchanged [alpha.39 inspector](BLOCK_TRANSACTION_COMMITMENTS.md) to check the selected London header, both complete tries, and transaction/receipt association by contiguous index and type. It then requires the header's transaction list and every receipt's `transactionHash` to equal the hash calculated from the corresponding raw envelope. Passing the roots does not bypass that last requirement.

RPC receipt fields such as `from`, `to` and `blockTimestamp` are metadata outside the receipt trie. The collector preserves them and accepts matching integer or hexadecimal receipt timestamps; log timestamps may use either matching representation too. These checks establish observation consistency. They do not turn RPC metadata into sender or execution proof. The header's own `timestamp` is a separate field inside the checked header encoding.

## Why the retained captures reject

Anvil's [version-pinned impersonation wrapper](https://github.com/foundry-rs/foundry/blob/v1.8.1/crates/anvil/core/src/eth/transaction/mod.rs#L73-L95) derives its local transaction label by hashing the encoded transaction followed by the impersonated sender address. Its EIP-2718 encoding still returns the transaction itself. For the legacy envelopes observed here, that explains why the ordinary raw-byte hash differs from the RPC lookup label while the transaction trie still matches.

The separate [Python hash diagnostic](../experiments/paid-body-acquisition/check_raw_hashes.py) reproduces the ordinary raw-byte hash mismatch for all 30 observations. Its [retained result](../experiments/paid-body-acquisition/raw-hash-check.json) also matches every local label with `Keccak(raw || receipt.from)`. This reuses the pinned Python fixture primitive rather than JavaScript; it is not a third independent cryptographic implementation. A diagnostic comparison with that formula can describe this legacy fixture's label convention. It cannot authenticate the supplied `from`, verify a signature or authorize a different hash rule. The acquisition verifier continues to reject these captures. No labels, receipts, raw bytes or selected headers are replaced to manufacture an accepted result.

The next acceptance fixture needs freshly acquired, locally signed, non-impersonated top-level transactions under reviewed local guards. No paid-history adoption, recovery reader, observer or provider-comparison integration is added by this increment. Their existing transaction summaries gain no stronger authentication from this experiment.

## Offline reproduction

The retained [body captures](../experiments/paid-body-acquisition/body-captures.json), [provenance](../experiments/paid-body-acquisition/provenance.json) and [compressed execution trace](../experiments/paid-body-acquisition/execution-trace.json.gz) preserve acquisition evidence separately from cryptographic acceptance. A recorded runner `status: pass` means the bounded acquisition completed; it does not mean the strict body verifier accepted it.

From the repository root, use the pinned runtimes and existing resource supervision. These tests do not start a node:

```sh
python -I -B experiments/paid-body-acquisition/test_body_node.py
python -I -B experiments/paid-body-acquisition/test_collect_body.py
python -I -B experiments/paid-body-acquisition/check_raw_hashes.py --input experiments/paid-body-acquisition/body-captures.json
node --max-old-space-size=256 --test --test-isolation=none --test-concurrency=1 --test-timeout=30000 tests/block-body-capture.test.mjs
```

The [extractor](../experiments/paid-body-acquisition/extract_body_evidence.py) checks the supplied trace and input pins, binds captures to retained raw RPC responses, and replays collection offline. It writes `body-captures.json`, `provenance.json` and `execution-trace.json.gz` only into a new directory. Cryptographic verification remains a separate step. Decompress the retained trace into a working file named `execution-trace.json`, then replay it into a new directory:

```sh
python -I -B experiments/paid-body-acquisition/extract_body_evidence.py --trace execution-trace.json --inputs experiments/paid-body-acquisition/experiment-inputs.json --expected-input-sha256 6807d8c14817a6fde6d71cf622f3f509261b722ff85784c296caae0cad177183 --output-dir body-evidence-recheck
```

Run the following JavaScript as a Node ES module from the repository root. Each explicit sample selection is copied from the retained fixture, so its hash remains a fixture assumption, not an independently authenticated checkpoint. Unexpected acceptance or a different rejection fails the example.

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectBlockTransactionReceipts } from './reference/ethereum-block-transactions.mjs';
import { inspectBlockBodyCapture } from './experiments/paid-body-acquisition/verify_body.mjs';

const fixture = JSON.parse(readFileSync('experiments/paid-body-acquisition/body-captures.json', 'utf8'));
assert.equal(fixture.schema, 'caw-local-body-captures/1');
const captures = [...fixture.branches.left, ...fixture.branches.right];
assert.equal(captures.length, 30);
const commitments = [];
let hashLabelRejections = 0;
for (const body of captures) {
  const selected = {
    schema: 'caw-block-body-selection/1', profile: 'london-16',
    number: body.selection.block_number, hash: body.selection.block_hash,
  };
  commitments.push(inspectBlockTransactionReceipts(
    body.header, body.raw_transactions, body.receipts,
    { schema: 'caw-block-transactions-selection/1', profile: selected.profile, hash: selected.hash }
  ));
  assert.throws(() => inspectBlockBodyCapture(body, selected),
    { code: 'BLOCK_BODY_TRANSACTION_HASH' });
  hashLabelRejections++;
}
console.log(JSON.stringify({
  blocks: captures.length,
  commitmentChecksPassed: commitments.length,
  hashLabelRejections,
  senderVerified: commitments.some(value => value.senderVerified),
  endpointAuthenticated: commitments.some(value => value.endpointAuthenticated),
}));
```

The expected output is `{"blocks":30,"commitmentChecksPassed":30,"hashLabelRejections":30,"senderVerified":false,"endpointAuthenticated":false}`.

**24 focused checks, 814/814 full-suite Node tests and 46 Python tests passed.** Offline extraction replay and the guide example passed. The separate build retained 22 byte-identical frontend assets.

## Bounds and remaining trust

The collector admits at most 256 transactions per block, 16 KiB per raw envelope, 1 MiB of total raw bytes, 516 requests and 4 MiB of observed decoded JSON per block. Its header bound is 64 KiB; receipt/log and structural limits also apply. The unchanged inspectors retain their own smaller nested bounds, including 8 KiB calldata and the receipt invocation's 4 MiB capture budget. These are implementation admission limits, not Ethereum block limits.

The inherited Windows guard pins Anvil 1.8.1, binds its owned listener to `127.0.0.1:18545`, creates no generated accounts, and starts a fresh London chain with ID 31337. It retains the 512 MiB node cap, 600-second deadline, 1 MiB response cap, 4 MiB trace cap, 1,800-request limit and 250 local transaction-attempt limit. The recorded outer supervisor further limited the controller and node together to 512 MiB, two processes and 300 seconds. Startup requires 768 MiB free memory and 2 GiB free disk. The captured run used no external provider, forwarded no upstream requests and released its listener. The synthetic token and local impersonation are explicit test overrides.

The process, transport and node are shared trust. Read leases constrain reviewed code in that process; they do not isolate a hostile collector. Repeated headers can miss changes after the last read or changes away and back between observations. Neither a consistent retained trace nor matching commitment roots authenticates its producer or chooses a canonical public chain. Sender, signature, endpoint, execution, freshness and finality claims remain false.
