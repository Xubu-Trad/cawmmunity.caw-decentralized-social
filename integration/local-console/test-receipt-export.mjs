import {exportReceiptHistory,verifyReceiptExport} from './ui/receipt-export.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {fixturePlan} from './test-accounting-review-fixture.mjs';
import {beginWithdrawal,beginTransfer,beginPost,rememberHash} from './ui/withdrawal-journal.mjs';
import {archiveReceiptOutcome,readLastReceiptOutcome,OUTCOME_PREFIX} from './ui/receipt-outcomes.mjs';
import {recheckReceiptOutcome,readReceiptRechecks,RECHECK_PREFIX} from './ui/receipt-rechecks.mjs';
const state=JSON.parse(fs.readFileSync(process.argv[2])).before,plan={...fixturePlan(state),nonce:'0x0'},locks={request:async(_n,_o,fn)=>fn({})};
const actionId='0x'+'12'.repeat(16),tx='0x'+'34'.repeat(32),block='0x'+'56'.repeat(32),checks=[];let sequence=0,mode='match',hook=null;
const attempt=()=> '0x'+(++sequence).toString(16).padStart(32,'0');
function storage(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
async function setup(){const s=storage();await beginWithdrawal(s,locks,state,plan,actionId,state);await rememberHash(s,locks,state,actionId,tx);await archiveReceiptOutcome(s,locks,state,actionId,tx,{status:'confirmed',blockNumber:'0x20',blockHash:block});return {s,original:readLastReceiptOutcome(s,state)};}
let sent=0;
const provider={async request(q){
 if(hook){const h=hook;hook=null;h();}
 if(mode==='offline')throw Error('provider unavailable');
 if(q.method==='eth_chainId')return mode==='wrong chain'?'0x1':'0x7a69';
 if(q.method==='eth_accounts')return [mode==='wrong account'?'0x'+'99'.repeat(20):state.signer];
 const current=mode==='moved'?'0x'+'78'.repeat(32):block;
 if(q.method==='eth_getBlockByNumber')return q.params[0]==='0x0'?{hash:state.genesisHash}:q.params[0]===plan.blockNumber?{hash:mode==='orphaned anchor'?'0x'+'99'.repeat(32):plan.blockHash}:{hash:current,number:'0x20'};
 if(q.method==='eth_getTransactionReceipt')return mode==='missing'?null:{transactionHash:mode==='bad receipt'?'0x'+'99'.repeat(32):tx,from:plan.from,to:plan.to,status:mode==='reverted'?'0x0':'0x1',blockHash:current,blockNumber:'0x20'};
 if(q.method==='eth_getTransactionByHash')return {hash:tx,from:plan.from,to:plan.to,input:plan.data,value:plan.value,nonce:plan.nonce,chainId:plan.chainId,blockHash:current,blockNumber:'0x20'};
 if(q.method==='eth_sendTransaction')sent++;
 throw Error('Unexpected method '+q.method);
}};

const run=async(name,fn)=>{await fn();checks.push(name);};
const {s,original}=await setup();
for(const m of ['match','missing','reverted','offline']){mode=m;await recheckReceiptOutcome(s,locks,state,original,provider,attempt(),1234);}
const originalRaw=s.getItem(OUTCOME_PREFIX+actionId),historyRaw=s.getItem(RECHECK_PREFIX+actionId);
const exported=await exportReceiptHistory(s,locks,state,original);
await run('export retains original accounting and all observation classes',async()=>{const v=await verifyReceiptExport(exported.text,state);assert.equal(v.observations,4);assert.deepEqual(v.value.original,original);assert.deepEqual(v.value.rechecks,JSON.parse(historyRaw));});
await run('export leaves saved records unchanged',()=>{assert.equal(s.getItem(OUTCOME_PREFIX+actionId),originalRaw);assert.equal(s.getItem(RECHECK_PREFIX+actionId),historyRaw);});
await run('same snapshot exports identically',async()=>assert.deepEqual(await exportReceiptHistory(s,locks,state,original),exported));
await run('empty recheck history is explicit',async()=>{const {s,original}=await setup();assert.equal((await verifyReceiptExport((await exportReceiptHistory(s,locks,state,original)).text,state)).observations,0);});
await run('changed archive rejects export',async()=>{const {s,original}=await setup();s.setItem(OUTCOME_PREFIX+actionId,'changed');await assert.rejects(()=>exportReceiptHistory(s,locks,state,original));});
await run('corrupt history rejects without overwriting',async()=>{const {s,original}=await setup();s.setItem(RECHECK_PREFIX+actionId,'bad');await assert.rejects(()=>exportReceiptHistory(s,locks,state,original));assert.equal(s.getItem(RECHECK_PREFIX+actionId),'bad');});
await run('busy lock rejects export',async()=>await assert.rejects(()=>exportReceiptHistory(s,{request:async(_n,_o,fn)=>fn(null)},state,original)));
await run('missing lock support rejects export',async()=>await assert.rejects(()=>exportReceiptHistory(s,null,state,original)));
await run('payload modification fails checksum',async()=>{const v=JSON.parse(exported.text);v.payload+=' ';await assert.rejects(()=>verifyReceiptExport(JSON.stringify(v),state),/checksum/);});
await run('wrong external contract selection rejects',async()=>await assert.rejects(()=>verifyReceiptExport(exported.text,{...state,contracts:{...state.contracts,custody:'0x'+'99'.repeat(20)}})));
await run('oversized export rejects',async()=>await assert.rejects(()=>verifyReceiptExport('x'.repeat(200001),state)));
await run('unexpected envelope fields reject',async()=>await assert.rejects(()=>verifyReceiptExport(JSON.stringify({...JSON.parse(exported.text),extra:true}),state)));
await run('recomputed checksum does not bypass semantic checks',async()=>{const v=JSON.parse(exported.text),p=JSON.parse(v.payload);p.rechecks.entries[1].classification='MATCHES_PRIOR';v.payload=JSON.stringify(p);v.sha256=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v.payload))).toString('hex');await assert.rejects(()=>verifyReceiptExport(JSON.stringify(v),state));});
await run('export never invokes provider or submits',()=>assert.equal(sent,0));
for(const kind of ['withdrawal','transfer','post'])for(const status of ['confirmed','reverted'])await run(kind+' '+status+' export preserves action and accounting review',async()=>{
 const store=storage(),fn={withdrawal:beginWithdrawal,transfer:beginTransfer,post:beginPost}[kind];
 await fn(store,locks,state,{...fixturePlan(state,kind),nonce:'0x0'},actionId,state);await rememberHash(store,locks,state,actionId,tx);
 await archiveReceiptOutcome(store,locks,state,actionId,tx,{status,blockNumber:'0x20',blockHash:block});const original=readLastReceiptOutcome(store,state);
 const verified=await verifyReceiptExport((await exportReceiptHistory(store,locks,state,original)).text,state);assert.deepEqual(verified.value.original,original);
});
await run('legacy record exports without inventing accounting review',async()=>{const store=storage();await beginWithdrawal(store,locks,state,plan,actionId);await rememberHash(store,locks,state,actionId,tx);await archiveReceiptOutcome(store,locks,state,actionId,tx,{status:'confirmed',blockNumber:'0x20',blockHash:block});const verified=await verifyReceiptExport((await exportReceiptHistory(store,locks,state,readLastReceiptOutcome(store,state))).text,state);assert.equal(verified.value.original.action.accountingReview,undefined);});
fs.writeFileSync(process.argv[3],exported.text);
console.log(JSON.stringify({passed:checks.length,checks,scope:'Local export integrity and structure only, not chain evidence.'},null,2));
