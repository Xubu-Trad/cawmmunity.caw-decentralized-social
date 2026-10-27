import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectTestPaidLedger as inspect} from './ledger-reader.mjs';
const raw=readFileSync(new URL('./ledger-fixture.json',import.meta.url));
assert.equal(createHash('sha256').update(raw).digest('hex'),'3c6366af80618adcade19c01b1160f12420599025434d1a31cf7ab8257ac00ff');
const f=JSON.parse(raw),checks=[];
const run=c=>inspect(JSON.stringify(c.evidence),JSON.stringify(c.selection));
const group=(name,fn)=>{fn();checks.push(name);};
group('constructed states are not execution or funding evidence',()=>{assert.equal(f.synthetic,true);assert.equal(f.executed,false);assert.equal(f.funded,false);assert.equal(f.cases.length,6);});
for(const c of f.cases)group(c.name,()=>{
 if(c.expectedError){assert.throws(()=>run(c),{code:c.expectedError});return;}
 const result=run(c);for(const [k,v] of Object.entries(c.expected))assert.deepEqual(result[k],v);
 assert.equal(result.selectedLedgerDecoded,true);assert.equal(result.localLedgerInvariantsHold,true);assert.equal(result.binding.selectedFixtureBindingVerified,true);
 for(const key of ['historyMatchesLedger','tokenBackingVerified','withdrawalVerified','executionVerified','accountAuthorityVerified','currentPermissionVerified','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(result[key],false);
});
const reject=(name,fn)=>group(name,()=>{const c=structuredClone(f.cases[1]);fn(c);assert.throws(()=>run(c),e=>typeof e.code==='string');});
reject('missing witness',c=>c.evidence.probe.proof.storageProof.pop());
reject('duplicate witness',c=>{c.evidence.probe.proof.storageProof[1]=c.evidence.probe.proof.storageProof[0];});
reject('wrong concrete storage key',c=>{c.evidence.probe.proof.storageProof[0].key='0x'+'ff'.repeat(32);});
reject('forged credit value',c=>{c.evidence.probe.proof.storageProof[0].value='0x65';});
reject('zero-state proof substituted under nonzero header',c=>{c.evidence.probe.proof=f.cases[0].evidence.probe.proof;});
reject('changed selected probe',c=>{c.selection.probe='0x'+'44'.repeat(20);});
reject('changed runtime',c=>{c.evidence.probe.code='0x00';});
reject('caller supplied ledger claim',c=>{c.evidence.ledger=c.expected;});
reject('unsupported finality claim',c=>{c.selection.finalityVerified=true;});
group('input size bound',()=>assert.throws(()=>inspect(' '.repeat(1048577),JSON.stringify(f.cases[0].selection)),e=>typeof e.code==='string'));
group('object input refused',()=>assert.throws(()=>inspect(f.cases[0].evidence,JSON.stringify(f.cases[0].selection)),{code:'PAID_LEDGER_ARGUMENTS'}));
console.log(JSON.stringify({schema:'caw-test-paid-ledger-check/1',fixtureSha256:createHash('sha256').update(raw).digest('hex'),passed:checks.length,checks,executedStateVerified:false,productionAccepted:false},null,2));
