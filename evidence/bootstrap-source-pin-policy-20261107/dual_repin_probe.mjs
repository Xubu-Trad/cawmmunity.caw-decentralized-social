import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [w,o]=process.argv.slice(2);

const {inspectOperatorGenesisReference}=await import(
  pathToFileURL(resolve(
    w,'reference/operator-genesis-reference.mjs'
  )).href
);

const read=p=>readFileSync(resolve(w,p));
const sha=b=>createHash('sha256')
  .update(b).digest('hex');

const config=read(
  'evidence/consensus-capella-bootstrap/config.yaml'
);
const metadata=read(
  'evidence/consensus-capella-bootstrap/meta.yaml'
);
const operator=read(
  'evidence/bootstrap-operator-reference-20261107/operator_reference.json'
);

const CPIN='4a8e4e5d0fd4961b87ea5d1ff8ce3a28240ab6e2184eea754acccf50131f4a1a';
const MPIN='bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const OPIN='7dd1be57f1e1624a656cc3ef685945929e5d5bc610211ab8b101af7119f56982';

const genesis=
  '0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b';
const beacon=
  '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';

assert.equal(sha(config),CPIN);
assert.equal(sha(metadata),MPIN);
assert.equal(sha(operator),OPIN);

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

const check=(meta,metaPin,ref,refPin)=>
  inspectOperatorGenesisReference(
    selection(metaPin),
    config,meta,CPIN,metaPin,ref,refPin
  );

// Baseline using the published reference and its original pin.
const base=check(metadata,MPIN,operator,OPIN);
assert.equal(base.fullGenesisRootMatchesOperatorRecord,true);
assert.equal(base.networkAuthenticated,false);
console.log('BASELINE=PASS');

// Construct a coherent synthetic alternative.
const alternate='0x'+'11'.repeat(32);

const forkData=Buffer.concat([
  Buffer.from('03000001','hex'),
  Buffer.alloc(28),
  Buffer.from(alternate.slice(2),'hex')
]);

const digest='0x'+sha(forkData).slice(0,8);
assert.equal(digest,'0x51369403');

const source=metadata.toString('ascii');
assert.equal(source.split(genesis).length,2);
assert.equal(source.split('0x856842be').length,3);

const changedMeta=Buffer.from(
  source.replace(genesis,alternate)
    .replaceAll('0x856842be',digest),
  'ascii'
);

const changedMetaPin=sha(changedMeta);

const record=JSON.parse(operator.toString('utf8'));
assert.equal(record.genesisValidatorsRoot,genesis);

record.genesisValidatorsRoot=alternate;

const changedOperator=Buffer.from(
  JSON.stringify(record,null,2)+'\n'
);

const changedOperatorPin=sha(changedOperator);
assert.notEqual(changedOperatorPin,OPIN);

// Preserve both exact synthetic inputs.
writeFileSync(
  resolve(o,'synthetic_metadata.yaml'),
  changedMeta,{flag:'wx'}
);
writeFileSync(
  resolve(o,'synthetic_operator.json'),
  changedOperator,{flag:'wx'}
);

// Control A: the original expected operator pin is fixed.
assert.throws(
  ()=>check(
    changedMeta,changedMetaPin,
    changedOperator,OPIN
  ),
  {code:'OPERATOR_REFERENCE_REJECTED'}
);

console.log('FIXED_EXPECTED_PIN=REJECTED');

// Control B: same data; only expected operator pin changes.
const result=check(
  changedMeta,changedMetaPin,
  changedOperator,changedOperatorPin
);

assert.equal(result.genesisValidatorsRoot,alternate);
assert.equal(result.fullGenesisRootMatchesOperatorRecord,true);

for (const key of [
  'rootAuthenticated',
  'networkAuthenticated',
  'independentAcquisitionVerified',
  'forkScheduleVerified',
  'blsValidated',
  'finalityVerified',
  'updatesAccepted',
  'productionAccepted'
]) assert.equal(result[key],false);

assert.ok(Object.isFrozen(result));

console.log('REPINNED_EXPECTED_PIN=ACCEPTED_AS_CONSISTENCY');
console.log('PROVIDER_METADATA_SHA256='+changedMetaPin);
console.log('SYNTHETIC_OPERATOR_SHA256='+changedOperatorPin);
console.log('ORIGINAL_OPERATOR_SHA256='+OPIN);
console.log('AUTHORITY=NOT_ESTABLISHED');
console.log('PASS: dual-repin boundary reproduced');
