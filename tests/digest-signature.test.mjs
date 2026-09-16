import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectDigestSignature } from '../reference/ethereum-block-senders.mjs';
import { inspectBlockTransactions } from '../reference/ethereum-block-transactions.mjs';

// Native signature/public-key expectations are retained alpha42 fixtures.
// Only canonical envelope decoding is shared with the implementation. These
// tests do not derive their expected signer by calling sender recovery.
const fixtureBytes = readFileSync(new URL('../reference/fixtures/block-senders-v1.json', import.meta.url));
assert.ok(fixtureBytes.length <= 512 * 1024);
assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'),
  '2ad5cc9166b143fb979f57712c154e446dadb0bdb2cb694e67e298a327299373');
const fixture = JSON.parse(fixtureBytes);
assert.equal(fixture.schema, 'caw-block-senders-fixtures/1');
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const word = value => BigInt(value).toString(16).padStart(64, '0');
function signature(transaction, parity) {
  return '0x' + word(transaction.r) + word(transaction.s)
    + (27n + BigInt(parity)).toString(16);
}
function parity(transaction) {
  if (transaction.type !== '0x0') return BigInt(transaction.yParity);
  const v = BigInt(transaction.v);
  return v < 35n ? v - 27n : (v - 35n) & 1n;
}
function decode(value) {
  const raw = value.rawTransactions ?? Array(value.rawTransactionsRecipe.count)
    .fill(value.rawTransactionsRecipe.rawTransaction);
  return inspectBlockTransactions(value.header, raw, {
    schema: 'caw-block-transactions-selection/1', profile: 'london-16', hash: value.header.hash,
  }).transactions;
}
function rows(value) {
  const expected = value.expected ?? Array.from({ length: value.expectedRecipe.count },
    (_, index) => ({ index, ...value.expectedRecipe.transaction }));
  const transactions = decode(value);
  assert.equal(transactions.length, expected.length);
  return transactions.map((transaction, index) => {
    assert.equal(parity(transaction), BigInt(expected[index].parity));
    return { digest: expected[index].signingHash,
      signature: signature(transaction, expected[index].parity), expected: expected[index] };
  });
}
const official = rows(fixture.positive.find(value => value.name === 'official-eip155-example'))[0];
const inspect = (row = official) => inspectDigestSignature(row.digest, row.signature);
function reject(fn, code) {
  assert.throws(fn, error => error instanceof Error && (code ? error.code === code
    : /^TRANSACTION_SENDER_/.test(error.code ?? '')));
}
function frozen(value) {
  if (value !== null && typeof value === 'object') {
    assert.ok(Object.isFrozen(value));
    Object.values(value).forEach(frozen);
  }
}

for (const value of fixture.positive) test('digest signature native vector: ' + value.name, () => {
  for (const row of rows(value)) {
    const result = inspect(row);
    assert.deepEqual(result, { schema: 'caw-digest-signature/1', digest: row.digest,
      signature: row.signature, from: row.expected.sender, publicKey: row.expected.publicKey,
      signatureVerified: true, signerAuthorityVerified: false, executionVerified: false });
    frozen(result);
  }
});

const scalarErrors = new Set(['TRANSACTION_SENDER_R', 'TRANSACTION_SENDER_S',
  'TRANSACTION_SENDER_HIGH_S', 'TRANSACTION_SENDER_RECOVERY_POINT', 'TRANSACTION_SENDER_PUBLIC_KEY']);
for (const value of fixture.negative.filter(value => scalarErrors.has(value.expected_error))) {
  test('digest signature rejects retained scalar/curve case: ' + value.name, () => {
    const transaction = decode(value)[0], recoveryParity = parity(transaction);
    let digest = official.digest;
    if (value.expected_error === 'TRANSACTION_SENDER_PUBLIC_KEY') {
      // The retained fixture explicitly uses R = +/-G. Choose z = +/-s so
      // sR-zG is infinity, without invoking recovery to manufacture an oracle.
      assert.equal(transaction.r, '0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
      const s = BigInt(transaction.s);
      digest = '0x' + word(recoveryParity === 0n ? s : N - s);
    }
    reject(() => inspectDigestSignature(digest, signature(transaction, recoveryParity)), value.expected_error);
  });
}

test('a digest check does not infer a chain, message domain, named identity or authority policy', () => {
  const result = inspect();
  assert.equal(result.from, '0x9d8a62f656a8d1615c1294fd71e9cfb3e4855a4f');
  assert.equal(result.signatureVerified, true);
  assert.equal(result.signerAuthorityVerified, false);
  assert.equal(result.executionVerified, false);
  for (const key of ['chainId', 'replayProtected', 'accountAuthorityVerified',
    'transactionCommitmentVerified', 'transactionsVerified', 'endpointAuthenticated']) {
    assert.equal(Object.hasOwn(result, key), false, key);
  }
});

test('flipped parity matches the retained independently derived different public key', () => {
  const changed = rows(fixture.positive.find(value =>
    value.name === 'official-eip155-flipped-parity-different-sender'))[0];
  assert.equal(changed.digest, official.digest);
  assert.equal(changed.signature.slice(0, -2), official.signature.slice(0, -2));
  assert.notEqual(changed.signature.slice(-2), official.signature.slice(-2));
  const result = inspect(changed);
  assert.equal(result.from, changed.expected.sender);
  assert.equal(result.publicKey, changed.expected.publicKey);
  assert.notEqual(result.from, official.expected.sender);
  assert.equal(result.signerAuthorityVerified, false);
});

test('changing a digest can recover another signer and cannot authenticate the original identity', () => {
  const digest = '0x' + word(BigInt(official.digest) ^ 1n);
  const result = inspectDigestSignature(digest, official.signature);
  assert.equal(result.digest, digest);
  assert.equal(result.signatureVerified, true);
  assert.notEqual(result.from, official.expected.sender);
  assert.notEqual(result.publicKey, official.expected.publicKey);
  assert.equal(result.signerAuthorityVerified, false);
});

test('the exact result is deeply frozen and contains only detached scalar values', () => {
  const input = { digest: official.digest, signature: official.signature };
  const result = inspect(input);
  frozen(result);
  input.digest = '0x' + '00'.repeat(32); input.signature = '0x';
  assert.equal(result.digest, official.digest); assert.equal(result.signature, official.signature);
  assert.throws(() => { result.from = '0x' + '11'.repeat(20); }, TypeError);
  assert.throws(() => { result.extra = true; }, TypeError);
});

test('exactly two arguments are required', () => {
  reject(() => inspectDigestSignature(), 'TRANSACTION_SENDER_SCHEMA');
  reject(() => inspectDigestSignature(official.digest), 'TRANSACTION_SENDER_SCHEMA');
  reject(() => inspectDigestSignature(official.digest, official.signature, true), 'TRANSACTION_SENDER_SCHEMA');
});

test('digest encoding is exactly lowercase 0x plus 32 bytes', () => {
  for (const value of ['', '0x', official.digest.slice(2), official.digest.slice(0, -2),
    official.digest + '00', '0X' + official.digest.slice(2), official.digest.toUpperCase(),
    '0x' + 'gg'.repeat(32), ' ' + official.digest, official.digest + '\n', null, false, 0, {}, []]) {
    reject(() => inspectDigestSignature(value, official.signature), 'TRANSACTION_SENDER_DIGEST');
  }
  for (const value of [undefined, 1n, Symbol('digest'), () => official.digest]) {
    reject(() => inspectDigestSignature(value, official.signature));
  }
});

test('signature encoding is exactly lowercase 0x plus 65 bytes', () => {
  for (const value of ['', '0x', official.signature.slice(2), official.signature.slice(0, -2),
    official.signature + '00', '0X' + official.signature.slice(2), official.signature.toUpperCase(),
    '0x' + 'gg'.repeat(65), ' ' + official.signature, official.signature + '\n', null, false, 0, {}, []]) {
    reject(() => inspectDigestSignature(official.digest, value), 'TRANSACTION_SENDER_SIGNATURE_ENCODING');
  }
  for (const value of [undefined, 1n, Symbol('signature'), () => official.signature]) {
    reject(() => inspectDigestSignature(official.digest, value));
  }
});

test('only 27 and 28 are admitted in the signature recovery byte', () => {
  for (const v of [0, 1, 2, 26, 29, 35, 36, 37, 38, 255]) {
    reject(() => inspectDigestSignature(official.digest,
      official.signature.slice(0, -2) + v.toString(16).padStart(2, '0')), 'TRANSACTION_SENDER_PARITY');
  }
});

test('both arguments are captured before either is interpreted without evaluating getters', () => {
  let reads = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'payload', { enumerable: true, get() { reads++; return official.signature; } });
  reject(() => inspectDigestSignature('invalid digest', hostile), 'TRANSACTION_SENDER_DESCRIPTOR');
  reject(() => inspectDigestSignature(hostile, official.signature), 'TRANSACTION_SENDER_DESCRIPTOR');
  assert.equal(reads, 0);
});

test('toJSON, coercion, custom iterators and nonenumerable hooks never execute', () => {
  let calls = 0;
  const hook = () => { calls++; throw new Error('caller hook'); };
  for (const hostile of [{ toJSON: hook }, { valueOf: hook }, { toString: hook },
    { [Symbol.toPrimitive]: hook }, Object.defineProperty({}, 'hidden', { value: hook })]) {
    reject(() => inspectDigestSignature(hostile, official.signature));
    reject(() => inspectDigestSignature(official.digest, hostile));
  }
  const iterator = []; iterator[Symbol.iterator] = hook;
  reject(() => inspectDigestSignature(official.digest, iterator));
  assert.equal(calls, 0);
});

test('boxed strings, inherited objects, cycles, sparse arrays and symbols are refused', () => {
  const cycle = {}; cycle.self = cycle;
  const sparse = Array(1);
  for (const hostile of [new String(official.digest), Object.create({ value: official.digest }),
    cycle, sparse, { [Symbol('value')]: official.signature }]) {
    reject(() => inspectDigestSignature(hostile, official.signature));
    reject(() => inspectDigestSignature(official.digest, hostile));
  }
});

test('descriptor capture keeps its existing string, array and depth bounds', () => {
  reject(() => inspectDigestSignature('x'.repeat(262145), official.signature), 'TRANSACTION_SENDER_STRING');
  reject(() => inspectDigestSignature(official.digest, 'x'.repeat(262145)), 'TRANSACTION_SENDER_STRING');
  reject(() => inspectDigestSignature(official.digest, Array(2049).fill(null)), 'TRANSACTION_SENDER_LIMIT');
  let deep = null;
  for (let index = 0; index < 22; index++) deep = { value: deep };
  reject(() => inspectDigestSignature(deep, official.signature), 'TRANSACTION_SENDER_LIMIT');
  reject(() => inspectDigestSignature('\ud800', official.signature), 'TRANSACTION_SENDER_STRING');
});
