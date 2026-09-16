import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { inspectPaidBodyHistory } from '../reference/paid-body-history.mjs';
import { reconstruct } from '../reference/paid-action-reader.mjs';

const root = new URL('../experiments/paid-signed-body-acquisition/', import.meta.url);
const bytes = readFileSync(new URL('body-captures.json', root));
assert.equal(createHash('sha256').update(bytes).digest('hex'), 'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const captures = JSON.parse(bytes);
const expanded = gunzipSync(readFileSync(new URL('execution-trace.json.gz', root)), { maxOutputLength: 8 * 1024 * 1024 });
assert.equal(createHash('sha256').update(expanded).digest('hex'), '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975');
const trace = JSON.parse(expanded);
const clone = value => structuredClone(value);
function sample(branch = 'left', collector = 'number') {
  const { history, manifest } = trace.branches[branch].collectors[collector];
  return clone({ history, manifest, bodies: captures.branches[branch] });
}
const inspect = ({ history, manifest, bodies }) => inspectPaidBodyHistory(history, manifest, bodies);
const rejected = (fn, code) => assert.throws(fn, error => code ? error.code === code
  : /^(PAID_BODY_HISTORY_|PAID_HISTORY_|BLOCK_BODY_|BLOCK_TRANSACTIONS_|BLOCK_RECEIPTS_|TRANSACTION_SENDER_|EXEC_HEADER_)/.test(error.code ?? ''));
function bothReceipt(s, index, field, value) {
  s.history.blocks[index].transactions[0].receipt[field] = clone(value);
  s.bodies[index].receipts[0][field] = clone(value);
}
const falseFlags = ['accountAuthorityVerified', 'transactionsVerified', 'executionVerified', 'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified'];

for (const branch of ['left', 'right']) for (const collector of ['number', 'hash']) {
  test(`bind every committed transaction to ${branch}/${collector} history before reconstruction`, () => {
    const s = sample(branch, collector), result = inspect(s);
    assert.equal(result.schema, 'caw-paid-body-history/1');
    assert.equal(result.profile, 'london-16'); assert.equal(result.chainId, '0x7a69');
    assert.equal(result.blockCount, 15); assert.equal(result.transactionCount, 15); assert.equal(result.receiptCount, 15);
    assert.deepEqual(result.history, reconstruct(s.history, s.manifest));
    for (const flag of ['transactionCommitmentVerified', 'receiptCommitmentVerified', 'signaturesVerified', 'senderVerified', 'transactionFieldsBound']) assert.equal(result[flag], true, flag);
    for (const flag of falseFlags) assert.equal(result[flag], false, flag);
    result.blocks.forEach((block, index) => {
      assert.equal(block.blockHash, s.bodies[index].header.hash);
      assert.equal(block.transactions[0].from, s.history.blocks[index].transactions[0].transaction.from);
      assert.equal(block.transactions[0].contractAddress, s.bodies[index].receipts[0].contractAddress);
      assert.equal(block.body_integrity.body_integrity.senderVerified, false);
      assert.equal(block.sender_integrity.body_integrity.senderVerified, false);
      assert.equal(block.sender_integrity.senderVerified, true);
    });
  });
}

test('matching byte evidence does not merge the two alternative selected histories', () => {
  const a = inspect(sample('left')), b = inspect(sample('right'));
  assert.notDeepEqual(a.history.messages, b.history.messages);
  assert.notEqual(a.blocks.at(-1).blockHash, b.blocks.at(-1).blockHash);
});

test('result is recursively frozen and detached from caller data', () => {
  const s = sample(), result = inspect(s), before = JSON.stringify(result);
  function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }
  frozen(result); s.history.final.credits[0] = '0'; s.bodies[0].raw_transactions[0] = '0x';
  assert.equal(JSON.stringify(result), before);
});

for (const index of [0, 2, 9]) test(`a consistent forged RPC sender is rejected at block offset ${index}`, () => {
  const s = sample(), forged = '0x' + 'ab'.repeat(20);
  s.history.blocks[index].transactions[0].transaction.from = forged;
  bothReceipt(s, index, 'from', forged);
  // These constructor, token-approval and relayed-post records previously used
  // supplied RPC metadata. The old accounting result alone does not bind it.
  assert.doesNotThrow(() => reconstruct(s.history, s.manifest));
  rejected(() => inspect(s));
});

for (const field of ['to', 'data', 'gas', 'gasPrice', 'value']) test(`committed ${field} overrides a replacement transaction summary`, () => {
  const s = sample(), tx = s.history.blocks[2].transactions[0].transaction;
  tx[field] = ({ to: '0x' + 'cd'.repeat(20), data: '0x12345678', gas: '0x3d08ff', gasPrice: '0x1', value: '0x1' })[field];
  if (field === 'to') bothReceipt(s, 2, 'to', tx.to);
  if (field === 'gasPrice') bothReceipt(s, 2, 'effectiveGasPrice', tx.gasPrice);
  if (field !== 'value') assert.doesNotThrow(() => reconstruct(s.history, s.manifest));
  rejected(() => inspect(s));
});

test('inner post signature bytes cannot be edited while retaining the raw transaction', () => {
  const s = sample(), tx = s.history.blocks[9].transactions[0].transaction;
  const position = tx.data.length - 64;
  tx.data = tx.data.slice(0, position) + (tx.data.slice(position, position + 2) === '01' ? '02' : '01') + tx.data.slice(position + 2);
  assert.doesNotThrow(() => reconstruct(s.history, s.manifest));
  rejected(() => inspect(s), 'PAID_BODY_HISTORY_TRANSACTION_FIELDS');
});

for (const [label, mutate] of [
  ['wrong creation address', s => bothReceipt(s, 0, 'contractAddress', '0x' + 'ee'.repeat(20))],
  ['missing successful creation address', s => bothReceipt(s, 0, 'contractAddress', null)],
  ['creation destination instead of null', s => { const a = s.bodies[0].receipts[0].contractAddress; s.history.blocks[0].transactions[0].transaction.to = a; bothReceipt(s, 0, 'to', a); }],
  ['contract address on ordinary call', s => bothReceipt(s, 2, 'contractAddress', s.history.addresses.probe)],
  ['receipt type inconsistent with legacy bytes', s => bothReceipt(s, 2, 'type', '0x1')],
  ['history receipt differs from captured receipt', s => { s.history.blocks[2].transactions[0].receipt.from = '0x' + 'ab'.repeat(20); }],
  ['capture header metadata differs from history', s => { s.bodies[2].header.size = '0x1'; }],
  ['end header differs beyond old endpoint fields', s => { s.history.end_block.stateRoot = '0x' + 'bb'.repeat(32); }],
  ['raw bytes changed under same selected root', s => { const raw = s.bodies[2].raw_transactions[0]; s.bodies[2].raw_transactions[0] = raw.slice(0, -2) + (raw.endsWith('01') ? '02' : '01'); }],
  ['committed event data changed in both copies', s => { const logs = clone(s.bodies[2].receipts[0].logs); logs[0].data = '0x' + '00'.repeat(32); bothReceipt(s, 2, 'logs', logs); }],
  ['missing raw envelope', s => { s.bodies[2].raw_transactions = []; }],
  ['missing receipt', s => { s.bodies[2].receipts = []; }],
  ['extra capture', s => { s.bodies.push(clone(s.bodies.at(-1))); }],
  ['missing capture', s => { s.bodies.pop(); }],
  ['reordered captures', s => { [s.bodies[2], s.bodies[3]] = [s.bodies[3], s.bodies[2]]; }],
  ['capture from competing branch', s => { s.bodies[10] = clone(captures.branches.right[10]); }],
  ['selected endpoint replaced', s => { s.manifest.end_block_hash = '0x' + 'ff'.repeat(32); }],
  ['runtime assumption replaced', s => { s.manifest.probe_runtime_sha256 = 'f'.repeat(64); }],
  ['computed final accounting forged', s => { s.history.final.credits[0] = '0'; }],
  ['foreign chain', s => { s.history.chain_id = s.manifest.chain_id = 1; }],
]) test(label, () => { const s = sample(); mutate(s); rejected(() => inspect(s)); });

test('missing captured receipt type retains the underlying strict refusal', () => {
  const s = sample(); delete s.bodies[2].receipts[0].type; delete s.history.blocks[2].transactions[0].receipt.type;
  rejected(() => inspect(s), 'BLOCK_RECEIPTS_SCHEMA');
});

test('bad arity and missing inputs cannot reuse a prior success', () => {
  const s = sample();
  rejected(() => inspectPaidBodyHistory(s.history, s.manifest));
  rejected(() => inspectPaidBodyHistory(s.history, s.manifest, s.bodies, null));
  rejected(() => inspectPaidBodyHistory(null, s.manifest, s.bodies));
  rejected(() => inspectPaidBodyHistory(s.history, null, s.bodies));
  rejected(() => inspectPaidBodyHistory(s.history, s.manifest, null));
});

test('capture accessors and toJSON are not executed', () => {
  for (const key of ['history', 'manifest', 'bodies']) {
    const s = sample(); let calls = 0;
    Object.defineProperty(s[key], key === 'bodies' ? '0' : 'schema', { enumerable: true, get() { calls++; throw Error('must not execute'); } });
    rejected(() => inspect(s)); assert.equal(calls, 0);
  }
  const s = sample(); let calls = 0; s.history.toJSON = () => { calls++; return {}; };
  rejected(() => inspect(s)); assert.equal(calls, 0);
});

test('cycles, sparse arrays, extra keys and exotic prototypes are refused', () => {
  for (const mutate of [
    s => { s.history.loop = s.history; },
    s => { delete s.bodies[1]; },
    s => { s.bodies.extra = true; },
    s => { s.history.extra = true; },
    s => { s.manifest.extra = true; },
    s => { Object.setPrototypeOf(s.history, { inherited: true }); },
    s => { s.bodies[0][Symbol('hidden')] = true; },
  ]) { const s = sample(); mutate(s); rejected(() => inspect(s)); }
});

test('block and aggregate transaction limits reject before reconstruction', () => {
  const s = sample(); s.history.blocks = Array.from({ length: 129 }, () => clone(s.history.blocks[2]));
  s.bodies = Array.from({ length: 129 }, () => clone(s.bodies[2])); rejected(() => inspect(s));
  const t = sample();
  for (const [index, count] of [[2, 128], [3, 127]]) {
    const block = t.history.blocks[index], body = t.bodies[index];
    block.transactions = Array.from({ length: count }, () => clone(block.transactions[0]));
    block.header.transactions = Array.from({ length: count }, () => block.header.transactions[0]);
    body.header = clone(block.header);
    body.raw_transactions = Array.from({ length: count }, () => body.raw_transactions[0]);
    body.receipts = Array.from({ length: count }, () => clone(body.receipts[0]));
  }
  rejected(() => inspect(t), 'PAID_BODY_HISTORY_TRANSACTION_LIMIT');
});

test('large strings and nesting cannot bypass the descriptor admission budget', () => {
  const s = sample(); s.history.registry_runtime = 'x'.repeat(262145); rejected(() => inspect(s));
  const t = sample(); let deep = null; for (let i = 0; i < 22; i++) deep = { deep }; t.history.extra = deep;
  rejected(() => inspect(t));
});
