import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {createConsole} from './server.mjs';
import {acquireVerifiedReceipt} from './strict-console-acquisition.mjs';
import {exportReceiptHistory} from './ui/receipt-export.mjs';
import {OUTCOME_PREFIX} from './ui/receipt-outcomes.mjs';
import {mountReceiptHistory} from './ui/receipt-history-panel.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {withdrawalData} from './ui/withdrawal-plan.mjs';
import {verifyWithdrawalProofPackage} from './withdrawal-proof-package.mjs';
const dir=process.argv[2],read=n=>JSON.parse(fs.readFileSync(dir+'/'+n)),e=read('withdrawal-boundaries.json'),s=read('withdrawal-selection.json'),capture=read('capture.json');
const before=e.before,after=e.after,genesis=capture.blocks[0].block.hash;
const tx=inspectBlockSenders(after.header,e.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:after.header.hash,chainId:'0x7a69',allowUnprotectedLegacy:false}).transactions[0];
const state={chainId:'0x7a69',genesisHash:genesis,controller:s.config.controller,contracts:Object.fromEntries(Object.entries(s.config.contracts).map(([k,v])=>[k,v.address]))};
const plan={chainId:'0x7a69',from:tx.from,to:tx.to,data:tx.data,value:tx.value,nonce:tx.nonce,epoch:before.observed.epoch,amount:s.amount,blockNumber:before.header.number,blockHash:before.header.hash,genesisHash:genesis};
const original={version:1,scope:'LOCAL_PROVIDER_RECEIPT_CHECK',action:{version:1,id:'0x'+'ab'.repeat(16),phase:'submitted',plan,contracts:state.contracts,hash:tx.hash},transactionHash:tx.hash,receipt:{status:'confirmed',blockHash:after.header.hash,blockNumber:after.header.number}};
async function pack(o=original){return(await exportReceiptHistory({getItem:k=>k===OUTCOME_PREFIX+o.action.id?JSON.stringify(o):null},{request:async(_n,_o,f)=>f({})},state,o)).text;}
const exportText=await pack();let mode='valid',proofCalls=0;const checks=[];
async function rpc(method,p){
 assert(['eth_chainId','eth_getBlockByNumber','eth_getBlockByHash','eth_getTransactionReceipt','eth_getRawTransactionByHash','eth_getProof'].includes(method),'READ_ONLY');
 if(method==='eth_chainId')return mode==='chain'?'0x1':'0x7a69';
 if(method==='eth_getBlockByNumber'){
  if(p[0]==='0x0')return {hash:mode==='genesis'?'0x'+'00'.repeat(32):genesis};
  const h=[before.header,after.header].find(h=>h.number===p[0]);return mode==='reorg'?{...h,hash:'0x'+'00'.repeat(32)}:h;
 }
 if(method==='eth_getBlockByHash'){
  const h=structuredClone([before.header,after.header].find(h=>h.hash===p[0]));
  if(mode==='mixed'&&h?.hash===after.header.hash)h.transactions.push(tx.hash);
  if(mode==='header'&&h)h.stateRoot='0x'+'00'.repeat(32);
  return h;
 }
 if(method==='eth_getTransactionReceipt'){const r=structuredClone(e.receipts[0]);if(mode==='missing')return null;if(mode==='receipt')r.status='0x0';return r;}
 if(method==='eth_getRawTransactionByHash')return mode==='raw'?e.rawTransactions[0]+'00':e.rawTransactions[0];
 if(method==='eth_getProof'){
  proofCalls++;assert.equal(p[2].requireCanonical,true);const boundary=[before,after].find(b=>b.header.hash===p[2].blockHash);assert(boundary);
  const proof=structuredClone(Object.values(boundary.proofs).find(x=>x.address===p[0]));assert(proof);
  if(mode==='missing-proof')return null;
  if(mode==='proof-value'&&proof.storageProof.length)proof.storageProof[0].value='0xffff';
  if(mode==='proof-node')proof.accountProof=[];
  return proof;
 }
}
const proxy=http.createServer(async(req,res)=>{try{let body='';for await(const c of req)body+=c;const q=JSON.parse(body);res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result:await rpc(q.method,q.params)}));}catch(err){res.end(JSON.stringify({jsonrpc:'2.0',id:1,error:{code:-1,message:err.message}}));}});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const config={...s.config,genesisHash:genesis,rpcUrl:'http://127.0.0.1:'+proxy.address().port,postingDeployment:{blockNumber:before.header.number,blockHash:before.header.hash,transactionHash:tx.hash}};
const app=createConsole(config);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
async function request(text=exportText,headers={}){const r=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/verified-receipt',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({exportText:text})});return {status:r.status,result:await r.json()};}
try{
 let good;
 for(mode of ['valid','chain','genesis','mixed','header','missing','receipt','raw','missing-proof','proof-value','proof-node','reorg','valid']){
  const r=await request();if(mode==='valid'){assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.result.status,'INCLUDED_WITHDRAWAL_MATCHES_LOCAL_RECORD');assert.equal(r.result.accountingEffectsVerified,true);good=r.result;}else assert.equal(r.status,422,mode);checks.push('endpoint '+mode);
 }
 const downloads=proofCalls;
 const replay=verifyWithdrawalProofPackage(JSON.parse(JSON.stringify(good.proofPackage)),s);
 assert.equal(replay.transactionHash,tx.hash);
 assert.equal(replay.accountingEffectsVerified,true);
 assert.equal(proofCalls,downloads);
 assert(!JSON.stringify(good.proofPackage).includes(config.rpcUrl));
 checks.push('downloaded endpoint evidence verifies offline against fixture selection');
 for(const[name,change,field]of [['amount',o=>{o.action.plan.amount='1';o.action.plan.data=withdrawalData(state.contracts.custody,plan.epoch,'1','eoa');},'plan.amount'],['nonce',o=>o.action.plan.nonce='0xff','plan.nonce'],['epoch',o=>{o.action.plan.epoch='99';o.action.plan.data=withdrawalData(state.contracts.custody,'99',plan.amount,'eoa');},'plan.epoch'],['receipt status',o=>o.receipt.status='reverted','receipt.status'],['receipt block',o=>o.receipt.blockHash='0x'+'99'.repeat(32),'receipt.blockHash'],['review anchor',o=>o.action.plan.blockHash='0x'+'88'.repeat(32),'plan.reviewAnchorOutsideSelectedHistory']]){
  const o=structuredClone(original);change(o);const r=await request(await pack(o));assert.equal(r.status,200);assert.equal(r.result.status,'INCLUDED_WITHDRAWAL_WITH_LOCAL_RECORD_DISCREPANCIES');assert(r.result.discrepancies.includes(field));checks.push('preserved discrepancy '+name);
 }
 assert.equal((await request('{}')).status,422);checks.push('malformed export rejected');
 assert.equal((await request(exportText,{Origin:'https://example.invalid'})).status,403);checks.push('foreign origin rejected');
 const ctrl=new AbortController();ctrl.abort();await assert.rejects(()=>acquireVerifiedReceipt(rpc,config,exportText,ctrl.signal));checks.push('interrupted acquisition rejects');
 const recovered=await acquireVerifiedReceipt(rpc,config,exportText);assert.equal(recovered.status,good.status);checks.push('retry recovers without resubmission');
 class Element{constructor(){this.textContent='';this.disabled=false;this.listeners={};}addEventListener(n,f){this.listeners[n]=f;}}
 const nodes=Object.fromEntries(['verify-receipt-history','export-withdrawal-proofs','receipt-history-status','refresh','confirm','recover','check-receipt','recheck-outcome'].map(k=>[k,new Element()]));let payload=good,hold=null;
 const panel=mountReceiptHistory({getElementById:k=>nodes[k]},async()=>exportText,async()=>{if(hold)await hold;return new Response(JSON.stringify(payload));},new Element());
 const label=()=>nodes['receipt-history-status'].textContent;
 await panel.verify();assert.match(label(),/Custody, credit and recipient token changes verified/);checks.push('panel displays verified accounting');
 for(const [name,mutate]of [['missing accounting',v=>v.accountingEffectsVerified=false],['public finality',v=>v.publicChainAuthenticated=true],['wrong export',v=>v.exportSha256='0'.repeat(64)],['missing ownership',v=>delete v.ownershipVerified]]){payload=structuredClone(good);mutate(payload);await panel.verify();assert.match(label(),/Not accepted/);checks.push('panel rejects '+name);}
 payload={...good,status:'INCLUDED_WITHDRAWAL_WITH_LOCAL_RECORD_DISCREPANCIES',discrepancies:['plan.amount']};await panel.verify();assert.match(label(),/saved fields disagree/);checks.push('panel retains mismatch');
 payload=good;let release;hold=new Promise(r=>release=r);const pending=panel.verify();await new Promise(r=>setImmediate(r));panel.clear();release();await pending;assert.match(label(),/^Not checked/);checks.push('late verification cannot restore cleared result');
 hold=null;await panel.verify();assert.match(label(),/Withdrawal included/);checks.push('panel retries after interruption');
 fs.writeFileSync(dir+'/withdrawal-export.json',exportText);fs.writeFileSync(dir+'/console-result.json',JSON.stringify({result:good,checks,count:checks.length},null,2)+'\n');console.log(JSON.stringify({count:checks.length,checks},null,2));
}finally{await new Promise(r=>app.server.close(r));await new Promise(r=>proxy.close(r));}

