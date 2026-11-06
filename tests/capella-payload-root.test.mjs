import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectCapellaPayloadHeader } from '../reference/capella-payload-root.mjs';
const vectors = JSON.parse(readFileSync(new URL('../evidence/consensus-capella-payload/vectors.json', import.meta.url)));
for (const v of vectors.cases) test('official Capella payload header ' + v.case, () => {
  const r = inspectCapellaPayloadHeader(JSON.stringify(v.header), v.root);
  assert.equal(r.payloadRootVerified, true); assert.equal(r.executionBlockHash, v.header.block_hash);
  for (const k of ['rootAuthenticated', 'beaconBindingVerified', 'executionVerified', 'consensusVerified', 'finalityVerified', 'productionAccepted']) assert.equal(r[k], false);
  assert.ok(Object.isFrozen(r));
});
const v = vectors.cases[0];
const check = h => inspectCapellaPayloadHeader(JSON.stringify(h), v.root);
test('every changed field rejects under selected root', () => {
  for (const [k, value] of Object.entries(v.header)) {
    const replacement = value.startsWith('0x') ? '0x' + (value.slice(2, 4) === 'ff' ? '00' : 'ff') + value.slice(4) : '0';
    assert.throws(() => check({ ...v.header, [k]: replacement }), /ROOT_MISMATCH/);
  }
});
test('fixed lengths, oversized and odd extra data reject', () => {
  for (const [k, value] of [['fee_recipient', '0x00'], ['logs_bloom', '0x00'], ['extra_data', '0x' + '00'.repeat(33)], ['extra_data', '0x0']])
    assert.throws(() => check({ ...v.header, [k]: value }));
});
test('extra-data length participates in hash', () => {
  assert.throws(() => check({ ...v.header, extra_data: v.header.extra_data + '00' }), /ROOT_MISMATCH/);
});
test('uint64 and uint256 overflow and Number coercion reject', () => {
  for (const [k, value] of [['block_number', String(2n ** 64n)], ['base_fee_per_gas', String(2n ** 256n)], ['timestamp', 1], ['gas_used', '-1'], ['gas_limit', '01']])
    assert.throws(() => check({ ...v.header, [k]: value }), /UINT/);
});
test('later-fork fields and duplicate keys reject', () => {
  assert.throws(() => check({ ...v.header, blob_gas_used: '0' }), /SCHEMA/);
  assert.throws(() => inspectCapellaPayloadHeader(JSON.stringify(v.header).replace('"timestamp":', '"timestamp":"0","timestamp":'), v.root));
});
test('wrong selected root rejects', () => assert.throws(() => inspectCapellaPayloadHeader(JSON.stringify(v.header), '0x' + '00'.repeat(32)), /ROOT_MISMATCH/));
