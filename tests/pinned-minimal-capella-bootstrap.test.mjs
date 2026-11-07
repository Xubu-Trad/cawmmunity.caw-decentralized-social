import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectPinnedMinimalCapellaBootstrap } from '../reference/pinned-minimal-capella-bootstrap.mjs';

const fixture = JSON.parse(readFileSync(new URL('../evidence/consensus-capella-bootstrap/binding.json', import.meta.url)));
const metadata = readFileSync(new URL('../evidence/consensus-capella-bootstrap/meta.yaml', import.meta.url));
const PIN = 'bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const ROOT = '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';

const selection = () => ({
  schema: 'caw-bootstrap-selection/1', network: 'ethereum-minimal-capella-fixture',
  profile: 'minimal-capella-32-structural-only', selectedBeaconRoot: ROOT,
  anchor: { source: 'externally-retained-fixture-metadata', beaconRoot: ROOT, sha256: PIN }
});
const bootstrap = () => ({
  schema: 'caw-minimal-capella-bootstrap/1', profile: 'minimal-capella-32-structural-only',
  header: structuredClone(fixture.input), committee: structuredClone(fixture.committee),
  committeeBranch: [...fixture.committeeBranch]
});
const run = (s = selection(), b = bootstrap(), m = metadata, pin = PIN) =>
  inspectPinnedMinimalCapellaBootstrap(s, m, pin, JSON.stringify(b));

test('official pinned fixture binds committee without adopting root', () => {
  const r = run();
  assert.equal(r.structuralBindingVerified, true);
  assert.equal(r.committeeInclusionVerified, true);
  assert.equal(r.metadataDigestMatchesRetainedPin, true);
  assert.equal(r.selectedBeaconRoot, ROOT);
  for (const k of ['rootAuthenticated', 'independentAcquisitionVerified', 'publicKeysValidated',
    'aggregatePubkeyValidated', 'signaturesVerified', 'forkScheduleVerified',
    'consensusVerified', 'finalityVerified', 'updatesAccepted', 'productionAccepted']) {
    assert.equal(r[k], false, k);
  }
  assert.ok(Object.isFrozen(r));
});
test('one changed metadata byte rejects', () => {
  const m = Buffer.from(metadata); m[0] ^= 1;
  assert.throws(() => run(selection(), bootstrap(), m), { code: 'FIXTURE_METADATA_REJECTED' });
});
test('wrong retained metadata digest rejects', () => {
  assert.throws(() => run(selection(), bootstrap(), metadata, '0'.repeat(64)),
    { code: 'FIXTURE_METADATA_REJECTED' });
});
test('altered committee member rejects', () => {
  const b = bootstrap(); b.committee.pubkeys[0] = '0x' + 'ff'.repeat(48);
  assert.throws(() => run(selection(), b), /ROOT_MISMATCH/);
});
test('altered committee branch rejects', () => {
  const b = bootstrap(); b.committeeBranch[0] = '0x' + 'ff'.repeat(32);
  assert.throws(() => run(selection(), b), /ROOT_MISMATCH/);
});
test('altered header state root rejects', () => {
  const b = bootstrap(); b.header.beacon.state_root = '0x' + 'ff'.repeat(32);
  assert.throws(() => run(selection(), b), /ROOT_MISMATCH/);
});
test('unsupported bootstrap profile rejects', () => {
  const b = bootstrap(); b.profile = 'mainnet-512';
  assert.throws(() => run(selection(), b), /schema rejected/);
});
test('injected authority claim rejects', () => {
  const b = bootstrap(); b.rootAuthenticated = true;
  assert.throws(() => run(selection(), b), /schema rejected/);
});
