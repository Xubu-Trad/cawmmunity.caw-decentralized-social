import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectTestRegistryState } from '../reference/test-registry-state.mjs';
import { keccak256Hex } from '../reference/keccak256.mjs';
const raw=readFileSync(new URL('../reference/fixtures/registry-state-v1.json',import.meta.url));
const f=JSON.parse(raw);const item=name=>structuredClone(f.cases.find(c=>c.name===name));
const check=c=>inspectTestRegistryState(JSON.stringify(c.evidence),JSON.stringify(c.selection));
test('synthetic fixtures and runtime identity remain pinned',()=>{
 assert.equal(f.synthetic,true);assert.equal(createHash('sha256').update(raw).digest('hex'),'674fcbb4fa51799a7dbf57253fd124f2eb26d9193a517b9e983ef324899be76c');
 const build=JSON.parse(readFileSync(new URL('../experiments/account-authority/authority-build.json',import.meta.url)));
 assert.equal(keccak256Hex(build.contracts.TestAccountRegistry.runtime),f.runtimeCodeHash);
});
for(const name of ['owner-a-zero-epoch','owner-b-epoch-two','maximum-epoch'])test(name+' decodes only selected-state owner and epoch',()=>{
 const c=item(name),r=check(c);assert.equal(r.owner,'0x'+BigInt(c.owner).toString(16).padStart(40,'0'));assert.equal(r.epoch,c.epoch);assert.deepEqual(r.storageKeys,c.keys);
 assert.equal(r.selectedStateDecoded,true);assert.equal(r.codeMatchesFixture,true);assert.ok(Object.isFrozen(r));
 for(const k of ['accountAuthorityVerified','transactionPermissionVerified','currentPermissionVerified','approvalsVerified','executionVerified','endpointAuthenticated','consensusVerified','finalityVerified','freshnessVerified','productionAccepted'])assert.equal(r[k],false);
});
for(const name of ['zero-owner','oversized-owner'])test(name+' rejects despite a structurally valid proof',()=>{assert.throws(()=>check(item(name)),{code:'REGISTRY_STATE_OWNER'});});
test('missing epoch witness rejects',()=>{const c=item('owner-a-zero-epoch');c.evidence.proof.storageProof.pop();assert.throws(()=>check(c));});
test('wrong account cannot reuse the original storage proof',()=>{const c=item('owner-a-zero-epoch');c.selection.accountId='0x2';assert.throws(()=>check(c));});
test('out-of-fixture or noncanonical account IDs reject',()=>{for(const id of ['0x0','0x4','0x01',1]){const c=item('owner-a-zero-epoch');c.selection.accountId=id;assert.throws(()=>check(c),{code:'REGISTRY_STATE_ACCOUNT'});}});
test('changing claimed owner without changing witness rejects',()=>{const c=item('owner-a-zero-epoch');c.evidence.proof.storageProof[0].value='0x1';assert.throws(()=>check(c));});
test('different runtime cannot be selected by caller',()=>{const c=item('owner-a-zero-epoch');c.evidence.code='0x';assert.throws(()=>check(c));c.selection.expectedCodeHash='0x'+'00'.repeat(32);assert.throws(()=>check(c),{code:'REGISTRY_STATE_SCHEMA'});});
test('proof for another state does not match selected header',()=>{const c=item('owner-a-zero-epoch');c.evidence.proof=item('owner-b-epoch-two').evidence.proof;assert.throws(()=>check(c));});

