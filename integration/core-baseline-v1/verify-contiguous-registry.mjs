import fs from 'node:fs';import assert from 'node:assert/strict';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectHeaderBoundCode} from '../../reference/header-bound-state-proof.mjs';
const [capturePath,operationsPath,expectedPath]=process.argv.slice(2),c=JSON.parse(fs.readFileSync(capturePath)),ops=JSON.parse(fs.readFileSync(operationsPath)),expected=JSON.parse(fs.readFileSync(expectedPath));
assert.equal(c.chainId,'0x7a69');assert.equal(c.blocks.length,29);const blocks=c.blocks.slice(1);
function verify(blocks){
 const bodyRejections=[];
 inspectExecutionHeaderChain(blocks.map(x=>x.block),{schema:'caw-execution-header-chain-selection/1',profile:'shanghai-17',startHash:c.startHash,endHash:c.endHash});
 for(let i=0;i<blocks.length;i++){
  const b=blocks[i],selection={schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:b.block.hash};
  assert.equal(b.rawTransactions.length,1);assert.equal(b.receipts.length,1);assert.equal(b.rawTransactions[0],ops[i].rawTransaction);assert.equal(Number(BigInt(b.receipts[0].status)),ops[i].status);assert.deepEqual(b.receipts[0].logs.map(({address,topics,data})=>({address,topics,data})),ops[i].logs);
  let joined,senders;
  try{joined=inspectBlockTransactionReceipts(b.block,b.rawTransactions,b.receipts,selection);senders=inspectBlockSenders(b.block,b.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:b.block.hash,chainId:c.chainId,allowUnprotectedLegacy:false});}
  catch(e){if(e.code!=='BLOCK_TRANSACTIONS_TRANSACTION_ENCODED_LIMIT')throw e;bodyRejections.push({index:i,bytes:(b.rawTransactions[0].length-2)/2,code:e.code});continue;}
  assert.equal(joined.associations.length,1);assert.equal(senders.transactionCount,1);assert.equal(b.rawTransactions[0],ops[i].rawTransaction);assert.equal(joined.associations[0].transactionHash,ops[i].hash);assert.equal(Number(BigInt(joined.receipts[0].status)),ops[i].status);
  assert.deepEqual(b.receipts[0].logs.map(({address,topics,data})=>({address,topics,data})),ops[i].logs);
 }
 return bodyRejections;
}
const bodyRejections=verify(blocks);assert.equal(blocks[0].block.parentHash,c.blocks[0].block.hash);
const mutations=[];for(const [name,mutate]of [['missing block',x=>x.splice(10,1)],['reordered blocks',x=>[x[5],x[6]]=[x[6],x[5]]],['changed receipt',x=>x[5].receipts[0].status='0x0'],['changed body',x=>x[4].rawTransactions[0]=x[3].rawTransactions[0]]]){const x=structuredClone(blocks);mutate(x);assert.throws(()=>verify(x));mutations.push(name);}
const final=c.blocks.at(-1).block;assert.equal(final.hash,c.endHash);const fields=expected.storage;assert.equal(fields.length,16);
const proved=[],rejections=[];
for(const field of fields){
 const entry=c.proof.storageProof.filter(x=>BigInt(x.key)===BigInt(field.key));assert.equal(entry.length,1);
 try{
  const r=inspectHeaderBoundCode(JSON.stringify({header:final,proof:{...c.proof,storageProof:entry},code:c.code}),JSON.stringify({schema:'caw-header-code-selection/1',profile:'shanghai-17',hash:c.endHash,address:c.proof.address,storageKeys:[field.key],expectedCodeHash:c.expectedRuntimeHash}));
  assert.equal(BigInt(r.state.proof.storage[0].value).toString(),field.expected);proved.push(field.label);
 }catch(e){if(!e.code?.startsWith('ETH_PROOF_'))throw e;rejections.push({label:field.label,code:e.code});}
}
console.log(JSON.stringify({status:rejections.length||bodyRejections.length?'LOCAL_CHAIN_ACQUIRED_VERIFICATION_GAPS':'LOCAL_CONTIGUOUS_CHAIN_VERIFIED',blocks:blocks.length,retainedSignedTransactions:ops.length,commitmentVerifiedBlocks:blocks.length-bodyRejections.length,bodyRejections,parentLinkage:true,proofFieldsAccepted:proved,proofRejections:rejections,mutations,startHash:c.startHash,endHash:c.endHash,chainAuthenticated:false,consensusVerified:false,finalityVerified:false,limits:'Owned local Anvil chain, no fork or public checkpoint. All raw bytes/status/logs match retained model input; rejected blocks have no commitment-verification acceptance. Proof rejections are preserved, never replaced by RPC claims.'},null,2));
