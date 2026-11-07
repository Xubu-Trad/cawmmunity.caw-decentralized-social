import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bls12_381} from '@noble/curves/bls12-381';
import {inspectG1PublicKey} from './g1.mjs';

const read = p => readFileSync(new URL('../../' + p, import.meta.url));
const inventory = JSON.parse(read('evidence/bls-g1-20261107/vector-inventory.json'));
assert.equal(inventory.length, 13);
const vectors = inventory.map(item => {
  const raw = read(item.path);
  assert.equal(raw.length, item.size);
  assert.equal(createHash('sha256').update(raw).digest('hex'), item.sha256);
  const vector = JSON.parse(raw);
  assert.match(vector.input.pubkey, /^[0-9a-f]+$/);
  assert.equal(typeof vector.output, 'boolean');
  return {name:item.archivePath.split('/').at(-1), bytes:Buffer.from(vector.input.pubkey,'hex'), expected:vector.output};
});
const infinity = 'deserialization_succeeds_infinity_with_true_b_flag.json';
for (const v of vectors) {
  test('external deserialization: ' + v.name, () => {
    let actual = false;
    try {
      const point = bls12_381.G1.ProjectivePoint.fromHex(v.bytes);
      point.assertValidity();
      actual = true;
    } catch {}
    assert.equal(actual, v.expected);
  });
  test('nonidentity key policy: ' + v.name, () => {
    if (v.expected && v.name !== infinity) {
      const result = inspectG1PublicKey(v.bytes);
      assert.equal(result.publicKeyHex, v.bytes.toString('hex'));
      for (const key of ['compressedEncodingCanonical','curveMembershipValidated','subgroupMembershipValidated','nonIdentity']) {
        assert.equal(result[key], true);
      }
      for (const key of ['committeeMembershipAuthenticated','aggregatePublicKeyRelationshipVerified','signaturesVerified',
        'rootAuthenticated','networkAuthenticated','blsValidated','finalityVerified','updatesAccepted','productionAccepted']) {
        assert.equal(result[key], false);
      }
      assert.ok(Object.isFrozen(result));
    } else {
      assert.throws(() => inspectG1PublicKey(v.bytes), {code:'BLS_G1_PUBLIC_KEY_REJECTED'});
    }
  });
}

test('API rejects non-buffer and unsupported lengths', () => {
  for (const value of [null, undefined, '', new Uint8Array(48), Buffer.alloc(0), Buffer.alloc(47), Buffer.alloc(96)]) {
    assert.throws(() => inspectG1PublicKey(value), {code:'BLS_G1_PUBLIC_KEY_REJECTED'});
  }
});

test('no extra argument can override key rejection', () => {
  const valid = vectors.find(v => v.expected && v.name !== infinity).bytes;
  assert.throws(() => inspectG1PublicKey(valid, {allowInfinity:true}), {code:'BLS_G1_PUBLIC_KEY_REJECTED'});
});

test('result retains the original bytes after caller mutation', () => {
  const bytes = Buffer.from(vectors.find(v => v.expected && v.name !== infinity).bytes);
  const hex = bytes.toString('hex'); const result = inspectG1PublicKey(bytes); bytes.fill(0);
  assert.equal(result.publicKeyHex, hex);
  assert.throws(() => inspectG1PublicKey(bytes), {code:'BLS_G1_PUBLIC_KEY_REJECTED'});
});
