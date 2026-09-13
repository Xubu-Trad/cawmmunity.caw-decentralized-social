# Acquiring locally signed block bodies

Alpha.41 acquires fresh CAW synthetic-chain transactions signed by the two fixed public test identities. All 30 captured blocks are accepted by the unchanged strict [body verifier](../experiments/paid-body-acquisition/verify_body.mjs): both commitment roots, transaction/receipt association, and RPC transaction labels agree with the complete raw envelopes. The run contains 22 signed submissions and 884 local RPC requests. Its 15 captures per branch cover 20 distinct blocks; ten prefix blocks are observed on both branches. The owned listener was released and no upstream requests were forwarded.

This addresses the specific [alpha.40 rejection](BLOCK_BODY_ACQUISITION.md). Its impersonated envelopes still reject with `BLOCK_BODY_TRANSACTION_HASH`; that evidence and the verifier remain unchanged. The new result establishes bounded body integrity under supplied London headers. It does not establish a canonical public chain or authenticate a provider.

## Signing and acquisition

The [writer](../experiments/paid-signed-body-acquisition/signed_writer.py) derives and checks only the existing CAW test identities A and B. The former synthetic deployer/relayer role D maps to A for both the dry call and top-level transaction. Owner-sensitive calls still use A or B, and D remains available as read-call metadata. Deployment addresses and runtime expectations come from the new run's actual deployment receipts. No wallet import, real funds or external node is involved; local balance and synthetic-token overrides remain explicit fixture setup.

Every submitted envelope is legacy type 0 on chain 31337. The signing digest includes the chain ID and two zero fields, and `v = 2 * 31337 + 35 + parity`, following [EIP-155](https://eips.ethereum.org/EIPS/eip-155). Each send queries the latest nonce, including after ancestor rollback. The [codec](../experiments/paid-signed-body-acquisition/legacy_codec.py) enforces canonical nine-field RLP, zero value, gas price 100,000,000,000, at most 4,000,000 gas, a uint64 nonce, 16 KiB of raw bytes and 8 KiB of calldata. It also checks nonzero in-range signature scalars and low-s; those structural checks alone do not verify a signature.

The writer signs the Keccak-256 digest with secp256k1, normalizes s, then verifies the signature against the fixed test public key. Its `Prehashed(SHA256())` API call consumes the already computed 32-byte digest without applying SHA-256 again; see the [cryptography 50.0.1 Prehashed API](https://cryptography.io/en/50.0.1/hazmat/primitives/asymmetric/utils/#cryptography.hazmat.primitives.asymmetric.utils.Prehashed). The owned node's ecrecover precompile chooses the matching parity. The retained `known_test_public_key_signature_checked` and `local_precompile_parity_checked` observations describe this reviewed writer path. They are not an independently replayed generic sender verifier, and RPC `from` is not sender proof.

The [signed node wrapper](../experiments/paid-signed-body-acquisition/signed_node.py) permits one exact decoded payload per `submit_signed` call in a write phase. It refuses direct raw submissions, `eth_sendTransaction` and impersonation, clears permission after failures, and counts admitted raw attempts against the inherited transaction limit even when RPC fails. All transport, trace and resource guards remain inherited. The writer is retired before branch reads.

The unchanged body collector independently reads number and hash headers, fetches complete bytes through `eth_getRawTransactionByHash` and receipts, then repeats the headers. Its lease learns allowed transaction hashes from those reads, rather than the writer's submission list. There is no reconstructed envelope or raw-byte fallback. Offline extraction binds each captured envelope to its exact recorded submission and replays the retained raw RPC responses through the same collector. Extraction does not perform the separate cryptographic body check.

## Retained evidence and reproduction

The [input manifest](../experiments/paid-signed-body-acquisition/experiment-inputs.json) pins the new writer, node wrapper and codec together with the existing guards, contracts, compiled artifacts and collectors. Its SHA-256 is `bc36f989ffdb8f323511de9d562f48778710d415072b646f89d6c47ca21311d2`. The [provenance](../experiments/paid-signed-body-acquisition/provenance.json) records the [body captures](../experiments/paid-signed-body-acquisition/body-captures.json) and original [compressed trace](../experiments/paid-signed-body-acquisition/execution-trace.json.gz). The captures' SHA-256 is `e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36`; the expanded trace's is `6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975`.

Use the exact runtimes and resource supervision recorded in [validation evidence](../evidence/TEST_RESULTS.json). From the repository root, these checks do not start a node:

```sh
python -I -B experiments/paid-signed-body-acquisition/test_legacy_codec.py
python -I -B experiments/paid-signed-body-acquisition/test_signed_node.py
python -I -B experiments/paid-signed-body-acquisition/test_signed_writer.py
python -I -B experiments/paid-signed-body-acquisition/test_signed_extractor.py
```

Decompress the retained archive to `execution-trace.json`. The [offline extractor](../experiments/paid-signed-body-acquisition/extract_signed_evidence.py) writes exactly three evidence files into a new directory; it does not overwrite an existing directory:

```sh
python -I -B experiments/paid-signed-body-acquisition/extract_signed_evidence.py --trace execution-trace.json --inputs experiments/paid-signed-body-acquisition/experiment-inputs.json --expected-input-sha256 bc36f989ffdb8f323511de9d562f48778710d415072b646f89d6c47ca21311d2 --output-dir signed-evidence-recheck
```

For a fresh local run, first create an empty `signed-run` directory and replace `PINNED_ANVIL_EXE` with the reviewed Anvil executable. Run this command under the recorded outer resource supervisor. The runner requires a new output file and checks the manifest before and after acquisition:

```sh
python -I -B experiments/paid-signed-body-acquisition/run_signed_body.py --anvil PINNED_ANVIL_EXE --output signed-run/execution-trace.json --expected-input-sha256 bc36f989ffdb8f323511de9d562f48778710d415072b646f89d6c47ca21311d2
```

Fresh ECDSA signatures and node timestamps can change transaction and block hashes. Reproduction checks newly observed bytes against their own recorded headers; it does not substitute the retained fixture's expected hashes.

Run the following JavaScript as a Node ES module from the repository root. Each separate selection is explicitly copied from the fixture, so the selected hash remains a fixture assumption. The example requires 30 accepted captures and throws on any rejection or unexpected verification flag:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectBlockBodyCapture } from './experiments/paid-body-acquisition/verify_body.mjs';

const fixture = JSON.parse(readFileSync('experiments/paid-signed-body-acquisition/body-captures.json', 'utf8'));
assert.equal(fixture.schema, 'caw-local-body-captures/1');
assert.equal(fixture.synthetic_chain, true);
assert.equal(fixture.independent_providers, false);
const captures = [...fixture.branches.left, ...fixture.branches.right];
assert.equal(captures.length, 30);
let accepted = 0;
for (const body of captures) {
  const selection = {
    schema: 'caw-block-body-selection/1', profile: 'london-16',
    number: body.selection.block_number, hash: body.selection.block_hash,
  };
  const result = inspectBlockBodyCapture(body, selection);
  assert.equal(result.rpcTransactionHashesVerified, true);
  assert.equal(result.body_integrity.transactionAssociationVerified, true);
  for (const flag of ['signaturesVerified', 'senderVerified', 'transactionsVerified',
    'executionVerified', 'endpointAuthenticated', 'consensusVerified',
    'finalityVerified', 'freshnessVerified']) {
    assert.equal(result.body_integrity[flag], false);
  }
  accepted++;
}
console.log(JSON.stringify({
  blocks: captures.length, accepted,
  rpcTransactionHashesVerified: true, transactionAssociationVerified: true,
  signaturesVerified: false, senderVerified: false,
  endpointAuthenticated: false, executionVerified: false,
}));
```

**8 focused checks, 822/822 full-suite Node tests and 65 Python tests passed.** Offline extraction replay and the guide example passed. The separate build retained 22 byte-identical frontend assets.

## Bounds and remaining trust

The inherited Windows guard pins Anvil 1.8.1 and starts a fresh London chain with ID 31337, no generated accounts and an owned loopback listener. It retains a 512 MiB node cap, 600-second deadline, 1 MiB response cap, 4 MiB trace cap, 1,800 RPC requests and 250 transaction attempts. Startup requires 768 MiB free memory and 2 GiB free disk. Recorded outer supervision additionally bounds the controller and node together to 512 MiB, two processes and 300 seconds. The collector retains its 256-transactions-per-block, 516-request and 4 MiB decoded-response bounds; these are implementation admission limits, not Ethereum block limits.

The two branches share a node and prefix, so they do not demonstrate independent providers. Read leases constrain reviewed code in one process; they do not isolate hostile code. Repeated headers can miss changes after the last read or changes away and back between reads. Receipt `from`, `to` and `blockTimestamp` are RPC metadata outside the receipt trie, even when they match this trace. The header timestamp is separately part of the checked header encoding.

The generic verifier's signature, sender, transaction-validity, execution, endpoint, consensus, finality and freshness flags remain false. The writer's fixed-key checks do not change those flags. This increment adds no body-backed paid-history adoption, recovery, observer or provider-comparison integration, and establishes no new CAW protocol rule or public-chain execution result.
