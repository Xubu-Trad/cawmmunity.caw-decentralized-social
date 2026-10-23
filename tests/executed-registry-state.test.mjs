import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectTestRegistryState } from '../reference/test-registry-state.mjs';

const raw=readFileSync(new URL('../reference/fixtures/executed-registry-state-v1.json',import.meta.url));
const fixture=JSON.parse(raw);
const check=c=>inspectTestRegistryState(JSON.stringify(c.evidence),JSON.stringify(c.selection));
test('capture is completed local execution with impersonated actors',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'e3646e690b222f7ffd1aaf5c0156a28ac2aa40f503d6ffb7c3b1df64a67edc10');
 assert.equal(fixture.complete,true);assert.equal(fixture.localOnly,true);assert.equal(fixture.impersonatedActors,true);
 assert.equal(fixture.publicChainCertification,false);assert.equal(fixture.node.remote_provider,null);
 assert.equal(fixture.node.token_code_replaced,false);assert.equal(fixture.cases.length,2);
});
for(const c of fixture.cases)test(c.name+' proof agrees with retained direct authority read',()=>{
 const result=check(c);assert.equal(result.owner,c.owner);assert.equal(result.epoch,c.epoch);
 assert.equal(c.directAuthority,'0x'+c.owner.slice(2).padStart(64,'0')+BigInt(c.epoch).toString(16).padStart(64,'0'));
 for(const key of ['accountAuthorityVerified','transactionPermissionVerified','currentPermissionVerified','executionVerified','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(result[key],false);
});
test('pre-transfer proof cannot be adopted under post-transfer header',()=>{
 const c=structuredClone(fixture.cases[1]);c.evidence.proof=fixture.cases[0].evidence.proof;
 assert.throws(()=>check(c));
});
test('direct RPC claim cannot replace the committed owner value',()=>{
 const c=structuredClone(fixture.cases[1]);c.evidence.proof.storageProof[0].value='0x1';
 assert.throws(()=>check(c));
});
test('local endpoint header hash remains an explicit selection assumption',()=>{
 const c=structuredClone(fixture.cases[1]);c.selection.hash=fixture.cases[0].selection.hash;
 assert.throws(()=>check(c));
});
