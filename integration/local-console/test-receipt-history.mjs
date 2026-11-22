import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {verifyPostingHistory} from './verify-posting-history.mjs';
import {verifyReceiptHistory} from './verify-receipt-history.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {exportReceiptHistory} from './ui/receipt-export.mjs';
import {OUTCOME_PREFIX} from './ui/receipt-outcomes.mjs';
import {RECHECK_PREFIX} from './ui/receipt-rechecks.mjs';
import {POST_PROFILE,postText,postData} from './ui/post-plan.mjs';
const dir=process.argv[2],load=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),bundle=load('capture.json'),selection=load('selection.json'),context=load('fixture-context.json');
const history=verifyPostingHistory(bundle,selection),checks=[],locks={request:async(_n,_o,fn)=>fn({})};
async function fixture(post){
 const at=bundle.blocks.findIndex(r=>r.header.hash===post.blockHash),row=bundle.blocks[at],prior=at?bundle.blocks[at-1].header:bundle.anchor;
 const tx=inspectBlockSenders(row.header,row.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:row.header.hash,chainId:'0x7a69',allowUnprotectedLegacy:false}).transactions.find(t=>t.hash===post.transactionHash);
 const state={chainId:'0x7a69',contracts:Object.fromEntries(Object.entries(context.contracts).map(([k,v])=>[k,v.address])),controller:context.controller,genesisHash:context.genesisHash,owner:post.author,signer:tx.from,ownerType:post.author===context.contracts.wallet.address?'fixture-wallet':'eoa',epoch:post.epoch,posting:{profile:POST_PROFILE,nonce:post.nonce}};
 const plan={action:'post',chainId:'0x7a69',from:tx.from,to:tx.to,data:tx.data,value:tx.value,nonce:tx.nonce,epoch:post.epoch,blockNumber:prior.number,blockHash:prior.hash,genesisHash:context.genesisHash,owner:post.author,posting:state.contracts.posting,postNonce:post.nonce,text:post.text,textHash:post.textHash,profile:POST_PROFILE};
 const original={version:1,scope:'LOCAL_PROVIDER_RECEIPT_CHECK',action:{version:3,id:'0x'+'12'.repeat(16),phase:'submitted',plan,contracts:state.contracts,hash:tx.hash},transactionHash:tx.hash,receipt:{status:'confirmed',blockHash:post.blockHash,blockNumber:post.blockNumber}};
 return {state,original};
}
async function pack(f,entries=[]){const original=f.original;return (await exportReceiptHistory({getItem:k=>k===OUTCOME_PREFIX+original.action.id?JSON.stringify(original):k===RECHECK_PREFIX+original.action.id?JSON.stringify({version:1,original,entries}):null},locks,f.state,original)).text;}
const run=async(n,fn)=>{await fn();checks.push(n);};
const first=await fixture(history.posts[0]),second=await fixture(history.posts[1]);
for(const [name,f]of [['contract wallet',first],['later EOA owner',second]])await run(name+' exported post binds to signed committed history',async()=>{const r=await verifyReceiptHistory(await pack(f),f.state,bundle,selection);assert.equal(r.status,'INCLUDED_POST_MATCHES_LOCAL_RECORD');assert.equal(r.publicChainAuthenticated,false);assert.equal(r.accountingEffectsVerified,false);});
for(const [name,mutate,expected]of [
 ['changed receipt status',f=>f.original.receipt.status='reverted','receipt.status'],
 ['changed receipt block',f=>f.original.receipt.blockHash='0x'+'99'.repeat(32),'receipt.blockHash'],
 ['changed transaction nonce',f=>f.original.action.plan.nonce='0xffff','plan.nonce'],
 ['different text with coherent calldata',f=>{const p=f.original.action.plan;p.text='different';p.textHash=postText(p.text).textHash;p.data=postData(p.posting,p.epoch,p.postNonce,p.text,f.state.ownerType);},'plan.data'],
 ['unselected review anchor',f=>f.original.action.plan.blockHash='0x'+'99'.repeat(32),'plan.reviewAnchorOutsideSelectedHistory']
 ])await run(name+' retained as discrepancy rather than accepted match',async()=>{const f=structuredClone(first);mutate(f);const r=await verifyReceiptHistory(await pack(f),f.state,bundle,selection);assert.equal(r.status,'INCLUDED_POST_WITH_LOCAL_RECORD_DISCREPANCIES');assert(r.discrepancies.includes(expected));});
await run('absent transaction is only absent in selected range',async()=>{const f=structuredClone(first);f.original.transactionHash=f.original.action.hash='0x'+'99'.repeat(32);const r=await verifyReceiptHistory(await pack(f),f.state,bundle,selection);assert.equal(r.status,'NOT_FOUND_IN_SELECTED_VERIFIED_POST_HISTORY');assert.equal(r.transactionIncluded,false);});
await run('prior failed recheck remains separate from verified inclusion',async()=>{const e={id:'0x'+'34'.repeat(16),checkedAt:1,classification:'INCONCLUSIVE',result:null,error:'provider offline'},text=await pack(first,[e]),r=await verifyReceiptHistory(text,first.state,bundle,selection);assert.equal(r.retainedObservations,1);assert.equal(r.status,'INCLUDED_POST_MATCHES_LOCAL_RECORD');assert.equal(JSON.parse(JSON.parse(text).payload).rechecks.entries[0].error,'provider offline');});
const awaitable=await pack(first);
for(const [name,mutate]of [
 ['changed signed transaction',b=>{const t=b.blocks[0].rawTransactions[0];b.blocks[0].rawTransactions[0]=t.slice(0,-2)+(t.endsWith('00')?'01':'00');}],
 ['changed receipt status',b=>b.blocks[0].receipts[0].status='0x0'],
 ['changed state proof',b=>b.blocks[0].parent.registry.storageProof[0].value='0x1'],
 ['omitted history block',b=>b.blocks.shift()]
 ])await run(name+' rejects even when exported checksum is valid',async()=>{const b=structuredClone(bundle);mutate(b);await assert.rejects(()=>verifyReceiptHistory(awaitable,first.state,b,selection));});
// Stored export is passed directly to the verifier, never a pre-accepted summary.
console.log(JSON.stringify({passed:checks.length,checks,scope:'Retained local signed-chain capture; selected endpoints trusted, no fresh execution or public finality.'},null,2));
fs.writeFileSync(path.join(dir,'post-export.json'),await pack(first));fs.writeFileSync(path.join(dir,'review-state.json'),JSON.stringify(first.state,null,2)+'\n');
