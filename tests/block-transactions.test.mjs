import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectBlockTransactions, inspectBlockTransactionReceipts } from '../reference/ethereum-block-transactions.mjs';
import { inspectBlockReceipts } from '../reference/ethereum-block-receipts.mjs';
import { inspectExecutionHeader } from '../reference/ethereum-execution-header.mjs';

// Python-generated complete envelope bytes and trie commitments are the oracle.
// No JavaScript transaction encoder or trie implementation supplies expectations.
// The synthetic signatures establish shape only, never a sender or execution.
const root = new URL('../', import.meta.url), PROFILE = 'london-16';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => structuredClone(value), plain = value => JSON.parse(JSON.stringify(value));
const same = (left, right) => assert.deepEqual(plain(left), plain(right));
const quantity = value => '0x' + BigInt(value).toString(16);
const selection = header => ({ schema: 'caw-block-transactions-selection/1', profile: PROFILE, hash: header.hash });
const receiptSelection = header => ({ schema: 'caw-block-receipts-selection/1', profile: PROFILE, hash: header.hash });
const hexChanged = value => '0x' + (parseInt(value.slice(2, 4), 16) ^ 1).toString(16).padStart(2, '0') + value.slice(4);
function read(path, pin) {
  const bytes = readFileSync(new URL(path, root)); assert.ok(bytes.length < 4 * 1024 * 1024);
  assert.match(pin, /^[0-9a-f]{64}$/); assert.equal(sha(bytes), pin, path);
  return JSON.parse(bytes.toString('utf8'));
}
const fixture = read('reference/fixtures/block-transactions-v1.json', '6ef84984389a24fb114cbbe4a8de6d739dcfdabcd07ef5c24c62fd10e1ae5086');
assert.equal(fixture.format, 'caw-block-transactions-fixtures-v1');
function vector(name) { const value = fixture.cases.find(item => item.name === name); assert.ok(value, name); return value; }
function receiptsFor(value) {
  if (value.receipts) return clone(value.receipts);
  const recipe = value.receipt_recipe;
  assert.equal(recipe.schema, 'caw-synthetic-associated-receipts/1');
  return Array.from({ length: recipe.count }, (_, index) => ({ ...clone(recipe.template), type: value.expected.transaction_types[index],
    cumulativeGasUsed: quantity(BigInt(index + 1) * BigInt(recipe.gas_step)), transactionIndex: quantity(index),
    blockHash: value.header.hash, blockNumber: value.header.number, transactionHash: value.expected.transaction_hashes[index] }));
}
function supplied(name = 'mixed-types-contract-creation-and-data-boundaries') {
  const value = vector(name);
  return { header: clone(value.header), raw: clone(value.raw_transactions), receipts: receiptsFor(value), selection: clone(value.selection) };
}
function inspect(value) { return inspectBlockTransactions(value.header, value.raw, value.selection); }
function join(value) { return inspectBlockTransactionReceipts(value.header, value.raw, value.receipts, value.selection); }
function rejects(action, code) {
  assert.throws(action, error => error instanceof Error && (code ? error.code === code
    : /^(BLOCK_TRANSACTIONS_|BLOCK_RECEIPTS_|EXEC_HEADER_)/.test(error.code ?? '')));
}
function frozen(value) {
  if (value !== null && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
const falseFlags = ['signaturesVerified', 'senderVerified', 'transactionsVerified', 'executionVerified',
  'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified'];
function boundary(result, header, count, combined = false) {
  assert.equal(result.schema, combined ? 'caw-block-transaction-receipts-integrity/1' : 'caw-block-transactions-integrity/1');
  assert.equal(result.profile, PROFILE); assert.equal(result.blockHash, header.hash); assert.equal(result.blockNumber, header.number);
  assert.equal(result.transactionCount, count); assert.equal(result.transactions.length, count);
  assert.equal(result.transactionsRoot, header.transactionsRoot);
  assert.equal(result.transactionCommitmentVerified, true); assert.equal(result.transactionSetCompleteUnderRoot, true);
  assert.equal(result.transactionAssociationVerified, combined);
  for (const flag of falseFlags) assert.equal(result[flag], false, flag);
  assert.equal(result.header_integrity.hash, header.hash); assert.equal(result.header_integrity.headerHashVerified, true);
  assert.equal(result.header_integrity.transactionsRoot, header.transactionsRoot);
  assert.equal(result.header_integrity.bodyCommitmentsVerified, false);
  for (const [index, transaction] of result.transactions.entries()) {
    assert.equal(transaction.index, index);
    assert.ok(['0x0', '0x1', '0x2'].includes(transaction.type));
    assert.match(transaction.hash, /^0x[0-9a-f]{64}$/);
    assert.equal(Object.hasOwn(transaction, 'from'), false);
    assert.equal(Object.hasOwn(transaction, 'transactionHash'), false);
  }
  if (!combined) return;
  assert.equal(result.receiptCount, count); assert.equal(result.receipts.length, count); assert.equal(result.associations.length, count);
  assert.equal(result.receiptsRoot, header.receiptsRoot); assert.equal(result.receiptCommitmentVerified, true);
  assert.equal(result.receiptSetCompleteUnderRoot, true);
  assert.equal(result.transaction_integrity.transactionAssociationVerified, false);
  assert.equal(result.receipt_integrity.transactionAssociationVerified, false);
  for (const [index, association] of result.associations.entries()) {
    const transaction = result.transactions[index], receipt = result.receipts[index];
    same(association, { index, transactionHash: transaction.hash, transactionEncoded: transaction.encoded,
      transactionType: transaction.type, receiptEncoded: receipt.encoded, receiptType: receipt.type });
    assert.equal(transaction.type, receipt.type);
  }
}

test('independent transaction fixtures pin their generator and Python primitives', () => {
  assert.equal(fixture.synthetic, true);
  assert.equal(new Set(fixture.cases.map(item => item.name)).size, fixture.cases.length);
  assert.equal(sha(readFileSync(new URL('reference/fixtures/generate-block-transactions-fixtures.py', root))),
    'd5ff964fa006119c4978701af7ecede4f6bf158a99188589264fcb9adde04da1');
  assert.equal(sha(readFileSync(new URL(fixture.primitive.path, root))), fixture.primitive.sha256);
  assert.equal(sha(readFileSync(new URL(fixture.receipt_oracle.path, root))), fixture.receipt_oracle.sha256);
});

for (const value of fixture.cases) {
  test('independent transaction bytes, hashes, trie and receipt association: ' + value.name, () => {
    const input = supplied(value.name), result = inspect(input), expected = value.expected;
    boundary(result, value.header, expected.transaction_count);
    assert.equal(result.transactionsRoot, expected.transactions_root); assert.equal(result.blockHash, expected.header_hash);
    same(result.transactions.map(transaction => transaction.encoded), value.raw_transactions);
    same(result.transactions.map(transaction => transaction.hash), expected.transaction_hashes);
    same(result.transactions.map(transaction => transaction.type), expected.transaction_types);
    assert.equal(sha(Buffer.concat(result.transactions.map(transaction => Buffer.from(transaction.encoded.slice(2), 'hex')))),
      expected.encoded_transactions_sha256);
    if (expected.decoded_transactions) same(result.transactions.map(({ encoded, ...transaction }) => transaction), expected.decoded_transactions);
    same(result.transactions.map(transaction => (transaction.encoded.length - 2) / 2), expected.raw_transaction_bytes);
    if (value.name === 'calldata-limit-8192') assert.equal((result.transactions[0].data.length - 2) / 2, 8192);
    if (value.name === 'access-address-limit-64') assert.equal(result.transactions[0].accessList.length, 64);
    if (value.name === 'access-slot-limit-256') assert.equal(result.transactions[0].accessList.reduce((count, entry) => count + entry.storageKeys.length, 0), 256);
    if (value.name === 'raw-transaction-limit-16384') assert.equal(expected.raw_transaction_bytes[0], 16384);
    if (value.name.startsWith('tiny-legacy-')) {
      assert.ok(expected.raw_transaction_bytes.every(bytes => bytes === 10));
      assert.match(result.transactionsRoot, /^0x[0-9a-f]{64}$/);
      assert.notEqual(result.transactionsRoot, result.transactions[0].hash);
      assert.equal(expected.trie_shape.root_rlp_bytes, value.name === 'tiny-legacy-short-root' ? 15 : 42);
      assert.equal(expected.trie_shape.inline_root_children, value.name === 'tiny-legacy-short-root' ? 0 : 2);
    }
    const combined = join(input); boundary(combined, value.header, expected.transaction_count, true);
    same(combined.transaction_integrity, result);
    same(combined.receipt_integrity, inspectBlockReceipts(value.header, input.receipts, receiptSelection(value.header)));
    assert.equal(combined.receiptsRoot, expected.receipts_root);
    assert.equal(sha(Buffer.concat(combined.receipts.map(receipt => Buffer.from(receipt.encoded.slice(2), 'hex')))),
      expected.encoded_receipts_sha256);
    if (expected.encoded_receipts) same(combined.receipts.map(receipt => receipt.encoded), expected.encoded_receipts);
    for (const sample of expected.index_samples) {
      const transaction = result.transactions[Number(BigInt(sample.index))]; assert.equal(transaction.hash, sample.hash);
      const key = { '0x0': '0x80', '0x1': '0x01', '0x7f': '0x7f', '0x80': '0x8180',
        '0x81': '0x8181', '0xff': '0x81ff' }[sample.index];
      if (key) assert.equal(sample.key, key);
    }
  });
}

test('empty transactions and receipts are complete under the standard empty trie root', () => {
  const value = supplied('empty'), result = join(value);
  assert.equal(result.transactionsRoot, '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421');
  assert.equal(result.receiptsRoot, result.transactionsRoot); same(result.associations, []); boundary(result, value.header, 0, true);
});

test('contract creation, calldata length boundaries and repeated access-list entries are preserved exactly', () => {
  const result = inspect(supplied()), [legacy, typeOne, typeTwo] = result.transactions;
  assert.equal(legacy.to, '0x'); assert.equal(legacy.data, '0x' + 'ab'.repeat(55));
  assert.equal(typeOne.data, '0x' + 'cd'.repeat(56)); assert.equal(typeTwo.to, '0x');
  assert.equal(typeOne.accessList.length, 2);
  assert.equal(typeOne.accessList[0].address, typeOne.accessList[1].address);
  assert.equal(typeOne.accessList[0].storageKeys[1], typeOne.accessList[0].storageKeys[2]);
  assert.equal(typeTwo.nonce, '0x' + 'f'.repeat(64));
  assert.equal(Object.hasOwn(legacy, 'chainId'), false);
});

test('zero and out-of-curve signature scalars are structural data without signature or sender claims', () => {
  for (const name of ['zero-signature-scalars-formatting-only', 'legacy-large-integers']) {
    const value = supplied(name), result = join(value); boundary(result, value.header, value.raw.length, true);
    for (const transaction of result.transactions) {
      assert.equal(transaction.r, name.startsWith('zero') ? '0x0' : '0x' + 'f'.repeat(64));
      assert.equal(transaction.s, transaction.r);
      assert.equal(Object.hasOwn(transaction, 'from'), false);
    }
  }
});

test('calldata bytes are committed independently of unchanged RLP length and signature fields', () => {
  const value = supplied(), before = value.raw[0], payload = 'ab'.repeat(55);
  assert.equal(before.split(payload).length, 2);
  value.raw[0] = before.replace(payload, 'ac' + 'ab'.repeat(54));
  assert.equal(value.raw[0].length, before.length);
  rejects(() => inspect(value), 'BLOCK_TRANSACTIONS_ROOT_MISMATCH');
  rejects(() => join(value), 'BLOCK_TRANSACTIONS_ROOT_MISMATCH');
});

for (const value of fixture.association_mismatches) {
  test('both roots independently pass but combined receipt association rejects: ' + value.name, () => {
    const transactions = inspectBlockTransactions(value.header, value.raw_transactions, value.selection);
    const receipts = inspectBlockReceipts(value.header, receiptsFor(value), receiptSelection(value.header));
    assert.equal(transactions.transactionsRoot, value.expected.transactions_root);
    assert.equal(receipts.receiptsRoot, value.expected.receipts_root);
    assert.equal(transactions.transactionCount, value.expected.transaction_count);
    assert.equal(receipts.receiptCount, value.expected.receipt_count);
    const code = value.name.includes('count-mismatch') ? 'BLOCK_TRANSACTIONS_COUNT_MISMATCH' : 'BLOCK_TRANSACTIONS_TYPE_MISMATCH';
    rejects(() => inspectBlockTransactionReceipts(value.header, value.raw_transactions, receiptsFor(value), value.selection), code);
  });
}

const invalidReasons = {
  'empty envelope': 'DATA', 'top-level transaction must be a list': 'TYPE',
  'legacy field count': 'TRANSACTION_FIELDS', 'unsupported typed prefix': 'TYPE',
  'missing typed payload': 'RLP', 'type two field count': 'TRANSACTION_FIELDS',
  'typed payload must be a list': 'TRANSACTION_FIELDS', 'trailing RLP item': 'RLP',
  'truncated RLP item': 'RLP', 'nonminimal list length': 'RLP', 'nonminimal length of length': 'RLP',
  'nonminimal scalar RLP': 'RLP', 'integer leading zero': 'TRANSACTION_INTEGER',
  'integer exceeds 32 bytes': 'TRANSACTION_INTEGER', 'integer must be scalar': 'TRANSACTION_INTEGER',
  'recipient width': 'TO', 'legacy v domain': 'V', 'typed parity domain': 'PARITY',
  'typed parity must be scalar': 'TRANSACTION_INTEGER', 'access list must be a list': 'ACCESS_LIST',
  'access tuple field count': 'ACCESS_LIST', 'access address width': 'ACCESS_LIST',
  'storage keys must be a list': 'ACCESS_LIST', 'storage key width': 'STORAGE_KEY',
  'calldata byte limit': 'DATA_LIMIT', 'access tuple limit': 'ACCESS_LIST_LIMIT',
  'aggregate storage key limit': 'ACCESS_LIST_LIMIT', 'RLP nesting limit': 'RLP_LIMIT',
  'RLP node limit': 'RLP_LIMIT', 'child exceeds parent RLP boundary': 'RLP',
  'transaction field count': 'TRANSACTION_FIELDS'
};
for (const value of fixture.invalid_envelopes) {
  test('malformed envelope rejected despite its independently matching header commitment: ' + value.name, () => {
    const header = { ...clone(fixture.invalid_header_template), ...value.header_patch };
    const checked = inspectExecutionHeader(header, { schema: 'caw-execution-header-selection/1', profile: PROFILE, hash: header.hash });
    assert.equal(checked.headerHashVerified, true); assert.equal(checked.transactionsRoot, value.header_patch.transactionsRoot);
    const reason = invalidReasons[value.expected_reason]; assert.ok(reason, value.expected_reason);
    rejects(() => inspectBlockTransactions(header, [value.raw_transaction], selection(header)), 'BLOCK_TRANSACTIONS_' + reason);
  });
}

test('missing, duplicated and reordered raw transactions cannot substitute for the complete ordered root', () => {
  for (const kind of ['missing', 'duplicate', 'reordered', 'empty']) {
    const value = supplied('typed-index-boundaries-130');
    if (kind === 'missing') value.raw.pop();
    else if (kind === 'duplicate') value.raw[1] = value.raw[0];
    else if (kind === 'reordered') [value.raw[0], value.raw[1]] = [value.raw[1], value.raw[0]];
    else value.raw = [];
    rejects(() => inspect(value), 'BLOCK_TRANSACTIONS_ROOT_MISMATCH');
  }
});

test('transaction ordering stays committed across RLP index 127, 128 and 255 boundaries', () => {
  for (const pair of [[127, 128], [128, 255]]) {
    const value = supplied('typed-index-boundaries-256'), [left, right] = pair;
    assert.notEqual(value.raw[left], value.raw[right]);
    [value.raw[left], value.raw[right]] = [value.raw[right], value.raw[left]];
    rejects(() => inspect(value), 'BLOCK_TRANSACTIONS_ROOT_MISMATCH');
  }
});

test('changing a signed-shaped scalar preserves syntax but breaks the checked transaction root', () => {
  const value = supplied('legacy-nonce-zero'), before = value.raw[0];
  value.raw[0] = before.slice(0, -2) + (before.endsWith('01') ? '02' : '01');
  rejects(() => inspect(value), 'BLOCK_TRANSACTIONS_ROOT_MISMATCH');
  rejects(() => join(value), 'BLOCK_TRANSACTIONS_ROOT_MISMATCH');
});

test('a matching reported header hash cannot hide a changed body commitment or header field', () => {
  for (const field of ['transactionsRoot', 'receiptsRoot', 'extraData']) {
    const value = supplied(); value.header[field] = field === 'extraData' ? '0xdeadbeef' : hexChanged(value.header[field]);
    rejects(() => inspect(value), 'EXEC_HEADER_HASH_MISMATCH'); rejects(() => join(value), 'EXEC_HEADER_HASH_MISMATCH');
  }
  const value = supplied(); value.selection.hash = hexChanged(value.selection.hash);
  rejects(() => inspect(value), 'EXEC_HEADER_SELECTED_HASH_MISMATCH'); rejects(() => join(value), 'EXEC_HEADER_SELECTED_HASH_MISMATCH');
});

test('changing a receipt status leaves the transaction commitment valid and breaks joint receipt binding', () => {
  const value = supplied(), expected = inspect(value);
  value.receipts[0].status = value.receipts[0].status === '0x1' ? '0x0' : '0x1';
  same(inspect(value), expected); rejects(() => join(value), 'BLOCK_RECEIPTS_ROOT_MISMATCH');
});

test('forged RPC transaction hash and sender metadata cannot change computed transaction associations', () => {
  const value = supplied(), expected = join(value);
  value.header.transactions = value.raw.map(() => ({ hash: '0x' + 'aa'.repeat(32), from: '0x' + 'bb'.repeat(20), input: '0xdeadbeef' }));
  for (const receipt of value.receipts) {
    receipt.transactionHash = '0x' + 'cc'.repeat(32); receipt.from = '0x' + 'dd'.repeat(20);
    receipt.to = '0x' + 'ee'.repeat(20); receipt.gasUsed = '0x0';
    for (const log of receipt.logs) log.transactionHash = '0x' + 'ff'.repeat(32);
  }
  same(join(value), expected);
});

test('both entry points require exact arguments and an explicit London transaction selection', () => {
  const value = supplied();
  for (const profile of [undefined, null, 'auto', 'shanghai-17', 'cancun-20', 'prague-21']) {
    const changed = { ...value.selection, profile };
    rejects(() => inspectBlockTransactions(value.header, value.raw, changed));
    rejects(() => inspectBlockTransactionReceipts(value.header, value.raw, value.receipts, changed));
  }
  for (const changed of [undefined, null, {}, { ...value.selection, schema: 'caw-block-receipts-selection/1' },
    { ...value.selection, future: true }]) {
    rejects(() => inspectBlockTransactions(value.header, value.raw, changed));
    rejects(() => inspectBlockTransactionReceipts(value.header, value.raw, value.receipts, changed));
  }
  rejects(() => inspectBlockTransactions(value.header, value.raw));
  rejects(() => inspectBlockTransactions(value.header, value.raw, value.selection, true));
  rejects(() => inspectBlockTransactionReceipts(value.header, value.raw, value.selection));
  rejects(() => inspectBlockTransactionReceipts(value.header, value.raw, value.receipts, value.selection, true));
  for (const header of [undefined, null, {}, { ...value.header, transactionsRoot: undefined }]) {
    rejects(() => inspectBlockTransactions(header, value.raw, value.selection));
    rejects(() => inspectBlockTransactionReceipts(header, value.raw, value.receipts, value.selection));
  }
});

test('raw transactions must be complete lower-case byte strings in a dense array', () => {
  const value = supplied('legacy-nonce-zero');
  for (const raw of [undefined, null, {}, '[]', [null], [[]], [1], ['0x'], ['0x0'], ['0Xc0'], ['0xAA'],
    [Buffer.from(value.raw[0].slice(2), 'hex')], [{ raw: value.raw[0], hash: '0x' + '00'.repeat(32) }]]) {
    rejects(() => inspectBlockTransactions(value.header, raw, value.selection));
    rejects(() => inspectBlockTransactionReceipts(value.header, raw, value.receipts, value.selection));
  }
});

test('input capture and both result trees are deeply isolated and immutable', () => {
  const value = supplied(), before = clone(value), transactionResult = inspect(value), result = join(value), expected = plain(result);
  same(value, before); frozen(transactionResult); frozen(result);
  value.raw[0] = '0xc0'; value.header.extraData = '0xffff'; value.selection.hash = '0x' + '00'.repeat(32);
  value.receipts[0].logs.length = 0; value.receipts.length = 0; same(result, expected);
  assert.throws(() => { result.associations[0].transactionHash = '0x'; }, TypeError);
  assert.throws(() => { result.transactions[0].data = '0xff'; }, TypeError);
  assert.throws(() => { transactionResult.transactions.pop(); }, TypeError);
});

test('capture rejects getters, conversion hooks and caller iterators without running them', () => {
  let calls = 0;
  for (const place of ['header', 'raw', 'receipt', 'receipt-array', 'selection']) {
    const value = supplied();
    const [object, key] = place === 'header' ? [value.header, 'transactionsRoot'] : place === 'raw' ? [value.raw, '0']
      : place === 'receipt' ? [value.receipts[0], 'logsBloom'] : place === 'receipt-array' ? [value.receipts, '0'] : [value.selection, 'hash'];
    Object.defineProperty(object, key, { enumerable: true, configurable: true, get() { calls++; throw new Error('not called'); } });
    rejects(() => join(value));
    if (!place.startsWith('receipt')) rejects(() => inspect(value));
  }
  for (const hook of ['toJSON', 'valueOf', Symbol.toPrimitive, Symbol.iterator]) {
    const value = supplied(); value.raw[hook] = () => { calls++; throw new Error('not called'); };
    rejects(() => inspect(value)); rejects(() => join(value));
  }
  assert.equal(calls, 0);
});

test('cycles, exotic prototypes, symbols, hidden fields and sparse arrays fail closed', () => {
  for (const kind of ['cycle', 'date', 'prototype', 'symbol', 'hidden', 'sparse', 'array-property']) {
    const value = supplied();
    if (kind === 'cycle') value.header.transactions = value.header;
    else if (kind === 'date') value.header.transactions = new Date(0);
    else if (kind === 'prototype') Object.setPrototypeOf(value.selection, { inherited: true });
    else if (kind === 'symbol') value.selection[Symbol('hidden')] = true;
    else if (kind === 'hidden') Object.defineProperty(value.selection, 'hidden', { value: null, enumerable: false });
    else if (kind === 'sparse') delete value.raw[0];
    else value.raw.extra = true;
    rejects(() => inspect(value)); rejects(() => join(value));
  }
});

test('null-prototype plain data and frozen inputs preserve computed commitments and associations', () => {
  const value = supplied(), expectedTransactions = inspect(value), expected = join(value);
  function nullObjects(item) {
    if (Array.isArray(item)) return Object.freeze(item.map(nullObjects));
    if (item && typeof item === 'object') return Object.freeze(Object.assign(Object.create(null),
      Object.fromEntries(Object.entries(item).map(([key, child]) => [key, nullObjects(child)]))));
    return item;
  }
  const input = nullObjects(value); same(inspect(input), expectedTransactions); same(join(input), expected);
});

test('transaction count and envelope size budgets reject before building unbounded tries', () => {
  const value = supplied('legacy-nonce-zero');
  value.raw = Array(257).fill(value.raw[0]); rejects(() => inspect(value), 'BLOCK_TRANSACTIONS_TRANSACTION_LIMIT');
  rejects(() => join(value), 'BLOCK_TRANSACTIONS_TRANSACTION_LIMIT');
  value.raw = ['0x' + '00'.repeat(16385)];
  rejects(() => inspect(value), 'BLOCK_TRANSACTIONS_TRANSACTION_ENCODED_LIMIT');
});

test('individually bounded envelopes cannot exceed the aggregate one MiB transaction byte budget', () => {
  const value = supplied('calldata-limit-8192'), raw = value.raw[0];
  value.raw = Array(128).fill(raw); assert.ok((raw.length - 2) / 2 <= 16384);
  assert.ok(value.raw.length <= 256); assert.ok((raw.length - 2) / 2 * value.raw.length > 1048576);
  rejects(() => inspect(value), 'BLOCK_TRANSACTIONS_ENCODED_LIMIT');
});

test('capture bounds cover depth, array length, node count and aggregate metadata bytes', () => {
  for (const kind of ['depth', 'array', 'nodes', 'bytes']) {
    const value = supplied('legacy-nonce-zero');
    if (kind === 'depth') { let child = null; for (let index = 0; index < 25; index++) child = { nested: child }; value.header.transactions = child; }
    else if (kind === 'array') value.header.transactions = Array(2049).fill(null);
    else if (kind === 'nodes') value.header.transactions = Array.from({ length: 100 }, () => Array(2048).fill(null));
    else value.header.transactions = Array(48).fill('a'.repeat(200000));
    rejects(() => inspect(value), 'BLOCK_TRANSACTIONS_LIMIT'); rejects(() => join(value), 'BLOCK_TRANSACTIONS_LIMIT');
  }
});

test('joint capture charges all four inputs against one budget before validating either root', () => {
  const value = supplied('legacy-nonce-zero');
  value.header.transactions = Array(23).fill('a'.repeat(200000));
  value.receipts[0].from = Array(23).fill('b'.repeat(200000));
  // Each input is below the transaction checker's 8 MiB capture bound. Their
  // combined size must fail in the joint capture, before header/receipt limits.
  rejects(() => join(value), 'BLOCK_TRANSACTIONS_LIMIT');
});
