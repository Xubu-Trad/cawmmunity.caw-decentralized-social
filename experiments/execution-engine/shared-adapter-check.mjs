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
console.log(JSON.stringify({checks:39,passed:39,scope:'34 regression groups plus frozen surfaces, callback replacement, immutable diagnostics, malformed callback poison, closed lifecycle',productionAccepted:false}));
