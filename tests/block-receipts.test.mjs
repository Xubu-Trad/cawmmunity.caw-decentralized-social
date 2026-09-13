import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectBlockReceipts } from '../reference/ethereum-block-receipts.mjs';

// Historical captures and independent Python vectors exercise receipt-root
// reconstruction. Neither a matching root nor these synthetic blocks establish
// consensus, execution or a receipt's association with supplied transaction data.
const root = new URL('../', import.meta.url), PROFILE = 'london-16';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => structuredClone(value), plain = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => assert.deepEqual(plain(a), plain(b));
const quantity = n => '0x' + BigInt(n).toString(16);
const selection = header => ({ schema: 'caw-block-receipts-selection/1', profile: PROFILE, hash: header.hash });
const hexChanged = value => '0x' + (parseInt(value.slice(2, 4), 16) ^ 1).toString(16).padStart(2, '0') + value.slice(4);
function read(path, pin) {
  const bytes = readFileSync(new URL(path, root)); assert.ok(bytes.length < 4 * 1024 * 1024);
  assert.match(pin, /^[0-9a-f]{64}$/); assert.equal(sha(bytes), pin, path);
  return JSON.parse(bytes.toString('utf8'));
}
const fixture = read('reference/fixtures/block-receipts-v1.json', 'c33a162580eee8d9df8a69e2eba46c08b77a9982e205f37a87d3a0a78b117be1');
assert.equal(fixture.format, 'caw-block-receipts-fixtures-v1');
const histories = {
  leftNumber: read('experiments/paid-reorg/history-left-number.json', '9c1a69329dab7a232ffde072d658a02f99497348ec640f3419b1cd6a10ac88e4'),
  leftHash: read('experiments/paid-reorg/history-left-hash.json', 'e63c9f608d5c3b81f90e052c2e3defc6f635684fa0bf62cba89025dab8f970d4'),
  rightNumber: read('experiments/paid-reorg/history-right-number.json', 'bb1571c806a80d4866eeb54f61c1269831acca70f4a4efcb1d3ccc7471834cb2'),
  rightHash: read('experiments/paid-reorg/history-right-hash.json', 'd8aa7517ebeb7356bd176e47bb9442fc9e30afd3ab56cf61d470f5429c18da23')
};
function vector(name) { const value = fixture.cases.find(item => item.name === name); assert.ok(value, name); return value; }
function expand(value) {
  if (value.receipts) return clone(value.receipts);
  const recipe = value.receipt_recipe;
  assert.ok(['caw-synthetic-empty-log-receipts/1', 'caw-synthetic-repeated-receipts/1'].includes(recipe.schema));
  return Array.from({ length: recipe.count }, (_, index) => ({ ...clone(recipe.template),
    transactionIndex: quantity(index), cumulativeGasUsed: quantity(BigInt(index + 1) * BigInt(recipe.gas_step)),
    blockHash: value.header.hash, blockNumber: value.header.number }));
}
function inspect(value) { return inspectBlockReceipts(value.header, expand(value), value.selection); }
function rejects(fn, code) {
  assert.throws(fn, error => error instanceof Error && (code ? error.code === code
    : /^(BLOCK_RECEIPTS_|EXEC_HEADER_)/.test(error.code ?? '')));
}
function boundary(result, header, count) {
  assert.equal(result.schema, 'caw-block-receipts-integrity/1'); assert.equal(result.profile, PROFILE);
  assert.equal(result.blockHash, header.hash); assert.equal(result.blockNumber, header.number);
  assert.equal(result.receiptCount, count); assert.equal(result.receipts.length, count);
  assert.equal(result.receiptsRoot, header.receiptsRoot);
  assert.equal(result.receiptCommitmentVerified, true); assert.equal(result.receiptSetCompleteUnderRoot, true);
  for (const flag of ['transactionAssociationVerified', 'transactionsVerified', 'executionVerified',
    'endpointAuthenticated', 'consensusVerified', 'finalityVerified', 'freshnessVerified']) assert.equal(result[flag], false, flag);
  assert.equal(result.header_integrity.schema, 'caw-execution-header-integrity/1');
  assert.equal(result.header_integrity.hash, header.hash); assert.equal(result.header_integrity.headerHashVerified, true);
  assert.equal(result.header_integrity.receiptsRoot, header.receiptsRoot);
  assert.equal(result.header_integrity.bodyCommitmentsVerified, false);
  result.receipts.forEach((receipt, index) => {
    assert.equal(receipt.index, index);
    same(Object.keys(receipt).sort(), ['index', 'type', 'status', 'cumulativeGasUsed', 'logsBloom', 'logs', 'encoded'].sort());
    receipt.logs.forEach(log => same(Object.keys(log).sort(), ['address', 'topics', 'data'].sort()));
  });
}
function frozen(value) {
  if (value !== null && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function retained(index = 0) {
  const block = clone(histories.leftNumber.blocks[index]);
  return { header: block.header, receipts: block.transactions.map(item => item.receipt), selection: selection(block.header) };
}
function check(value) { return inspectBlockReceipts(value.header, value.receipts, value.selection); }
function bareLogs(receipts) {
  for (const receipt of receipts) receipt.logs = receipt.logs.map(({ address, topics, data }) => ({ address, topics, data }));
  return receipts;
}

test('independent receipt fixtures pin their generator and shared Python primitives', () => {
  assert.equal(fixture.synthetic, true);
  assert.equal(new Set(fixture.cases.map(item => item.name)).size, fixture.cases.length);
  assert.equal(sha(readFileSync(new URL('reference/fixtures/generate-block-receipts-fixtures.py', root))),
    'bade4d20fa0fd49d0990745b0dd4c0a4163cc7634d537358225e7c49dedaca77');
  assert.equal(sha(readFileSync(new URL(fixture.primitive.path, root))), fixture.primitive.sha256);
});

for (const value of fixture.cases.filter(item => item.expected.accepted !== false)) {
  test('independent receipt trie and encoding vector: ' + value.name, () => {
    const result = inspect(value), expected = value.expected; boundary(result, value.header, expected.receipt_count);
    assert.equal(result.receiptsRoot, expected.receipts_root);
    assert.equal(result.blockHash, expected.header_hash);
    assert.equal(value.header.logsBloom, expected.logs_bloom); assert.equal(value.header.gasUsed, expected.gas_used);
    const bytes = result.receipts.map(receipt => Buffer.from(receipt.encoded.slice(2), 'hex'));
    assert.equal(sha(Buffer.concat(bytes)), expected.encoded_receipts_sha256);
    if (expected.encoded_receipts) same(result.receipts.map(receipt => receipt.encoded), expected.encoded_receipts);
    for (const sample of expected.encoded_samples ?? []) {
      const receipt = result.receipts[Number(BigInt(sample.transaction_index))]; assert.equal(receipt.encoded, sample.encoded);
      assert.equal(sha(Buffer.from(receipt.encoded.slice(2), 'hex')), sample.sha256);
      const boundaryKey = { '0x0': '0x80', '0x1': '0x01', '0x7f': '0x7f', '0x80': '0x8180', '0xff': '0x81ff' }[sample.transaction_index];
      if (boundaryKey) assert.equal(sample.key, boundaryKey);
    }
  });
}

test('all 60 retained London block receipt sets match the original header commitments', () => {
  const results = {};
  for (const [name, history] of Object.entries(histories)) {
    assert.equal(history.blocks.length, 15);
    results[name] = history.blocks.map(block => {
      const receipts = block.transactions.map(item => item.receipt);
      const result = inspectBlockReceipts(block.header, receipts, selection(block.header));
      boundary(result, block.header, receipts.length); return result;
    });
  }
  same(results.leftNumber, results.leftHash); same(results.rightNumber, results.rightHash);
  assert.notEqual(results.leftNumber.at(-1).blockHash, results.rightNumber.at(-1).blockHash);
});

test('the empty receipt set matches the standard empty trie root and has no accepted transaction claim', () => {
  const value = vector('empty'), result = inspect(value);
  assert.equal(result.receiptsRoot, '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421');
  assert.equal(result.receiptCount, 0); same(result.receipts, []); boundary(result, value.header, 0);
});

test('type envelopes and status remain distinct independently pinned receipt bytes', () => {
  const names = ['legacy-failed', 'legacy-success', 'type-1', 'type-2'];
  const results = names.map(name => inspect(vector(name)));
  assert.equal(results[0].receipts[0].status, '0x0'); assert.equal(results[1].receipts[0].status, '0x1');
  assert.equal(results[0].receipts[0].type, '0x0');
  assert.equal(results[2].receipts[0].encoded.slice(0, 4), '0x01');
  assert.equal(results[3].receipts[0].encoded.slice(0, 4), '0x02');
  assert.equal(new Set(results.map(result => result.receiptsRoot)).size, 4);
});

test('changing log data preserves its bloom but invalidates its receipt commitment', () => {
  const value = retained(0); const log = value.receipts[0].logs[0];
  log.data = log.data === '0x' ? '0x00' : hexChanged(log.data);
  rejects(() => check(value), 'BLOCK_RECEIPTS_ROOT_MISMATCH');
});

test('log order and topic order are committed even when the bloom stays unchanged', () => {
  for (const changedOrder of ['logs', 'topics']) {
    const value = retained(); bareLogs(value.receipts);
    if (changedOrder === 'logs') value.receipts[0].logs.reverse();
    else value.receipts[0].logs[0].topics.reverse();
    rejects(() => check(value), 'BLOCK_RECEIPTS_ROOT_MISMATCH');
  }
});

test('changing a well-formed receipt type or status fails the independent receipt root', () => {
  for (const field of ['type', 'status']) {
    const value = retained(1); value.receipts[0][field] = field === 'type' ? '0x1' : '0x0';
    rejects(() => check(value), 'BLOCK_RECEIPTS_ROOT_MISMATCH');
  }
});

test('altered receipt blooms, log addresses and log topics are rejected', () => {
  for (const field of ['bloom', 'address', 'topic']) {
    const value = retained(0), receipt = value.receipts[0];
    if (field === 'bloom') receipt.logsBloom = hexChanged(receipt.logsBloom);
    else if (field === 'address') receipt.logs[0].address = hexChanged(receipt.logs[0].address);
    else receipt.logs[0].topics[0] = hexChanged(receipt.logs[0].topics[0]);
    rejects(() => check(value));
  }
});

test('a matching reported header hash cannot hide altered header fields or selected endpoints', () => {
  for (const field of ['receiptsRoot', 'logsBloom', 'gasUsed', 'extraData']) {
    const value = retained(); value.header[field] = field === 'gasUsed' ? quantity(BigInt(value.header[field]) + 1n)
      : field === 'extraData' ? '0x01' : hexChanged(value.header[field]);
    rejects(() => check(value), 'EXEC_HEADER_HASH_MISMATCH');
  }
  const value = retained(); value.selection.hash = hexChanged(value.selection.hash);
  rejects(() => check(value), 'EXEC_HEADER_SELECTED_HASH_MISMATCH');
});

test('missing, duplicated, reordered and reindexed receipt sets cannot substitute for a complete root', () => {
  const source = fixture.cases.find(item => item.receipt_recipe?.count === 130); assert.ok(source);
  for (const change of ['missing', 'duplicate', 'reordered', 'reindexed']) {
    const value = { header: clone(source.header), receipts: expand(source), selection: clone(source.selection) };
    if (change === 'missing') value.receipts.pop();
    else if (change === 'duplicate') value.receipts[1] = clone(value.receipts[0]);
    else {
      [value.receipts[0], value.receipts[1]] = [value.receipts[1], value.receipts[0]];
      if (change === 'reindexed') value.receipts.forEach((receipt, index) => { receipt.transactionIndex = quantity(index); });
    }
    rejects(() => check(value));
  }
  const value = retained(); value.receipts = []; rejects(() => check(value));
});

test('reordering different receipt payloads still fails after repairing indices and cumulative gas', () => {
  const source = vector('mixed-log-boundaries');
  const value = { header: clone(source.header), receipts: expand(source), selection: clone(source.selection) };
  const gas = value.receipts.map(receipt => receipt.cumulativeGasUsed);
  [value.receipts[0], value.receipts[1]] = [value.receipts[1], value.receipts[0]];
  value.receipts.forEach((receipt, index) => { receipt.transactionIndex = quantity(index); receipt.cumulativeGasUsed = gas[index]; });
  rejects(() => check(value), 'BLOCK_RECEIPTS_ROOT_MISMATCH');
});

test('cumulative gas must increase and finish at the selected header gas used', () => {
  const source = fixture.cases.find(item => item.receipt_recipe?.count === 130); assert.ok(source);
  for (const change of ['zero', 'equal', 'decrease', 'final']) {
    const value = { header: clone(source.header), receipts: expand(source), selection: clone(source.selection) };
    if (change === 'zero') value.receipts[0].cumulativeGasUsed = '0x0';
    else if (change === 'equal') value.receipts[1].cumulativeGasUsed = value.receipts[0].cumulativeGasUsed;
    else if (change === 'decrease') value.receipts[1].cumulativeGasUsed = '0x1';
    else value.receipts.at(-1).cumulativeGasUsed = quantity(BigInt(value.header.gasUsed) + 1n);
    rejects(() => check(value));
  }
  const value = { header: clone(source.header), receipts: expand(source), selection: clone(source.selection) };
  value.receipts[0].cumulativeGasUsed = quantity(BigInt(value.receipts[0].cumulativeGasUsed) + 1n);
  rejects(() => check(value), 'BLOCK_RECEIPTS_ROOT_MISMATCH');
});

test('receipt and supplied log block associations and ordinal metadata fail closed', () => {
  for (const field of ['blockHash', 'blockNumber', 'transactionIndex']) {
    const value = retained(); value.receipts[0][field] = field === 'blockHash'
      ? hexChanged(value.header.hash) : quantity(BigInt(value.receipts[0][field]) + 1n);
    rejects(() => check(value));
    const logValue = retained(); logValue.receipts[0].logs[0][field] = field === 'blockHash'
      ? hexChanged(logValue.header.hash) : quantity(BigInt(logValue.receipts[0].logs[0][field]) + 1n);
    rejects(() => check(logValue));
  }
  for (const [field, invalid] of [['logIndex', '0x1'], ['removed', true], ['removed', null]]) {
    const value = retained(); value.receipts[0].logs[0][field] = invalid; rejects(() => check(value));
  }
});

test('supplied log indices are global across receipts and cannot restart at each transaction', () => {
  const source = vector('mixed-log-boundaries');
  const value = { header: clone(source.header), receipts: expand(source), selection: clone(source.selection) };
  let index = 0;
  for (const receipt of value.receipts) for (const log of receipt.logs) log.logIndex = quantity(index++);
  same(check(value), inspect(source));
  assert.ok(value.receipts[1].logs.length > 0); value.receipts[1].logs[0].logIndex = '0x0';
  rejects(() => check(value), 'BLOCK_RECEIPTS_LOG_INDEX');
});

test('receipt-root matching does not authenticate transaction hashes, calldata or RPC summary metadata', () => {
  const block = clone(histories.leftNumber.blocks[0]), receipts = block.transactions.map(item => item.receipt);
  const expected = inspectBlockReceipts(block.header, receipts, selection(block.header));
  block.header.transactions = ['0x' + 'aa'.repeat(32)];
  block.transactions[0].transaction.data = '0xdeadbeef';
  receipts[0].transactionHash = '0x' + 'bb'.repeat(32);
  receipts[0].gasUsed = '0x0'; receipts[0].from = '0x' + 'cc'.repeat(20);
  receipts[0].logs.forEach(log => { log.transactionHash = '0x' + 'dd'.repeat(32); log.blockTimestamp = '0x0'; });
  const result = inspectBlockReceipts(block.header, receipts, selection(block.header));
  same(result, expected); boundary(result, block.header, receipts.length);
});

test('optional receipt and log metadata can be absent without changing consensus-only output', () => {
  const value = retained(), expected = check(value);
  value.receipts = value.receipts.map(({ type, status, cumulativeGasUsed, logsBloom, logs,
    transactionIndex, blockHash, blockNumber }) => ({ type, status, cumulativeGasUsed, logsBloom,
    logs: logs.map(({ address, topics, data }) => ({ address, topics, data })), transactionIndex, blockHash, blockNumber }));
  same(check(value), expected);
});

test('explicit London selection and exact argument shape cannot silently downgrade', () => {
  const value = retained();
  for (const profile of [undefined, null, 'auto', 'shanghai-17', 'cancun-20', 'prague-21'])
    rejects(() => inspectBlockReceipts(value.header, value.receipts, { ...value.selection, profile }));
  for (const malformed of [undefined, null, {}, { ...value.selection, schema: 'caw-execution-header-selection/1' },
    { ...value.selection, unexpected: true }]) rejects(() => inspectBlockReceipts(value.header, value.receipts, malformed));
  rejects(() => inspectBlockReceipts(value.header, value.receipts));
  rejects(() => inspectBlockReceipts(value.header, value.receipts, value.selection, true));
});

test('missing, null and unknown receipt or log fields are rejected', () => {
  for (const receipts of [null, {}, '[]', [null], [[]]]) {
    const value = retained(); value.receipts = receipts; rejects(() => check(value));
  }
  for (const field of ['type', 'status', 'cumulativeGasUsed', 'logsBloom', 'logs', 'transactionIndex', 'blockHash', 'blockNumber']) {
    for (const mode of ['absent', 'null']) {
      const value = retained(); if (mode === 'absent') delete value.receipts[0][field]; else value.receipts[0][field] = null;
      rejects(() => check(value));
    }
  }
  for (const field of ['address', 'topics', 'data']) {
    const value = retained(); delete value.receipts[0].logs[0][field]; rejects(() => check(value));
  }
  for (const field of ['root', 'futureType', 'data']) {
    const value = retained(); value.receipts[0][field] = '0x'; rejects(() => check(value));
  }
  const value = retained(); value.receipts[0].logs[0].unknown = true; rejects(() => check(value));
});

test('only London receipt types and status bits use canonical lower-case quantities', () => {
  for (const field of ['transactionIndex', 'blockNumber', 'cumulativeGasUsed', 'type', 'status']) {
    for (const invalid of ['0x', '0x00', '0x01', '0X1', '0xA', '1', '-0x1', 1, '0x1' + '0'.repeat(64)]) {
      const value = retained(); value.receipts[0][field] = invalid; rejects(() => check(value));
    }
  }
  for (const invalid of ['0x3', '0x4', '0x7f', '0x80']) {
    const value = retained(); value.receipts[0].type = invalid; rejects(() => check(value));
  }
  for (const invalid of ['0x2', '0xff']) {
    const value = retained(); value.receipts[0].status = invalid; rejects(() => check(value));
  }
});

test('receipt bloom, log address/topic and log data widths are strict', () => {
  for (const [field, invalid] of [['logsBloom', '0x' + '00'.repeat(255)], ['logsBloom', '0x' + '00'.repeat(257)],
    ['blockHash', '0x' + '00'.repeat(31)], ['blockHash', '0x' + 'AA'.repeat(32)]]) {
    const value = retained(); value.receipts[0][field] = invalid; rejects(() => check(value));
  }
  for (const [field, invalid] of [['address', '0x' + '00'.repeat(19)], ['address', '0x' + '00'.repeat(21)],
    ['data', '0x0'], ['data', '0xAA'], ['topics', ['0x' + '00'.repeat(31)]], ['topics', Array(5).fill('0x' + '00'.repeat(32))]]) {
    const value = retained(); value.receipts[0].logs[0][field] = invalid; rejects(() => check(value));
  }
});

test('captured input and nested result values are isolated and deeply immutable', () => {
  const value = retained(), before = clone(value), result = check(value), expected = plain(result); same(value, before); frozen(result);
  value.header.extraData = '0xffff'; value.receipts[0].logs[0].topics[0] = '0x' + '11'.repeat(32);
  value.receipts.length = 0; value.selection.hash = '0x' + '00'.repeat(32); same(result, expected);
  assert.throws(() => { result.receipts[0].logs[0].data = '0xff'; }, TypeError);
});

test('plain-data capture rejects getters without invoking them and does not invoke toJSON', () => {
  let calls = 0;
  for (const place of ['header', 'receipt', 'log', 'array', 'selection']) {
    const value = retained();
    const [object, key] = place === 'header' ? [value.header, 'receiptsRoot'] : place === 'receipt' ? [value.receipts[0], 'logsBloom']
      : place === 'log' ? [value.receipts[0].logs[0], 'data'] : place === 'array' ? [value.receipts, '0'] : [value.selection, 'hash'];
    Object.defineProperty(object, key, { enumerable: true, configurable: true, get() { calls++; throw new Error('not called'); } });
    rejects(() => check(value));
  }
  const value = retained(); value.receipts[0].toJSON = () => { calls++; throw new Error('not called'); };
  rejects(() => check(value)); assert.equal(calls, 0);
});

test('cycles, exotic prototypes, symbols, non-enumerable fields and sparse arrays fail before encoding', () => {
  for (const change of ['cycle', 'date', 'symbol', 'hidden', 'sparse', 'array-property']) {
    const value = retained();
    if (change === 'cycle') value.receipts[0].from = value.receipts;
    else if (change === 'date') value.receipts[0].from = new Date(0);
    else if (change === 'symbol') value.receipts[0][Symbol('hidden')] = true;
    else if (change === 'hidden') Object.defineProperty(value.receipts[0], 'from', { value: null, enumerable: false });
    else if (change === 'sparse') { value.receipts.length = 2; delete value.receipts[1]; }
    else value.receipts.extra = true;
    rejects(() => check(value));
  }
});

test('null-prototype plain data and frozen inputs preserve the same validated receipt output', () => {
  const value = retained(), expected = check(value);
  function nullObjects(item) {
    if (Array.isArray(item)) return Object.freeze(item.map(nullObjects));
    if (item && typeof item === 'object') return Object.freeze(Object.assign(Object.create(null),
      Object.fromEntries(Object.entries(item).map(([key, child]) => [key, nullObjects(child)]))));
    return item;
  }
  same(check(nullObjects(value)), expected);
});

test('more than 256 receipts is rejected before attempting an unbounded trie', () => {
  const value = retained(); value.receipts = Array.from({ length: 257 }, () => clone(value.receipts[0]));
  rejects(() => check(value), 'BLOCK_RECEIPTS_RECEIPT_LIMIT');
});

test('more than 64 logs in one receipt and more than 8192 data bytes in a log are rejected', () => {
  const value = retained(); bareLogs(value.receipts);
  value.receipts[0].logs = Array.from({ length: 65 }, (_, index) => clone(value.receipts[0].logs[index % 3]));
  rejects(() => check(value), 'BLOCK_RECEIPTS_LOG_LIMIT');
  const large = retained(); large.receipts[0].logs[0].data = '0x' + 'ab'.repeat(8193);
  rejects(() => check(large), 'BLOCK_RECEIPTS_DATA');
});

test('two individually bounded data fields cannot exceed the 16 KiB encoded receipt budget', () => {
  const value = retained(); bareLogs(value.receipts);
  value.receipts[0].logs[0].data = '0x' + 'ab'.repeat(8192);
  value.receipts[0].logs[1].data = '0x' + 'cd'.repeat(8192);
  rejects(() => check(value), 'BLOCK_RECEIPTS_RECEIPT_ENCODED_LIMIT');
});

test('individually valid log counts cannot exceed the aggregate 512-log bound', () => {
  const source = vector('block-log-limit-512');
  const value = { header: clone(source.header), receipts: expand(source), selection: clone(source.selection) };
  assert.equal(value.receipts.length, 8); assert.equal(value.receipts[0].logs.length, 64);
  const extra = clone(value.receipts[0]); extra.transactionIndex = '0x8';
  extra.cumulativeGasUsed = quantity(9n * BigInt(source.receipt_recipe.gas_step)); value.receipts.push(extra);
  rejects(() => check(value), 'BLOCK_RECEIPTS_LOG_LIMIT');
});

test('individually bounded encoded receipts cannot exceed the aggregate 1 MiB budget', () => {
  // The original one-receipt vector is independently pinned. Repetition is an
  // admission-limit probe, not a claimed valid root or exact-boundary oracle.
  const source = vector('log-data-limit-8192'), one = expand(source)[0];
  const value = { header: clone(source.header), selection: clone(source.selection),
    receipts: Array.from({ length: 128 }, (_, index) => ({ ...clone(one), transactionIndex: quantity(index),
      cumulativeGasUsed: quantity(BigInt(index + 1) * BigInt(source.receipt_recipe.gas_step)) })) };
  assert.ok(value.receipts.length < 256); assert.equal(value.receipts[0].logs.length, 1);
  rejects(() => check(value), 'BLOCK_RECEIPTS_ENCODED_LIMIT');
});

test('capture bounds reject excessive metadata depth, array length, values and aggregate size', () => {
  for (const kind of ['depth', 'array', 'nodes', 'bytes']) {
    const value = retained();
    if (kind === 'depth') { let data = null; for (let i = 0; i < 22; i++) data = { nested: data }; value.receipts[0].from = data; }
    else if (kind === 'array') value.receipts[0].from = Array(2049).fill(null);
    else if (kind === 'nodes') value.receipts[0].from = Array.from({ length: 50 }, () => Array(2048).fill(null));
    else value.receipts[0].from = Array(24).fill('a'.repeat(200000));
    rejects(() => check(value), 'BLOCK_RECEIPTS_LIMIT');
  }
});
