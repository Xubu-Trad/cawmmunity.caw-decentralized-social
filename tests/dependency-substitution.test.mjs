import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectSourceCommitment} from '../reference/source-commitment-inspection.mjs';

// Fixed same-operator inventory retained before constructing the substitution.
// This test helper is not a general dependency resolver or secure loader.
const INVENTORY_SHA256 = 'bf8ad46e19fb2c551971a54e86a9b11cca66bdb9d2f739e01339a2101ed5a945';
const read = p => readFileSync(new URL('../' + p, import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const inventoryBytes = read('evidence/dependency-substitution-20261107/retained-source-inventory.json');
assert.equal(sha(inventoryBytes), INVENTORY_SHA256);
const inventory = JSON.parse(inventoryBytes);
const original = new Map(inventory.files.map(f => [f.path, read(f.path)]));
const entry = 'reference/pinned-fixture-operator-policy.mjs';
const dependency = 'reference/operator-genesis-reference.mjs';
const entryPin = inventory.files.find(f => f.path === entry).sha256;

function compareInventory(files) {
  assert.deepEqual([...files.keys()].sort(), inventory.files.map(f => f.path).sort());
  for (const f of inventory.files) {
    const bytes = files.get(f.path);
    assert.equal(bytes.length, f.size, f.path + ' size');
    assert.equal(sha(bytes), f.sha256, f.path + ' digest');
  }
}

function substituted() {
  const files = new Map(original);
  const text = files.get(dependency).toString('utf8');
  assert.equal(text.split('networkAuthenticated:false').length, 2);
  // One variable: corrupt one reported flag in one imported module.
  files.set(dependency, Buffer.from(text.replace('networkAuthenticated:false', 'networkAuthenticated:true')));
  return files;
}

test('all five retained local source identities match', () => {
  assert.equal(inventory.files.length, 5);
  compareInventory(original);
});

test('unchanged entrypoint inspection misses changed dependency bytes', () => {
  const files = substituted();
  assert.deepEqual(files.get(entry), original.get(entry));
  const result = inspectSourceCommitment(files.get(entry), entryPin);
  assert.equal(result.sourceBytesMatchRetainedCommitment, true);
  assert.equal(result.dependencyClosureVerified, false);
  assert.equal(result.executedBytesBound, false);
  assert.throws(() => compareInventory(files), /operator-genesis-reference/);
});

test('controlled import substitution changes a reported flag without changing inputs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'caw-dependency-control-'));
  try {
    const variants = [original, substituted()];
    const config = read('evidence/consensus-capella-bootstrap/config.yaml');
    const metadata = read('evidence/consensus-capella-bootstrap/meta.yaml');
    const operator = read('evidence/bootstrap-operator-reference-20261107/operator_reference.json');
    const beacon = '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';
    const selection = {schema:'caw-bootstrap-selection/1', network:'ethereum-minimal-capella-fixture',
      profile:'minimal-capella-32-structural-only', selectedBeaconRoot:beacon,
      anchor:{source:'externally-retained-fixture-metadata', beaconRoot:beacon, sha256:sha(metadata)}};
    const args = [selection, config, metadata, sha(config), sha(metadata), operator];
    const results = [];
    for (let i = 0; i < variants.length; i++) {
      const root = join(dir, String(i));
      mkdirSync(join(root, 'reference'), {recursive:true});
      for (const [path, bytes] of variants[i]) writeFileSync(join(root, path), bytes);
      // Only the reviewed original and this exact generated negative control run.
      const module = await import(pathToFileURL(join(root, entry)).href);
      results.push(module.inspectPinnedFixtureOperatorPolicy(...args));
    }
    assert.equal(results[0].networkAuthenticated, false);
    assert.equal(results[1].networkAuthenticated, true); // Deliberately false claim, not authentication.
    assert.deepEqual({...results[1], networkAuthenticated:false}, results[0]);
    assert.equal(results[1].productionAccepted, false);
    assert.equal(results[1].updatesAccepted, false);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('missing dependency rejects exact inventory comparison', () => {
  const files = new Map(original);
  files.delete(dependency);
  assert.throws(() => compareInventory(files));
});

test('unexpected file rejects exact inventory comparison', () => {
  const files = new Map(original);
  files.set('reference/unreviewed.mjs', Buffer.from('export default 1;'));
  assert.throws(() => compareInventory(files));
});
