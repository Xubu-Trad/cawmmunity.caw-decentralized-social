import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectPaidRegistryStateHistory} from '../reference/paid-registry-state-history.mjs';
const raw=readFileSync(new URL('../experiments/paid-signed-delegate-acquisition/joint-capture.json',import.meta.url));
const f=JSON.parse(raw);
const check=x=>inspectPaidRegistryStateHistory(JSON.stringify(x));
test('delegation capture is local, signed and synthetic-token only',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'2fbe579e35a5b6bf3b83093331138b2a7733a7daafd9cf22473ab483226019c2');
 assert.equal(f.localOnly,true);assert.equal(f.nonImpersonatedSubmissions,true);assert.equal(f.syntheticToken,true);assert.equal(f.publicChainCertification,false);
});
for(const [branch,authorization] of [['left','token-approval'],['right','operator']])test(branch+' isolates '+authorization+' transfer',()=>{
 const r=check(f.branches[branch]);const transfer=r.history.operations.find(op=>op.kind==='transfer');
 assert.equal(transfer.authorization,authorization);assert.notEqual(transfer.caller,transfer.from);
 assert.equal(r.history.registry_sequence.successfulCalls,8);assert.equal(r.history.registry_sequence.failedCallsNotPermissionChecked,1);
 assert.equal(r.selectedEndpointStateMatchesHistory,true);assert.equal(r.state.state.epoch,'0x1');
 for(const flag of ['accountAuthorityVerified','currentPermissionVerified','executionVerified','endpointAuthenticated','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(r[flag],false);
});
test('other authorization path is disabled before each successful delegated transfer',()=>{
 const left=check(f.branches.left).history.operations,right=check(f.branches.right).history.operations;
 const li=left.findIndex(op=>op.kind==='transfer'),ri=right.findIndex(op=>op.kind==='transfer');
 assert.equal(left.slice(0,li).filter(op=>op.kind==='operator').at(-1).allowed,false);
 assert.equal(right.slice(0,ri).filter(op=>op.kind==='approve').at(-1).approved,'0x'+'00'.repeat(20));
});
test('each revoked attempt has a signed failed receipt without registry effects',()=>{
 for(const branch of ['left','right']) {
  const x=f.branches[branch],reg=x.history.addresses.registry;
  const failures=x.history.blocks.flatMap(b=>b.transactions).filter(t=>t.transaction.to===reg && t.receipt.status==='0x0');
  assert.equal(failures.length,1);assert.deepEqual(failures[0].receipt.logs,[]);
  assert.equal(failures[0].transaction.from,x.policy.assumedEoaOwners[1]);
  assert.ok(failures[0].transaction.data.startsWith('0x23b872dd'));
  // Failure reason is not committed by the receipt; do not invent one here.
  assert.equal(check(x).history.registry_sequence.failedCallsNotPermissionChecked,1);
 }
});
test('same-height proof substitution fails for the delegated branches',()=>{
 const x=structuredClone(f.branches.right);assert.equal(x.history.end_block.number,f.branches.left.history.end_block.number);
 x.stateEvidence=f.branches.left.stateEvidence;x.stateSelection=f.branches.left.stateSelection;
 assert.throws(()=>check(x),{code:'REGISTRY_HISTORY_STATE_ENDPOINT'});
});
test('a caller label cannot replace the recovered delegated signer',()=>{
 const x=structuredClone(f.branches.left),reg=x.history.addresses.registry;
 const tx=x.history.blocks.flatMap(b=>b.transactions).find(t=>t.transaction.to===reg && t.transaction.data.startsWith('0x23b872dd') && t.receipt.status==='0x1');
 assert.ok(tx);tx.transaction.from=x.policy.assumedEoaOwners[0];assert.throws(()=>check(x));
});
test('failed receipt cannot be relabeled as successful while keeping body commitments',()=>{
 const x=structuredClone(f.branches.left),reg=x.history.addresses.registry;
 const tx=x.history.blocks.flatMap(b=>b.transactions).find(t=>t.transaction.to===reg && t.receipt.status==='0x0');
 assert.ok(tx);tx.receipt.status='0x1';assert.throws(()=>check(x));
});
