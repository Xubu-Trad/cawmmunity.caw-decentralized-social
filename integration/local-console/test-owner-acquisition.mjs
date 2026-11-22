import http from 'node:http';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createConsole} from './server.mjs';
import {mountStrictHistory} from './ui/strict-history-panel.mjs';
import {verifyOwnerPostBlock} from './post-authority-sequence.mjs';
const evidence=JSON.parse(fs.readFileSync(process.argv[2]));
const {ownerBundle:b,selection:s}=evidence,genesis='0x'+'ab'.repeat(32),C=s.contracts;
let mode='valid',fault='none',point='recipient',calls=0,tipReads=0,hit=0,closed=false,reached;
const checks=[],pause=ms=>new Promise(r=>setTimeout(r,ms));
const isTarget=q=>q.method==='eth_getProof'&&(point==='recipient'?q.params[0]===s.controller:q.params[0]===C.registry.address&&q.params[2].blockHash===b.header.hash);
function result(method,p){
 calls++;
 if(method==='eth_chainId')return '0x7a69';
 if(method==='eth_getBlockByNumber'){
  if(p[0]==='0x0')return {hash:genesis};
  if(p[0]===b.parent.number)return b.parent;
  if(p[0]==='latest')return b.header;
  assert.equal(p[0],b.header.number);tipReads++;
  return mode==='reorg'&&tipReads>1?{...b.header,hash:'0x'+'11'.repeat(32)}:b.header;
 }
 if(method==='eth_getProof'){
  assert.equal(p[2].requireCanonical,true);let proof;
  if(p[2].blockHash===b.parent.hash)proof=p[0]===C.registry.address?b.initialRegistry:p[0]===C.posting.address?b.initialPosting:b.ownerProofs[p[0]];
  else{assert.equal(p[2].blockHash,b.header.hash);proof=p[0]===C.registry.address?b.finalRegistry:b.finalPosting;}
  proof=structuredClone(proof);
  if(mode==='bad-final'&&p[0]===C.registry.address&&p[2].blockHash===b.header.hash)proof.accountProof[0]='0xc0';
  if(mode==='bad-recipient'&&p[0]===s.controller)proof.accountProof[0]='0xc0';
  if(mode==='missing-recipient'&&p[0]===s.controller)return null;
  return proof;
 }
 const index=b.header.transactions.indexOf(p[0]);assert(index>=0);
 if(method==='eth_getRawTransactionByHash')return b.rawTransactions[index];
 assert.equal(method,'eth_getTransactionReceipt','READ_ONLY');const r=structuredClone(b.receipts[index]);
 if(mode==='receipt'&&index===1)r.status='0x0';return r;
}
const proxy=http.createServer(async(req,res)=>{
 let raw='';for await(const c of req)raw+=c;const q=JSON.parse(raw);
 try{
  const value=result(q.method,q.params);
  if(fault!=='none'&&isTarget(q)){
   hit++;res.on('close',()=>closed=true);reached?.();
   if(fault==='stall')return;
   res.writeHead(200,{'Content-Type':'application/json','Content-Length':'100000'});res.write('{"result":');setTimeout(()=>res.destroy(),20);return;
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(mode==='rpc-error'&&isTarget(q)?{jsonrpc:'2.0',id:q.id,error:{code:-1,message:'fixture rejection'}}:{jsonrpc:'2.0',id:q.id,result:value}));
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const config={...s,rpcUrl:'http://127.0.0.1:'+proxy.address().port,genesisHash:genesis,postingDeployment:{blockNumber:b.parent.number,blockHash:b.parent.hash,transactionHash:'0x'+'12'.repeat(32)}};
const app=createConsole(config);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
async function accepted(){mode='valid';fault='none';tipReads=0;const r=await fetch(base+'/api/verified-posts'),v=await r.json();assert.equal(r.status,200,JSON.stringify(v));assert.equal(v.posts.length,1);assert.equal(v.transfers.length,1);assert.equal(v.posts[0].author,s.controller);assert.equal(v.posts[0].epoch,'2');assert.equal(v.intraBlockOwnershipVerified,true);return v;}
async function until(p){const start=Date.now();while(!p()){if(Date.now()-start>1500)throw Error('CANCELLATION_NOT_PROPAGATED');await pause(10);}}
try{
 const good=await accepted();checks.push('HTTP verifies transfer then new-owner post');
 for(mode of ['bad-final','bad-recipient','missing-recipient','receipt','rpc-error','reorg']){
  tipReads=0;const r=await fetch(base+'/api/verified-posts'),v=await r.json();assert.equal(r.status,422,mode);assert(!('posts'in v),mode);checks.push(mode+' rejects without accepted rows');
 }
 await accepted();checks.push('clean reacquisition after rejection');
 for(point of ['recipient','final-registry']){
  fault='stall';closed=false;hit=0;let reach;const target=new Promise(r=>reach=r);reached=reach;
  const controller=new AbortController();const request=fetch(base+'/api/verified-posts',{signal:controller.signal}).then(()=>({unexpected:true}),e=>({name:e.name}));
  await Promise.race([target,pause(5000).then(()=>{throw Error('TARGET_NOT_REACHED');})]);
  const busy=await fetch(base+'/api/verified-posts');assert.equal(busy.status,429);await busy.text();
  controller.abort();assert.equal((await request).name,'AbortError');await until(()=>closed);const n=calls;await pause(40);assert.equal(calls,n);assert.equal(hit,1);await accepted();checks.push('cancel '+point+' stops upstream and allows retry');
  fault='truncate';hit=0;const r=await fetch(base+'/api/verified-posts'),v=await r.json();assert.equal(r.status,422);assert(!('posts'in v));assert.equal(hit,1);await accepted();checks.push('truncated '+point+' rejects then retry succeeds');
 }
 assert.throws(()=>verifyOwnerPostBlock(b,{...s,expectedNonce:'1'}),e=>e.message.includes('INITIAL_HISTORY_NONCE'));checks.push('initial posting nonce gap rejected');
 class Element{constructor(){this.children=[];this.textContent='';this.disabled=false;this.listeners={};}addEventListener(n,f){this.listeners[n]=f;}replaceChildren(...x){this.children=x;}append(...x){this.children.push(...x);}}
 const nodes=Object.fromEntries(['verify-history','verified-history-status','verified-posts','refresh','confirm'].map(x=>[x,new Element()]));const doc={getElementById:n=>nodes[n],createElement:()=>new Element()};
 let payload=good,ok=true;const panel=mountStrictHistory(doc,async()=>({ok,text:async()=>JSON.stringify(payload)}));await panel.verify();assert.equal(nodes['verified-posts'].children.length,1);assert.equal(nodes['verified-posts'].children[0].children[1].textContent,good.posts[0].text);checks.push('existing UI renders verified new-owner post');
 ok=false;payload={error:'recipient proof rejected'};await panel.verify();assert.equal(nodes['verified-posts'].children.length,0);checks.push('UI clears history after failed recheck');
 console.log(JSON.stringify({passed:checks.length,checks,scope:'Actual loopback console HTTP with preserved mined evidence and injected transport failures; not fresh execution or independent operator.'},null,2));
}finally{app.server.closeAllConnections();proxy.closeAllConnections();await new Promise(r=>app.server.close(r));await new Promise(r=>proxy.close(r));}
