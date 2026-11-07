import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectRetainedFixtureGenesisBinding} from
  '../reference/retained-fixture-genesis-binding.mjs';
import {inspectFixtureForkData} from
  '../reference/fork-data-root.mjs';
import {inspectPinnedFixtureSelection} from
  '../reference/bootstrap-fixture-metadata-selection.mjs';

const base=new URL(
  '../evidence/consensus-capella-bootstrap/',import.meta.url
);
const config=readFileSync(new URL('config.yaml',base));
const meta=readFileSync(new URL('meta.yaml',base));

const sha=b=>createHash('sha256').update(b).digest('hex');

const CONFIG_PIN='4a8e4e5d0fd4961b87ea5d1ff8ce3a28240ab6e2184eea754acccf50131f4a1a';
const META_PIN='bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';

const originalRoot=
  '0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b';
const selectedRoot=
  '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';

const selection=pin=>({
  schema:'caw-bootstrap-selection/1',
  network:'ethereum-minimal-capella-fixture',
  profile:'minimal-capella-32-structural-only',
  selectedBeaconRoot:selectedRoot,
  anchor:{
    source:'externally-retained-fixture-metadata',
    beaconRoot:selectedRoot,
    sha256:pin
  }
});

test('published fixture binds to retained full genesis root',()=>{
  assert.equal(sha(config),CONFIG_PIN);
  assert.equal(sha(meta),META_PIN);

  const result=inspectRetainedFixtureGenesisBinding(
    selection(META_PIN),config,meta,CONFIG_PIN,META_PIN
  );

  assert.equal(result.genesisValidatorsRoot,originalRoot);
  assert.equal(result.genesisRootMatchesRetainedFixtureReference,true);
  assert.equal(result.rootAuthenticated,false);
  assert.equal(result.networkAuthenticated,false);
  assert.equal(result.productionAccepted,false);
  assert.ok(Object.isFrozen(result));
});

test('coherent genesis replacement rejects against fixed reference',()=>{
  const changedRoot='0x'+'11'.repeat(32);
  const digest='0x'+sha(Buffer.concat([
    Buffer.from('03000001','hex'),
    Buffer.alloc(28),
    Buffer.from(changedRoot.slice(2),'hex')
  ])).slice(0,8);

  assert.equal(digest,'0x51369403');

  const original=meta.toString('ascii');
  assert.equal(original.split(originalRoot).length,2);
  assert.equal(original.split('0x856842be').length,3);

  const changedMeta=Buffer.from(
    original.replace(originalRoot,changedRoot)
      .replaceAll('0x856842be',digest),
    'ascii'
  );
  const changedPin=sha(changedMeta);

  // Both published consistency modules still accept
  // the correctly recomputed dependent values.
  const selected=inspectPinnedFixtureSelection(
    selection(changedPin),changedMeta,changedPin
  );
  const fork=inspectFixtureForkData(
    config,changedMeta,CONFIG_PIN,changedPin
  );

  assert.equal(selected.selectedBeaconRoot,selectedRoot);
  assert.equal(fork.genesisValidatorsRoot,changedRoot);
  assert.equal(fork.forkDigest,digest);

  // The separate retained reference must not change
  // when the input metadata and its hash change.
  assert.throws(
    ()=>inspectRetainedFixtureGenesisBinding(
      selection(changedPin),
      config,changedMeta,CONFIG_PIN,changedPin
    ),
    {code:'RETAINED_GENESIS_ROOT_REJECTED'}
  );
});
