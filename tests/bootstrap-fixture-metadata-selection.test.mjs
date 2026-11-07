import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectPinnedFixtureSelection} from '../reference/bootstrap-fixture-metadata-selection.mjs';

const metadata=readFileSync(new URL(
  '../evidence/consensus-capella-bootstrap/meta.yaml',import.meta.url
));
const sha='bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const root='0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';

const make=()=>({
  schema:'caw-bootstrap-selection/1',
  network:'ethereum-minimal-capella-fixture',
  profile:'minimal-capella-32-structural-only',
  selectedBeaconRoot:root,
  anchor:{
    source:'externally-retained-fixture-metadata',
    beaconRoot:root,
    sha256:sha
  }
});

const run=(p,bytes=metadata,pin=sha)=>
  inspectPinnedFixtureSelection(p,bytes,pin);

test('fixture metadata binds root without authority',()=>{
  const r=run(make());
  assert.equal(r.metadataDigestMatchesRetainedPin,true);
  assert.equal(r.selectedBeaconRoot,root);
  for(const k of [
    'rootAuthenticated','independentAcquisitionVerified',
    'forkScheduleVerified','blsValidated','updatesAccepted',
    'finalityVerified','productionAccepted'
  ]) assert.equal(r[k],false);
  assert.ok(Object.isFrozen(r));
});

test('one-byte metadata mutation rejects',()=>{
  const b=Buffer.from(metadata);
  b[0]^=1;
  assert.throws(()=>run(make(),b),{code:'FIXTURE_METADATA_REJECTED'});
});

test('wrong retained digest rejects',()=>{
  assert.throws(()=>run(make(),metadata,'0'.repeat(64)),
    {code:'FIXTURE_METADATA_REJECTED'});
});

test('wrong descriptor digest rejects',()=>{
  const p=make();
  p.anchor.sha256='1'.repeat(64);
  assert.throws(()=>run(p),{code:'FIXTURE_METADATA_REJECTED'});
});

test('changed selected root rejects',()=>{
  const p=make();
  p.selectedBeaconRoot='0x'+'34'.repeat(32);
  assert.throws(()=>run(p),{code:'BOOTSTRAP_PROFILE_REJECTED'});
});

test('missing metadata rejects',()=>{
  assert.throws(()=>run(make(),null),{code:'FIXTURE_METADATA_REJECTED'});
});

test('injected authority rejects',()=>{
  const p=make();
  p.rootAuthenticated=true;
  assert.throws(()=>run(p),{code:'BOOTSTRAP_PROFILE_REJECTED'});
});
