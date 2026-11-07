import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectMinimalCapellaBootstrap} from '../reference/minimal-capella-bootstrap.mjs';
const f=JSON.parse(readFileSync(new URL('../evidence/consensus-capella-bootstrap/binding.json',import.meta.url)));
const input=()=>({schema:'caw-minimal-capella-bootstrap/1',profile:'minimal-capella-32-structural-only',header:structuredClone(f.input),committee:structuredClone(f.committee),committeeBranch:[...f.committeeBranch]});
const run=p=>inspectMinimalCapellaBootstrap(JSON.stringify(p),f.selectedBeaconRoot);
test('official minimal fixture committee binds to selected beacon state',()=>{
 const r=run(input());assert.equal(r.committeeInclusionVerified,true);assert.equal(r.structuralBindingVerified,true);
 for(const k of ['publicKeysValidated','aggregatePubkeyValidated','signaturesVerified','rootAuthenticated','forkScheduleVerified','consensusVerified','finalityVerified','productionAccepted'])assert.equal(r[k],false);
 assert.ok(Object.isFrozen(r));
});
test('changed committee member or aggregate rejects',()=>{
 for(const aggregate of [false,true]){const p=input();if(aggregate)p.committee.aggregate_pubkey='0x'+'ff'.repeat(48);else p.committee.pubkeys[0]='0x'+'ff'.repeat(48);assert.throws(()=>run(p),/ROOT_MISMATCH/);}
});
test('wrong committee size and key encoding reject',()=>{
 const p=input();p.committee.pubkeys.pop();assert.throws(()=>run(p),/schema rejected/);
 const q=input();q.committee.pubkeys[0]='0x00';assert.throws(()=>run(q),/schema rejected/);
});
test('altered committee branch rejects',()=>{const p=input();p.committeeBranch[0]='0x'+'ff'.repeat(32);assert.throws(()=>run(p),/ROOT_MISMATCH/);});
test('supplied state root cannot bypass header commitment',()=>{const p=input();p.header.beacon.state_root='0x'+'ff'.repeat(32);assert.throws(()=>run(p),/ROOT_MISMATCH/);});
test('unsupported profile, proof index and trust claims reject',()=>{
 const p=input();p.profile='mainnet';assert.throws(()=>run(p),/schema rejected/);
 for(const k of ['index','rootAuthenticated']){const q=input();q[k]=true;assert.throws(()=>run(q),/schema rejected/);}
});
