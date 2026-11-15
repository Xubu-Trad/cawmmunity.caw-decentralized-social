import {mountReceiptHistory} from './ui/receipt-history-panel.mjs';
import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createConsole} from './server.mjs';
import {mountStrictHistory} from './ui/strict-history-panel.mjs';
const dir=process.argv[2],bundle=JSON.parse(fs.readFileSync(dir+'/capture.json')),selection=JSON.parse(fs.readFileSync(dir+'/selection.json'));
const genesis=JSON.parse(fs.readFileSync(dir+'/fixture-context.json')).genesisHash,tip=bundle.blocks.at(-1).header;
let mode='valid',calls=0;const readMethods=new Set(['eth_chainId','eth_getBlockByNumber','eth_getProof','eth_getRawTransactionByHash','eth_getTransactionReceipt']);
function result(method,p){
 assert(readMethods.has(method),'READ_ONLY');calls++;
 if(method==='eth_chainId')return '0x7a69';
 if(method==='eth_getBlockByNumber'){
  if(p[0]==='0x0')return {hash:genesis};
  if(p[0]==='latest')return tip;
  if(mode==='reorg'&&p[0]===tip.number&&calls>20)return {...tip,hash:'0x'+'01'.repeat(32)};
  return p[0]===bundle.anchor.number?bundle.anchor:bundle.blocks.find(x=>x.header.number===p[0]).header;
 }
 if(method==='eth_getProof'){
  assert.equal(p[2].requireCanonical,true);assert.equal(typeof p[2].blockHash,'string');
  let proof;if(p[2].blockHash===tip.hash)proof=bundle.finalPosting;
  else {const row=bundle.blocks.find((r,i)=>(i?bundle.blocks[i-1].header:bundle.anchor).hash===p[2].blockHash);proof=Object.values(row.parent).find(x=>x.address===p[0]);}
  if(mode==='proof'&&p[0]===selection.contracts.registry.address){proof=structuredClone(proof);proof.storageProof[0].value='0x1';}return proof;
 }
 const row=bundle.blocks.find(x=>x.header.transactions.includes(p[0]));
 if(method==='eth_getRawTransactionByHash'){const raw=row.rawTransactions[0];return mode==='raw'?raw.slice(0,-2)+'ff':raw;}
 if(method==='eth_getTransactionReceipt'){if(mode==='missing')return null;const r=structuredClone(row.receipts[0]);if(mode==='receipt')r.status='0x0';return r;}
}
const proxy=http.createServer(async(req,res)=>{let s='';for await(const c of req)s+=c;const q=JSON.parse(s);try{const v=result(q.method,q.params);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(mode==='rpc-error'&&q.method==='eth_getProof'?{jsonrpc:'2.0',id:q.id,error:{code:-1,message:'fixture error'}}:{jsonrpc:'2.0',id:q.id,result:v}));}catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const config={...selection,rpcUrl:'http://127.0.0.1:'+proxy.address().port,genesisHash:genesis,postingDeployment:{blockNumber:bundle.anchor.number,blockHash:bundle.anchor.hash,transactionHash:'0x'+'12'.repeat(32)}};
const app=createConsole(config);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;const checks=[];

const exportText=fs.readFileSync(dir+'/post-export.json','utf8'),expected=JSON.parse(exportText);
async function request(body={exportText},headers={}){const res=await fetch(base+'/api/verified-receipt',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return {res,v:await res.json()};}
try{
 let good;
 for(mode of ['valid','raw','receipt','proof','missing','rpc-error','reorg','valid']){
  calls=0;const {res,v}=await request();
  if(mode==='valid'){assert.equal(res.status,200,JSON.stringify(v));assert.equal(v.status,'INCLUDED_POST_MATCHES_LOCAL_RECORD');assert.equal(v.exportSha256,expected.sha256);good=v;}
  else{assert.equal(res.status,422,mode);assert(!('transactionIncluded'in v));}
  checks.push('strict receipt endpoint '+mode);
 }
 for(const [name,body,headers,status]of [['wrong field',{other:exportText},{},422],['invalid export',{exportText:'{}'},{},422],['foreign origin',{exportText},{Origin:'https://example.invalid'},403],['oversized request',{exportText:'x'.repeat(220001)},{},422]]){
  const {res}=await request(body,headers);assert.equal(res.status,status,name);checks.push(name+' rejected');
 }
 class Element{constructor(){this.textContent='';this.disabled=false;this.listeners={};}addEventListener(n,f){this.listeners[n]=f;}}
 const names=['verify-receipt-history','receipt-history-status','refresh','confirm','check-receipt','recheck-outcome'];
 const nodes=Object.fromEntries(names.map(n=>[n,new Element()])),doc={getElementById:n=>nodes[n]},events=new Element();
 let payload=good,ok=true,wait=null,exportWait=null;
 const panel=mountReceiptHistory(doc,async()=>{if(exportWait)await exportWait;return exportText;},async()=>{if(wait)await wait;return {ok,text:async()=>JSON.stringify(payload)};},events);
 const label=()=>nodes['receipt-history-status'].textContent;
 await panel.verify();assert.match(label(),/compared saved fields match/);checks.push('UI matching inclusion');
 payload={...good,status:'INCLUDED_POST_WITH_LOCAL_RECORD_DISCREPANCIES',discrepancies:['receipt.blockHash']};await panel.verify();assert.match(label(),/saved fields disagree/);checks.push('UI conflict remains distinct');
 payload={...good,status:'NOT_FOUND_IN_SELECTED_VERIFIED_POST_HISTORY',transactionIncluded:false};await panel.verify();assert.match(label(),/does not prove it never occurred/);checks.push('UI selected-range absence');
 for(const [name,change]of [['wrong export',v=>v.exportSha256='0'.repeat(64)],['wrong transaction',v=>v.transactionHash='0x'+'99'.repeat(32)],['false public finality',v=>v.publicChainAuthenticated=true],['missing signature proof',v=>delete v.signaturesVerified],['inconsistent match',v=>v.discrepancies=['receipt.status']]]){
  payload=structuredClone(good);change(payload);await panel.verify();assert.match(label(),/Not accepted/);checks.push('UI rejects '+name);
 }
 payload={error:'proof rejected'};ok=false;await panel.verify();assert.match(label(),/Not accepted/);assert(!label().includes('compared saved fields match'));checks.push('failure clears earlier acceptance');ok=true;payload=good;
 for(const trigger of ['refresh','confirm','check-receipt','recheck-outcome','storage']){
  let release;wait=new Promise(r=>release=r);const job=panel.verify();await new Promise(r=>setTimeout(r,0));
  if(trigger==='storage')events.listeners.storage();else nodes[trigger].listeners.click();
  release();await job;wait=null;assert.match(label(),/^Not checked/);assert.equal(nodes['verify-receipt-history'].disabled,false);checks.push('late response discarded after '+trigger);
 }
 let release;exportWait=new Promise(r=>release=r);const pending=panel.verify();panel.clear();release();await pending;exportWait=null;assert.match(label(),/^Not checked/);checks.push('cancel during export snapshot discards result');
 const errorPanel=mountReceiptHistory(doc,async()=>{throw Error('Posting receipts only');},async()=>{throw Error('must not request')},events);await errorPanel.verify();assert.match(label(),/Posting receipts only/);checks.push('unsupported selection shows rejection without fetch');
 console.log(JSON.stringify({passed:checks.length,checks,scope:'Real loopback server with retained signed capture served by controlled read-only RPC; DOM controller tests, not browser wallet or fresh execution.'},null,2));
}finally{app.server.closeAllConnections();proxy.closeAllConnections();await new Promise(r=>app.server.close(r));await new Promise(r=>proxy.close(r));}
