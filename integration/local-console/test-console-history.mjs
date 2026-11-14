import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createConsole} from './server.mjs';
import {mountStrictHistory} from './ui/strict-history-panel.mjs';
const dir=process.argv[2],bundle=JSON.parse(fs.readFileSync(dir+'/capture.json')),selection=JSON.parse(fs.readFileSync(dir+'/selection.json'));
const genesis='0x'+'ab'.repeat(32),tip=bundle.blocks.at(-1).header;
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
try{
 for(mode of ['valid','raw','receipt','proof','missing','rpc-error','reorg','valid']){
  calls=0;const res=await fetch(base+'/api/verified-posts'),v=await res.json();
  if(mode==='valid'){assert.equal(res.status,200,JSON.stringify(v));assert.equal(v.posts.length,2);assert.equal(v.status,'VERIFIED_LOCAL_HISTORY');assert.equal(v.publicChainAuthenticated,false);}
  else{assert.equal(res.status,422,mode);assert(!('posts'in v),mode+' must not return accepted rows');}
  checks.push(mode);
 }
 // Minimal DOM exercises visible acceptance, failure clearing and stale responses.
 class Element{constructor(){this.children=[];this.textContent='';this.disabled=false;this.listeners={};}addEventListener(n,f){this.listeners[n]=f;}replaceChildren(...x){this.children=x;}append(...x){this.children.push(...x);}}
 const nodes=Object.fromEntries(['verify-history','verified-history-status','verified-posts','refresh','confirm'].map(x=>[x,new Element()]));const doc={getElementById:n=>nodes[n],createElement:()=>new Element()};
 mode='valid';calls=0;const good=await(await fetch(base+'/api/verified-posts')).json();let payload=good,ok=true,pending=null;
 const panel=mountStrictHistory(doc,async()=>{if(pending)await pending;return {ok,text:async()=>JSON.stringify(payload)};});
 await panel.verify();assert.equal(nodes['verified-posts'].children.length,2);assert.equal(nodes['verified-posts'].children[0].children[1].textContent,good.posts[0].text);checks.push('UI renders literal verified text');
 ok=false;payload={error:'proof rejected'};await panel.verify();assert.equal(nodes['verified-posts'].children.length,0);assert.match(nodes['verified-history-status'].textContent,/Not accepted/);checks.push('UI clears accepted rows after failure');
 ok=true;payload={...good,signaturesVerified:false};await panel.verify();assert.equal(nodes['verified-posts'].children.length,0);checks.push('UI rejects incomplete acceptance');
 payload=good;let release;pending=new Promise(r=>release=r);const task=panel.verify();panel.clear();release();await task;assert.equal(nodes['verified-posts'].children.length,0);checks.push('UI discards stale verification response');
 console.log(JSON.stringify({checks,passed:checks.length,scope:'HTTP integration with recorded valid proofs and mutated RPC responses; minimal DOM state tests, not live browser or fresh execution.'},null,2));
}finally{await new Promise(r=>app.server.close(r));await new Promise(r=>proxy.close(r));}
