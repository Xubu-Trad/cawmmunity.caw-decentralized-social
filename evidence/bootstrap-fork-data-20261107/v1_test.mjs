import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectFixtureForkData} from '../reference/fork-data-root.mjs';

const dir = new URL('../evidence/consensus-capella-bootstrap/', import.meta.url);
const config = readFileSync(new URL('config.yaml', dir));
const metadata = readFileSync(new URL('meta.yaml', dir));
const CONFIG_PIN = '4a8e4e5d0fd4961b87ea5d1ff8ce3a28240ab6e2184eea754acccf50131f4a1a';
const META_PIN = 'bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const sha = b => createHash('sha256').update(b).digest('hex');
const rePinForNegativeControl = (c, m) => inspectFixtureForkData(c, m, sha(c), sha(m));
const reject = f => assert.throws(f, {code: 'FIXTURE_FORK_DATA_REJECTED'});
const mutate = (bytes, before, after) => {
  const original = bytes.toString('ascii');
  assert.equal(original.split(before).length, 2, `expected one occurrence: ${before}`);
  return Buffer.from(original.replace(before, after), 'ascii');
};

test('official minimal Capella fork-data root matches independent oracle, without authority', () => {
  const r = inspectFixtureForkData(config, metadata, CONFIG_PIN, META_PIN);
  assert.equal(r.forkDataRoot, '0x856842be987cb7f12d34e84282045bdf06fb0c6a88889e41b889ca90dd583c92');
  assert.equal(r.forkDigest, '0x856842be');
  for (const key of ['rootAuthenticated','networkAuthenticated','forkScheduleVerified','blsValidated','signaturesVerified','finalityVerified','updatesAccepted','productionAccepted']) assert.equal(r[key], false, key);
  assert.ok(Object.isFrozen(r));
});

test('changed fork version rejects with fresh synthetic config pin', () => {
  const c = mutate(config, 'CAPELLA_FORK_VERSION: 0x03000001', 'CAPELLA_FORK_VERSION: 0x03000002');
  reject(() => rePinForNegativeControl(c, metadata));
});
test('changed genesis validators root rejects with fresh synthetic metadata pin', () => {
  const m = mutate(metadata, '0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b', '0x'+'11'.repeat(32));
  reject(() => rePinForNegativeControl(config, m));
});
test('changed bootstrap digest rejects with fresh synthetic metadata pin', () => {
  const m = mutate(metadata, "bootstrap_fork_digest: '0x856842be'", "bootstrap_fork_digest: '0x00000000'");
  reject(() => rePinForNegativeControl(config, m));
});
test('changed store digest rejects with fresh synthetic metadata pin', () => {
  const m = mutate(metadata, "store_fork_digest: '0x856842be'", "store_fork_digest: '0x00000000'");
  reject(() => rePinForNegativeControl(config, m));
});
test('malformed fork-version encoding rejects with fresh synthetic pin', () => {
  const c = mutate(config, 'CAPELLA_FORK_VERSION: 0x03000001', 'CAPELLA_FORK_VERSION: 0xXX000001');
  reject(() => rePinForNegativeControl(c, metadata));
});
test('extra metadata authority field rejects with fresh synthetic pin', () => {
  const m = Buffer.from(metadata.toString('ascii')+'rootAuthenticated: true\n', 'ascii');
  reject(() => rePinForNegativeControl(config, m));
});
test('wrong input pin rejects before metadata parsing', () => {
  reject(() => inspectFixtureForkData(config, metadata, '0'.repeat(64), META_PIN));
  reject(() => inspectFixtureForkData(config, metadata, CONFIG_PIN, '0'.repeat(64)));
});
test('unsupported preset/epoch and duplicate fork-field reject', () => {
  const c1=mutate(config, "PRESET_BASE: 'minimal'", "PRESET_BASE: 'mainnet'");
  const c2=mutate(config, 'CAPELLA_FORK_EPOCH: 0', 'CAPELLA_FORK_EPOCH: 1');
  const c3=Buffer.from(config.toString('ascii')+'CAPELLA_FORK_VERSION: 0x03000001\n', 'ascii');
  for (const c of [c1,c2,c3]) reject(() => rePinForNegativeControl(c, metadata));
});
