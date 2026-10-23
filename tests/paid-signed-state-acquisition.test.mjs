import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectPaidRegistryStateHistory} from '../reference/paid-registry-state-history.mjs';
const raw=readFileSync(new URL('../experiments/paid-signed-state-acquisition/joint-capture.json',import.meta.url));
const f=JSON.parse(raw);
const check=x=>inspectPaidRegistryStateHistory(JSON.stringify(x));
test('joint capture reports local signed execution without public-chain certification',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'94a43795e6029a859b4bf4dfe05af41998317bee1fb0b2fb231b6642931d64dd');
 assert.equal(f.localOnly,true);assert.equal(f.syntheticToken,true);assert.equal(f.nonImpersonatedSubmissions,true);assert.equal(f.publicChainCertification,false);
});
for(const branch of ['left','right'])test(branch+' signed history matches its executed endpoint proofs',()=>{
 const r=check(f.branches[branch]);assert.equal(r.selectedEndpointStateMatchesHistory,true);assert.equal(r.selectedOperatorMatchesReplay,true);
 assert.equal(r.history.registryCallSendersBound,true);assert.equal(r.state.operatorAllowed,false);
 assert.equal(r.state.state.epoch,'0x1');assert.equal(r.state.approved,'0x'+'00'.repeat(20));
 for(const key of ['executionVerified','accountAuthorityVerified','currentPermissionVerified','endpointAuthenticated','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(r[key],false);
});
test('same-height alternate branch proofs do not attach to selected history',()=>{
 const x=structuredClone(f.branches.right);assert.equal(x.history.end_block.number,f.branches.left.history.end_block.number);
 x.stateEvidence=f.branches.left.stateEvidence;x.stateSelection=f.branches.left.stateSelection;
 assert.throws(()=>check(x),{code:'REGISTRY_HISTORY_STATE_ENDPOINT'});
});
test('altered body bytes cannot be rescued by matching state proofs',()=>{
 const x=structuredClone(f.branches.left);x.captures[0].raw_transactions[0]='0x';assert.throws(()=>check(x));
});
test('changing owner proof claim fails despite valid signed history',()=>{
 const x=structuredClone(f.branches.left);x.stateEvidence.proof.storageProof[0].value='0x1';assert.throws(()=>check(x));
});
