import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadWitnessAdapter} from './witness-adapter.mjs';
import {createAddressFromString,hexToBytes} from '@ethereumjs/util';
const root=pathToFileURL(resolve(process.argv[2])+'/');
await import('./shared-signed-transfer-replay.mjs');
await import('./shared-missing-witness-replay.mjs');
await import('./shared-signed-contract-replay.mjs');
await import('./shared-signed-revert-replay.mjs');
await import('./shared-signed-clear-replay.mjs');
await import('./shared-signed-cap-replay.mjs');

const create=await loadWitnessAdapter(root);
const input=JSON.parse(readFileSync(new URL('reference/fixtures/replay-input-binding.json',root))).input;
for(const method of ['putCode','deleteAccount','clearStorage','getStateRoot','setStateRoot','hasStateRoot','shallowCopy','consumeBAL']){
 const e=create(input);await e.stateManager.checkpoint();
 await assert.rejects(async()=>e.stateManager[method](),/WITNESS_ADAPTER_UNSUPPORTED/);
 await e.stateManager.revert();assert.throws(()=>e.healthy());
 const d=input.dependencies.selection.dependencies[0],a=createAddressFromString(d.address),k=hexToBytes(d.storageKeys[0]);
 await assert.rejects(e.stateManager.getStorage(a,k));
 await assert.rejects(e.stateManager.putStorage(a,k,hexToBytes('0x01')));
 await assert.rejects(e.stateManager.checkpoint());
}

const d=input.dependencies.selection.dependencies[0],a=createAddressFromString(d.address),k=hexToBytes(d.storageKeys[0]);
const isolated=create(input);
assert.equal(isolated.session,undefined);assert.equal(isolated.overlay.putAccount,undefined);
assert.equal(isolated.stateManager.accountStack,undefined);assert.equal(isolated.stateManager.topAccountStack,undefined);
assert.ok(Object.isFrozen(isolated)&&Object.isFrozen(isolated.overlay)&&Object.isFrozen(isolated.stateManager));
assert.ok(Object.isFrozen(isolated.stateManager.originalStorageCache));
assert.throws(()=>{isolated.stateManager.getAccount=()=>undefined;},TypeError);
assert.throws(()=>{isolated.stateManager.originalStorageCache.get=()=>new Uint8Array();},TypeError);
await isolated.stateManager.putStorage(a,k,hexToBytes('0x01'));
const events=isolated.storageWrites;assert.ok(Object.isFrozen(events)&&Object.isFrozen(events[0]));
assert.throws(()=>{events[0].value='0xff';},TypeError);assert.equal(isolated.storageWrites[0].value,'0x01');
const malformed=create(input);await assert.rejects(malformed.stateManager.getAccount(null));
assert.throws(()=>malformed.healthy());assert.throws(()=>malformed.overlay.account(d.address));
await assert.rejects(malformed.stateManager.originalStorageCache.get(a,k));
const closed=create(input);closed.overlay.discard();await assert.rejects(closed.stateManager.getAccount(a));assert.throws(()=>closed.healthy());

const badCalls=[
 e=>e.stateManager.getAccount({toString:()=>d.address}),
 e=>e.stateManager.getAccount(a,'extra'),
 e=>e.stateManager.checkpoint('extra'),
 e=>e.stateManager.getStorage(a,new Uint8Array(31)),
 e=>e.stateManager.getStorage(a,new Uint8Array(33)),
 e=>e.stateManager.putStorage(a,k,[]),
 e=>e.stateManager.putStorage(a,k,new Uint8Array(33)),
 e=>e.stateManager.originalStorageCache.get(a,new Uint8Array(31)),
];
for(const call of badCalls){const e=create(input);await assert.rejects(call(e));assert.throws(()=>e.healthy());assert.equal(e.storageWrites.length,0);}
const bounded=create(input);
for(let i=0;i<256;i++)await bounded.stateManager.putStorage(a,k,hexToBytes('0x01'));
assert.equal(bounded.storageWrites.length,256);bounded.healthy();
await assert.rejects(bounded.stateManager.putStorage(a,k,hexToBytes('0x02')),/STORAGE_DIAGNOSTIC_LIMIT/);
assert.equal(bounded.storageWrites.length,256);assert.throws(()=>bounded.healthy());
const rolled=create(input);await rolled.stateManager.checkpoint();
for(let i=0;i<256;i++)await rolled.stateManager.putStorage(a,k,new Uint8Array());
await rolled.stateManager.revert();rolled.healthy();
await assert.rejects(rolled.stateManager.putStorage(a,k,new Uint8Array()),/STORAGE_DIAGNOSTIC_LIMIT/);
assert.equal(rolled.storageWrites.length,256);assert.throws(()=>rolled.healthy());
const exhausted=create(input);
for(let i=0;i<4096;i++)await exhausted.stateManager.getAccount(a);
exhausted.healthy();await assert.rejects(exhausted.stateManager.getAccount(a),/CALLBACK_LIMIT/);
assert.throws(()=>exhausted.healthy());
const cleanup=create(input);await cleanup.stateManager.checkpoint();
for(let i=0;i<4095;i++)await cleanup.stateManager.originalStorageCache.get(a,k);
await assert.rejects(cleanup.stateManager.getAccount(a),/CALLBACK_LIMIT/);
await cleanup.stateManager.revert();assert.throws(()=>cleanup.healthy());
await assert.rejects(cleanup.stateManager.checkpoint());
console.log(JSON.stringify({checks:51,passed:51,scope:'49 prior groups plus shared callback-budget boundary and cleanup after exhaustion',productionAccepted:false}));
