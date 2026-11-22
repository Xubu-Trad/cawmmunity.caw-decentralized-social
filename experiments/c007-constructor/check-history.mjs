import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
const original=JSON.parse(fs.readFileSync(process.argv[2]));
// Anvil genesis exposes additional fork fields. Retain it in the raw capture;
// use block 1 as the explicit checkpoint rather than stripping those fields.
assert.equal(original.blocks[0].block.number,'0x0');
original.blocks=original.blocks.slice(1);
const selection={startHash:original.blocks[0].block.hash,endHash:original.blocks.at(-1).block.hash,chainId:'0x7a69'};
export function check(a,pin=selection){
 assert.equal(a.chainId,pin.chainId);assert(a.blocks.length>1);
 inspectExecutionHeaderChain(a.blocks.map(b=>b.block),{schema:'caw-execution-header-chain-selection/1',profile:'shanghai-17',startHash:pin.startHash,endHash:pin.endHash});
 const history=[];
 for(const b of a.blocks){
  const opts={schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:b.block.hash};
  const combined=inspectBlockTransactionReceipts(b.block,b.rawTransactions,b.receipts,opts);
  const senders=inspectBlockSenders(b.block,b.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:b.block.hash,chainId:pin.chainId,allowUnprotectedLegacy:false});
  for(let i=0;i<senders.transactions.length;i++)history.push({blockNumber:b.block.number,blockHash:b.block.hash,transaction:senders.transactions[i],decoded:combined.transactions[i],receipt:combined.receipts[i],association:combined.associations[i]});
 }
 return history;
}
const history=check(original);assert.equal(history.length,26);
const negatives=[];
function reject(name,alter){const x=structuredClone(original);alter(x);assert.throws(()=>check(x));negatives.push(name);}
reject('missing_middle_block',x=>x.blocks.splice(5,1));
reject('missing_tail',x=>x.blocks.pop());
reject('reordered_blocks',x=>[x.blocks[4],x.blocks[5]]=[x.blocks[5],x.blocks[4]]);
reject('altered_raw_transaction',x=>{const s=x.blocks[1].rawTransactions[0];x.blocks[1].rawTransactions[0]=s.slice(0,-2)+(s.endsWith('00')?'01':'00');});
reject('missing_transaction',x=>x.blocks[1].rawTransactions=[]);
reject('changed_receipt_status',x=>x.blocks[1].receipts[0].status=x.blocks[1].receipts[0].status==='0x0'?'0x1':'0x0');
reject('missing_receipt',x=>x.blocks[1].receipts=[]);
reject('wrong_chain',x=>x.chainId='0x1');
const logged=original.blocks.find(x=>x.receipts.some(r=>r.logs.length));assert(logged);
reject('altered_event_bytes',x=>{const r=x.blocks.find(b=>b.block.hash===logged.block.hash).receipts.find(r=>r.logs.length);r.logs[0].data='0x';});
fs.writeFileSync(process.argv[3],JSON.stringify({schema:'caw-verified-local-history/1',selected:selection,blocks:original.blocks.length,transactions:history.length,negatives,history,headerChainVerified:true,bodyAndReceiptCommitmentsVerified:true,senderRecoveryVerified:true,endpointAuthenticated:false,executionReplayed:false,consensusVerified:false,finalityVerified:false},null,2)+'\n');
console.log(JSON.stringify({blocks:original.blocks.length,transactions:history.length,negatives}));
