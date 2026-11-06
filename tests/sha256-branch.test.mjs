import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectSha256Branch } from '../reference/sha256-branch.mjs';
const vectors = JSON.parse(readFileSync(new URL('../evidence/SHA256_BRANCH_VECTORS.json', import.meta.url)));
const inspect = p => inspectSha256Branch(JSON.stringify(p));
const sample = () => structuredClone(vectors.proofs[9]);
test('Python whole-tree vectors cover every depth-four position', () => {
  assert.equal(vectors.proofs.length, 16);
  for (const p of vectors.proofs) {
    const r = inspect(p); assert.equal(r.inclusionVerified, true);
    for (const k of ['rootAuthenticated', 'consensusVerified', 'finalityVerified', 'productionAccepted']) assert.equal(r[k], false);
    assert.equal(Object.isFrozen(r), true);
  }
});
test('depth zero and upper supported index verify', () => { inspect(vectors.zero); inspect(vectors.high); });
for (const field of ['leaf', 'root']) test('changed ' + field + ' rejects', () => {
  const p = sample(); p[field] = '0x' + 'ff'.repeat(32);
  assert.throws(() => inspect(p), e => e.code === 'SHA256_BRANCH_ROOT_MISMATCH');
});
test('changed sibling and branch order reject', () => {
  const p = sample(); p.branch[0] = '0x' + 'ff'.repeat(32);
  assert.throws(() => inspect(p), /ROOT_MISMATCH/);
  const q = sample(); q.branch.reverse(); assert.throws(() => inspect(q), /ROOT_MISMATCH/);
});
test('wrong position rejects', () => { const p = sample(); p.index ^= 1; assert.throws(() => inspect(p), /ROOT_MISMATCH/); });
test('short and extra branches reject', () => {
  for (const delta of [-1, 1]) { const p = sample(); delta < 0 ? p.branch.pop() : p.branch.push(p.leaf); assert.throws(() => inspect(p), /BRANCH_LENGTH/); }
});
test('range and number type boundaries reject', () => {
  for (const [k, values] of [['depth', [-1, 33, 1.5, '4', null]], ['index', [-1, 16, 1.5, '9', null]]])
    for (const v of values) { const p = sample(); p[k] = v; assert.throws(() => inspect(p)); }
});
test('malformed byte strings reject', () => {
  for (const value of ['0x00', '0x' + 'GG'.repeat(32), {}, null]) { const p = sample(); p.leaf = value; assert.throws(() => inspect(p), /BYTES32/); }
});
test('extra authority claim, duplicate key and oversized input reject', () => {
  const p = sample(); p.finalityVerified = true; assert.throws(() => inspect(p), /SCHEMA/);
  assert.throws(() => inspectSha256Branch(JSON.stringify(sample()).replace('"index":', '"index":0,"index":')));
  assert.throws(() => inspectSha256Branch(' '.repeat(8193)));
});
test('self-selected replacement root establishes inclusion only', () => {
  const p = { ...vectors.zero, leaf: '0x' + 'ab'.repeat(32), root: '0x' + 'ab'.repeat(32) };
  assert.equal(inspect(p).rootAuthenticated, false);
});
