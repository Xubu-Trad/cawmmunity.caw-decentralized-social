import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Controlled five-module fixture experiment, not an application loader.
const read = p => readFileSync(new URL('../' + p, import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const rawInventory = read('evidence/dependency-substitution-20261107/retained-source-inventory.json');
assert.equal(sha(rawInventory), 'bf8ad46e19fb2c551971a54e86a9b11cca66bdb9d2f739e01339a2101ed5a945');
const inventory = JSON.parse(rawInventory);
const entry = 'reference/pinned-fixture-operator-policy.mjs';
const dependency = 'reference/operator-genesis-reference.mjs';
const original = new Map(inventory.files.map(f => [f.path, read(f.path)]));

function writeSet(root, files) {
  mkdirSync(join(root, 'reference'), {recursive:true});
  for (const [path, bytes] of files) writeFileSync(join(root, path), bytes);
}

function inspectAndCapture(root) {
  // Hash the same buffers retained here. Do not re-read the acquisition path
  // later when constructing the experimental snapshot destination.
  const captured = new Map();
  for (const f of inventory.files) {
    const bytes = readFileSync(join(root, f.path));
    assert.equal(bytes.length, f.size, f.path);
    assert.equal(sha(bytes), f.sha256, f.path);
    captured.set(f.path, bytes);
  }
  return captured;
}

function substitute(root) {
  const path = join(root, dependency);
  const text = readFileSync(path, 'utf8');
  assert.equal(text.split('networkAuthenticated:false').length, 2);
  writeFileSync(path, text.replace('networkAuthenticated:false', 'networkAuthenticated:true'));
}

async function run(root) {
  // Every case uses a distinct file URL tree to avoid ESM cache reuse.
  const module = await import(pathToFileURL(join(root, entry)).href);
  const config = read('evidence/consensus-capella-bootstrap/config.yaml');
  const metadata = read('evidence/consensus-capella-bootstrap/meta.yaml');
  const operator = read('evidence/bootstrap-operator-reference-20261107/operator_reference.json');
  const beacon = '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';
  return module.inspectPinnedFixtureOperatorPolicy({
    schema:'caw-bootstrap-selection/1', network:'ethereum-minimal-capella-fixture',
    profile:'minimal-capella-32-structural-only', selectedBeaconRoot:beacon,
    anchor:{source:'externally-retained-fixture-metadata', beaconRoot:beacon, sha256:sha(metadata)},
  }, config, metadata, sha(config), sha(metadata), operator);
}

async function withFixture(action) {
  const dir = mkdtempSync(join(tmpdir(), 'caw-import-boundary-'));
  try {
    const source = join(dir, 'source');
    writeSet(source, original);
    await action(source, join(dir, 'snapshot'));
  } finally { rmSync(dir, {recursive:true, force:true}); }
}

test('unchanged inspected tree returns original unauthenticated result', async () => {
  await withFixture(async source => {
    inspectAndCapture(source);
    const result = await run(source);
    assert.equal(result.networkAuthenticated, false);
    assert.equal(result.productionAccepted, false);
  });
});

test('substitution after inspection changes the later imported result', async () => {
  await withFixture(async source => {
    inspectAndCapture(source); // Original passes before the injected mutation.
    substitute(source);       // Deterministic check-to-use interleaving.
    assert.equal(sha(readFileSync(join(source, entry))), sha(original.get(entry)));
    const result = await run(source);
    assert.equal(result.networkAuthenticated, true); // False claim from corrupted code.
    assert.equal(result.productionAccepted, false);
    assert.throws(() => inspectAndCapture(source), /operator-genesis-reference/);
  });
});

test('captured verified bytes preserve behavior when acquisition files change', async () => {
  await withFixture(async (source, snapshot) => {
    const captured = inspectAndCapture(source);
    substitute(source);
    writeSet(snapshot, captured); // Writes checked buffers, not newly read files.
    inspectAndCapture(snapshot);
    const result = await run(snapshot);
    const control = join(snapshot, 'control');
    writeSet(control, original);
    assert.deepEqual(result, await run(control));
    assert.equal(result.networkAuthenticated, false);
    assert.throws(() => inspectAndCapture(source), /operator-genesis-reference/);
  });
});

test('writable snapshot destination still permits substitution after its check', async () => {
  await withFixture(async (source, snapshot) => {
    writeSet(snapshot, inspectAndCapture(source));
    inspectAndCapture(snapshot);
    substitute(snapshot); // Snapshot is not immutable or protected from this actor.
    const result = await run(snapshot);
    assert.equal(result.networkAuthenticated, true); // Not authentic network evidence.
    assert.equal(result.updatesAccepted, false);
    assert.equal(result.productionAccepted, false);
    assert.throws(() => inspectAndCapture(snapshot), /operator-genesis-reference/);
  });
});
