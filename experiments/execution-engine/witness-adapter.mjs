import assert from 'node:assert/strict';
import {Address,Account,hexToBytes,bytesToHex} from '@ethereumjs/util';
// Existing proven accounts/selected slots only. Experimental, not a complete StateManager.
export async function loadWitnessAdapter(root){
 const {createReplayReadSession}=await import(new URL('reference/replay-read-session.mjs',root));
 const {createReplayStorageOverlay}=await import(new URL('reference/replay-storage-overlay.mjs',root));
return function environment(selectedInput) {
  const session = createReplayReadSession(JSON.stringify(selectedInput)), overlay=createReplayStorageOverlay(JSON.stringify(selectedInput));
  let failed=false,writes=0,reverts=0,callbackCount=0;const storageWrites=[];
  function limit(ok,message){if(!ok){const e=new Error(message);e.code='WITNESS_ADAPTER_LIMIT';throw e;}}
  function consume(){limit(callbackCount<4096,'CALLBACK_LIMIT');callbackCount++;}
  function healthy(){assert.equal(failed,false,'ACCOUNT_ADAPTER_FAILED');session.assertUsable();overlay.assertUsable();}
  const bytes=q=>{const n=BigInt(q);if(n===0n)return new Uint8Array();const h=n.toString(16);return hexToBytes('0x'+(h.length%2?'0':'')+h);};
  function unsupported(){failed=true;const e=new Error('WITNESS_ADAPTER_UNSUPPORTED');e.code='WITNESS_ADAPTER_UNSUPPORTED';throw e;}
  const arities={checkpoint:0,commit:0,revert:0,getAccount:1,getCode:1,getStorage:2,putAccount:2,putStorage:3};
  function validate(name,args){
    if(!(name in arities))return;
    assert.equal(args.length,arities[name],'CALLBACK_ARGUMENTS');
    if(arities[name]===0)return;
    assert.ok(args[0] && args[0].bytes instanceof Uint8Array && args[0].bytes.length===20,'CALLBACK_ADDRESS');
    const addressBytes=new Uint8Array(args[0].bytes);
    assert.equal(args[0].toString(),bytesToHex(addressBytes),'CALLBACK_ADDRESS_TEXT');
    args[0]=new Address(addressBytes);
    if(name==='getStorage'||name==='putStorage')assert.ok(args[1] instanceof Uint8Array && args[1].length===32,'CALLBACK_SLOT');
    if(name==='putStorage')assert.ok(args[2] instanceof Uint8Array && args[2].length<=32,'CALLBACK_VALUE');
  }
  class Reads {
    constructor(){this.originalStorageCache={get:async(a,k)=>{healthy();return bytes(overlay.originalStorage(a.toString(),bytesToHex(k)));},clear:()=>{}};}
    async checkpoint(){healthy();overlay.checkpoint();}
    async commit(){healthy();overlay.commit();}
    async revert(){overlay.revert();reverts++;}
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
    async putCode() { return unsupported(); }
    async putStorage(a,k,v) { healthy();limit(storageWrites.length<256,'STORAGE_DIAGNOSTIC_LIMIT');overlay.putStorage(a.toString(),bytesToHex(k),'0x'+(v.length?BigInt(bytesToHex(v)):0n).toString(16));storageWrites.push({address:a.toString(),key:bytesToHex(k),value:bytesToHex(v)}); }
    async deleteAccount() { return unsupported(); }
    getStateRoot(){return unsupported();}
    setStateRoot(){return unsupported();}
    hasStateRoot(){return unsupported();}
    shallowCopy(){return unsupported();}
    consumeBAL(){return unsupported();}
    async clearStorage() { return unsupported(); }
  }
  // Only the explicit callback surface is exposed; no inherited mutable cache stacks.
  const internal=new Reads(),stateManager={};
  for(const name of Object.getOwnPropertyNames(Reads.prototype)){
    if(name==='constructor')continue;
    stateManager[name]=async(...args)=>{
      try { if(name!=='revert'){healthy();consume();}validate(name,args);return await internal[name](...args); }
      catch(error){failed=true;throw error;}
    };
  }
  stateManager.originalStorageCache=Object.freeze({
    get:async(...args)=>{try{healthy();consume();validate('getStorage',args);return await internal.originalStorageCache.get(...args);}catch(error){failed=true;throw error;}},
    clear:()=>{},
  });
  Object.freeze(stateManager);
  const view=Object.freeze({
    account:(...args)=>{healthy();return overlay.account(...args);},
    originalAccount:(...args)=>{healthy();return overlay.originalAccount(...args);},
    storage:(...args)=>{healthy();return overlay.storage(...args);},
    originalStorage:(...args)=>{healthy();return overlay.originalStorage(...args);},
    discard:()=>overlay.discard(),
  });
  return Object.freeze({overlay:view,stateManager,healthy,writes:()=>writes,
    get storageWrites(){return Object.freeze(storageWrites.map(x=>Object.freeze({...x})));},reverts:()=>reverts});
}

}
