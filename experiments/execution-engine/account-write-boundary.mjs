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
  let failed=false,writes=0;
  function healthy(){assert.equal(failed,false,'ACCOUNT_ADAPTER_FAILED');session.assertUsable();overlay.assertUsable();}
  const bytes=q=>{const n=BigInt(q);if(n===0n)return new Uint8Array();const h=n.toString(16);return hexToBytes('0x'+(h.length%2?'0':'')+h);};
  class Reads extends SimpleStateManager {
    constructor(){super();this.originalStorageCache={get:async(a,k)=>bytes(overlay.originalStorage(a.toString(),bytesToHex(k))),clear:()=>{}};}
    async checkpoint(){overlay.checkpoint();await super.checkpoint();}
    async commit(){overlay.commit();await super.commit();}
    async revert(){overlay.revert();await super.revert();}
    async getAccount(a) {
      healthy();const p = overlay.account(a.toString());
      return new Account(BigInt(p.nonce), BigInt(p.balance), hexToBytes(p.storageHash), hexToBytes(p.codeHash));
    }
    async getCode(a) { session.code(a.toString()); return hexToBytes(childCode); }
    async getStorage(a,k) {
      const n = BigInt(overlay.storage(a.toString(),bytesToHex(k)));
      if (n === 0n) return new Uint8Array();
      const h = n.toString(16);return hexToBytes('0x'+(h.length % 2 ? '0' : '')+h);
    }
    async putAccount(a,value) {
      try {
        healthy();const original=overlay.originalAccount(a.toString());
        assert.ok(value instanceof Account,'ACCOUNT_REQUIRED');
        assert.equal(bytesToHex(value.codeHash),original.codeHash,'CODE_CHANGE');
        assert.equal(bytesToHex(value.storageRoot),original.storageHash,'ROOT_CHANGE');
        assert.equal(value.version,0,'VERSION_CHANGE');assert.equal(value.codeSize,0,'CODE_SIZE_CHANGE');
        overlay.putAccount(a.toString(),'0x'+value.nonce.toString(16),'0x'+value.balance.toString(16));writes++;
      } catch(error){failed=true;throw error;}
    }
    async putCode() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async putStorage(a,k,v) { overlay.putStorage(a.toString(),bytesToHex(k),'0x'+(v.length?BigInt(bytesToHex(v)):0n).toString(16)); }
    async deleteAccount() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async clearStorage() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
  }
  return {session,overlay,stateManager:new Reads(),healthy,writes:()=>writes};
}
const addr=createAddressFromString(address);
const positive=environment('0x00'),before=await positive.stateManager.getAccount(addr);
const newNonce=before.nonce+1n,newBalance=before.balance+1n;
before.nonce=newNonce;before.balance=newBalance;await positive.stateManager.putAccount(addr,before);
const changed=await positive.stateManager.getAccount(addr);assert.equal(changed.nonce,newNonce);assert.equal(changed.balance,newBalance);
before.balance=0n;assert.equal((await positive.stateManager.getAccount(addr)).balance,newBalance);positive.healthy();
const rollback=environment('0x00'),old=rollback.overlay.account(address),slot=rollback.overlay.storage(address,key);
await rollback.stateManager.checkpoint();const a=await rollback.stateManager.getAccount(addr);a.nonce+=1n;a.balance+=1n;
await rollback.stateManager.putAccount(addr,a);await rollback.stateManager.putStorage(addr,hexToBytes(key),hexToBytes('0x01'));
await rollback.stateManager.revert();assert.deepEqual(rollback.overlay.account(address),old);assert.equal(rollback.overlay.storage(address,key),slot);
for(const mutation of ['code','root','delete','unknown','version','size']){
 const e=environment('0x00');await e.stateManager.checkpoint();let value=await e.stateManager.getAccount(addr),target=addr;
 if(mutation==='code')value.codeHash=hexToBytes('0x'+'ff'.repeat(32));
 if(mutation==='root')value.storageRoot=hexToBytes('0x'+'ff'.repeat(32));
 if(mutation==='delete')value=undefined;
 if(mutation==='unknown')target=createAddressFromString('0x'+'ff'.repeat(20));
 if(mutation==='version')value.version=1;
 if(mutation==='size')value.codeSize=1;
 await assert.rejects(e.stateManager.putAccount(target,value));await e.stateManager.revert();assert.throws(()=>e.healthy());
}
// Zero-value CALL to the existing selected account exercises real engine account callbacks.
const call=environment('0x00'),initial=call.overlay.account(address);
const evm=await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.London}),stateManager:call.stateManager});
const outer='0x6020600060006000600073'+address.slice(2)+'61fffff160005260206000f3';
const result=await evm.runCode({code:hexToBytes(outer),gasLimit:200000n,to:addr,caller:addr});
assert.equal(result.exceptionError,undefined);assert.equal(BigInt(bytesToHex(result.returnValue)),1n);assert.ok(call.writes()>0);
assert.deepEqual(call.overlay.account(address),initial);call.healthy();
console.log(JSON.stringify({checks:9,passed:9,engineAccountCallbacks:call.writes(),scope:'existing-account fields, defensive copies, paired rollback, six unsupported changes, zero-value self CALL',signedTransactionReplay:false,valueTransferVerified:false,executionVerified:false,productionAccepted:false}));
