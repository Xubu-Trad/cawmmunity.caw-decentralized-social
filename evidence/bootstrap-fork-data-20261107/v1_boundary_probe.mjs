import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const w=process.argv[2];
const url=pathToFileURL(resolve(
  w,'reference/fork-data-root.mjs'
));
const {inspectFixtureForkData}=await import(url.href);

const dir=resolve(w,'evidence/consensus-capella-bootstrap');
const config=readFileSync(resolve(dir,'config.yaml'));
const metadata=readFileSync(resolve(dir,'meta.yaml'));
const hash=b=>createHash('sha256').update(b).digest('hex');

function inspect(c,m) {
  return inspectFixtureForkData(c,m,hash(c),hash(m));
}

const original=inspect(config,metadata);
assert.equal(original.forkDigest,'0x856842be');
assert.equal(original.rootAuthenticated,false);
console.log('BASELINE=VERIFIED');

assert.equal(config.at(-1),10);
const injected=Buffer.concat([
  config,Buffer.from('rootAuthenticated: true\n')
]);

const a=inspect(injected,metadata);
assert.equal(a.rootAuthenticated,false);
assert.equal(a.productionAccepted,false);
console.log('CASE_A=CONFIG_AUTHORITY_FIELD_ACCEPTED_BUT_NOT_ADOPTED');

const oldVersion='CAPELLA_FORK_VERSION: 0x03000001';
const newVersion='CAPELLA_FORK_VERSION: 0x03000002';

assert.equal(
  config.toString('ascii').split(oldVersion).length,2
);

const c2=Buffer.from(
  config.toString('ascii').replace(oldVersion,newVersion)
);

assert.throws(
  ()=>inspect(c2,metadata),
  {code:'FIXTURE_FORK_DATA_REJECTED'}
);

const genesis=original.genesisValidatorsRoot;
const forkData=Buffer.concat([
  Buffer.from('03000002','hex'),
  Buffer.alloc(28),
  Buffer.from(genesis.slice(2),'hex')
]);

const digest='0x'+createHash('sha256')
  .update(forkData).digest('hex').slice(0,8);

assert.notEqual(digest,'0x856842be');

const originalMeta=metadata.toString('ascii');
assert.equal(originalMeta.split('0x856842be').length,3);

const m2=Buffer.from(
  originalMeta.replaceAll('0x856842be',digest)
);

const b=inspect(c2,m2);
assert.equal(b.forkDigest,digest);
assert.equal(b.forkScheduleVerified,false);
assert.equal(b.networkAuthenticated,false);
assert.equal(b.rootAuthenticated,false);

console.log('CASE_B=COHERENT_ALTERNATE_FORK_ACCEPTED');
console.log('ALTERNATE_DIGEST='+digest);
console.log('AUTHENTICATED_ROOT=false');
console.log('BOUNDARY_OBSERVATIONS=2');
