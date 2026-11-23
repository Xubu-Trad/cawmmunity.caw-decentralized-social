import {diagnose} from './diagnose-stake-root.mjs';
import {gethTransition,checkGethBinary} from './geth-window-transition.mjs';
import assert from 'node:assert/strict';
import {createCustomCommon, Mainnet, Hardfork} from '@ethereumjs/common';
import {createBlockFromRPC} from '@ethereumjs/block';
import {createVM, runBlock} from '@ethereumjs/vm';
import {MerkleStateManager} from '@ethereumjs/statemanager';
import {Account, createAddressFromString, bytesToHex, bytesToBigInt, hexToBytes} from '@ethereumjs/util';

// Fresh private Shanghai chain. Replay signed transactions from the explicit funded genesis.
export async function replayWindow({rpc, accounts, head, slots, pool, token, hashes}) {
  checkGethBinary();
  let alloc=Object.fromEntries(accounts.map(a=>[a,{balance:'0x'+(10000n * 10n**18n).toString(16)}]));
  const common = createCustomCommon({chainId:1337}, Mainnet, {hardfork:Hardfork.Shanghai});
  const stateManager = new MerkleStateManager();
  for (const account of accounts) {
    await stateManager.putAccount(createAddressFromString(account), new Account(0n, 10000n * 10n**18n));
  }
  const vm = await createVM({common,stateManager});
  const genesis = await rpc('eth_getBlockByNumber',['0x0',false]);
  const root = async () => bytesToHex(await stateManager.getStateRoot());
  assert.equal(await root(),'0xe914d7e6a70676d0aecddd6b3e1110d78639f4e45a167334b8ba589316f48632','explicit funded allocation');
  let previous = genesis, parentStateRoot;
  const states=[], intermediateRoots=[], blockHashes={'0':genesis.hash}, mismatches=[];
  let reference;
  const snapshot = async () => Promise.all(slots.map(async ([contract,key]) =>
    bytesToBigInt(await stateManager.getStorage(createAddressFromString(contract==='pool'?pool:token),hexToBytes(key)))));
  for (let number=1;number<=Number(BigInt(head.number));number++){
    const data=await rpc('eth_getBlockByNumber',['0x'+number.toString(16),true]);
    const block=createBlockFromRPC(data,[],{common});
    assert.equal(data.parentHash,previous.hash);
    assert.equal(block.header.number,BigInt(number));
    assert.equal(bytesToHex(block.hash()),data.hash);
    assert.deepEqual(data.withdrawals,[]);
    for(const [i,tx] of block.transactions.entries()){
      assert.equal(bytesToHex(tx.hash()),data.transactions[i].hash);
      assert.equal(tx.getSenderAddress().toString(),data.transactions[i].from.toLowerCase());
    }
    reference=gethTransition(alloc,data,data.transactions,blockHashes);
    assert.equal(reference.result.txRoot,data.transactionsRoot);
    assert.equal(reference.result.receiptsRoot,data.receiptsRoot);
    assert.equal(reference.result.logsBloom,data.logsBloom);
    assert.equal(BigInt(reference.result.gasUsed),BigInt(data.gasUsed));
    if(data.number===head.number){
      assert.equal(data.hash,head.hash);
      assert.deepEqual(data.transactions.map(t=>t.hash),hashes);
      parentStateRoot=await root();
      states.push(await snapshot());
      let error;
      vm.events.on('afterTx',async (_tx,done)=>{
        try{states.push(await snapshot());intermediateRoots.push(await root());}catch(e){error=e;}finally{done();}
      });
      const result=await runBlock(vm,{block,skipHeaderValidation:true,generate:true});
      if(error)throw error;
      assert.deepEqual(result.receipts.map(r=>r.status),[1,1,1]);
    }else{
      await runBlock(vm,{block,skipHeaderValidation:true,generate:true});
    }
    assert.equal(await root(),reference.result.stateRoot,'Geth / EthereumJS execution root at block '+number);
    if(data.number===head.number){
      for(const count of [1,2]){
        const prefix=gethTransition(alloc,data,data.transactions.slice(0,count),blockHashes);
        assert.equal(prefix.result.stateRoot,intermediateRoots[count-1],'intrablock state root');
      }
      assert.equal(intermediateRoots[2],reference.result.stateRoot);
    }
    if(number===5){
      assert.equal(mismatches.length,0,'earlier block already diverged');
      console.log(JSON.stringify({firstMismatch:await diagnose(rpc,data,previous,stateManager,reference.alloc)}));
    }
    if(data.stateRoot!==reference.result.stateRoot)mismatches.push(number);
    alloc=reference.alloc;
    blockHashes[number]=data.hash;
    previous=data;
  }
  return {intermediateRoots,mismatches,parentStateRoot,stateRoot:await root(),blocks:Number(BigInt(head.number)),states};
}
