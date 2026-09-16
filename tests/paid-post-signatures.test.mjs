import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { inspectPaidPostSignature, inspectPaidPostHistory } from '../reference/paid-post-signatures.mjs';
import { inspectPaidBodyHistory } from '../reference/paid-body-history.mjs';

const clone = structuredClone, sha = b => createHash('sha256').update(b).digest('hex');
const fixtureBytes = readFileSync(new URL('../reference/fixtures/paid-post-signatures-v1.json', import.meta.url));
assert.equal(sha(fixtureBytes), '6e03216616272e7c383c09f63e0d046dd1c172416cfad06014fdb18c6c9f1655');
const fixtures = JSON.parse(fixtureBytes);
const root = new URL('../experiments/paid-signed-body-acquisition/', import.meta.url);
const captureBytes = readFileSync(new URL('body-captures.json', root));
assert.equal(sha(captureBytes), 'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const captures = JSON.parse(captureBytes);
const traceBytes = gunzipSync(readFileSync(new URL('execution-trace.json.gz', root)), { maxOutputLength: 8 * 1024 * 1024 });
assert.equal(sha(traceBytes), '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975');
const trace = JSON.parse(traceBytes);
const A = '0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76', B = '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73';
const profile = 'paid-action-v1-eoa-65-low-s';
const policy = () => ({ schema: 'caw-paid-post-policy/1', profile, assumedEoaOwners: [A, B] });
function sample(branch = 'left', collector = 'number') {
  const { history, manifest } = trace.branches[branch].collectors[collector];
  return clone({ history, manifest, captures: captures.branches[branch], policy: policy() });
}
const inspect = s => inspectPaidPostHistory(s.history, s.manifest, s.captures, s.policy);
const single = (v = clone(fixtures.positive[0])) => inspectPaidPostSignature(v.calldata, v.selection);
const rejected = (fn, code) => assert.throws(fn, e => code ? e.code === code : /^(PAID_POST_SIGNATURE_|TRANSACTION_SENDER_|PAID_BODY_HISTORY_|PAID_HISTORY_|BLOCK_|EXEC_HEADER_)/.test(e.code ?? ''));
const flags = ['accountAuthorityVerified', 'codeAbsenceVerified', 'erc1271Verified', 'executionVerified', 'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified', 'currentPermissionVerified'];

for (const vector of fixtures.positive) test('native EIP-712 vector: ' + vector.name, () => {
  const result = single(vector), e = vector.expected;
  for (const key of ['digest', 'domainSeparator', 'structHash', 'textHash', 'signature']) assert.equal(result[key], e[key], key);
  assert.deepEqual(result.request, e.request);
  assert.equal(result.signature_integrity.publicKey, e.publicKey);
  assert.equal(result.signer, vector.selection.expectedSigner);
  assert.equal(result.signatureVerified, true); assert.equal(result.signerMatchesExpected, true);
  for (const flag of flags) assert.equal(result[flag], false, flag);
});

for (const branch of ['left', 'right']) for (const collector of ['number', 'hash']) {
  test(`accepted posts use historical owners for ${branch}/${collector}`, () => {
    const s = sample(branch, collector), result = inspect(s);
    assert.equal(result.successfulPostCount, branch === 'left' ? 3 : 2);
    assert.equal(result.failedPostCallsNotSignatureChecked, branch === 'left' ? 0 : 1);
    assert.deepEqual(result.posts.map(p => p.owner), branch === 'left' ? [A, B, B] : [A, A]);
    assert.ok(result.posts.every(p => p.relayer === A));
    assert.equal(result.postSignaturesVerified, true); assert.equal(result.historicalOwnerMatchesVerified, true);
    assert.equal(result.body_history.accountAuthorityVerified, false);
    for (const flag of flags) assert.equal(result[flag], false, flag);
    for (const post of result.posts) {
      const submission = trace.submissions.find(x => x.hash === post.transactionHash);
      const recorded = trace.rpc.find(x => x.label === submission.label + '.contract_digest');
      assert.ok(recorded); assert.equal(post.signature.digest, recorded.response.result);
    }
  });
}

test('EOA assumption must cover the historical signer rather than the relayer', () => {
  const left = sample(); left.policy.assumedEoaOwners = [A];
  rejected(() => inspect(left), 'PAID_POST_SIGNATURE_OWNER_ASSUMPTION');
  const right = sample('right'); right.policy.assumedEoaOwners = [A];
  assert.equal(inspect(right).successfulPostCount, 2);
});

test('the failed orphan call has a valid signature but is not accepted by this history', () => {
  const s = sample('right'), failed = s.history.blocks[11].transactions[0];
  assert.equal(failed.receipt.status, '0x0');
  const result = inspectPaidPostSignature(failed.transaction.data, { schema: 'caw-paid-post-selection/1', profile,
    chainId: '0x7a69', verifyingContract: s.history.addresses.probe, expectedSigner: B });
  assert.equal(result.digest, trace.orphan_intent.digest);
  assert.equal(result.signature, trace.orphan_intent.signature);
  assert.equal(result.currentPermissionVerified, false);
  const checked = inspect(s); assert.ok(checked.posts.every(p => p.transactionHash !== failed.receipt.transactionHash));
});

test('byte-consistent successful history with an invalid inner signature passes alpha43 but fails here', () => {
  const s = sample(), mutation = fixtures.historyMutation, index = mutation.index;
  s.history.blocks[index].transactions[0].transaction.data = mutation.calldata;
  s.captures[index].raw_transactions[0] = mutation.rawTransaction;
  for (const { index: i, header } of mutation.headers) {
    s.history.blocks[i].header = clone(header); s.captures[i].header = clone(header);
    s.captures[i].selection.block_hash = header.hash;
    for (const receipt of [s.history.blocks[i].transactions[0].receipt, s.captures[i].receipts[0]]) {
      receipt.blockHash = header.hash; receipt.transactionHash = header.transactions[0];
      for (const log of receipt.logs) { log.blockHash = header.hash; log.transactionHash = header.transactions[0]; }
    }
  }
  s.history.end_block = clone(s.history.blocks.at(-1).header); s.manifest.end_block_hash = s.history.end_block.hash;
  const old = inspectPaidBodyHistory(s.history, s.manifest, s.captures);
  assert.equal(old.transactionFieldsBound, true); assert.equal(old.history.messageCount, '3');
  rejected(() => inspect(s), mutation.expected_error);
});

for (const field of ['chainId', 'verifyingContract', 'expectedSigner']) test('changed selection cannot preserve expected authorization: ' + field, () => {
  const v = clone(fixtures.positive[0]); v.selection[field] = field === 'chainId' ? '0x1' : '0x' + '33'.repeat(20);
  rejected(() => single(v), 'PAID_POST_SIGNATURE_SIGNER_MISMATCH');
});

function editWord(v, offset, n) {
  const at = 10 + offset * 2;
  v.calldata = v.calldata.slice(0, at) + BigInt(n).toString(16).padStart(64, '0') + v.calldata.slice(at + 64);
}
for (const [field, offset, value] of [['account', 64, 2], ['epoch', 96, 1], ['nonce', 128, 1], ['validAfter', 160, 99], ['deadline', 192, 201], ['distribution', 224, 7]]) {
  test('signature binds request ' + field, () => {
    const v = clone(fixtures.positive[0]); editWord(v, offset, value);
    rejected(() => single(v), 'PAID_POST_SIGNATURE_SIGNER_MISMATCH');
  });
}

test('changed exact text bytes invalidate the signed request', () => {
  const v = clone(fixtures.positive[0]), start = 10 + 320 * 2;
  v.calldata = v.calldata.slice(0, start) + '63' + v.calldata.slice(start + 2);
  rejected(() => single(v), 'PAID_POST_SIGNATURE_SIGNER_MISMATCH');
});

test('normalizing decomposed Unicode changes the signed bytes', () => {
  const v = clone(fixtures.positive.find(x => x.name === 'decomposed'));
  editWord(v, 288, 2);
  const start = 10 + 320 * 2;
  v.calldata = v.calldata.slice(0, start) + 'c3a9' + '00'.repeat(30) + v.calldata.slice(start + 64);
  rejected(() => single(v), 'PAID_POST_SIGNATURE_SIGNER_MISMATCH');
});

for (const [label, mutate] of [
  ['selector', v => { v.calldata = '0x00000000' + v.calldata.slice(10); }],
  ['request offset', v => editWord(v, 0, 96)],
  ['text offset', v => editWord(v, 256, 256)],
  ['signature offset', v => editWord(v, 32, 384)],
  ['trailing bytes', v => { v.calldata += '00'; }],
  ['nonzero signature padding', v => { v.calldata = v.calldata.slice(0, -2) + '01'; }],
  ['empty text', v => editWord(v, 288, 0)],
  ['excessive text length', v => editWord(v, 288, 1681)],
  ['invalid UTF8', v => { const p = 10 + 320 * 2; v.calldata = v.calldata.slice(0, p) + 'ff' + v.calldata.slice(p + 2); }],
  ['unsupported account', v => editWord(v, 64, 4)],
]) test('canonical post ABI refuses ' + label, () => { const v = clone(fixtures.positive[0]); mutate(v); rejected(() => single(v)); });

test('420-scalar bound is independent of encoded byte length', () => {
  const v = clone(fixtures.positive.find(x => x.name === 'maximum-four-byte-scalars'));
  const p = 10 + 320 * 2; v.calldata = v.calldata.slice(0, p) + '61'.repeat(1680) + v.calldata.slice(p + 3360);
  rejected(() => single(v), 'PAID_POST_SIGNATURE_TEXT');
});

test('standalone and history results are recursively frozen and detached', () => {
  const s = sample(), result = inspect(s), before = JSON.stringify(result);
  function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
  frozen(result); frozen(single()); s.policy.assumedEoaOwners.length = 0; s.history.final.owners[0] = A;
  assert.equal(JSON.stringify(result), before);
});

test('history requires an explicit bounded, duplicate-free ordinary-account policy', () => {
  for (const mutate of [s => { s.policy = null; }, s => { s.policy.extra = true; }, s => { s.policy.profile = 'erc1271'; },
    s => { s.policy.assumedEoaOwners = [A, A]; }, s => { s.policy.assumedEoaOwners = ['0x' + '00'.repeat(20)]; },
    s => { s.policy.assumedEoaOwners = Array(65).fill(A); }, s => { s.policy.assumedEoaOwners = []; }]) {
    const s = sample(); mutate(s); rejected(() => inspect(s));
  }
});

test('exact arity, schemas and canonical selections are enforced', () => {
  const v = fixtures.positive[0], s = sample();
  rejected(() => inspectPaidPostSignature(v.calldata)); rejected(() => inspectPaidPostSignature(v.calldata, v.selection, null));
  rejected(() => inspectPaidPostHistory(s.history, s.manifest, s.captures));
  rejected(() => inspectPaidPostHistory(s.history, s.manifest, s.captures, s.policy, true));
  for (const mutate of [v => { v.selection.extra = true; }, v => { v.selection.chainId = '0x00'; }, v => { v.selection.chainId = -1; },
    v => { v.selection.verifyingContract = '0x' + '00'.repeat(20); }, v => { v.selection.expectedSigner = '0x' + 'AB'.repeat(20); },
    v => { v.calldata = v.calldata.toUpperCase(); }, v => { v.calldata += '\n'; },
    v => { v.selection.chainId += '\n'; }, v => { v.selection.verifyingContract += '\n'; },
    v => { v.selection.expectedSigner += '\u2028'; }]) { const x = clone(v); mutate(x); rejected(() => single(x)); }
});

test('input capture rejects accessor execution, cycles and excessive payloads', () => {
  const s = sample(); let reads = 0;
  Object.defineProperty(s.policy, 'assumedEoaOwners', { enumerable: true, get() { reads++; return [A, B]; } });
  rejected(() => inspect(s)); assert.equal(reads, 0);
  const v = clone(fixtures.positive[0]); v.selection.loop = v.selection; rejected(() => single(v));
  const x = clone(fixtures.positive[0]); x.calldata = 'x'.repeat(262145); rejected(() => single(x));
  const y = sample(); y.policy.assumedEoaOwners = Array(2); rejected(() => inspect(y));
});
