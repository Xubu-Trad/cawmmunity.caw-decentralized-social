import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, ECDH } from 'node:crypto';
import { inspectBlockSenders } from '../reference/ethereum-block-senders.mjs';
import { inspectBlockTransactions } from '../reference/ethereum-block-transactions.mjs';
import { inspectBlockBodyCapture } from '../experiments/paid-body-acquisition/verify_body.mjs';

const root = new URL('../', import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => structuredClone(value);
function read(path, pin, limit = 1024 * 1024) {
  const bytes = readFileSync(new URL(path, root));
  assert.ok(bytes.length <= limit); assert.equal(sha(bytes), pin);
  return JSON.parse(bytes);
}
const fixture = read('reference/fixtures/block-senders-v1.json', '2ad5cc9166b143fb979f57712c154e446dadb0bdb2cb694e67e298a327299373');
assert.equal(fixture.schema, 'caw-block-senders-fixtures/1');
for (const value of fixture.positive) {
  if (!value.rawTransactionsRecipe) continue;
  assert.equal(value.name, 'maximum-256-transactions');
  assert.equal(value.rawTransactionsRecipe.count, 256);
  assert.equal(value.expectedRecipe.count, 256);
  value.rawTransactions = Array(256).fill(value.rawTransactionsRecipe.rawTransaction);
  value.expected = Array.from({length: 256}, (_, index) => ({index, ...clone(value.expectedRecipe.transaction)}));
}
const captures = read('experiments/paid-signed-body-acquisition/body-captures.json',
  'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const inspect = value => inspectBlockSenders(value.header, value.rawTransactions, value.selection);
const sample = () => clone(fixture.positive.find(v => v.rawTransactions.length === 1 && v.selection.chainId === '0x1' && !v.selection.allowUnprotectedLegacy));
const lowerSelection = value => ({schema: 'caw-block-transactions-selection/1', profile: 'london-16', hash: value.header.hash});
const senderSelection = c => ({schema: 'caw-block-senders-selection/1', profile: 'london-16', hash: c.header.hash,
  chainId: '0x7a69', allowUnprotectedLegacy: false});
const falseFlags = ['transactionsVerified', 'executionVerified', 'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified'];
function frozen(value) {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function reject(fn, code) {
  assert.throws(fn, error => error instanceof Error && (code ? error.code === code
    : /^(TRANSACTION_SENDER_|BLOCK_TRANSACTIONS_|EXEC_HEADER_)/.test(error.code ?? '')));
}

for (const value of fixture.positive) test('sender vector: ' + value.name, () => {
  const result = inspect(value);
  assert.equal(result.schema, 'caw-block-senders-integrity/1');
  assert.equal(result.blockHash, value.header.hash); assert.equal(result.blockNumber, value.header.number);
  assert.equal(result.chainId, value.selection.chainId);
  assert.equal(result.transactionCount, value.rawTransactions.length);
  assert.equal(result.signaturesVerified, true); assert.equal(result.senderVerified, true);
  assert.equal(result.transactionCommitmentVerified, true);
  for (const flag of falseFlags) assert.equal(result[flag], false, flag);
  assert.equal(result.body_integrity.senderVerified, false);
  assert.equal(result.body_integrity.signaturesVerified, false);
  assert.equal(result.transactions.length, value.expected.length);
  result.transactions.forEach((transaction, index) => {
    const expected = value.expected[index];
    assert.equal(transaction.index, index); assert.equal(transaction.type, expected.type);
    assert.equal(transaction.from, expected.sender);
    assert.equal(transaction.publicKey, expected.publicKey);
    assert.equal(transaction.signingHash, expected.signingHash);
    assert.equal(transaction.hash, expected.transactionHash);
    assert.equal(transaction.encoded, value.rawTransactions[index]);
    if (Object.hasOwn(expected, 'chainId')) assert.equal(transaction.chainId, expected.chainId);
    if (Object.hasOwn(expected, 'replayProtected')) assert.equal(transaction.replayProtected, expected.replayProtected);
    for (const field of ['nonce', 'gasLimit', 'to', 'value', 'data', 'gasPrice', 'maxPriorityFeePerGas', 'maxFeePerGas', 'accessList']) {
      if (Object.hasOwn(expected, field)) assert.deepEqual(JSON.parse(JSON.stringify(transaction[field])), expected[field], field);
    }
    const nativePoint = ECDH.convertKey(Buffer.from(transaction.publicKey.slice(2), 'hex'), 'secp256k1');
    assert.equal('0x' + nativePoint.toString('hex'), transaction.publicKey);
  });
  frozen(result);
});

for (const value of fixture.negative) test('sender rejection: ' + value.name, () => {
  // Negative signatures are inside independently assembled valid roots. The
  // older structural verifier must pass before the new signature check rejects.
  const old = inspectBlockTransactions(value.header, value.rawTransactions, lowerSelection(value));
  assert.equal(old.transactionCommitmentVerified, true);
  reject(() => inspect(value), value.expected_error);
});

test('a parity change can be valid for another sender without authenticating the original identity', () => {
  const original = inspect(fixture.positive.find(v => v.name === 'official-eip155-example')).transactions[0];
  const changed = inspect(fixture.positive.find(v => v.name === 'official-eip155-flipped-parity-different-sender')).transactions[0];
  assert.equal(original.r, changed.r); assert.equal(original.s, changed.s);
  assert.equal(original.signingHash, changed.signingHash);
  assert.notEqual(original.v, changed.v); assert.notEqual(original.hash, changed.hash);
  assert.notEqual(original.publicKey, changed.publicKey); assert.notEqual(original.from, changed.from);
  assert.equal(original.from, '0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f');
});

test('all retained signed branch bodies derive the recorded fixture senders offline', () => {
  const identities = new Set(['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76', '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73']);
  let count = 0;
  for (const body of [...captures.branches.left, ...captures.branches.right]) {
    const result = inspectBlockSenders(body.header, body.raw_transactions, senderSelection(body));
    const prior = inspectBlockBodyCapture(body, {schema: 'caw-block-body-selection/1', profile: 'london-16',
      number: body.header.number, hash: body.header.hash});
    assert.equal(prior.rpcTransactionHashesVerified, true);
    assert.equal(prior.body_integrity.senderVerified, false);
    result.transactions.forEach((tx, index) => {
      assert.ok(identities.has(tx.from)); assert.equal(tx.from, body.receipts[index].from);
      assert.equal(tx.chainId, '0x7a69'); assert.equal(tx.replayProtected, true);
      assert.equal(tx.hash, prior.body_integrity.transactions[index].hash);
      count++;
    });
  }
  assert.equal(count, 30);
});

test('RPC sender labels are not inputs to recovered identity', () => {
  const body = clone(captures.branches.left[0]);
  const before = inspectBlockSenders(body.header, body.raw_transactions, senderSelection(body));
  body.receipts[0].from = '0x' + 'aa'.repeat(20);
  body.header.transactions = ['0x' + 'bb'.repeat(32)];
  const after = inspectBlockSenders(body.header, body.raw_transactions, senderSelection(body));
  assert.deepEqual(after.transactions, before.transactions);
  assert.notEqual(after.transactions[0].from, body.receipts[0].from);
});

test('chain choice and unprotected-legacy policy must be explicit and canonical', () => {
  for (const value of [undefined, null, 1, 1n, true, '1', '0x01', '0X1', '0x', '-0x1', '0x'+'1'.repeat(65)]) {
    const s = sample(); s.selection.chainId = value; reject(() => inspect(s));
  }
  for (const value of [undefined, null, 0, 1, 'false', {}, []]) {
    const s = sample(); s.selection.allowUnprotectedLegacy = value; reject(() => inspect(s));
  }
  for (const key of ['chainId', 'allowUnprotectedLegacy']) {
    const s = sample(); delete s.selection[key]; reject(() => inspect(s));
  }
});

test('unprotected permission never excuses a protected transaction for a different chain', () => {
  const s = sample(); s.selection.chainId = '0x2'; s.selection.allowUnprotectedLegacy = true;
  reject(() => inspect(s), 'TRANSACTION_SENDER_CHAIN_MISMATCH');
});

test('unknown profiles, schemas and extra selection fields fail', () => {
  for (const change of [{profile: 'latest'}, {schema: 'caw-block-transactions-selection/1'}, {trusted: true}]) {
    const s = sample(); Object.assign(s.selection, change); reject(() => inspect(s));
  }
  const s = sample(); reject(() => inspectBlockSenders(s.header, s.rawTransactions));
  reject(() => inspectBlockSenders(s.header, s.rawTransactions, s.selection, true));
});

test('selection and header changes cannot be hidden behind a correct signature', () => {
  let s = sample(); s.selection.hash = '0x' + 'ff'.repeat(32); reject(() => inspect(s));
  s = sample(); s.header.extraData = s.header.extraData === '0x' ? '0x01' : '0x'; reject(() => inspect(s));
  s = sample(); s.rawTransactions[0] = s.rawTransactions[0].slice(0, -2) + '00'; reject(() => inspect(s));
});

test('all arguments are captured without getters, toJSON or custom iteration', () => {
  let reads = 0;
  const s = sample();
  Object.defineProperty(s.selection, 'chainId', {enumerable: true, get() {reads++;return '0x1';}});
  reject(() => inspect(s)); assert.equal(reads, 0);
  const h = sample(); Object.defineProperty(h.header, 'toJSON', {enumerable: true, get() {reads++;return () => h.header;}});
  reject(() => inspect(h)); assert.equal(reads, 0);
  const a = sample(); a.rawTransactions[Symbol.iterator] = () => {reads++;throw Error('iterator');};
  reject(() => inspect(a)); assert.equal(reads, 0);
});

test('inherited, sparse, cyclic and oversized inputs fail before unchecked work', () => {
  let s = sample(); s.selection = Object.create(s.selection); reject(() => inspect(s));
  s = sample(); delete s.rawTransactions[0]; reject(() => inspect(s));
  s = sample(); s.header.cycle = s.header; reject(() => inspect(s));
  s = sample(); s.rawTransactions = Array(257).fill(s.rawTransactions[0]); reject(() => inspect(s));
  s = sample(); s.rawTransactions[0] = '0x' + 'ab'.repeat(16385); reject(() => inspect(s));
});

test('result is immutable and detached while caller inputs remain unchanged', () => {
  const s = sample(), before = clone(s), result = inspect(s);
  assert.deepEqual(s, before); frozen(result);
  s.selection.chainId = '0x2'; s.rawTransactions[0] = '0x';
  assert.notEqual(result.chainId, s.selection.chainId);
  assert.equal(result.transactions[0].encoded, before.rawTransactions[0]);
  assert.throws(() => {result.transactions[0].from = '0x' + '11'.repeat(20);}, TypeError);
});
