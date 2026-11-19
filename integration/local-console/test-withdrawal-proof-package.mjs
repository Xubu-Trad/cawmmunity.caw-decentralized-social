import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  makeWithdrawalProofPackage, MAX_WITHDRAWAL_PACKAGE_BYTES, MAX_WITHDRAWAL_SELECTION_BYTES,
  verifyWithdrawalProofPackage,
} from './withdrawal-proof-package.mjs';

const fixture = process.argv[2] ?? fileURLToPath(new URL('../../evidence/console-withdrawal-20261116/', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(fixture, name), 'utf8'));
const selected = read('withdrawal-selection.json');
const evidence = read('withdrawal-boundaries.json');
const sentinel = 'EXCLUDED_LOCAL_CONFIGURATION';
const localSelection = structuredClone(selected);
localSelection.config.rpc = sentinel;
localSelection.config.contracts.registry.privateNote = sentinel;
localSelection.config.contracts.extra = sentinel;
evidence.before.observed.localState = sentinel;
evidence.before.proofs.owner.extra = sentinel;
const bundle = makeWithdrawalProofPackage(evidence, localSelection);
assert(!JSON.stringify(bundle).includes(sentinel));
assert.deepEqual(bundle.selection, selected);
assert.equal(Object.hasOwn(bundle.evidence.before.observed, 'accountingProofsVerified'), false);
assert.equal(Object.hasOwn(bundle.evidence.receipts[0], 'from'), false);
evidence.before.proofs.owner.accountProof.length = 0;

function success(candidate, anchors) {
  const result = verifyWithdrawalProofPackage(candidate, anchors);
  assert.equal(result.startHash, anchors.startHash);
  assert.equal(result.endHash, anchors.endHash);
  assert.equal(result.transactionHash, anchors.transactionHash);
  assert.equal(result.amount, anchors.amount);
  for (const key of ['accountingEffectsVerified', 'transactionSignatureVerified', 'receiptCommitmentVerified', 'selectedEndpointsTrusted']) {
    assert.equal(result[key], true);
  }
  for (const key of ['publicChainAuthenticated', 'consensusVerified', 'executionReplayed']) assert.equal(result[key], false);
  return result;
}
const replay = success(bundle, selected);
const fresh = read('fresh/fresh-console-verification.json');
const freshSelection = {
  config: selected.config, startHash: fresh.startHash, endHash: fresh.endHash,
  transactionHash: fresh.transactionHash, amount: fresh.amount,
};
const freshBundle = makeWithdrawalProofPackage(read('fresh/withdrawal-boundaries.json'), freshSelection);
success(freshBundle, freshSelection);
assert.throws(() => verifyWithdrawalProofPackage(freshBundle, selected), /SELECTION_MISMATCH/);
assert.throws(() => verifyWithdrawalProofPackage(bundle), /INDEPENDENT_SELECTION_REQUIRED/);

const zeroHash = '0x' + '00'.repeat(32);
const zeroAddress = '0x' + '00'.repeat(20);
for (const change of [
  s => { s.startHash = zeroHash; }, s => { s.endHash = zeroHash; },
  s => { s.transactionHash = zeroHash; }, s => { s.amount = '1'; },
  s => { s.config.controller = zeroAddress; }, s => { s.config.contracts.token.address = zeroAddress; },
  s => { s.config.contracts.custody.codeHash = zeroHash; },
]) {
  const external = structuredClone(selected);
  change(external);
  assert.throws(() => verifyWithdrawalProofPackage(bundle, external), /SELECTION_MISMATCH/);
}

for (const change of [
  b => { b.schema = 'unrecognized'; },
  b => { b.evidence.receipts[0].status = '0x0'; },
  b => { b.evidence.rawTransactions[0] = '0x00'; },
  b => { delete b.evidence.before.proofs.registry; },
  b => { b.evidence.after.proofs.token.storageProof.pop(); },
  b => { b.evidence.before.proofs.custody.accountProof[0] = '0xc0'; },
  b => { b.evidence.after.observed.credit = '999'; },
  b => { b.evidence.after.header.gasUsed = '0x0'; },
  b => { b.consensusVerified = true; },
]) {
  const changed = structuredClone(bundle);
  change(changed);
  assert.throws(() => verifyWithdrawalProofPackage(changed, selected));
}
// Matching two copies of the same false claim cannot bypass the evidence reader.
const wrong = structuredClone(bundle);
wrong.selection.config.contracts.registry.codeHash = zeroHash;
assert.throws(() => verifyWithdrawalProofPackage(wrong, structuredClone(wrong.selection)), /AUTHORITY_CODE_HASH/);

const cli = fileURLToPath(new URL('./verify-withdrawal-package.mjs', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'caw-withdrawal-proof-test-'));
try {
  const proofPath = path.join(temp, 'package.json'), pinsPath = path.join(temp, 'selection.json');
  const run = (...args) => {
    const p = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 30000, windowsHide: true });
    if (p.error) throw p.error;
    return p;
  };
  const cliReject = (pattern, ...args) => {
    const p = run(...args);
    assert.equal(p.status, 1);
    assert.equal(p.stdout, '');
    assert.match(p.stderr, pattern);
  };
  fs.writeFileSync(proofPath, JSON.stringify(bundle));
  fs.writeFileSync(pinsPath, JSON.stringify(selected));
  const positive = run(proofPath, pinsPath);
  assert.equal(positive.status, 0, positive.stderr);
  assert.deepEqual(JSON.parse(positive.stdout), replay);
  cliReject(/Usage/, proofPath);
  cliReject(/regular JSON file/, temp, pinsPath);
  fs.writeFileSync(pinsPath, JSON.stringify(freshSelection));
  cliReject(/SELECTION_MISMATCH/, proofPath, pinsPath);
  fs.writeFileSync(pinsPath, ' '.repeat(MAX_WITHDRAWAL_SELECTION_BYTES + 1));
  cliReject(/exceeds/, proofPath, pinsPath);
  fs.writeFileSync(pinsPath, JSON.stringify(selected));
  fs.writeFileSync(proofPath, ' '.repeat(MAX_WITHDRAWAL_PACKAGE_BYTES + 1));
  cliReject(/exceeds/, proofPath, pinsPath);
  fs.writeFileSync(proofPath, '{"schema":null,"schema":null}');
  cliReject(/DUPLICATE_KEY/, proofPath, pinsPath);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log('Withdrawal proof package controls passed for both archived acquisitions and the offline CLI.');
