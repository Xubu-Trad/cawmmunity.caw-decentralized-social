import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Wallet,Transaction,Interface,encodeRlp,keccak256,getBytes,hexlify} from 'ethers';
import {acquireVerifiedPosts} from './strict-console-acquisition.mjs';
import {verifyPostingHistory} from './verify-posting-history.mjs';
import {postData} from './ui/post-plan.mjs';
import {requirePostBlockSize,requirePostOnlyBatch} from './post-block-scope.mjs';

// SYNTHETIC reader vectors, not mined blocks. Reuses preserved parent/final
// proofs but deliberately constructs a new selected header and signed batch.
// No execution-consistency or live-chain claim follows from these vectors.
const [capturePath,selectionPath]=process.argv.slice(2);
const original=JSON.parse(fs.readFileSync(capturePath));
const selected=JSON.parse(fs.readFileSync(selectionPath));
const abi=new Interface(['event LocalPostPublished(uint256 indexed accountId,uint256 indexed epoch,uint256 indexed nonce,address author,bytes32 textHash,bytes text)']);
const wallet=new Wallet('0x'+'3'.padStart(64,'0'));
assert.equal(wallet.address.toLowerCase(),selected.controller);
const q=n=>'0x'+BigInt(n).toString(16);
const uint=n=>BigInt(n)===0n?'0x':hexlify(getBytes('0x'+BigInt(n).toString(16).padStart(Math.ceil(BigInt(n).toString(16).length/2)*2,'0')));
function bloom(logs){const out=new Uint8Array(256);for(const l of logs)for(const value of [l.address,...l.topics]){const h=getBytes(keccak256(value));for(let i=0;i<6;i+=2){const bit=((h[i]<<8)|h[i+1])&2047;out[255-(bit>>3)]|=1<<(bit&7);}}return hexlify(out);}
// Exactly two ordered trie entries, RLP indices 0=80 and 1=01.
function root(values){assert.equal(values.length,2);const branch=Array(17).fill('0x');branch[8]=keccak256(encodeRlp(['0x30',values[0]]));branch[0]=keccak256(encodeRlp(['0x31',values[1]]));return keccak256(encodeRlp(branch));}
const fields=['parentHash','sha3Uncles','miner','stateRoot','transactionsRoot','receiptsRoot','logsBloom','difficulty','number','gasLimit','gasUsed','timestamp','extraData','mixHash','nonce','baseFeePerGas','withdrawalsRoot'];
const integers=new Set(['difficulty','number','gasLimit','gasUsed','timestamp','baseFeePerGas']);
function seal(bundle,selection){
 const row=bundle.blocks[0],h=row.header;
 h.transactions=row.rawTransactions.map(keccak256);h.transactionsRoot=root(row.rawTransactions);
 let gas=0n;const all=[];
 const encoded=row.receipts.map((r,i)=>{gas+=30000n;r.cumulativeGasUsed=q(gas);r.gasUsed=q(30000);r.transactionIndex=q(i);r.transactionHash=h.transactions[i];r.logsBloom=bloom(r.logs);all.push(...r.logs);return '0x02'+encodeRlp([uint(r.status),uint(gas),r.logsBloom,r.logs.map(l=>[l.address,l.topics,l.data])]).slice(2);});
 h.receiptsRoot=root(encoded);h.logsBloom=bloom(all);h.gasUsed=q(gas);h.hash=keccak256(encodeRlp(fields.map(k=>integers.has(k)?uint(h[k]):h[k])));selection.endHash=h.hash;
 row.receipts.forEach((r,i)=>{r.blockHash=h.hash;r.blockNumber=h.number;r.logs.forEach((l,j)=>Object.assign(l,{blockHash:h.hash,blockNumber:h.number,transactionHash:h.transactions[i],transactionIndex:q(i),logIndex:q(i+j),removed:false}));});
}
async function vector(){
 const bundle={schema:original.schema,anchor:structuredClone(original.anchor),blocks:[structuredClone(original.blocks[0])],finalPosting:structuredClone(original.finalPosting)};
 const selection=structuredClone(selected),row=bundle.blocks[0];
 row.header.stateRoot=original.blocks.at(-1).header.stateRoot;
 row.receipts=[structuredClone(row.receipts[0]),structuredClone(row.receipts[0])];row.rawTransactions=[];
 const base=Transaction.from(original.blocks[0].rawTransactions[0]);
 for(let i=0;i<2;i++){
  const text=i?'second batched voice 🌒':'first batched voice';
  const data=postData(selection.contracts.posting.address,'1',String(i),text,'fixture-wallet');
  row.rawTransactions.push(await wallet.signTransaction({type:2,chainId:31337,nonce:base.nonce+i,to:selection.contracts.wallet.address,value:0,gasLimit:300000,maxFeePerGas:base.maxFeePerGas,maxPriorityFeePerGas:base.maxPriorityFeePerGas,data}));
  const event=abi.encodeEventLog(abi.getEvent('LocalPostPublished'),[2,1,i,selection.contracts.wallet.address,keccak256(Buffer.from(text)),Buffer.from(text)]);
  row.receipts[i].logs=[{...row.receipts[i].logs[0],...event,address:selection.contracts.posting.address}];
 }
 seal(bundle,selection);return {bundle,selection};
}
const v=await vector(),accepted=verifyPostingHistory(v.bundle,v.selection);
assert.deepEqual(accepted.posts.map(x=>x.nonce),['0','1']);assert.equal(accepted.executionReplayed,false);
const cases=['two signed posts in one synthetic committed block'];
const config={genesisHash:'0x'+'ab'.repeat(32),contracts:selected.contracts,controller:selected.controller,postingDeployment:{blockNumber:v.bundle.anchor.number,blockHash:v.bundle.anchor.hash}};
let rawReads=0,receiptReads=0;
async function rpc(method,p){
 const row=v.bundle.blocks[0];
 if(method==='eth_chainId')return '0x7a69';
 if(method==='eth_getBlockByNumber')return p[0]==='0x0'?{hash:config.genesisHash}:p[0]===v.bundle.anchor.number?v.bundle.anchor:row.header;
 if(method==='eth_getProof'){
  assert.equal(p[2].requireCanonical,true);
  if(p[2].blockHash===row.header.hash)return v.bundle.finalPosting;
  assert.equal(p[2].blockHash,v.bundle.anchor.hash);return Object.values(row.parent).find(x=>x.address===p[0]);
 }
 const index=row.header.transactions.indexOf(p[0]);assert(index>=0);
 if(method==='eth_getRawTransactionByHash'){rawReads++;return row.rawTransactions[index];}
 if(method==='eth_getTransactionReceipt'){receiptReads++;return row.receipts[index];}
 throw Error('UNEXPECTED_RPC');
}
const acquired=await acquireVerifiedPosts(rpc,config);assert.equal(acquired.posts.length,2);assert.equal(rawReads,2);assert.equal(receiptReads,2);cases.push('acquisition reads both signed transactions and receipts');
async function reject(name,mutate,expected){const x=await vector();await mutate(x.bundle.blocks[0],x);seal(x.bundle,x.selection);assert.throws(()=>verifyPostingHistory(x.bundle,x.selection),expected,name);cases.push(name);}
await reject('mixed block with unrelated log',r=>r.receipts[1].logs[0].address=selected.contracts.registry.address,/POST_ONLY_BATCH_REQUIRED/);
await reject('mixed block with no post event',r=>r.receipts[1].logs=[],/POST_ONLY_BATCH_REQUIRED/);
await reject('reverted transaction',r=>r.receipts[1].status='0x0',/POST_ONLY_BATCH_REQUIRED/);
await reject('extra event cannot hide state change',r=>r.receipts[1].logs.push(structuredClone(r.receipts[1].logs[0])),/POST_ONLY_BATCH_REQUIRED/);
await reject('duplicate post nonce',r=>{r.receipts[1].logs[0].topics[3]=r.receipts[0].logs[0].topics[3];},/POST_NONCE/);
await reject('valid signature on different call',async r=>{const t=Transaction.from(r.rawTransactions[1]);r.rawTransactions[1]=await wallet.signTransaction({...t.toJSON(),type:2,to:selected.contracts.registry.address,signature:undefined});},/POST_TARGET/);
await reject('valid signature from wrong signer',async r=>{const t=Transaction.from(r.rawTransactions[1]);r.rawTransactions[1]=await new Wallet('0x'+'4'.padStart(64,'0')).signTransaction({...t.toJSON(),type:2,signature:undefined});},/POST_SIGNER/);
await reject('event epoch differs from parent proof',r=>r.receipts[1].logs[0].topics[2]='0x'+'2'.padStart(64,'0'),/POST_EPOCH/);
await reject('second call replays first calldata',r=>r.rawTransactions[1]=r.rawTransactions[0],/POST_CALLDATA/);
requirePostBlockSize(Array(16).fill('0x'));cases.push('16 transaction resource boundary');
assert.throws(()=>requirePostBlockSize(Array(17).fill('0x')),/POST_BLOCK_TRANSACTION_LIMIT/);cases.push('17 transaction resource rejection');
assert.throws(()=>requirePostOnlyBatch(Array(17).fill(v.bundle.blocks[0].receipts[0]),selected.contracts.posting.address,v.bundle.blocks[0].receipts[0].logs[0].topics[0]),/POST_BLOCK_TRANSACTION_LIMIT/);cases.push('receipt resource rejection');
console.log(JSON.stringify({scope:'synthetic signed reader vectors; not EVM execution or public-chain evidence',passed:cases.length,cases},null,2));
