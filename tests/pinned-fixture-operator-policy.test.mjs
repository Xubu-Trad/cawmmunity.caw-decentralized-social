import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectPinnedFixtureOperatorPolicy} from
  '../reference/pinned-fixture-operator-policy.mjs';
import {inspectOperatorGenesisReference} from
  '../reference/operator-genesis-reference.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');

const config=read('evidence/consensus-capella-bootstrap/config.yaml');
const original=read('evidence/consensus-capella-bootstrap/meta.yaml');
const operator=read('evidence/bootstrap-operator-reference-20261107/operator_reference.json');
const synthetic=read('evidence/bootstrap-operator-reference-20261107/synthetic_provider_metadata.yaml');

const CPIN='4a8e4e5d0fd4961b87ea5d1ff8ce3a28240ab6e2184eea754acccf50131f4a1a';
const MPIN='bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const OPIN='7dd1be57f1e1624a656cc3ef685945929e5d5bc610211ab8b101af7119f56982';
const SYNMETA='bb1ee5c4ee0fc17b024140cffe880a9d1bf5487674020a32394ad9d010b3df7a';
const SYNOP='fd9fad0b1958cfbbd794123dd32e82acc2777a81ebd6c45f62a8311dc59b5be5';

const beacon='0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';

const selection=pin=>({
  schema:'caw-bootstrap-selection/1',
  network:'ethereum-minimal-capella-fixture',
  profile:'minimal-capella-32-structural-only',
  selectedBeaconRoot:beacon,
  anchor:{
    source:'externally-retained-fixture-metadata',
    beaconRoot:beacon,
    sha256:pin
  }
});

const changed=JSON.parse(operator.toString('utf8'));
changed.genesisValidatorsRoot='0x'+'11'.repeat(32);
const changedOperator=Buffer.from(
  JSON.stringify(changed,null,2)+'\n'
);

const pinned=(meta,pin,ref)=>
  inspectPinnedFixtureOperatorPolicy(
    selection(pin),config,meta,CPIN,pin,ref
  );

test('baseline passes only as fixture consistency',()=>{
  assert.equal(sha(config),CPIN);
  assert.equal(sha(original),MPIN);
  assert.equal(sha(operator),OPIN);

  const r=pinned(original,MPIN,operator);
  assert.equal(r.operatorReferenceMatchesSourcePin,true);
  assert.equal(r.independentPinAuthorityEstablished,false);
  assert.equal(r.networkAuthenticated,false);
  assert.equal(r.productionAccepted,false);
  assert.ok(Object.isFrozen(r));
});

test('published comparator accepts coherent dual repin',()=>{
  assert.equal(sha(synthetic),SYNMETA);
  assert.equal(sha(changedOperator),SYNOP);

  const r=inspectOperatorGenesisReference(
    selection(SYNMETA),
    config,synthetic,CPIN,SYNMETA,
    changedOperator,SYNOP
  );

  assert.equal(r.fullGenesisRootMatchesOperatorRecord,true);
  assert.equal(r.rootAuthenticated,false);
  assert.equal(r.networkAuthenticated,false);
});

test('source-pinned gate rejects identical dual-repinned data',()=>{
  assert.throws(
    ()=>pinned(synthetic,SYNMETA,changedOperator),
    {code:'PINNED_FIXTURE_POLICY_REJECTED'}
  );
});

test('source-pinned gate rejects altered operator alone',()=>{
  assert.throws(
    ()=>pinned(original,MPIN,changedOperator),
    {code:'PINNED_FIXTURE_POLICY_REJECTED'}
  );
});

test('extra caller replacement pin cannot override source pin',()=>{
  assert.throws(
    ()=>inspectPinnedFixtureOperatorPolicy(
      selection(MPIN),config,original,CPIN,MPIN,
      operator,SYNOP
    ),
    {code:'PINNED_FIXTURE_POLICY_REJECTED'}
  );
});
