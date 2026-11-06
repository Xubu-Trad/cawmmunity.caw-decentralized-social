import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectCapellaHeaderBinding } from '../reference/capella-header-binding.mjs';
const fixture=JSON.parse(readFileSync(new URL('../evidence/CAPELLA_BINDING_FIXTURE.json',import.meta.url)));
const input=()=>structuredClone(fixture.input);
const run=p=>inspectCapellaHeaderBinding(JSON.stringify(p),fixture.selectedBeaconRoot);
test('synthetic complete linkage passes without authentication',()=>{
 const r=run(input());assert.equal(r.structuralBindingVerified,true);
 for(const k of ['rootAuthenticated','forkScheduleVerified','executionVerified','consensusVerified','finalityVerified','productionAccepted'])assert.equal(r[k],false);
 assert.ok(Object.isFrozen(r));
});
test('payload field change rejects before inclusion can bless it',()=>{const p=input();p.execution.timestamp='0';assert.throws(()=>run(p),/ROOT_MISMATCH/);});
test('another valid payload and its valid root reject under original branch',()=>{
 const v=JSON.parse(readFileSync(new URL('../evidence/consensus-capella-payload/vectors.json',import.meta.url))).cases[1];
 const p=input();p.execution=v.header;p.executionRoot=v.root;assert.throws(()=>run(p),/ROOT_MISMATCH/);
});
test('changed or reversed branch rejects',()=>{
 const p=input();p.executionBranch[0]='0x'+'ff'.repeat(32);assert.throws(()=>run(p),/ROOT_MISMATCH/);
 const q=input();q.executionBranch.reverse();assert.throws(()=>run(q),/ROOT_MISMATCH/);
});
test('changed beacon body or selected root rejects',()=>{
 const p=input();p.beacon.body_root='0x'+'00'.repeat(32);assert.throws(()=>run(p),/ROOT_MISMATCH/);
 assert.throws(()=>inspectCapellaHeaderBinding(JSON.stringify(input()),'0x'+'00'.repeat(32)),/ROOT_MISMATCH/);
});
test('caller cannot change proof position, body root or add authority flags',()=>{
 for(const [k,v]of [['index',8],['bodyRoot',fixture.input.beacon.body_root],['finalityVerified',true]]){
  const p=input();p[k]=v;assert.throws(()=>run(p),/schema rejected/);
 }
});
test('unknown profile and incomplete proof reject',()=>{
 const p=input();p.profile='deneb';assert.throws(()=>run(p),/schema rejected/);
 const q=input();q.executionBranch.pop();assert.throws(()=>run(q),/BRANCH_LENGTH/);
});
