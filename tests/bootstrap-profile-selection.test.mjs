import test from 'node:test';
import assert from 'node:assert/strict';
import {selectResearchBootstrap} from
  '../reference/bootstrap-profile-selection.mjs';

const root = '0x' + '12'.repeat(32);

const good = () => ({
  schema:'caw-bootstrap-selection/1',
  network:'ethereum-minimal-capella-fixture',
  profile:'minimal-capella-32-structural-only',
  selectedBeaconRoot:root,
  anchor:{
    source:'externally-retained-fixture-metadata',
    beaconRoot:root,
    sha256:'a'.repeat(64)
  }
});

test('selection remains non-authoritative', () => {
  const r = selectResearchBootstrap(good());
  assert.equal(r.fixtureProfileSelected,true);
  for (const k of [
    'rootAuthenticated',
    'independentAcquisitionVerified',
    'blsValidated',
    'updatesAccepted',
    'finalityVerified',
    'productionAccepted'
  ]) assert.equal(r[k],false);
  assert.ok(Object.isFrozen(r));
});

const cases = [
  ['unknown network',p=>p.network='ethereum-mainnet'],
  ['wrong profile',p=>p.profile='mainnet-512'],
  ['missing anchor',p=>delete p.anchor],
  ['mismatched anchor',p=>
    p.anchor.beaconRoot='0x'+'34'.repeat(32)],
  ['wrong root encoding',p=>p.selectedBeaconRoot='0x12'],
  ['zero root',p=>{
    p.selectedBeaconRoot='0x'+'00'.repeat(32);
    p.anchor.beaconRoot=p.selectedBeaconRoot;
  }],
  ['undeclared authority',p=>p.rootAuthenticated=true],
  ['untrusted provenance',p=>p.anchor.source='rpc-majority'],
  ['extra anchor claim',p=>p.anchor.finalized=true],
  ['invalid digest',p=>p.anchor.sha256='0x1234']
];

for (const [name,mutate] of cases) {
  test(name+' rejects',()=>{
    const p=good();
    mutate(p);
    assert.throws(
      ()=>selectResearchBootstrap(p),
      {code:'BOOTSTRAP_PROFILE_REJECTED'}
    );
  });
}
