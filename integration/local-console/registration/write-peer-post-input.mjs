import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Transaction,keccak256,toQuantity} from 'ethers';
import {verifyPostCapsule} from './verify-post-capsule.mjs';

const archivedBlock='0x81473ce06a2add0ef448b70e2cbca60f0b557eebbde2345fb147ec04e69e2a0d';
const txHash='0xa7145ef7bbc6e88cf0db0824b8e3b635dba8d5834b2865570d5c625c130066d7';

export async function writePeerPostInput({file,rpc,token,pool,staker,payer,stake,fee,mine,runtime,balanceSlot,supply,word}){
  const archive=JSON.parse(readFileSync(new URL('./samples/branch-check/archive.json',import.meta.url),'utf8'));
  const post=verifyPostCapsule(archive,archivedBlock,txHash);
  const signed=Transaction.from(archive.txBytes);
  assert.equal(signed.from,payer.address);
  assert.equal(signed.to,pool.target);
  assert.equal(signed.chainId,1337n);
  assert.equal(signed.hash,txHash);

  await mine(token.connect(staker).approve(pool.target,stake));
  await mine(pool.connect(staker).stake(stake));
  await mine(token.approve(pool.target,fee));
  assert.equal(await rpc('eth_getTransactionCount',[payer.address,'latest']),toQuantity(signed.nonce));
  assert.equal(await rpc('eth_sendRawTransaction',[archive.txBytes]),txHash);
  const receipt=await rpc('eth_getTransactionReceipt',[txHash]);
  assert.equal(receipt.status,'0x1');
  const postHeight=Number(BigInt(receipt.blockNumber));
  assert.equal(postHeight,35);

  // The original lab used out-of-band state writes. Commit the same token code
  // and initial storage to the new chain's genesis so each Geth node executes it.
  const genesis={
    config:{chainId:1337,homesteadBlock:0,eip150Block:0,eip155Block:0,eip158Block:0,
      byzantiumBlock:0,constantinopleBlock:0,petersburgBlock:0,istanbulBlock:0,
      berlinBlock:0,londonBlock:0,terminalTotalDifficulty:0,shanghaiTime:0},
    timestamp:'0x1',gasLimit:'0x1c9c380',difficulty:'0x0',baseFeePerGas:'0x1',
    alloc:{[token.target]:{balance:'0x0',code:runtime,storage:{[balanceSlot]:word(supply),[word(2)]:word(supply)}}}
  };
  const blocks=[];
  for(let height=1;height<=postHeight;height++){
    const block=await rpc('eth_getBlockByNumber',[toQuantity(height),false]);
    assert.equal(block.number,toQuantity(height));
    const transactions=[];
    for(const hash of block.transactions){
      const raw=await rpc('eth_getRawTransactionByHash',[hash]);
      assert.equal(keccak256(raw),hash);
      const tx=Transaction.from(raw);
      assert.equal(tx.chainId,1337n);
      assert.ok(tx.from);
      if(!Object.hasOwn(genesis.alloc,tx.from)){
        const balance=await rpc('eth_getBalance',[tx.from,'0x0']);
        assert.ok(BigInt(balance)>0n);
        genesis.alloc[tx.from]={balance};
      }
      transactions.push(raw);
    }
    blocks.push({transactions});
  }
  assert.deepEqual(blocks[postHeight-1].transactions,[archive.txBytes]);
  writeFileSync(file,JSON.stringify({genesis,blocks,postHeight,txHash})+'\n',{flag:'wx'});
  console.log(JSON.stringify({peerInput:{postHeight,txHash,author:post.author,body:post.body}}));
}
