import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {MerklePatriciaTrie} from '@ethereumjs/mpt';import {RLP} from '@ethereumjs/rlp';
import {createTxFromRLP} from '@ethereumjs/tx';import {createCustomCommon,Mainnet,Hardfork} from '@ethereumjs/common';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockReceipts} from '../../reference/ethereum-block-receipts.mjs';
const [file,pin,opsFile,opsPin]=process.argv.slice(2);
function load(file,pin){assert(/^[0-9a-f]{64}$/.test(pin));assert(fs.statSync(file).size<=2*1024*1024);const b=fs.readFileSync(file);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),pin);return JSON.parse(b);}
const capture=load(file,pin),ops=load(opsFile,opsPin),bytes=h=>Uint8Array.from(Buffer.from(h.slice(2),'hex')),hex=b=>'0x'+Buffer.from(b).toString('hex');
const common=createCustomCommon({chainId:31337},Mainnet,{hardfork:Hardfork.Shanghai});
async function verify(c){
 assert.equal(c.chainId,'0x7a69');assert.equal(c.blocks.length,29);assert.equal(ops.length,28);const blocks=c.blocks.slice(1);assert.equal(blocks[0].block.parentHash,c.blocks[0].block.hash);
 inspectExecutionHeaderChain(blocks.map(x=>x.block),{schema:'caw-execution-header-chain-selection/1',profile:'shanghai-17',startHash:c.startHash,endHash:c.endHash});
 const nonces=new Map(),rows=[];let total=0;
 for(let i=0;i<28;i++){
  const b=blocks[i];assert.equal(b.rawTransactions.length,1);assert.equal(b.receipts.length,1);const raw=b.rawTransactions[0];assert(/^0x(?:[0-9a-f]{2})+$/.test(raw));const n=(raw.length-2)/2;assert(n<=34000);total+=n;assert(total<=200000);
  const tx=createTxFromRLP(bytes(raw),{common});assert.equal(tx.type,2);assert(tx.verifySignature());assert.equal(hex(tx.serialize()),raw);const sender=tx.getSenderAddress().toString();assert(['0x6813eb9362372eef6200f3b1dbc3f819671cba69','0x1eff47bc3a10a45d4b230b5d10e37751fe6aa718'].includes(sender));assert.equal(tx.nonce,nonces.get(sender)??0n);nonces.set(sender,tx.nonce+1n);
  const trie=new MerklePatriciaTrie();await trie.put(RLP.encode(new Uint8Array()),bytes(raw));assert.equal(hex(trie.root()),b.block.transactionsRoot);
  const rr=inspectBlockReceipts(b.block,b.receipts,{schema:'caw-block-receipts-selection/1',profile:'shanghai-17',hash:b.block.hash});assert.equal(rr.receiptCount,1);assert.equal(rr.receipts[0].type,'0x2');assert.equal(Number(BigInt(rr.receipts[0].status)),ops[i].status);assert.deepEqual(rr.receipts[0].logs,ops[i].logs);assert.equal(raw,ops[i].rawTransaction);assert.equal(hex(tx.hash()),ops[i].hash);
  rows.push({index:i,hash:hex(tx.hash()),sender,nonce:tx.nonce.toString(),status:rr.receipts[0].status});
 }
 return {rows,totalBytes:total};
}
const result=await verify(capture),controls=[];
for(const [name,mutate]of [['receipt status',x=>x.blocks[7].receipts[0].status='0x0'],['transaction byte',x=>{const r=x.blocks[7].rawTransactions[0];x.blocks[7].rawTransactions[0]=r.slice(0,-2)+(r.endsWith('00')?'01':'00');}],['missing block',x=>x.blocks.splice(8,1)],['duplicate transaction',x=>x.blocks[11].rawTransactions[0]=x.blocks[7].rawTransactions[0]],['oversized input',x=>x.blocks[7].rawTransactions[0]='0x'+'00'.repeat(34001)]]){const x=structuredClone(capture);mutate(x);await assert.rejects(()=>verify(x));controls.push(name);}
console.log(JSON.stringify({schema:'caw-contiguous-independent-body-reconciliation/1',status:'LOCAL_FIXTURE_BODY_RECEIPTS_RECONCILED',...result,controls,originalReaderUnchanged:true,originalReaderAcceptedBlocks:26,storageComplete:false,chainAuthenticated:false,finalityVerified:false,limits:'Separate pinned-fixture diagnostic, not a replacement production reader. EthereumJS checks all signed transaction roots/nonces; existing CAW reader checks receipts and headers. No execution or state transition is rerun.'},null,2));
