import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectBlockBodyCapture } from '../experiments/paid-body-acquisition/verify_body.mjs';
import { inspectBlockTransactionReceipts } from '../reference/ethereum-block-transactions.mjs';

const root = new URL('../', import.meta.url);
const sha = b => createHash('sha256').update(b).digest('hex');
const raw = readFileSync(new URL('reference/fixtures/block-transactions-v1.json', root));
assert.equal(sha(raw), '6ef84984389a24fb114cbbe4a8de6d739dcfdabcd07ef5c24c62fd10e1ae5086');
const fixture = JSON.parse(raw), clone = value => structuredClone(value);
const selection = capture => ({ schema: 'caw-block-body-selection/1', profile: 'london-16',
  number: capture.header.number, hash: capture.header.hash });
function fromVector(value) {
  const header = clone(value.header); header.transactions = clone(value.expected.transaction_hashes);
  const receipts = value.receipts ? clone(value.receipts) : Array.from({ length: value.receipt_recipe.count }, (_, i) => ({
    ...clone(value.receipt_recipe.template), type: value.expected.transaction_types[i],
    cumulativeGasUsed: '0x' + (BigInt(i + 1) * BigInt(value.receipt_recipe.gas_step)).toString(16),
    transactionIndex: '0x' + i.toString(16), blockHash: header.hash, blockNumber: header.number
  }));
  receipts.forEach((r, i) => { r.transactionHash = header.transactions[i]; });
  return { schema: 'caw-block-body-capture/1', selection: { block_number: header.number, block_hash: header.hash },
    header, raw_transactions: clone(value.raw_transactions), receipts };
}
function sample() { return fromVector(fixture.cases.find(c => c.name === 'mixed-types-contract-creation-and-data-boundaries')); }
function inspect(c) { return inspectBlockBodyCapture(c, selection(c)); }
function rejects(fn, code) { assert.throws(fn, e => e instanceof Error && (code ? e.code === code
  : /^(BLOCK_BODY_|BLOCK_TRANSACTIONS_|BLOCK_RECEIPTS_|EXEC_HEADER_)/.test(e.code ?? ''))); }
function frozen(v) { if (v && typeof v === 'object') { assert.ok(Object.isFrozen(v)); Object.values(v).forEach(frozen); } }

for (const v of fixture.cases.filter(c => new Set(c.expected.transaction_hashes).size === c.expected.transaction_count)) {
  test('acquisition wrapper verifies independently assembled unique body: ' + v.name, () => {
    const c = fromVector(v), result = inspect(c);
    assert.equal(result.schema, 'caw-block-body-verification/1');
    assert.equal(result.rpcTransactionHashesVerified, true);
    assert.deepEqual({ ...result.selected }, selection(c));
    assert.equal(result.body_integrity.transactionAssociationVerified, true);
    assert.equal(result.body_integrity.transactionCount, v.expected.transaction_count);
    assert.deepEqual(result.body_integrity.transactions.map(t => t.hash), v.expected.transaction_hashes);
    for (const f of ['signaturesVerified', 'senderVerified', 'executionVerified', 'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified']) {
      assert.equal(result.body_integrity[f], false, f);
    }
    frozen(result);
  });
}

test('consistently forged RPC labels pass standalone commitments but fail the acquisition wrapper', () => {
  const c = sample(); c.header.transactions[0] = '0x' + 'fe'.repeat(32); c.receipts[0].transactionHash = c.header.transactions[0];
  const rawCheck = inspectBlockTransactionReceipts(c.header, c.raw_transactions, c.receipts,
    { schema: 'caw-block-transactions-selection/1', profile: 'london-16', hash: c.header.hash });
  assert.equal(rawCheck.transactionAssociationVerified, true);
  assert.notEqual(rawCheck.transactions[0].hash, c.header.transactions[0]);
  rejects(() => inspect(c), 'BLOCK_BODY_TRANSACTION_HASH');
});

test('raw byte changes cannot use unchanged RPC hash labels as proof', () => {
  const c = sample(), tx = c.raw_transactions[0]; c.raw_transactions[0] = tx.slice(0, -2) + '03';
  rejects(() => inspect(c), 'BLOCK_TRANSACTIONS_ROOT_MISMATCH');
});

test('header hash lists and receipt hashes must each match computed transaction hashes', () => {
  for (const place of ['header', 'receipt', 'missing-receipt-hash']) {
    const c = sample();
    if (place === 'header') c.header.transactions[0] = '0x' + 'ff'.repeat(32);
    else if (place === 'receipt') c.receipts[0].transactionHash = '0x' + 'ff'.repeat(32);
    else delete c.receipts[0].transactionHash;
    rejects(() => inspect(c));
  }
});

test('hash-list length and duplicate transaction claims are rejected', () => {
  const c = sample(); c.header.transactions.pop(); rejects(() => inspect(c));
  const duplicate = sample();
  duplicate.header.transactions[1] = duplicate.header.transactions[0];
  duplicate.receipts[1].transactionHash = duplicate.header.transactions[0];
  rejects(() => inspect(duplicate), 'BLOCK_BODY_TRANSACTION_HASH');
});

test('caller selection cannot be replaced by the capture selection', () => {
  for (const field of ['hash', 'number', 'profile', 'schema', 'extra']) {
    const c = sample(), s = selection(c);
    if (field === 'hash') s.hash = '0x' + 'ff'.repeat(32);
    else if (field === 'number') s.number = '0x0';
    else if (field === 'profile') s.profile = 'prague-21';
    else if (field === 'schema') s.schema = 'other'; else s.extra = true;
    rejects(() => inspectBlockBodyCapture(c, s));
  }
  const c = sample(); c.selection.block_hash = '0x' + 'ff'.repeat(32); rejects(() => inspect(c));
});

test('both arguments and capture schema are exact; no old-summary upgrade is implicit', () => {
  const c = sample(), s = selection(c);
  rejects(() => inspectBlockBodyCapture(c)); rejects(() => inspectBlockBodyCapture(c, s, null));
  for (const field of Object.keys(c)) { const changed = clone(c); delete changed[field]; rejects(() => inspectBlockBodyCapture(changed, s)); }
  const changed = clone(c); changed.extra = null; rejects(() => inspect(changed));
  changed.schema = 'caw-paid-action-history/1'; rejects(() => inspect(changed));
});

test('unverified sender metadata is omitted; it cannot replace a recovered sender', () => {
  const c = sample(); c.receipts[0].from = '0x' + 'cc'.repeat(20);
  const checked = inspect(c); assert.equal(checked.body_integrity.senderVerified, false);
  assert.equal(Object.hasOwn(checked.body_integrity.transactions[0], 'from'), false);
  assert.equal(Object.hasOwn(checked.body_integrity.receipts[0], 'from'), false);
});

test('capture and selected data are detached and deeply frozen', () => {
  const c = sample(), s = selection(c), result = inspectBlockBodyCapture(c, s), encoded = JSON.stringify(result);
  c.raw_transactions.fill('0x'); c.header.transactions.fill('0x'); c.receipts[0].logs.push({}); s.hash = '0x';
  assert.equal(JSON.stringify(result), encoded); frozen(result);
  assert.throws(() => { result.selected.hash = '0x'; }, TypeError);
});

test('capture rejects accessors and conversion hooks without executing them', () => {
  let calls = 0;
  for (const place of ['capture', 'selection', 'raw-array', 'receipt']) {
    const c = sample(), s = selection(c);
    const [target, key] = place === 'capture' ? [c, 'header'] : place === 'selection' ? [s, 'hash']
      : place === 'raw-array' ? [c.raw_transactions, '0'] : [c.receipts[0], 'transactionHash'];
    Object.defineProperty(target, key, { enumerable: true, get() { calls++; throw Error('not run'); } });
    rejects(() => inspectBlockBodyCapture(c, s));
  }
  for (const hook of ['toJSON', 'valueOf', Symbol.iterator]) {
    const c = sample(); c[hook] = () => { calls++; throw Error('not run'); }; rejects(() => inspect(c));
  }
  assert.equal(calls, 0);
});

test('shared bounds reject sparse arrays, cycles and oversized combined input', () => {
  const sparse = sample(); delete sparse.receipts[0]; rejects(() => inspect(sparse));
  const cycle = sample(); cycle.header.transactions = cycle; rejects(() => inspect(cycle));
  const large = sample(); large.receipts[0].from = Array(48).fill('a'.repeat(200000)); rejects(() => inspect(large));
});

test('fresh impersonated local branches pass commitments but fail raw transaction hash labels', () => {
  const bytes = readFileSync(new URL('experiments/paid-body-acquisition/body-captures.json', root));
  assert.equal(sha(bytes), 'c1ea7eee1ef381a9d9f17bb734765c7a5e531b88a3ba0bc79c3a2e059a8293bb');
  const live = JSON.parse(bytes); assert.equal(live.schema, 'caw-local-body-captures/1');
  assert.equal(live.synthetic_chain, true); assert.equal(live.independent_providers, false);
  for (const name of ['left', 'right']) {
    assert.equal(live.branches[name].length, 15);
    for (const c of live.branches[name]) {
      const result = inspectBlockTransactionReceipts(c.header, c.raw_transactions, c.receipts,
        { schema: 'caw-block-transactions-selection/1', profile: 'london-16', hash: c.header.hash });
      assert.equal(result.transactionAssociationVerified, true);
      assert.equal(result.senderVerified, false);
      assert.notEqual(result.transactions[0].hash, c.header.transactions[0]);
      rejects(() => inspect(c), 'BLOCK_BODY_TRANSACTION_HASH');
    }
  }
  assert.notEqual(live.branches.left.at(-1).header.hash, live.branches.right.at(-1).header.hash);
  assert.equal(live.branches.left.at(-1).header.number, live.branches.right.at(-1).header.number);
});
