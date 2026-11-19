import fs from 'node:fs';import assert from 'node:assert/strict';
import {fixturePlan} from './test-accounting-review-fixture.mjs';
import {beginWithdrawal,rememberHash} from './ui/withdrawal-journal.mjs';
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
 if(q.method==='eth_getBlockByNumber')return q.params[0]==='0x0'?{hash:state.genesisHash}:q.params[0]===plan.blockNumber?{hash:mode==='orphaned anchor'?'0x'+'99'.repeat(32):plan.blockHash}:{hash:current,number:'0x20',transactions:mode==='absent from block'?[]:[tx]};
 if(q.method==='eth_getTransactionReceipt')return mode==='missing'?null:{transactionHash:mode==='bad receipt'?'0x'+'99'.repeat(32):tx,from:plan.from,to:plan.to,status:mode==='reverted'?'0x0':'0x1',blockHash:current,blockNumber:'0x20',transactionIndex:'0x0'};
 if(q.method==='eth_getTransactionByHash')return {hash:tx,from:plan.from,to:plan.to,input:plan.data,value:plan.value,nonce:plan.nonce,chainId:plan.chainId,blockHash:current,blockNumber:'0x20',transactionIndex:'0x0'};
 if(q.method==='eth_sendTransaction')sent++;
 throw Error('Unexpected method '+q.method);
}};
const run=async(name,fn)=>{await fn();checks.push(name);};
const {s,original}=await setup(),raw=s.getItem(OUTCOME_PREFIX+actionId);
for(const [m,expected]of [['match','MATCHES_PRIOR'],['missing','NOT_CURRENTLY_CONFIRMED'],['reverted','CONFLICTS_PRIOR'],['moved','CONFLICTS_PRIOR'],['offline','INCONCLUSIVE'],['bad receipt','INCONCLUSIVE'],['wrong chain','INCONCLUSIVE'],['wrong account','INCONCLUSIVE'],['orphaned anchor','INCONCLUSIVE'],['absent from block','INCONCLUSIVE']])await run(m+' observation retained without rewriting original',async()=>{mode=m;const e=await recheckReceiptOutcome(s,locks,state,original,provider,attempt(),1234);assert.equal(e.classification,expected);assert.equal(s.getItem(OUTCOME_PREFIX+actionId),raw);});
await run('all observations remain ordered after reload',()=>{const log=readReceiptRechecks(s,original,state);assert.equal(log.entries.length,10);assert.equal(log.entries[1].classification,'NOT_CURRENTLY_CONFIRMED');assert.equal(log.entries[2].classification,'CONFLICTS_PRIOR');});
mode='match';
await run('changed archive during provider reads blocks append',async()=>{const {s,original}=await setup();hook=()=>s.setItem(OUTCOME_PREFIX+actionId,'changed');await assert.rejects(()=>recheckReceiptOutcome(s,locks,state,original,provider,attempt()));assert.equal(s.getItem(RECHECK_PREFIX+actionId),null);});
await run('duplicate attempt identity preserves prior entries',async()=>{const {s,original}=await setup(),id=attempt();await recheckReceiptOutcome(s,locks,state,original,provider,id);const before=s.getItem(RECHECK_PREFIX+actionId);await assert.rejects(()=>recheckReceiptOutcome(s,locks,state,original,provider,id));assert.equal(s.getItem(RECHECK_PREFIX+actionId),before);});
await run('write failure retains original and prior history',async()=>{const {s,original}=await setup();await recheckReceiptOutcome(s,locks,state,original,provider,attempt());const before=s.getItem(RECHECK_PREFIX+actionId);s.setItem=()=>{throw Error('quota');};await assert.rejects(()=>recheckReceiptOutcome(s,locks,state,original,provider,attempt()));assert.equal(s.getItem(RECHECK_PREFIX+actionId),before);});
await run('lost write does not claim saved result',async()=>{const {s,original}=await setup();s.setItem=()=>{};await assert.rejects(()=>recheckReceiptOutcome(s,locks,state,original,provider,attempt()));assert.equal(s.getItem(RECHECK_PREFIX+actionId),null);});
await run('malformed log is not overwritten',async()=>{const {s,original}=await setup();s.setItem(RECHECK_PREFIX+actionId,'broken');await assert.rejects(()=>recheckReceiptOutcome(s,locks,state,original,provider,attempt()));assert.equal(s.getItem(RECHECK_PREFIX+actionId),'broken');});
await run('classification inconsistent with stored observation rejects',()=>{const log=readReceiptRechecks(s,original,state);log.entries[1].classification='MATCHES_PRIOR';const other=storage();other.setItem(RECHECK_PREFIX+actionId,JSON.stringify(log));assert.throws(()=>readReceiptRechecks(other,original,state));});
await run('64-entry limit retains full history without pruning',async()=>{const {s,original}=await setup();for(let i=0;i<64;i++)await recheckReceiptOutcome(s,locks,state,original,provider,attempt(),i);const before=s.getItem(RECHECK_PREFIX+actionId);await assert.rejects(()=>recheckReceiptOutcome(s,locks,state,original,provider,attempt()));assert.equal(s.getItem(RECHECK_PREFIX+actionId),before);});
await run('read-only checks never request submission',()=>assert.equal(sent,0));
console.log(JSON.stringify({passed:checks.length,checks,scope:'Controlled provider observations and local append-only recheck history; no public finality or authenticated receipt inclusion.'},null,2));
