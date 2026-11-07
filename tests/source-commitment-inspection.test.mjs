import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, mkdtempSync, copyFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectSourceCommitment} from '../reference/source-commitment-inspection.mjs';

// Retained from Section 283 before reading the candidate source. This test
// constant is a same-operator fixture commitment, not independent authority.
const RETAINED = '59741781544a672c7500a4480dad037d1262f79ebacbc84450056c3028015980';
const OLD_OPERATOR = '7dd1be57f1e1624a656cc3ef685945929e5d5bc610211ab8b101af7119f56982';
const NEW_OPERATOR = 'fd9fad0b1958cfbbd794123dd32e82acc2777a81ebd6c45f62a8311dc59b5be5';
const read = p => readFileSync(new URL('../' + p, import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const source = read('reference/pinned-fixture-operator-policy.mjs');
const sourceText = source.toString('utf8');
assert.equal(sourceText.split(OLD_OPERATOR).length, 2);
// One changed variable: only the embedded operator-reference hash.
const replaced = Buffer.from(sourceText.replace(OLD_OPERATOR, NEW_OPERATOR));
const rejects = fn => assert.throws(fn, {code: 'SOURCE_COMMITMENT_REJECTED'});

test('retained source matches without elevating authority or execution claims', () => {
  const result = inspectSourceCommitment(source, RETAINED);
  assert.equal(result.sourceBytesMatchRetainedCommitment, true);
  assert.equal(result.sha256, RETAINED);
  assert.equal(result.size, 1196);
  assert.ok(Object.isFrozen(result));
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'boolean' && key !== 'sourceBytesMatchRetainedCommitment') {
      assert.equal(value, false, key);
    }
  }
});

test('coherent source replacement rejects against unchanged retained commitment', () => {
  assert.equal(replaced.length, source.length);
  assert.notEqual(sha(replaced), RETAINED);
  rejects(() => inspectSourceCommitment(replaced, RETAINED));
});

test('replacing the external commitment too remains an explicit trust boundary', () => {
  const result = inspectSourceCommitment(replaced, sha(replaced));
  assert.equal(result.sourceBytesMatchRetainedCommitment, true);
  assert.equal(result.commitmentAuthorityEstablished, false);
  assert.equal(result.executedBytesBound, false);
});

test('controlled source replacement changes fixture outcome with inputs fixed', async () => {
  // Execute only the reviewed local source and this exact single-literal variant.
  // Copy fixed dependencies into a disposable directory; never import arbitrary
  // source supplied to inspectSourceCommitment. This is not a secure loader.
  const dir = mkdtempSync(join(tmpdir(), 'caw-source-control-'));
  try {
    for (const file of ['operator-genesis-reference.mjs', 'bootstrap-profile-selection.mjs',
      'bootstrap-fixture-metadata-selection.mjs', 'fork-data-root.mjs']) {
      copyFileSync(new URL('../reference/' + file, import.meta.url), join(dir, file));
    }
    writeFileSync(join(dir, 'original.mjs'), source);
    writeFileSync(join(dir, 'replacement.mjs'), replaced);
    const original = await import(pathToFileURL(join(dir, 'original.mjs')).href);
    const replacement = await import(pathToFileURL(join(dir, 'replacement.mjs')).href);
    const config = read('evidence/consensus-capella-bootstrap/config.yaml');
    const metadata = read('evidence/bootstrap-source-pin-policy-20261107/synthetic_metadata.yaml');
    const operator = read('evidence/bootstrap-source-pin-policy-20261107/synthetic_operator.json');
    assert.equal(sha(operator), NEW_OPERATOR);
    const beacon = '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';
    const selection = {schema: 'caw-bootstrap-selection/1',
      network: 'ethereum-minimal-capella-fixture', profile: 'minimal-capella-32-structural-only',
      selectedBeaconRoot: beacon, anchor: {source: 'externally-retained-fixture-metadata',
        beaconRoot: beacon, sha256: sha(metadata)}};
    const args = [selection, config, metadata, sha(config), sha(metadata), operator];
    assert.throws(() => original.inspectPinnedFixtureOperatorPolicy(...args),
      {code: 'PINNED_FIXTURE_POLICY_REJECTED'});
    const result = replacement.inspectPinnedFixtureOperatorPolicy(...args);
    assert.equal(result.operatorReferenceMatchesSourcePin, true);
    for (const flag of ['rootAuthenticated', 'networkAuthenticated', 'blsValidated',
      'finalityVerified', 'updatesAccepted', 'productionAccepted']) assert.equal(result[flag], false);
    rejects(() => inspectSourceCommitment(replaced, RETAINED));
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('non-buffer inputs reject', () => {
  for (const value of [null, undefined, source.toString(), new Uint8Array(source), {}]) {
    rejects(() => inspectSourceCommitment(value, RETAINED));
  }
});

test('empty and oversized bytes reject even with their matching digest', () => {
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(65537)]) {
    rejects(() => inspectSourceCommitment(bytes, sha(bytes)));
  }
  assert.equal(inspectSourceCommitment(Buffer.alloc(65536), sha(Buffer.alloc(65536))).size, 65536);
});

test('malformed or missing commitments reject', () => {
  for (const pin of [undefined, null, '', RETAINED.toUpperCase(), '0'.repeat(63),
    '0'.repeat(65), 'g'.repeat(64), Buffer.from(RETAINED)]) {
    rejects(() => inspectSourceCommitment(source, pin));
  }
});

test('extra override argument rejects', () => {
  rejects(() => inspectSourceCommitment(source, RETAINED, sha(replaced)));
});

test('later buffer mutation does not become an execution binding', () => {
  const copy = Buffer.from(source);
  const result = inspectSourceCommitment(copy, RETAINED);
  copy[0] ^= 1;
  rejects(() => inspectSourceCommitment(copy, RETAINED));
  assert.equal(result.executedBytesBound, false);
  assert.equal(result.dependencyClosureVerified, false);
});
