import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectHeaderBoundStateProof } from '../reference/header-bound-state-proof.mjs';

const captures = ['publicnode','drpc'].map(name => JSON.parse(readFileSync(new URL(
  '../reference/fixtures/caw-token-' + name + '.json', import.meta.url), 'utf8')));
function fixture(capture = captures[1]) {
  const result = label => structuredClone(capture.calls.find(c => c.label === label).response.result);
  return { evidence: { header: result('block_before'), proof: result('account_proof') },
    selection: { schema: 'caw-header-state-selection/1', profile: 'prague-21',
      hash: '0xf3e3dfad2242562dbed62de90831c39eace7c7c6e88f8c509afccef9a5f73e4d',
      address: '0xf3b9569f82b18aef890de263b84189bd33ebe452', storageKeys: [] } };
}
const check = f => inspectHeaderBoundStateProof(JSON.stringify(f.evidence),JSON.stringify(f.selection));
const fails = f => assert.throws(() => check(f));
test('retained historical proof binds to its recomputed selected header', () => {
  for (const capture of [captures[1]]) {
    const r=check(fixture(capture));
    assert.equal(r.selectedHeaderBindingVerified,true); assert.equal(r.proof.proofVerified,true);
    assert.equal(r.proof.stateRoot,r.header.stateRoot);
    assert.equal(r.proof.codeHash,'0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256');
    for (const key of ['endpointAuthenticated','consensusVerified','finalityVerified','freshnessVerified','accountAuthorityVerified','executionVerified','productionAccepted']) assert.equal(r[key],false);
    assert.equal(r.proof.rootAuthenticated,false); assert.equal(r.proof.blockBindingProven,false);
    assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.header)); assert.ok(Object.isFrozen(r.proof));
  }
});
test('retained provider proof-window failure remains unavailable evidence', () => {
  const response=captures[0].calls.find(c=>c.label==='account_proof').response;
  assert.equal(response.result,undefined);assert.match(response.error.message,/proof window/);
  assert.throws(()=>check(fixture(captures[0])),{code:'HEADER_STATE_SCHEMA'});
});
test('wrong retained block selection rejects', () => { const f=fixture();f.selection.hash='0x'+'00'.repeat(32);fails(f); });
test('modified header state root rejects', () => { const f=fixture();f.evidence.header.stateRoot='0x'+'00'.repeat(32);fails(f); });
test('valid proof for unrelated synthetic root cannot be substituted', () => {
  const f=fixture();const other=JSON.parse(readFileSync(new URL('../reference/fixtures/ethereum-state-proof-v1.json',import.meta.url),'utf8')).state_cases.find(c=>c.name==='account-and-three-slots-plus-absence');
  f.evidence.proof=other.proof;f.selection.address=other.trusted.address;f.selection.storageKeys=other.trusted.storageKeys;fails(f);
});
test('wrong selected account rejects', () => { const f=fixture();f.selection.address='0x'+'01'.repeat(20);fails(f); });
test('missing requested storage proof rejects', () => { const f=fixture();f.selection.storageKeys=['0x0'];fails(f); });
test('unsupported or mismatched fork layout rejects', () => { const f=fixture();f.selection.profile='london-16';fails(f);f.selection.profile='auto';fails(f); });
test('caller cannot override the header root or add trust flags', () => { const f=fixture();f.selection.stateRoot=f.evidence.header.stateRoot;fails(f);delete f.selection.stateRoot;f.evidence.endpointAuthenticated=true;fails(f); });
test('duplicate JSON keys and non-text input reject', () => {
  const f=fixture();const e=JSON.stringify(f.evidence),s=JSON.stringify(f.selection);
  assert.throws(()=>inspectHeaderBoundStateProof(e,s.replace('"schema":','"schema":"shadow","schema":')));
  assert.throws(()=>inspectHeaderBoundStateProof(f.evidence,s));
  assert.throws(()=>inspectHeaderBoundStateProof(e+' '.repeat(262144),s));
});
