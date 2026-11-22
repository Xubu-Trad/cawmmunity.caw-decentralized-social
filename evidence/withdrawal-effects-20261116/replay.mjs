import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createVM,runTx} from '@ethereumjs/vm';
import {createTxFromRLP} from '@ethereumjs/tx';
import {createBlock} from '@ethereumjs/block';
import {MerkleStateManager} from '@ethereumjs/statemanager';
import {createCustomCommon,Mainnet,Hardfork} from '@ethereumjs/common';
import {Account,createAddressFromString} from '@ethereumjs/util';
const [capturePath,genesisPath,out]=process.argv.slice(2);
const capture=JSON.parse(fs.readFileSync(capturePath)),genesis=JSON.parse(fs.readFileSync(genesisPath));
const hex=b=>'0x'+Buffer.from(b).toString('hex'),bytes=h=>Uint8Array.from(Buffer.from(h.slice(2),'hex'));
const common=createCustomCommon({chainId:31337},Mainnet,{hardfork:Hardfork.Shanghai}),stateManager=new MerkleStateManager();
for(const [a,v] of Object.entries(genesis.alloc)) {
  assert(!v.code && !v.storage,'UNSUPPORTED_GENESIS_STATE');
  await stateManager.putAccount(createAddressFromString('0x'+a.replace(/^0x/,'')),new Account(BigInt(v.nonce??0),BigInt(v.balance)));
}
const vm=await createVM({common,stateManager});
assert.equal(hex(await stateManager.getStateRoot()),capture.blocks[0].block.stateRoot,'GENESIS_ROOT');
const rows=[];let transactions=0;
for(const [i,b] of capture.blocks.slice(1).entries()) {
 const h=b.block,previous=capture.blocks[i].block;
 assert.equal(BigInt(h.number),BigInt(previous.number)+1n,'BLOCK_SEQUENCE');
 assert.equal(h.parentHash,previous.hash,'PARENT_HASH');
 assert.equal(b.rawTransactions.length,b.receipts.length,'RECEIPT_COUNT');
 assert.equal(b.rawTransactions.length,h.transactions.length,'TRANSACTION_COUNT');
 assert.deepEqual(h.withdrawals??[],[],'WITHDRAWALS_UNSUPPORTED');
 const block=createBlock({header:{number:BigInt(h.number),timestamp:BigInt(h.timestamp),gasLimit:BigInt(h.gasLimit),baseFeePerGas:BigInt(h.baseFeePerGas),difficulty:0n,coinbase:h.miner,mixHash:h.mixHash},withdrawals:[]},{common});
 let gas=0n;const txRows=[];
 for(const [j,raw] of b.rawTransactions.entries()) {
  const tx=createTxFromRLP(bytes(raw),{common}),receipt=b.receipts[j];
  assert(tx.verifySignature(),'SIGNATURE');
  assert.equal(hex(tx.hash()),h.transactions[j],'TRANSACTION_HASH');
  assert.equal(receipt.transactionHash,h.transactions[j],'RECEIPT_HASH');
  assert.equal(BigInt(receipt.transactionIndex),BigInt(j),'RECEIPT_INDEX');
  assert.equal(receipt.blockHash,h.hash,'RECEIPT_BLOCK');
  const r=await runTx(vm,{tx,block,blockGasUsed:gas});gas+=r.totalGasSpent;
  assert.equal(r.totalGasSpent,BigInt(receipt.gasUsed),'TX_GAS');
  assert.equal(gas,BigInt(receipt.cumulativeGasUsed),'CUMULATIVE_GAS');
  assert.equal(r.receipt.status,Number(BigInt(receipt.status)),'STATUS');
  assert.deepEqual((r.execResult.logs??[]).map(([a,t,d])=>({address:hex(a),topics:t.map(hex),data:hex(d)})),receipt.logs.map(({address,topics,data})=>({address,topics,data})),'LOGS');
  txRows.push({hash:hex(tx.hash()),sender:tx.getSenderAddress().toString(),gas:String(r.totalGasSpent),status:r.receipt.status});transactions++;
 }
 assert.equal(gas,BigInt(h.gasUsed),'BLOCK_GAS');
 const root=hex(await stateManager.getStateRoot());
 rows.push({block:Number(BigInt(h.number)),hash:h.hash,stateRoot:root,expectedRoot:h.stateRoot,transactions:txRows});
 fs.writeFileSync(out,JSON.stringify({status:'INCOMPLETE',rows},null,2));
 assert.equal(root,h.stateRoot,'STATE_ROOT '+h.number);
}
assert(rows.some(r=>r.transactions.length===2),'NO_TWO_TRANSACTION_BATCH');
fs.writeFileSync(out,JSON.stringify({status:'PASS',rows,transactions,matchingStateRoots:rows.length,startingRootVerified:true,executionEngine:'EthereumJS 10.1.3',independentOperator:false,chainAuthenticated:false,finalityVerified:false},null,2)+'\n');
console.log(`${transactions} transactions / ${rows.length} post-genesis state roots match`);
