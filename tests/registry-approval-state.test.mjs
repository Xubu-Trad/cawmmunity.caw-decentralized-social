import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectTestRegistryApprovalState } from '../reference/test-registry-state.mjs';
const raw=readFileSync(new URL('../reference/fixtures/executed-registry-approvals-v1.json',import.meta.url));
const f=JSON.parse(raw);
const item=name=>structuredClone(f.cases.find(c=>c.name===name));
const check=c=>inspectTestRegistryApprovalState(JSON.stringify(c.evidence),JSON.stringify(c.selection));
test('capture is completed local execution with no remote requests or code injection',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'9f9cfae95c6a6cba360c2b646c41740a2a0484288b7d6b076d77107194bf2480');
 assert.equal(f.complete,true);assert.equal(f.impersonatedActors,true);assert.equal(f.node.upstream_forwarded_count,0);
 assert.equal(f.node.token_code_replaced,false);assert.equal(f.cases.length,6);
});
for(const c of f.cases)test(c.name+' approval proofs match direct contract reads',()=>{
 const r=check(c);assert.equal(r.state.owner,c.owner);assert.equal(r.state.epoch,c.epoch);
 assert.equal(r.approved,c.approved);assert.equal(r.operatorOwner,c.owner);assert.equal(r.operatorAllowed,c.operatorAllowed);
 assert.equal(c.directApproved,'0x'+r.approved.slice(2).padStart(64,'0'));
 assert.equal(BigInt(c.directOperator),r.operatorAllowed?1n:0n);assert.ok(Object.isFrozen(r));
 for(const k of ['allOperatorGrantsVerified','transactionPermissionVerified','currentPermissionVerified','accountAuthorityVerified',
 'executionVerified','endpointAuthenticated','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(r[k],false);
});
test('new owner cannot reuse prior-owner operator witness',()=>{
 const c=item('transferred');c.evidence.proof.storageProof[3]=item('operator_granted').evidence.proof.storageProof[3];
 assert.throws(()=>check(c));
});
test('changing selected operator invalidates its nested mapping proof',()=>{
 const c=item('operator_granted');c.selection.operator='0x'+'33'.repeat(20);assert.throws(()=>check(c));
});
test('missing zero-approval witness rejects',()=>{
 const c=item('initial');c.evidence.proof.storageProof.splice(2,1);assert.throws(()=>check(c),{code:'REGISTRY_STATE_SLOTS'});
});
test('forged approval values and substituted runtime reject',()=>{
 let c=item('approved');c.evidence.proof.storageProof[2].value='0x0';assert.throws(()=>check(c));
 c=item('approved');c.evidence.code='0x';assert.throws(()=>check(c));
});
test('extra owner override and malformed operator selectors reject',()=>{
 const c=item('returned');c.selection.operatorOwner='0x'+'11'.repeat(20);assert.throws(()=>check(c),{code:'REGISTRY_STATE_SCHEMA'});
 delete c.selection.operatorOwner;
 for(const operator of ['0x1',f.cases[0].selection.operator+'\n',null]) {
  c.selection.operator=operator;assert.throws(()=>check(c),{code:'REGISTRY_STATE_OPERATOR'});
 }
});
