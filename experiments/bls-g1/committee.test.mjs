import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bls12_381} from '@noble/curves/bls12-381';
import {inspectMinimalCommitteeKeys, inspectPinnedMinimalBootstrapKeys} from './committee.mjs';
import {inspectPinnedMinimalCapellaBootstrap} from '../../reference/pinned-minimal-capella-bootstrap.mjs';

const read = p => readFileSync(new URL('../../' + p, import.meta.url));
const bindingBytes = read('evidence/consensus-capella-bootstrap/binding.json');
assert.equal(createHash('sha256').update(bindingBytes).digest('hex'), '96f107e5a94bd2a9bfa47f84ff257cbd18995ae8947440cac91804823236c6f8');
const fixture = JSON.parse(bindingBytes);
const metadata = read('evidence/consensus-capella-bootstrap/meta.yaml');
const pin = 'bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const selection = () => ({schema:'caw-bootstrap-selection/1', network:'ethereum-minimal-capella-fixture',
  profile:'minimal-capella-32-structural-only', selectedBeaconRoot:fixture.selectedBeaconRoot,
  anchor:{source:'externally-retained-fixture-metadata',beaconRoot:fixture.selectedBeaconRoot,sha256:pin}});
const committee = () => structuredClone(fixture.committee);
const bootstrap = () => ({schema:'caw-minimal-capella-bootstrap/1',profile:'minimal-capella-32-structural-only',
  header:structuredClone(fixture.input),committee:committee(),committeeBranch:[...fixture.committeeBranch]});
const keys = c => inspectMinimalCommitteeKeys(JSON.stringify(c));
const bound = b => inspectPinnedMinimalBootstrapKeys(selection(), metadata, pin, JSON.stringify(b));
const point = hex => bls12_381.G1.ProjectivePoint.fromHex(hex.slice(2));
const encoded = p => '0x' + Buffer.from(p.toRawBytes(true)).toString('hex');
const infinity = '0xc0' + '00'.repeat(47);

test('retained 32 keys and supplied aggregate satisfy the point sum', () => {
  const r = keys(committee());
  assert.equal(r.committeeSize, 32);
  assert.equal(r.aggregatePublicKey, fixture.committee.aggregate_pubkey);
  assert.equal(r.publicKeysValidated, true);
  assert.equal(r.aggregatePubkeyValidated, true);
  assert.equal(r.aggregatePublicKeyRelationshipVerified, true);
});

test('composition preserves metadata and structural evidence without authority claims', () => {
  const r = bound(bootstrap());
  for (const k of ['fixtureProfileSelected','metadataDigestMatchesRetainedPin','structuralBindingVerified',
    'committeeInclusionVerified','publicKeysValidated','aggregatePublicKeyRelationshipVerified']) assert.equal(r[k], true, k);
  for (const k of ['committeeMembershipAuthenticated','rootAuthenticated','networkAuthenticated',
    'independentAcquisitionVerified','forkScheduleVerified','blsValidated','signaturesVerified',
    'consensusVerified','finalityVerified','updatesAccepted','productionAccepted']) assert.equal(r[k], false, k);
  assert.ok(Object.isFrozen(r));
  const old = inspectPinnedMinimalCapellaBootstrap(selection(), metadata, pin, JSON.stringify(bootstrap()));
  assert.equal(old.publicKeysValidated, false);
  assert.equal(old.aggregatePubkeyValidated, false);
  assert.equal(r.committeeRoot, old.committeeRoot);
});

test('one valid member replacement fails the unchanged aggregate relation', () => {
  const c = committee(); c.pubkeys[0] = c.pubkeys[1];
  assert.throws(() => keys(c), {code:'MINIMAL_COMMITTEE_KEYS_REJECTED'});
});

test('valid but wrong aggregate point rejects', () => {
  const c = committee(); c.aggregate_pubkey = c.pubkeys[0];
  assert.throws(() => keys(c), {code:'MINIMAL_COMMITTEE_KEYS_REJECTED'});
});

test('off-curve and wrong-subgroup members reject', () => {
  for (const name of ['deserialization_fails_not_in_curve','deserialization_fails_not_in_G1']) {
    const c = committee(); c.pubkeys[0] = '0x' + JSON.parse(read('evidence/bls-g1-20261107/vectors/' + name + '.json')).input.pubkey;
    assert.throws(() => keys(c), {code:'BLS_G1_PUBLIC_KEY_REJECTED'});
  }
});

test('identity member and identity aggregate independently reject', () => {
  const member = committee(); member.pubkeys[0] = infinity;
  assert.throws(() => keys(member), {code:'BLS_G1_PUBLIC_KEY_REJECTED'});
  const aggregate = committee(); aggregate.aggregate_pubkey = infinity;
  assert.throws(() => keys(aggregate), {code:'BLS_G1_PUBLIC_KEY_REJECTED'});
});

test('malformed and noncanonical member encodings reject', () => {
  for (const value of ['0x00', '0xe0' + '00'.repeat(47), committee().pubkeys[0].toUpperCase()]) {
    const c = committee(); c.pubkeys[0] = value; assert.throws(() => keys(c));
  }
});

test('unsupported sizes and injected authority fields reject', () => {
  for (const count of [0,31,33,512]) {
    const c = committee(); c.pubkeys = Array.from({length:count}, () => c.pubkeys[0]); assert.throws(() => keys(c));
  }
  const c = committee(); c.rootAuthenticated = true; assert.throws(() => keys(c));
  assert.throws(() => inspectMinimalCommitteeKeys(JSON.stringify(committee()), true));
});

test('repeated members are counted with multiplicity, not deduplicated', () => {
  const c = committee(); c.pubkeys = Array(32).fill(c.pubkeys[0]);
  c.aggregate_pubkey = encoded(point(c.pubkeys[0]).multiply(32n));
  assert.equal(keys(c).aggregatePublicKeyRelationshipVerified, true);
  // One changed aggregate, as if membership were deduplicated.
  c.aggregate_pubkey = c.pubkeys[0];
  assert.throws(() => keys(c), {code:'MINIMAL_COMMITTEE_KEYS_REJECTED'});
});

test('permutation preserves point sum but fails the original ordered inclusion proof', () => {
  const b = bootstrap(); [b.committee.pubkeys[0],b.committee.pubkeys[1]] = [b.committee.pubkeys[1],b.committee.pubkeys[0]];
  assert.equal(keys(b.committee).aggregatePublicKeyRelationshipVerified, true);
  assert.throws(() => bound(b), /ROOT_MISMATCH/);
});

test('valid key relation cannot bypass a changed proof or unsupported profile', () => {
  const proof = bootstrap(); proof.committeeBranch[0] = '0x' + 'ff'.repeat(32);
  assert.throws(() => bound(proof), /ROOT_MISMATCH/);
  const profile = bootstrap(); profile.profile = 'mainnet'; assert.throws(() => bound(profile));
});

test('composition still rejects metadata mutation and selected-root mismatch', () => {
  const altered = Buffer.from(metadata); altered[0] ^= 1;
  assert.throws(() => inspectPinnedMinimalBootstrapKeys(selection(),altered,pin,JSON.stringify(bootstrap())));
  const s = selection(); s.selectedBeaconRoot = '0x' + '11'.repeat(32);
  assert.throws(() => inspectPinnedMinimalBootstrapKeys(s,metadata,pin,JSON.stringify(bootstrap())));
});
