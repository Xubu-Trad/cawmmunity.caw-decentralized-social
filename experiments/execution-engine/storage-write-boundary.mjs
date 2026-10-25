import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createEVM} from '@ethereumjs/evm';
import {Common, Mainnet, Hardfork} from '@ethereumjs/common';
import {SimpleStateManager} from '@ethereumjs/statemanager';
import {Account, createAddressFromString, hexToBytes, bytesToHex} from '@ethereumjs/util';

// Boundary probe only: injected bytecode, not signed-transaction replay.
assert.equal(process.argv.length, 3, 'Supply the repository root');
const root = pathToFileURL(resolve(process.argv[2]) + '/');
const {createReplayReadSession} = await import(new URL('reference/replay-read-session.mjs', root));
const {createReplayStorageOverlay} = await import(new URL('reference/replay-storage-overlay.mjs',root));
const input = JSON.parse(readFileSync(new URL('reference/fixtures/replay-input-binding.json', root))).input;
const address = input.dependencies.selection.dependencies[0].address;
const key = input.dependencies.selection.dependencies[0].storageKeys[0];
function environment(childCode) {
  const session = createReplayReadSession(JSON.stringify(input)), overlay=createReplayStorageOverlay(JSON.stringify(input));
  const bytes=q=>{const n=BigInt(q);if(n===0n)return new Uint8Array();const h=n.toString(16);return hexToBytes('0x'+(h.length%2?'0':'')+h);};
  class Reads extends SimpleStateManager {
    constructor(){super();this.originalStorageCache={get:async(a,k)=>bytes(overlay.originalStorage(a.toString(),bytesToHex(k))),clear:()=>{}};}
    async checkpoint(){overlay.checkpoint();await super.checkpoint();}
    async commit(){overlay.commit();await super.commit();}
    async revert(){overlay.revert();await super.revert();}
    async getAccount(a) {
      const p = session.account(a.toString());
      return new Account(BigInt(p.nonce), BigInt(p.balance), hexToBytes(p.storageHash), hexToBytes(p.codeHash));
    }
    async getCode(a) { session.code(a.toString()); return hexToBytes(childCode); }
    async getStorage(a,k) {
      const n = BigInt(overlay.storage(a.toString(),bytesToHex(k)));
      if (n === 0n) return new Uint8Array();
      const h = n.toString(16);return hexToBytes('0x'+(h.length % 2 ? '0' : '')+h);
    }
    async putAccount() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async putCode() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async putStorage(a,k,v) { overlay.putStorage(a.toString(),bytesToHex(k),'0x'+(v.length?BigInt(bytesToHex(v)):0n).toString(16)); }
    async deleteAccount() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async clearStorage() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
  }
  return {session,overlay,stateManager:new Reads()};
}
async function run(e,outerRevert=false){
 const evm=await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.London}),stateManager:e.stateManager});
 const tail=outerRevert?'5060006000fd':'60005260206000f3';
 const outer='0x602060006000600073'+address.slice(2)+'61fffff4'+tail;
 return evm.runCode({code:hexToBytes(outer),gasLimit:200000n,to:createAddressFromString(address),caller:createAddressFromString(address)});
}
const store='60017f'+key.slice(2)+'55';
const ok=environment('0x'+store+'00'),old=ok.overlay.originalStorage(address,key);
assert.notEqual(BigInt(old),1n,'write must change the selected slot');
const good=await run(ok);assert.equal(good.exceptionError,undefined);assert.equal(BigInt(bytesToHex(good.returnValue)),1n);
assert.equal(ok.overlay.storage(address,key),'0x1');assert.equal(ok.overlay.originalStorage(address,key),old);
const bad=environment('0x'+store+'60006000fd');
const reverted=await run(bad);assert.equal(reverted.exceptionError,undefined);assert.equal(BigInt(bytesToHex(reverted.returnValue)),0n);
assert.equal(bad.overlay.storage(address,key),old);bad.overlay.assertUsable();
// runCode is not runTx: the harness owns this enclosing frame explicitly.
const parent=environment('0x'+store+'00');parent.overlay.checkpoint();
const top=await run(parent,true);assert.equal(top.exceptionError.error,'revert');
parent.overlay.revert();assert.equal(parent.overlay.storage(address,key),old);
const missing=environment('0x'+store+'7f'+'ff'.repeat(32)+'5400');
await assert.rejects(run(missing),{code:'WITNESS_STATE_MISSING_SLOT'});
await missing.stateManager.revert();assert.throws(()=>missing.overlay.assertUsable(),{code:'REPLAY_STORAGE_FAILED'});
missing.overlay.discard();assert.throws(()=>missing.overlay.storage(address,key),{code:'REPLAY_STORAGE_CLOSED'});
console.log(JSON.stringify({checks:4,passed:4,profile:'London',scope:'injected nested SSTORE success/revert; harness parent rollback; missing evidence after write',signedTransactionReplay:false,gasAccountingVerified:false,executionVerified:false,productionAccepted:false}));
