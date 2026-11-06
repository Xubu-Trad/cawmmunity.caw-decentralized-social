import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectBeaconHeader } from '../reference/beacon-header-root.mjs';
import { inspectSha256Branch } from '../reference/sha256-branch.mjs';
const vectors = JSON.parse(readFileSync(new URL('../evidence/consensus-beacon-header/vectors.json', import.meta.url)));
for (const v of vectors.cases) test('official Capella BeaconBlockHeader case ' + v.case, () => {
  const result = inspectBeaconHeader(JSON.stringify(v.header), v.root);
  assert.equal(result.headerRootVerified, true);
  assert.equal(inspectSha256Branch(JSON.stringify(result.bodyRootProof)).inclusionVerified, true);
  for (const key of ['rootAuthenticated', 'executionPayloadVerified', 'consensusVerified', 'finalityVerified', 'productionAccepted']) assert.equal(result[key], false);
  assert.ok(Object.isFrozen(result.bodyRootProof.branch));
});
const v = vectors.cases[0];
test('each changed header field rejects under original root', () => {
  for (const key of Object.keys(v.header)) {
    const h = { ...v.header, [key]: key.endsWith('root') ? '0x' + 'ff'.repeat(32) : '0' };
    assert.throws(() => inspectBeaconHeader(JSON.stringify(h), v.root), /ROOT_MISMATCH/);
  }
});
test('changed selected root and derived branch reject', () => {
  assert.throws(() => inspectBeaconHeader(JSON.stringify(v.header), '0x' + '00'.repeat(32)), /ROOT_MISMATCH/);
  const p = structuredClone(inspectBeaconHeader(JSON.stringify(v.header), v.root).bodyRootProof); p.index = 5;
  assert.throws(() => inspectSha256Branch(JSON.stringify(p)), /ROOT_MISMATCH/);
});
test('uint64 rejects overflow and imprecise or noncanonical JSON representations', () => {
  for (const n of ['18446744073709551616', '-1', '01', '1e3', 1, null])
    assert.throws(() => inspectBeaconHeader(JSON.stringify({ ...v.header, slot: n }), v.root), /UINT64/);
});
test('unknown authority fields and duplicate keys reject', () => {
  assert.throws(() => inspectBeaconHeader(JSON.stringify({ ...v.header, finalized: true }), v.root), /SCHEMA/);
  assert.throws(() => inspectBeaconHeader(JSON.stringify(v.header).replace('"slot":', '"slot":"0","slot":'), v.root));
});
test('replacement valid header and root remain unauthenticated', () => {
  const other = vectors.cases[1]; const result = inspectBeaconHeader(JSON.stringify(other.header), other.root);
  assert.equal(result.rootAuthenticated, false); assert.equal(result.productionAccepted, false);
});
