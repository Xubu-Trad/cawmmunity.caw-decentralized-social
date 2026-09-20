import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { inspectPaidRegistryHistory } from '../reference/paid-registry-permissions.mjs';
import { inspectPaidPostHistory } from '../reference/paid-post-signatures.mjs';

const sha = b => createHash('sha256').update(b).digest('hex'), clone = structuredClone;
const root = new URL('../experiments/paid-signed-body-acquisition/', import.meta.url);
const rawCaptures = readFileSync(new URL('body-captures.json', root));
assert.equal(sha(rawCaptures), 'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const captures = JSON.parse(rawCaptures);
const rawTrace = gunzipSync(readFileSync(new URL('execution-trace.json.gz', root)), { maxOutputLength: 8 * 1024 * 1024 });
assert.equal(sha(rawTrace), '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975');
const trace = JSON.parse(rawTrace);
const fixtureBytes = readFileSync(new URL('../reference/fixtures/paid-registry-v1.json', import.meta.url));
assert.equal(sha(fixtureBytes), '404d6a675d6a8f8cba0daa7f4e531d3e66c42540639586137b636d5c6299f64a');
const fixture = JSON.parse(fixtureBytes);
const A = '0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76', B = '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73';
const policy = () => ({ schema: 'caw-paid-post-policy/1', profile: 'paid-action-v1-eoa-65-low-s', assumedEoaOwners: [A, B] });
function sample(branch = 'left', collector = 'number') {
  const { history, manifest } = trace.branches[branch].collectors[collector];
  return clone({ history, manifest, captures: captures.branches[branch], policy: policy() });
}
const inspect = s => inspectPaidRegistryHistory(s.history, s.manifest, s.captures, s.policy);
const reject = (fn, code) => assert.throws(fn, e => code ? e.code === code : /^(PAID_|BLOCK_|EXEC_HEADER_|TRANSACTION_SENDER_)/.test(e.code ?? ''));
const flags = ['accountAuthorityVerified', 'codeAbsenceVerified', 'currentPermissionVerified',
  'receiverCallbacksVerified', 'executionVerified', 'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified'];

for (const branch of ['left', 'right']) for (const collector of ['number', 'hash']) test(`registry permissions bind retained ${branch}/${collector}`, () => {
  const s = sample(branch, collector), result = inspect(s), r = result.registry_sequence;
  assert.equal(result.schema, 'caw-paid-registry-history/1');
  assert.equal(result.registryPermissionRulesVerified, true); assert.equal(result.registryCallSendersBound, true);
  assert.equal(result.registryBytePinsMatched, true);
  assert.equal(r.successfulCalls, 1); assert.equal(r.failedCallsNotPermissionChecked, 0);
  assert.equal(r.senderVerified, false); // Standalone transcript does not authenticate identities.
  assert.equal(result.post_history.postSignaturesVerified, true);
  assert.equal(result.post_history.successfulPostCount, branch === 'left' ? 3 : 2);
  assert.equal(result.post_history.body_history.senderVerified, true);
  assert.equal(result.post_history.accountAuthorityVerified, false);
  assert.deepEqual(r.final.owners, branch === 'left' ? [B, A, B] : [A, A, B]);
  assert.deepEqual(r.final.epochs, ['1', '0', '0']);
  assert.deepEqual(r.final.approved, Array(3).fill('0x' + '00'.repeat(20))); assert.deepEqual(r.final.operators, []);
  const op = result.operations[0];
  assert.equal(op.caller, A); assert.equal(op.authorization, 'owner');
  assert.equal(op.from, A); assert.equal(op.to, branch === 'left' ? B : A);
  assert.equal(op.transactionHash, s.history.blocks[10].transactions[0].receipt.transactionHash);
  assert.equal(op.blockHash, s.history.blocks[10].header.hash);
  for (const flag of flags) assert.equal(result[flag], false, flag);
});

test('native re-signed unauthorized transfer passes prior signature/body checks and fails permissions', () => {
  const s = sample(), m = fixture.historyMutation, i = m.index;
  s.history.blocks[i].transactions[0].transaction.from = m.sender;
  s.captures[i].raw_transactions[0] = m.rawTransaction;
  for (const receipt of [s.history.blocks[i].transactions[0].receipt, s.captures[i].receipts[0]]) receipt.from = m.sender;
  for (const { index, header } of m.headers) {
    s.history.blocks[index].header = clone(header); s.captures[index].header = clone(header);
    s.captures[index].selection.block_hash = header.hash;
    for (const receipt of [s.history.blocks[index].transactions[0].receipt, s.captures[index].receipts[0]]) {
      receipt.blockHash = header.hash; receipt.transactionHash = header.transactions[0];
      for (const log of receipt.logs) { log.blockHash = header.hash; log.transactionHash = header.transactions[0]; }
    }
  }
  s.history.end_block = clone(s.history.blocks.at(-1).header); s.manifest.end_block_hash = s.history.end_block.hash;
  const prior = inspectPaidPostHistory(s.history, s.manifest, s.captures, s.policy);
  assert.equal(prior.body_history.blocks[i].transactions[0].from, B);
  assert.equal(prior.postSignaturesVerified, true); assert.equal(prior.successfulPostCount, 3);
  assert.equal(prior.body_history.history.owners[0], B);
  reject(() => inspect(s), m.expected_error);
});

test('registry byte pins identify the preserved compiler artifact and source', () => {
  const build = JSON.parse(readFileSync(new URL('../experiments/paid-action/paid-build.json', import.meta.url)));
  const contract = build.contracts.TestAccountRegistry, h = sample().history;
  assert.equal(sha(readFileSync(new URL('../experiments/paid-action/TestAccountRegistry.sol', import.meta.url))), build.sources['TestAccountRegistry.sol']);
  assert.equal(contract.runtime, h.registry_runtime);
  assert.equal(contract.bytecode, h.blocks[0].transactions[0].transaction.data.slice(0, -128));
  assert.equal(sha(Buffer.from(contract.runtime.slice(2), 'hex')), '4745276b40204bd6e373b3f6c2e990ba8aeb3feb2de69a97b44510c58153d68f');
  assert.equal(sha(Buffer.from(contract.bytecode.slice(2), 'hex')), '451b67e63f5e995f2a3bfa161ec4aa77366cf4aa8e28fb68b390ab6bc496717d');
  for (const [signature, selector] of Object.entries({ 'approve(address,uint256)': '095ea7b3', 'setApprovalForAll(address,bool)': 'a22cb465',
    'transferFrom(address,address,uint256)': '23b872dd', 'safeTransferFrom(address,address,uint256)': '42842e0e',
    'safeTransferFrom(address,address,uint256,bytes)': 'b88d4fde' })) assert.equal(contract.methodIdentifiers[signature], selector);
});

test('the wrapper preserves strict body, post and policy rejections', () => {
  for (const change of [s => { s.history.blocks[10].transactions[0].transaction.from = B; },
    s => { s.captures.pop(); }, s => { s.manifest.end_block_hash = '0x' + '11'.repeat(32); },
    s => { s.policy.assumedEoaOwners = [A]; }]) { const s = sample(); change(s); reject(() => inspect(s)); }
});

test('history wrapper requires exact arity and avoids accessor execution', () => {
  const s = sample(); reject(() => inspectPaidRegistryHistory(s.history, s.manifest, s.captures));
  reject(() => inspectPaidRegistryHistory(s.history, s.manifest, s.captures, s.policy, null));
  let reads = 0; Object.defineProperty(s.history, 'blocks', { enumerable: true, get() { reads++; return []; } });
  reject(() => inspect(s), 'PAID_REGISTRY_DESCRIPTOR'); assert.equal(reads, 0);
});

test('history result remains frozen and detached without elevating lower flags', () => {
  const s = sample(), result = inspect(s), before = JSON.stringify(result);
  function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
  frozen(result); s.history.final.owners[0] = A; s.policy.assumedEoaOwners.length = 0;
  assert.equal(JSON.stringify(result), before); assert.equal(result.post_history.currentPermissionVerified, false);
});
