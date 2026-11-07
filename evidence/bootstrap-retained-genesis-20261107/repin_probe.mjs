import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const w=process.argv[2];
const load=async p=>import(
  pathToFileURL(resolve(w,p)).href
);

const {inspectFixtureForkData}=await load(
  'reference/fork-data-root.mjs'
);
const {inspectPinnedFixtureSelection}=await load(
  'reference/bootstrap-fixture-metadata-selection.mjs'
);

const config=readFileSync(resolve(
  w,'evidence/consensus-capella-bootstrap/config.yaml'
));
const meta=readFileSync(resolve(
  w,'evidence/consensus-capella-bootstrap/meta.yaml'
));

const sha=b=>createHash('sha256')
  .update(b).digest('hex');

const configPin='4a8e4e5d0fd4961b87ea5d1ff8ce3a28240ab6e2184eea754acccf50131f4a1a';
const metaPin='bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';

const originalGenesis='0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b';
const selectedRoot='0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';

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

assert.equal(sha(config),configPin);
assert.equal(sha(meta),metaPin);

const baseFork=inspectFixtureForkData(
  config,meta,configPin,metaPin
);
const baseSelection=inspectPinnedFixtureSelection(
  selection(metaPin),meta,metaPin
);

assert.equal(baseFork.genesisValidatorsRoot,originalGenesis);
assert.equal(baseFork.forkDigest,'0x856842be');
assert.equal(baseSelection.selectedBeaconRoot,selectedRoot);

console.log('BASELINE=PASS');

const changedGenesis='0x'+'11'.repeat(32);
const input=Buffer.concat([
  Buffer.from('03000001','hex'),
  Buffer.alloc(28),
  Buffer.from(changedGenesis.slice(2),'hex')
]);
const changedDigest='0x'+sha(input).slice(0,8);

assert.equal(changedDigest,'0x51369403');

const oldLine=`genesis_validators_root: '${originalGenesis}'`;
const newLine=`genesis_validators_root: '${changedGenesis}'`;

const source=meta.toString('ascii');

assert.equal(source.split(oldLine).length,2);
assert.equal(source.split('0x856842be').length,3);

const changedMeta=Buffer.from(
  source.replace(oldLine,newLine)
    .replaceAll('0x856842be',changedDigest),
  'ascii'
);

const changedPin=sha(changedMeta);
assert.notEqual(changedPin,metaPin);

// Fixed retained pin must detect the changed bytes.
assert.throws(
  ()=>inspectFixtureForkData(
    config,changedMeta,configPin,metaPin
  ),
  {code:'FIXTURE_FORK_DATA_REJECTED'}
);

assert.throws(
  ()=>inspectPinnedFixtureSelection(
    selection(metaPin),changedMeta,metaPin
  ),
  {code:'FIXTURE_METADATA_REJECTED'}
);

console.log('ORIGINAL_RETAINED_PIN=REJECTED_MUTATION');

// Change only the independent genesis-root variable.
// Digest and metadata hash are dependent recalculations.
const changedFork=inspectFixtureForkData(
  config,changedMeta,configPin,changedPin
);

const changedSelection=inspectPinnedFixtureSelection(
  selection(changedPin),changedMeta,changedPin
);

assert.equal(changedFork.genesisValidatorsRoot,changedGenesis);
assert.equal(changedFork.forkDigest,changedDigest);
assert.equal(changedSelection.selectedBeaconRoot,selectedRoot);
assert.equal(changedSelection.metadataDigestMatchesRetainedPin,true);
assert.notEqual(changedGenesis,originalGenesis);

assert.equal(changedFork.networkAuthenticated,false);
assert.equal(changedFork.forkScheduleVerified,false);
assert.equal(changedFork.rootAuthenticated,false);
assert.equal(changedSelection.rootAuthenticated,false);
assert.equal(changedSelection.productionAccepted,false);

console.log('SYNTHETIC_REPINNED_COMPOSITION=ACCEPTED');
console.log('GENESIS_ROOT_CHANGED=true');
console.log('SELECTED_BEACON_ROOT_UNCHANGED=true');
console.log('SYNTHETIC_FORK_DIGEST='+changedDigest);
console.log('EXTERNAL_GENESIS_IDENTITY_VERIFIED=false');
console.log('ROOT_AUTHENTICATED=false');
console.log('PASS: bounded identity-repin probe');
