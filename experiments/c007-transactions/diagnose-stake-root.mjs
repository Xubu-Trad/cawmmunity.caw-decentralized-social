import assert from 'node:assert/strict';
import {createMPT,verifyMPTWithMerkleProof} from '@ethereumjs/mpt';
import {RLP} from '@ethereumjs/rlp';
import {bytesToHex,hexToBytes,createAddressFromString} from '@ethereumjs/util';
import {keccak_256} from '@noble/hashes/sha3.js';

function mappingSlot(key,index){
  return bytesToHex(keccak_256(hexToBytes('0x'+key.padStart(64,'0')+index.toString(16).padStart(64,'0'))));
}

// Open the registry account against the block header, then its four storage paths.
async function openSlots(rpc,header,address,keys){
  const proof=await rpc('eth_getProof',[address,keys,header.number]);
  const trie=await createMPT({useKeyHashing:true});
  const verify=(root,key,nodes)=>verifyMPTWithMerkleProof(trie,hexToBytes(root),hexToBytes(key),nodes.map(hex=>hexToBytes(hex)));
  const account=RLP.decode(await verify(header.stateRoot,address,proof.accountProof));
  assert.equal(bytesToHex(account[2]),proof.storageHash);
  assert.equal(proof.storageProof.length,keys.length);
  const leaves=await Promise.all(keys.map(async(key,i)=>{
    assert.equal(BigInt(key),BigInt(proof.storageProof[i].key));
    const leaf=await verify(proof.storageHash,key,proof.storageProof[i].proof);
    return leaf===null?null:bytesToHex(leaf);
  }));
  return {storageRoot:proof.storageHash,leaves};
}

export async function diagnose(rpc,block,parent,state,alloc){
  assert.equal(block.transactions.length,1);
  const [tx]=block.transactions;
  assert.equal(tx.input.length,202);
  assert.equal(tx.input.slice(0,10),'0x23b872dd'); // transferFrom(address,address,uint256)
  const sender=tx.input.slice(10,74),receiver=tx.input.slice(74,138),tokenId=tx.input.slice(138);
  // OZ ERC721: _owners at 2, _balances at 3 and _tokenApprovals at 4.
  const keys=[mappingSlot(sender,3),mappingSlot(receiver,3),mappingSlot(tokenId,2),mappingSlot(tokenId,4)];
  const before=await openSlots(rpc,parent,tx.to,keys);
  const after=await openSlots(rpc,block,tx.to,keys);
  const encodedAddress=word=>bytesToHex(RLP.encode(hexToBytes('0x'+word.replace(/^(00)+/,''))));
  assert.deepEqual(before.leaves,['0x01',null,encodedAddress(sender),null]);
  assert.deepEqual(after.leaves,['0x80','0x01',encodedAddress(receiver),'0x80']);

  const address=createAddressFromString(tx.to);
  const account=await state.getAccount(address);
  const storage=await createMPT({useKeyHashing:true});
  const replayAccount=alloc[tx.to.slice(2)]??alloc[tx.to];
  for(const [key,word] of Object.entries(replayAccount.storage)){
    const value=hexToBytes('0x'+word.slice(2).replace(/^(00)+/,''));
    assert.ok(value.length,'unexpected zero in replay allocation');
    await storage.put(hexToBytes(key),RLP.encode(value));
  }
  const replayStorageRoot=bytesToHex(storage.root());
  assert.equal(replayStorageRoot,bytesToHex(account.storageRoot));
  const copy=state.shallowCopy();
  assert.equal(bytesToHex(await copy.getStateRoot()),bytesToHex(await state.getStateRoot()));
  const zeroLeaf=RLP.encode(new Uint8Array());
  for(const key of [keys[0],keys[3]]){
    assert.equal(await storage.get(hexToBytes(key)),null);
    await storage.put(hexToBytes(key),zeroLeaf);
    assert.notEqual(bytesToHex(storage.root()),after.storageRoot,'one zero alone explained the difference');
    await storage.del(hexToBytes(key));
  }
  for(const key of [keys[0],keys[3]]) await storage.put(hexToBytes(key),zeroLeaf);
  assert.equal(bytesToHex(storage.root()),after.storageRoot);
  await copy.modifyAccountFields(address,{storageRoot:storage.root()});
  assert.equal(bytesToHex(await copy.getStateRoot()),block.stateRoot,'exact world root after two leaf insertions');
  return {block:block.hash,transaction:tx.hash,registry:tx.to,senderBalanceSlot:keys[0],tokenApprovalSlot:keys[3],
    replayStorageRoot,sourceStorageRoot:after.storageRoot,replayStateRoot:bytesToHex(await state.getStateRoot()),sourceStateRoot:block.stateRoot};
}
