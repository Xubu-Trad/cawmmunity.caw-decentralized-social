import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectRegistryStateReconciliation } from '../reference/registry-state-reconciliation.mjs';
const f=JSON.parse(readFileSync(new URL('../reference/fixtures/executed-registry-state-v1.json',import.meta.url)));
const [before,after]=f.cases;
const transfer=f.setup.find(row=>row.label==='transfer');
const entry={from:transfer.transaction.from,to:transfer.transaction.to,value:transfer.transaction.value,
  data:transfer.transaction.data,status:transfer.receipt.status,
  logs:transfer.receipt.logs.map(({address,topics,data})=>({address,topics,data}))};
const input=(terminal=after,sequence=[entry])=>structuredClone({schema:'caw-registry-state-reconciliation/1',sequence,
 registrySelection:{schema:'caw-registry-selection/1',profile:'test-account-registry-direct-v1',
  registry:terminal.selection.registry,firstOwner:before.owner,secondOwner:after.owner},
 stateEvidence:terminal.evidence,stateSelection:terminal.selection});
const check=x=>inspectRegistryStateReconciliation(JSON.stringify(x));

test('retained executed transfer replay matches independently decoded terminal owner/epoch',()=>{
 const result=check(input());assert.equal(result.selectedAccountStateMatchesReplay,true);
 assert.equal(result.replay.operations[0].authorization,'owner');
 assert.equal(result.replay.operations[0].from,before.owner);assert.equal(result.state.owner,after.owner);
 assert.ok(Object.isFrozen(result));
 for(const key of ['approvalsStateVerified','initialStateVerified','sequenceComplete','sequenceOrderAuthenticated',
  'transactionPositionVerified','senderVerified','accountAuthorityVerified','currentPermissionVerified',
  'executionVerified','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(result[key],false);
});
test('initial state matches empty replay only under explicit constructor assumptions',()=>{
 assert.equal(check(input(before,[])).selectedAccountStateMatchesReplay,true);
});
test('terminal owner cannot impersonate the caller of the preceding transfer',()=>{
 const x=input();x.sequence[0].from=after.owner;
 assert.throws(()=>check(x),{code:'PAID_REGISTRY_NOT_AUTHORIZED'});
});
test('post-state cannot replace constructor owner to make earlier transfer valid',()=>{
 const x=input();x.registrySelection.firstOwner=after.owner;
 assert.throws(()=>check(x),{code:'PAID_REGISTRY_WRONG_FROM'});
});
test('omitted transfer cannot reconcile with final owner',()=>{
 assert.throws(()=>check(input(after,[])),{code:'REGISTRY_RECONCILE_OWNER'});
});
test('final owner coincidence cannot hide a missing epoch transition',()=>{
 const x=input(after,[]);x.registrySelection.firstOwner=after.owner;
 assert.throws(()=>check(x),{code:'REGISTRY_RECONCILE_EPOCH'});
});
test('pre-transfer state cannot anchor post-transfer replay',()=>{
 assert.throws(()=>check(input(before)),{code:'REGISTRY_RECONCILE_OWNER'});
});
test('a different registry selection cannot reconcile even with identical owners',()=>{
 const x=input(before,[]);x.registrySelection.registry='0x'+'aa'.repeat(20);
 assert.throws(()=>check(x),{code:'REGISTRY_RECONCILE_REGISTRY'});
});
test('extra caller-supplied authority flags and duplicate JSON keys reject',()=>{
 const x=input();x.accountAuthorityVerified=true;assert.throws(()=>check(x));
 assert.throws(()=>inspectRegistryStateReconciliation('{"schema":"a","schema":"b"}'));
});
test('unrecorded operator grants illustrate why final owner/epoch do not prove completeness',()=>{
 const x=input();const operator='0x'+'33'.repeat(20);
 const word=s=>s.slice(2).padStart(64,'0');
 x.sequence.push({from:after.owner,to:after.selection.registry,value:'0x0',status:'0x1',
  data:'0xa22cb465'+word(operator)+'0'.repeat(63)+'1',logs:[{address:after.selection.registry,
   topics:['0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31','0x'+word(after.owner),'0x'+word(operator)],data:'0x'+'0'.repeat(63)+'1'}]});
 const result=check(x);assert.equal(result.selectedAccountStateMatchesReplay,true);
 assert.equal(result.replay.final.operators.length,1);assert.equal(result.approvalsStateVerified,false);
 assert.equal(result.sequenceComplete,false);
});
