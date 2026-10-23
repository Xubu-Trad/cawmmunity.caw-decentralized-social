import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectHeaderBoundCode } from '../reference/header-bound-state-proof.mjs';

const capture=JSON.parse(readFileSync(new URL('../reference/fixtures/caw-token-drpc.json',import.meta.url),'utf8'));
function fixture() {
  const result = label => structuredClone(capture.calls.find(c=>c.label===label).response.result);
  return {evidence:{header:result('block_before'),proof:result('account_proof'),code:result('runtime')},
    selection:{schema:'caw-header-code-selection/1',profile:'prague-21',
      hash:'0xf3e3dfad2242562dbed62de90831c39eace7c7c6e88f8c509afccef9a5f73e4d',
      address:'0xf3b9569f82b18aef890de263b84189bd33ebe452',storageKeys:[],
      expectedCodeHash:'0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256'}};
}
const check=f=>inspectHeaderBoundCode(JSON.stringify(f.evidence),JSON.stringify(f.selection));
test('retained runtime matches both proven code hash and separate expected hash',()=>{
 const f=fixture(),r=check(f);assert.equal(r.codeMatchesSelectedState,true);assert.equal(r.expectedCodeHashMatched,true);
 assert.equal(r.codeHash,f.selection.expectedCodeHash);assert.equal(r.codeBytes,(f.evidence.code.length-2)/2);
 assert.equal(r.state.selectedHeaderBindingVerified,true);assert.ok(Object.isFrozen(r));
 for(const k of ['sourceReproductionVerified','dependenciesVerified','accountAuthorityVerified','executionVerified','endpointAuthenticated','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(r[k],false);
});
test('changed runtime rejects despite intact header and account proof',()=>{
 const f=fixture();f.evidence.code=f.evidence.code.slice(0,-2)+'ff';
 assert.throws(()=>check(f),{code:'HEADER_STATE_CODE_HASH'});
});
test('different expected code identity rejects an otherwise valid package',()=>{
 const f=fixture();f.selection.expectedCodeHash='0x'+'00'.repeat(32);
 assert.throws(()=>check(f),{code:'HEADER_STATE_CODE_SELECTION'});
});
test('empty runtime cannot stand in for retained contract code',()=>{
 const f=fixture();f.evidence.code='0x';assert.throws(()=>check(f),{code:'HEADER_STATE_CODE_HASH'});
});
test('malformed and oversized runtime bytes reject',()=>{
 for(const code of ['0x0','0xAB',42,'0x'+'00'.repeat(65537)]){
  const f=fixture();f.evidence.code=code;assert.throws(()=>check(f),{code:'KECCAK_INPUT'});
 }
});
test('missing identity or code does not select an unchecked fallback',()=>{
 const f=fixture();delete f.selection.expectedCodeHash;assert.throws(()=>check(f),{code:'HEADER_STATE_SCHEMA'});
 const g=fixture();delete g.evidence.code;assert.throws(()=>check(g),{code:'HEADER_STATE_SCHEMA'});
});
test('forged account codeHash is rejected by account proof verifier',()=>{
 const f=fixture();f.evidence.proof.codeHash='0x'+'00'.repeat(32);assert.throws(()=>check(f),{code:'ETH_PROOF_CLAIM'});
});
test('added authority claims and duplicate code fields reject',()=>{
 const f=fixture();f.evidence.authorized=true;assert.throws(()=>check(f),{code:'HEADER_STATE_SCHEMA'});
 const g=fixture();assert.throws(()=>inspectHeaderBoundCode(JSON.stringify(g.evidence).replace('"code":','"code":"0x","code":'),JSON.stringify(g.selection)));
});
