import assert from 'node:assert/strict';
import {id} from 'ethers';
import {capturePostCapsule} from './post-capsule.mjs';
import {verifyPostCapsule} from './verify-post-capsule.mjs';
import {capturePostCheckpoint,verifyPostCheckpoint} from './post-checkpoint.mjs';

export async function mineCheckpointBranches({rpc,token,pool,staker,stake,fee,mine,name}){
  const initial=await rpc('evm_snapshot',[]);
  try{
    if(await pool.stakeOf(staker.address)===0n){
      await mine(token.connect(staker).approve(pool.target,stake));
      await mine(pool.connect(staker).stake(stake));
    }
    await mine(token.approve(pool.target,fee));
    const parent=await rpc('evm_snapshot',[]);
    async function branch(text){
      const tx=await pool.publish(name,text,{gasLimit:750000});
      const receipt=await rpc('eth_getTransactionReceipt',[tx.hash]);
      assert.equal(receipt.status,'0x1');
      await rpc('evm_mine',[]);
      await rpc('evm_mine',[]);
      const tip=await rpc('eth_getBlockByNumber',['latest',false]);
      assert.equal(BigInt(tip.number),BigInt(receipt.blockNumber)+2n);
      return {txHash:tx.hash,blockHash:receipt.blockHash,height:receipt.blockNumber,checkpointHash:tip.hash};
    }
    const original=await branch('post before branch replacement');
    const {txHash,blockHash}=original;
    const archive=await capturePostCapsule(rpc,blockHash,txHash);
    const included=await capturePostCheckpoint(rpc,archive,blockHash,txHash,original.checkpointHash);
    for(const missingMethod of ['eth_getBlockByHash','eth_getBlockByNumber']){
      const missing=async(method,params)=>method===missingMethod?null:rpc(method,params);
      await assert.rejects(capturePostCheckpoint(missing,archive,blockHash,txHash,original.checkpointHash),/unavailable/);
    }
    await assert.rejects(capturePostCheckpoint(rpc,archive,blockHash,txHash,blockHash),/later than the post/);
    assert.throws(()=>verifyPostCheckpoint(archive,blockHash,txHash,blockHash,{headers:[archive.header]}),/later than the post/);

    // The post and the two existing successors count toward the 128-header limit.
    await rpc('anvil_mine',['0x7d']);
    const lastAllowed=await rpc('eth_getBlockByNumber',['latest',false]);
    const longest=await capturePostCheckpoint(rpc,archive,blockHash,txHash,lastAllowed.hash);
    const result=verifyPostCheckpoint(archive,blockHash,txHash,lastAllowed.hash,longest);
    assert.equal(result.headerCount,128);
    assert.equal(result.status,'included');
    await rpc('evm_mine',[]);
    const tooFar=await rpc('eth_getBlockByNumber',['latest',false]);
    await assert.rejects(capturePostCheckpoint(rpc,archive,blockHash,txHash,tooFar.hash),/within 128 headers/);
    assert.equal(await rpc('evm_revert',[parent]),true);
    const replacement=await branch('different post at the same height');
    assert.equal(original.height,replacement.height);
    assert.notEqual(original.txHash,replacement.txHash);
    assert.notEqual(original.blockHash,replacement.blockHash);
    assert.notEqual(original.checkpointHash,replacement.checkpointHash);
    const different=await capturePostCheckpoint(rpc,archive,blockHash,txHash,replacement.checkpointHash);
    return {original,replacement,archive,included,different};
  }finally{
    assert.equal(await rpc('evm_revert',[initial]),true);
  }
}

export function checkArchivedBranches({original,replacement,archive,included,different}){
  const {blockHash,txHash}=original;
  const check=(tip,proof)=>verifyPostCheckpoint(archive,blockHash,txHash,tip,proof);
  assert.equal(verifyPostCapsule(archive,blockHash,txHash).body,'post before branch replacement');
  assert.equal(check(original.checkpointHash,included).status,'included');
  const replaced=check(replacement.checkpointHash,different);
  assert.equal(replaced.status,'different-block');
  assert.equal(replaced.observedBlockHash,replacement.blockHash);
  for(const [tip,proof] of [[original.checkpointHash,included],[replacement.checkpointHash,different]]){
    assert.equal(proof.headers.length,3);
    const [head,middle,last]=proof.headers;
    for(const headers of [[head,middle],[head,last],[head,last,middle],[head,middle,last,last]]){
      assert.throws(()=>check(tip,{headers}));
    }
    assert.throws(()=>check(id('wrong checkpoint'),proof));
    assert.throws(()=>verifyPostCheckpoint(archive,blockHash,id('wrong post hash'),tip,proof));
  }
  assert.throws(()=>check(original.checkpointHash,different));
  assert.throws(()=>check(replacement.checkpointHash,included));
}
