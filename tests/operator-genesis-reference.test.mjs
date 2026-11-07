import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectOperatorGenesisReference} from
  '../reference/operator-genesis-reference.mjs';
import {inspectPinnedFixtureSelection} from
  '../reference/bootstrap-fixture-metadata-selection.mjs';
import {inspectFixtureForkData} from
  '../reference/fork-data-root.mjs';

const fixture=new URL(
  '../evidence/consensus-capella-bootstrap/',import.meta.url
);
const refUrl=new URL(
  '../evidence/bootstrap-operator-reference-20261107/operator_reference.json',
  import.meta.url
);

const config=readFileSync(new URL('config.yaml',fixture));
const metadata=readFileSync(new URL('meta.yaml',fixture));
const operator=readFileSync(refUrl);

const sha=b=>createHash('sha256').update(b).digest('hex');

const CPIN='4a8e4e5d0fd4961b87ea5d1ff8ce3a28240ab6e2184eea754acccf50131f4a1a';
const MPIN='bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const OPIN='7dd1be57f1e1624a656cc3ef685945929e5d5bc610211ab8b101af7119f56982';

const genesis=
  '0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b';
const beacon=
  '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';

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

const compare=(meta=metadata,mpin=MPIN,
               ref=operator,opin=OPIN)=>
  inspectOperatorGenesisReference(
    selection(mpin),config,meta,CPIN,mpin,ref,opin
  );

const bad=fn=>assert.throws(
  fn,{code:'OPERATOR_REFERENCE_REJECTED'}
);

const canonical=o=>Buffer.from(
  JSON.stringify(o,null,2)+'\n'
);

test('baseline operator reference matches fixture only',()=>{
  assert.equal(sha(config),CPIN);
  assert.equal(sha(metadata),MPIN);
  assert.equal(sha(operator),OPIN);

  const result=compare();

  assert.equal(result.genesisValidatorsRoot,genesis);
  assert.equal(result.fullGenesisRootMatchesOperatorRecord,true);
  assert.equal(result.rootAuthenticated,false);
  assert.equal(result.networkAuthenticated,false);
  assert.equal(result.productionAccepted,false);
  assert.ok(Object.isFrozen(result));
});

test('coherent provider genesis substitution rejects',()=>{
  const changedRoot='0x'+'11'.repeat(32);
  const digest='0x'+sha(Buffer.concat([
    Buffer.from('03000001','hex'),
    Buffer.alloc(28),
    Buffer.from(changedRoot.slice(2),'hex')
  ])).slice(0,8);

  assert.equal(digest,'0x51369403');

  const source=metadata.toString('ascii');
  assert.equal(source.split(genesis).length,2);
  assert.equal(source.split('0x856842be').length,3);

  const changed=Buffer.from(
    source.replace(genesis,changedRoot)
      .replaceAll('0x856842be',digest)
  );
  const changedPin=sha(changed);

  const selected=inspectPinnedFixtureSelection(
    selection(changedPin),changed,changedPin
  );
  const fork=inspectFixtureForkData(
    config,changed,CPIN,changedPin
  );

  assert.equal(selected.selectedBeaconRoot,beacon);
  assert.equal(fork.genesisValidatorsRoot,changedRoot);

  bad(()=>compare(changed,changedPin));
});

test('altered operator bytes reject with unchanged pin',()=>{
  const modified=Buffer.from(
    operator.toString('ascii').replace(
      genesis,'0x'+'11'.repeat(32)
    )
  );
  assert.notEqual(sha(modified),OPIN);
  bad(()=>compare(metadata,MPIN,modified,OPIN));
});

test('changed authority field rejects despite fresh hash',()=>{
  const changed=JSON.parse(operator.toString('utf8'));
  changed.authority='provider-confirmed';
  const bytes=canonical(changed);
  bad(()=>compare(metadata,MPIN,bytes,sha(bytes)));
});

test('extra operator field rejects despite fresh hash',()=>{
  const changed=JSON.parse(operator.toString('utf8'));
  changed.rootAuthenticated=true;
  const bytes=canonical(changed);
  bad(()=>compare(metadata,MPIN,bytes,sha(bytes)));
});

test('malformed expected operator pin rejects',()=>{
  bad(()=>compare(metadata,MPIN,operator,'0x'+OPIN));
});
