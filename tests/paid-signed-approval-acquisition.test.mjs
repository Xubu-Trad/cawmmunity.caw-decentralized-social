import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectPaidRegistryStateHistory} from '../reference/paid-registry-state-history.mjs';
const raw=readFileSync(new URL('../experiments/paid-signed-approval-acquisition/joint-capture.json',import.meta.url));
const f=JSON.parse(raw);
const check=x=>inspectPaidRegistryStateHistory(JSON.stringify(x));
test('new signed capture retains local synthetic and non-impersonation boundaries',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'c9be9a63dc4d50ee6832a9661198f65a054c5eee90a66e597a82d008ab54289a');
 assert.equal(f.localOnly,true);assert.equal(f.nonImpersonatedSubmissions,true);assert.equal(f.syntheticToken,true);assert.equal(f.publicChainCertification,false);
});
for(const branch of ['left','right'])test(branch+' signed approval history matches its endpoint proof',()=>{
 const result=check(f.branches[branch]);const A=f.branches[branch].policy.assumedEoaOwners[0];
 assert.equal(result.selectedEndpointStateMatchesHistory,true);assert.equal(result.selectedOperatorMatchesReplay,true);
 assert.equal(result.state.operatorAllowed,branch==='left');
 assert.equal(result.state.approved,branch==='left'?A:'0x'+'00'.repeat(20));
 assert.equal(result.history.registry_sequence.successfulCalls,5);
 for(const flag of ['accountAuthorityVerified','currentPermissionVerified','executionVerified','endpointAuthenticated','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(result[flag],false);
});
test('signed prefix grant precedes transfer and endpoint revocation follows it',()=>{
 const result=check(f.branches.right),ops=result.history.operations;
 assert.deepEqual(ops.map(op=>op.kind),['approve','operator','transfer','approve','operator']);
 assert.equal(ops[1].allowed,true);assert.equal(ops[4].allowed,false);
 assert.ok(BigInt(ops[1].blockNumber)<BigInt(ops[2].blockNumber));assert.ok(BigInt(ops[2].blockNumber)<BigInt(ops[4].blockNumber));
 assert.equal(ops[2].authorization,'owner'); // Does not claim delegated transfer coverage.
});
test('positive grant branch cannot substitute for same-height revoked branch',()=>{
 const x=structuredClone(f.branches.right);assert.equal(x.history.end_block.number,f.branches.left.history.end_block.number);
 x.stateEvidence=f.branches.left.stateEvidence;x.stateSelection=f.branches.left.stateSelection;
 assert.throws(()=>check(x),{code:'REGISTRY_HISTORY_STATE_ENDPOINT'});
});
test('forging positive grant value or removing its witness rejects',()=>{
 let x=structuredClone(f.branches.left);x.stateEvidence.proof.storageProof[3].value='0x0';assert.throws(()=>check(x));
 x=structuredClone(f.branches.left);x.stateEvidence.proof.storageProof.pop();assert.throws(()=>check(x));
});
test('matching endpoint state cannot excuse changed signed approval caller',()=>{
 const x=structuredClone(f.branches.left),registry=x.history.addresses.registry;
 const tx=x.history.blocks.flatMap(b=>b.transactions).find(t=>t.transaction.to===registry && t.transaction.data.startsWith('0x095ea7b3'));
 assert.ok(tx);tx.transaction.from=x.policy.assumedEoaOwners[1];assert.throws(()=>check(x));
});
