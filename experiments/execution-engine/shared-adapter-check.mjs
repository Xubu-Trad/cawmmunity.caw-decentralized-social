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
console.log(JSON.stringify({checks:34,passed:34,scope:'26 acquired replay cases through shared adapter plus eight unsupported-method poison checks',productionAccepted:false}));
