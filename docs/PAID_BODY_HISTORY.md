# History bound to block bodies

Alpha.43 connects the previously separate body and sender checks to the fixed CAW paid-history reader. Every transaction summary now has to match its committed raw bytes before the wrapper reconstructs messages and accounting. Altering a captured sender, destination or call cannot be accepted just because the edited records agree with each other.

The [new wrapper](../reference/paid-body-history.mjs) is offline. It reuses the earlier verifiers; it is not an independent implementation or an external audit. Earlier readers, captures, contracts and frontend behavior remain unchanged. Existing recovery and observer APIs do not automatically use this wrapper.

## What is checked

`inspectPaidBodyHistory(history, manifest, captures)` takes exactly three arguments. All inputs are detached together through bounded data descriptors. The manifest supplies the selected interval, chain and runtime assumptions. This increment admits only the fixed local experiment: chain 31337, London headers and replay-protected legacy transactions. The broader sender component's type 1 and type 2 support does not extend this history format.

1. Check the linked header interval against the separately supplied endpoints. Require the full ending header to equal the final history block. The starting header is an exclusive anchor; its transactions and receipts are not supplied or body-verified.
2. Require one complete body capture for every history block, in order. Match the full header and each full receipt with the corresponding history record. Verify complete transaction and receipt roots, receipt positions and transaction-hash labels using the unchanged [body verifier](BLOCK_BODY_ACQUISITION.md).
3. Recover and verify each transaction sender from its raw signing bytes under the fixed chain policy. Match the history's `from`, `to`, `data`, `gas`, `gasPrice` and `value`. Require receipt sender and destination metadata to agree. The captured receipt must specify the legacy type; missing types keep the existing verifier's refusal.
4. Derive a successful top-level creation address from the recovered sender and raw nonce. Ordinary calls and failed creations require a null creation address. This checks the address calculation, not creation-bytecode execution or resulting state. The address rule is documented in the versioned [go-ethereum CreateAddress implementation](https://github.com/ethereum/go-ethereum/blob/v1.14.12/crypto/crypto.go).
5. Run the unchanged [paid-history reader](../reference/paid-action-reader.mjs). Its existing event, time-window, ownership-epoch, direct-owner comparison and accounting checks now consume those bound fields. Return a frozen result only if every check succeeds.

The output separates `history`, `header_integrity` and per-block body/sender reports. `transactionFieldsBound`, `transactionCommitmentVerified`, `receiptCommitmentVerified`, `signaturesVerified` and `senderVerified` describe the checks above. Nested older reports keep their original flags.

## The authority gap

A recovered transaction sender is not necessarily the CAW account owner. A relayer can submit a separately signed post. The older reader compares the post's account, epoch, nonce, text, timing and distribution to its events, but does not verify the enclosed EIP-712 signature or contract-wallet permission. It also does not independently prove registry approval/transfer execution. Both kinds of permission need further work.

`accountAuthorityVerified`, `transactionsVerified`, `executionVerified`, `endpointAuthenticated`, `consensusVerified`, `finalityVerified` and `freshnessVerified` remain false. Runtime hashes and constructor arguments remain explicit supplied assumptions; they are not state proofs. Matching the two commitments under a supplied header does not establish that the transactions actually produced the receipts. No selected-history adoption, retry decision, wallet connection or public release follows from this result.

## Reproduce

Use the recorded Node runtime and resource limits. Run `node --test tests/paid-body-history.test.mjs`. The tests read the existing [signed local capture](SIGNED_BODY_ACQUISITION.md), pin both capture and expanded-trace hashes, and exercise both collectors on each branch. They include consistent forged RPC summaries, altered call fields, incorrect creation addresses, receipt/header substitution, missing bodies, wrong endpoints, changed accounting and malformed inputs.

Run this example as a Node ES module from the repository root. It uses retained local evidence without contacting a provider:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { inspectPaidBodyHistory } from './reference/paid-body-history.mjs';

const root = 'experiments/paid-signed-body-acquisition/';
const captureBytes = readFileSync(root + 'body-captures.json');
assert.equal(createHash('sha256').update(captureBytes).digest('hex'),
  'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const traceBytes = gunzipSync(readFileSync(root + 'execution-trace.json.gz'), {
  maxOutputLength: 8 * 1024 * 1024,
});
assert.equal(createHash('sha256').update(traceBytes).digest('hex'),
  '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975');
const trace = JSON.parse(traceBytes), captures = JSON.parse(captureBytes);
let histories = 0, transactionObservations = 0;
for (const branch of ['left', 'right']) {
  for (const collector of ['number', 'hash']) {
    const { history, manifest } = trace.branches[branch].collectors[collector];
    const result = inspectPaidBodyHistory(history, manifest, captures.branches[branch]);
    assert.equal(result.transactionFieldsBound, true);
    assert.equal(result.transactionCount, 15);
    assert.equal(result.accountAuthorityVerified, false);
    assert.equal(result.executionVerified, false);
    assert.equal(result.endpointAuthenticated, false);
    transactionObservations += result.transactionCount;
    histories++;
  }
}
assert.equal(histories, 4);
assert.equal(transactionObservations, 60);
console.log(JSON.stringify({histories, transactionObservations,
  transactionFieldsBound: true, accountAuthorityVerified: false,
  executionVerified: false, endpointAuthenticated: false}));
```

**41 focused checks and 903/903 full-suite Node tests passed.** The guide bound all four retained collector histories; the build retained 22 byte-identical frontend assets. See the [alpha.43 receipt](../evidence/ALPHA43_TEST_RESULTS.json) for exact scope and run records.

The four histories reuse 30 captured block observations across two branches, with a ten-block common prefix and 20 distinct blocks. Checking each collector produces 60 transaction observations; that is not 60 independent transactions or providers. No new raw trace was generated.

## Bounds and next work

Admission is limited to 128 history blocks, 256 total transactions before signature work, 8 MiB of weighted captured data, 100,000 nodes and depth 20. Lower-level per-block and per-envelope limits still apply. A valid larger network history can be refused by this bounded reference tool. Hostile same-process proxies and replaced native built-ins remain outside its plain-data boundary.

Next: verify the separately signed posting authority and registry permission assumptions, then connect complete-body evidence to selection invalidation, rollback and restart. Independent acquisition, authenticated endpoints, confirmation policy and the remaining manifesto decisions stay open.

Alpha.44 adds a separate [post signature wrapper](PAID_POST_SIGNATURES.md) over this result. It verifies successful EOA-style post signatures against historical message owners under an explicit policy. This body reader and its authority flags remain unchanged.
