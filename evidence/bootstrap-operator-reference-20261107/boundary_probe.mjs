import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [w,o]=process.argv.slice(2);
const load=async name=>import(
  pathToFileURL(resolve(w,name)).href
);

const {inspectFixtureForkData}=await load(
  'reference/fork-data-root.mjs'
);
const {inspectPinnedFixtureSelection}=await load(
  'reference/bootstrap-fixture-metadata-selection.mjs'
);

const sha=b=>createHash('sha256').update(b).digest('hex');
const config=readFileSync(resolve(
  w,'evidence/consensus-capella-bootstrap/config.yaml'
));
const metadata=readFileSync(resolve(
  w,'evidence/consensus-capella-bootstrap/meta.yaml'
));

const CONFIG_PIN=
  '4a8e4e5d0fd4961b87ea5d1ff8ce3a28240ab6e2184eea754acccf50131f4a1a';
const META_PIN=
  'bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const GENESIS=
  '0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b';
const BEACON=
  '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';

assert.equal(sha(config),CONFIG_PIN);
assert.equal(sha(metadata),META_PIN);

const operatorBytes=readFileSync(resolve(
  o,'operator_reference.json'
));
const pinLine=readFileSync(resolve(
  o,'operator_reference.sha256'
),'utf8');
const operatorPin=pinLine.split(/\s+/)[0];

assert.match(operatorPin,/^[0-9a-f]{64}$/);
assert.equal(sha(operatorBytes),operatorPin);

function reject(code) {
  const error=new Error(code);
  error.code=code;
  throw error;
}

function selection(pin) {
  return {
    schema:'caw-bootstrap-selection/1',
    network:'ethereum-minimal-capella-fixture',
    profile:'minimal-capella-32-structural-only',
    selectedBeaconRoot:BEACON,
    anchor:{
      source:'externally-retained-fixture-metadata',
      beaconRoot:BEACON,
      sha256:pin
    }
  };
}

function operatorBoundCheck(meta,metaPin,refBytes,refPin) {
  // The reference pin is supplied from the operator side,
  // not extracted from the provider's metadata.
  if (sha(refBytes)!==refPin) {
    reject('OPERATOR_REFERENCE_PIN_REJECTED');
  }

  const policy=JSON.parse(refBytes.toString('utf8'));
  const keys=[
    'authority','genesisValidatorsRoot','network',
    'schema','sourceClass'
  ];

  assert.deepEqual(Object.keys(policy).sort(),keys);
  assert.equal(
    refBytes.toString('utf8'),
    JSON.stringify(policy,null,2)+'\n'
  );

  if (
    policy.schema!=='caw-operator-genesis-reference/1' ||
    policy.network!=='ethereum-minimal-capella-fixture' ||
    policy.sourceClass!=='retained-minimal-capella-fixture' ||
    policy.authority!=='research-only' ||
    !/^0x[0-9a-f]{64}$/.test(policy.genesisValidatorsRoot)
  ) reject('OPERATOR_REFERENCE_FORMAT_REJECTED');

  const selected=inspectPinnedFixtureSelection(
    selection(metaPin),meta,metaPin
  );
  const fork=inspectFixtureForkData(
    config,meta,CONFIG_PIN,metaPin
  );

  if (fork.genesisValidatorsRoot!==policy.genesisValidatorsRoot) {
    reject('OPERATOR_REFERENCE_GENESIS_MISMATCH');
  }

  return Object.freeze({
    schema:'caw-operator-reference-comparison/1',
    selectedBeaconRoot:selected.selectedBeaconRoot,
    fullGenesisRootMatchesOperatorRecord:true,
    rootAuthenticated:false,
    networkAuthenticated:false,
    independentAcquisitionVerified:false,
    productionAccepted:false
  });
}

// Control: published fixture and retained operator record.
const baseline=operatorBoundCheck(
  metadata,META_PIN,operatorBytes,operatorPin
);

assert.equal(baseline.fullGenesisRootMatchesOperatorRecord,true);
assert.equal(baseline.rootAuthenticated,false);
assert.equal(baseline.networkAuthenticated,false);
assert.equal(baseline.productionAccepted,false);
console.log('BASELINE_OPERATOR_REFERENCE=PASS');

// Change only the provider's genesis root.
// Recompute its dependent digest and metadata hash.
const changedRoot='0x'+'11'.repeat(32);
const changedDigest='0x'+sha(Buffer.concat([
  Buffer.from('03000001','hex'),
  Buffer.alloc(28),
  Buffer.from(changedRoot.slice(2),'hex')
])).slice(0,8);

assert.equal(changedDigest,'0x51369403');

const original=metadata.toString('ascii');
assert.equal(original.split(GENESIS).length,2);
assert.equal(original.split('0x856842be').length,3);

const changed=Buffer.from(
  original.replace(GENESIS,changedRoot)
    .replaceAll('0x856842be',changedDigest),
  'ascii'
);
const changedPin=sha(changed);

writeFileSync(
  resolve(o,'synthetic_provider_metadata.yaml'),
  changed,{flag:'wx'}
);

// Prior consistency checks should still accept the
// coherent synthetic metadata with its recomputed pin.
const selected=inspectPinnedFixtureSelection(
  selection(changedPin),changed,changedPin
);
const fork=inspectFixtureForkData(
  config,changed,CONFIG_PIN,changedPin
);

assert.equal(selected.selectedBeaconRoot,BEACON);
assert.equal(fork.genesisValidatorsRoot,changedRoot);
assert.equal(fork.forkDigest,changedDigest);

console.log('SYNTHETIC_PROVIDER_CONSISTENCY=ACCEPTED');

// The unchanged operator reference must reject.
assert.throws(
  ()=>operatorBoundCheck(
    changed,changedPin,operatorBytes,operatorPin
  ),
  {code:'OPERATOR_REFERENCE_GENESIS_MISMATCH'}
);

console.log('SYNTHETIC_PROVIDER_VS_OPERATOR=REJECTED');

// Separate negative control: alter operator bytes,
// keeping the original operator-side pin unchanged.
const alteredRecord=Buffer.from(
  operatorBytes.toString('utf8').replace(
    GENESIS,changedRoot
  )
);

assert.notEqual(sha(alteredRecord),operatorPin);
assert.throws(
  ()=>operatorBoundCheck(
    metadata,META_PIN,alteredRecord,operatorPin
  ),
  {code:'OPERATOR_REFERENCE_PIN_REJECTED'}
);

console.log('ALTERED_OPERATOR_RECORD_WITH_FIXED_PIN=REJECTED');
console.log('OPERATOR_PIN_SHA256='+operatorPin);
console.log('SYNTHETIC_METADATA_SHA256='+changedPin);
console.log('REFERENCE_SOURCE=RETAINED_TEST_FIXTURE');
console.log('INDEPENDENT_LIVE_AUTHORITY=false');
console.log('NETWORK_AUTHENTICATED=false');
console.log('PASS: operator-reference boundary reproduced');
