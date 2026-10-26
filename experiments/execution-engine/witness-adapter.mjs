import assert from 'node:assert/strict';
import {SimpleStateManager} from '@ethereumjs/statemanager';
import {Account,hexToBytes,bytesToHex} from '@ethereumjs/util';
// Existing proven accounts/selected slots only. Experimental, not a complete StateManager.
export async function loadWitnessAdapter(root){
 const {createReplayReadSession}=await import(new URL('reference/replay-read-session.mjs',root));
 const {createReplayStorageOverlay}=await import(new URL('reference/replay-storage-overlay.mjs',root));
return function environment(selectedInput) {
  const session = createReplayReadSession(JSON.stringify(selectedInput)), overlay=createReplayStorageOverlay(JSON.stringify(selectedInput));
  let failed=false,writes=0,reverts=0;const storageWrites=[];
  function healthy(){assert.equal(failed,false,'ACCOUNT_ADAPTER_FAILED');session.assertUsable();overlay.assertUsable();}
  const bytes=q=>{const n=BigInt(q);if(n===0n)return new Uint8Array();const h=n.toString(16);return hexToBytes('0x'+(h.length%2?'0':'')+h);};
  function unsupported(){failed=true;throw new Error('WITNESS_ADAPTER_UNSUPPORTED');}
  class Reads extends SimpleStateManager {
    constructor(){super();this.originalStorageCache={get:async(a,k)=>{healthy();return bytes(overlay.originalStorage(a.toString(),bytesToHex(k)));},clear:()=>{}};}
    async checkpoint(){healthy();overlay.checkpoint();await super.checkpoint();}
    async commit(){healthy();overlay.commit();await super.commit();}
    async revert(){overlay.revert();await super.revert();reverts++;}
    async getAccount(a) {
      healthy();const p = overlay.account(a.toString());
      return new Account(BigInt(p.nonce), BigInt(p.balance), hexToBytes(p.storageHash), hexToBytes(p.codeHash));
    }
    async getCode(a) { healthy();return hexToBytes(session.code(a.toString())); }
    async getStorage(a,k) {
      healthy();
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
    async putCode() { failed=true;throw new Error('WITNESS_ADAPTER_UNSUPPORTED'); }
    async putStorage(a,k,v) { healthy();overlay.putStorage(a.toString(),bytesToHex(k),'0x'+(v.length?BigInt(bytesToHex(v)):0n).toString(16));storageWrites.push({address:a.toString(),key:bytesToHex(k),value:bytesToHex(v)}); }
    async deleteAccount() { failed=true;throw new Error('WITNESS_ADAPTER_UNSUPPORTED'); }
    getStateRoot(){return unsupported();}
    setStateRoot(){return unsupported();}
    hasStateRoot(){return unsupported();}
    shallowCopy(){return unsupported();}
    consumeBAL(){return unsupported();}
    async clearStorage() { failed=true;throw new Error('WITNESS_ADAPTER_UNSUPPORTED'); }
  }
  return {session,overlay,stateManager:new Reads(),healthy,writes:()=>writes,storageWrites,reverts:()=>reverts};
}

}
