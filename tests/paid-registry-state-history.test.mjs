import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { inspectPaidRegistryStateHistory } from '../reference/paid-registry-state-history.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const trace=JSON.parse(gunzipSync(read('experiments/paid-signed-body-acquisition/execution-trace.json.gz'),{maxOutputLength:8*1024*1024}));
const captures=JSON.parse(read('experiments/paid-signed-body-acquisition/body-captures.json'));
const raw=read('reference/fixtures/paid-registry-state-v1.json'),f=JSON.parse(raw);
function sample(name='matching') {
 const c=f.cases.find(c=>c.name===name);
 const {history,manifest}=structuredClone(trace.branches.left.collectors.number);
 const bodies=structuredClone(captures.branches.left),last=history.blocks.at(-1),body=bodies.at(-1);
 // Deliberately constructed endpoint; signatures/receipts are retained, not
 // asserted to be an execution of the replacement state root.
 last.header=structuredClone(c.evidence.header);body.header=structuredClone(last.header);
 body.selection.block_hash=last.header.hash;history.end_block=structuredClone(last.header);manifest.end_block_hash=last.header.hash;
 for(const receipt of [...last.transactions.map(t=>t.receipt),...body.receipts]) {
  receipt.blockHash=last.header.hash;for(const log of receipt.logs)log.blockHash=last.header.hash;
 }
 return {schema:'caw-paid-registry-state-history/1',history,manifest,captures:bodies,
  policy:{schema:'caw-paid-post-policy/1',profile:'paid-action-v1-eoa-65-low-s',assumedEoaOwners:['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76','0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73']},
  stateEvidence:structuredClone(c.evidence),stateSelection:structuredClone(c.selection)};
}
const check=x=>inspectPaidRegistryStateHistory(JSON.stringify(x));
test('constructed endpoint recipe is pinned and explicitly not execution',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'302e74b810b7dd4decab0d277ef53635eafd8de43e5b478bddd7be214a0da0cb');
 assert.equal(f.synthetic,true);assert.equal(f.executionClaim,false);
});
test('signed history and constructed matching endpoint compose without authority promotion',()=>{
 const result=check(sample());assert.equal(result.selectedEndpointStateMatchesHistory,true);
 assert.equal(result.selectedOperatorMatchesReplay,true);assert.equal(result.history.registryCallSendersBound,true);
 for(const key of ['allRegistryStateVerified','initialStateVerified','executionVerified','accountAuthorityVerified','currentPermissionVerified',
 'endpointAuthenticated','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(result[key],false);
 assert.ok(Object.isFrozen(result));
});
for(const [name,code] of [['wrong-owner','OWNER'],['wrong-epoch','EPOCH'],['wrong-approval','APPROVAL'],['wrong-operator','OPERATOR']])
 test(name+' commitment-consistent endpoint conflicts with replay',()=>assert.throws(()=>check(sample(name)),{code:'REGISTRY_HISTORY_STATE_'+code}));
test('valid proof from another selected endpoint cannot attach to the history',()=>{
 const x=sample(),other=f.cases.find(c=>c.name==='wrong-epoch');x.stateEvidence=other.evidence;x.stateSelection=other.selection;
 assert.throws(()=>check(x),{code:'REGISTRY_HISTORY_STATE_ENDPOINT'});
});
test('caller cannot bypass signed-body checking with a verified-report label',()=>{
 const x=sample();x.historyVerified=true;assert.throws(()=>check(x),{code:'REGISTRY_HISTORY_STATE_SCHEMA'});
 delete x.historyVerified;x.captures[0].raw_transactions[0]='0x';assert.throws(()=>check(x));
});
