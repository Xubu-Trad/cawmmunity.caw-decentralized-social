import assert from 'node:assert/strict';
import {bytesToHex,createAddressFromString,hexToBytes} from '@ethereumjs/util';
import {RLP} from '@ethereumjs/rlp';
import {openSlots,replayStorage} from './diagnose-stake-root.mjs';

// The execution trace supplies candidate keys. Only a header-bound proof can establish a leaf.
export function trackStorageAccess(vm){
  const candidates=new Map();
  vm.evm.events.on('step',step=>{
    if(step.opcode.name!=='SSTORE' && step.opcode.name!=='SLOAD') return;
    const address=step.address.toString();
    if(!candidates.has(address)) candidates.set(address,new Map());
    const keys=candidates.get(address);
    const key='0x'+step.stack.at(-1).toString(16).padStart(64,'0');
    keys.set(key,keys.get(key)===true || step.opcode.name==='SSTORE');
  });
  return candidates;
}

export async function explainZeroLeaves(rpc,block,state,alloc,candidates,previous){
  const original=bytesToHex(await state.getStateRoot());
  const copy=state.shallowCopy(),active=[],readOnly=[];
  for(const [address,slots] of candidates){
    const keys=[...slots.keys()],inserted=[];
    const source=await openSlots(rpc,block,address,keys);
    const storage=await replayStorage(alloc,address);
    const account=createAddressFromString(address);
    assert.equal(bytesToHex(storage.root()),bytesToHex((await state.getAccount(account)).storageRoot));
    for(const [i,key] of keys.entries()){
      const path=hexToBytes(key),raw=await storage.get(path);
      const replay=raw===null?null:bytesToHex(raw);
      if(source.leaves[i]===replay) continue;
      assert.equal(replay,null,'unexpected replay leaf');
      assert.equal(source.leaves[i],'0x80','unexpected source leaf');
      await storage.put(path,RLP.encode(new Uint8Array()));
      inserted.push(key);
      const id=address+'/'+key;
      active.push(id);
      if(!slots.get(key)) readOnly.push(id);
    }
    assert.equal(bytesToHex(storage.root()),source.storageRoot,'unexplained contract storage');
    // Omit one leaf at a time while retaining every other identified difference.
    for(const key of inserted){
      const path=hexToBytes(key);
      await storage.del(path);
      assert.notEqual(bytesToHex(storage.root()),source.storageRoot,'redundant zero leaf');
      await storage.put(path,RLP.encode(new Uint8Array()));
    }
    await copy.modifyAccountFields(account,{storageRoot:storage.root()});
  }
  assert.equal(bytesToHex(await copy.getStateRoot()),block.stateRoot,'unexplained world state');
  assert.equal(bytesToHex(await state.getStateRoot()),original,'diagnosis changed replay state');
  return {height:Number(BigInt(block.number)),block:block.hash,replayRoot:original,sourceRoot:block.stateRoot,
    readOnly,added:active.filter(k=>!previous.includes(k)),removed:previous.filter(k=>!active.includes(k)),active};
}
