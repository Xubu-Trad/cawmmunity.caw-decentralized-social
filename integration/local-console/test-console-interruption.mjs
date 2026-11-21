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
let fault='none',point='registry',hits=0,upstreamClosed=false;
let reached;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const checks=[];
const target=q=>point==='registry'?q.method==='eth_getProof'&&q.params[0]===selection.contracts.registry.address:
 point==='receipt'?q.method==='eth_getTransactionReceipt'&&q.params[0]===bundle.blocks.at(-1).header.transactions[0]:
 q.method==='eth_getProof'&&q.params[2]?.blockHash===tip.hash;
const proxy=http.createServer(async(req,res)=>{
 let input='';for await(const c of req)input+=c;const q=JSON.parse(input);
 try{
  const value=result(q.method,q.params);
  if(fault!=='none'&&target(q)){
   hits++;res.on('close',()=>{upstreamClosed=true;});reached?.();
   if(fault==='stall')return;
   if(fault==='truncate'){res.writeHead(200,{'Content-Type':'application/json','Content-Length':'100000'});res.write('{"jsonrpc":"2.0","result":');setTimeout(()=>res.destroy(),20);return;}
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result:value}));
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const config={...selection,rpcUrl:'http://127.0.0.1:'+proxy.address().port,genesisHash:genesis,postingDeployment:{blockNumber:bundle.anchor.number,blockHash:bundle.anchor.hash,transactionHash:'0x'+'12'.repeat(32)}};
let app,base;
async function start(){app=createConsole(config);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;}
async function accepted(){fault='none';const r=await fetch(base+'/api/verified-posts');const v=await r.json();assert.equal(r.status,200,JSON.stringify(v));assert.equal(v.posts.length,2);assert.equal(v.status,'VERIFIED_LOCAL_HISTORY');return v;}
async function until(predicate,ms=1200){const start=performance.now();while(!predicate()){if(performance.now()-start>ms)throw Error('CANCELLATION_NOT_PROPAGATED');await pause(10);}}
try{
 await start();const good=await accepted();checks.push('initial full strict verification');
 for(point of ['registry','receipt','final-proof']){
  fault='stall';hits=0;upstreamClosed=false;let release;const atTarget=new Promise(r=>release=r);reached=release;
  const controller=new AbortController();const request=fetch(base+'/api/verified-posts',{signal:controller.signal}).then(()=>({unexpected:true}),e=>({aborted:e.name}));
  await Promise.race([atTarget,pause(5000).then(()=>{throw Error('TARGET_NOT_REACHED');})]);
  const busy=await fetch(base+'/api/verified-posts');assert.equal(busy.status,429);await busy.text();
  controller.abort();assert.equal((await request).aborted,'AbortError');await until(()=>upstreamClosed);
  const count=calls;await pause(40);assert.equal(calls,count,'no later acquisition after cancellation');
  await accepted();checks.push('disconnect at '+point+' cancels upstream and permits clean retry');
 }
 for(point of ['registry','receipt','final-proof']){
  fault='truncate';hits=0;const r=await fetch(base+'/api/verified-posts');const v=await r.json();assert.equal(r.status,422);assert(!('posts'in v));assert.equal(hits,1);await accepted();checks.push('truncated '+point+' rejected then reacquired');
 }
 point='final-proof';fault='stall';hits=0;const startTime=performance.now();const timeout=await fetch(base+'/api/verified-posts');const v=await timeout.json();assert.equal(timeout.status,422);assert(!('posts'in v));assert(performance.now()-startTime>=2500);await accepted();checks.push('existing RPC timeout rejects incomplete acquisition and releases busy');
 await new Promise(r=>app.server.close(r));await start();assert.deepEqual((await accepted()).posts,good.posts);checks.push('server restart reacquires full history without cached acceptance');
 class Element{constructor(){this.children=[];this.textContent='';this.disabled=false;this.listeners={};}addEventListener(n,f){this.listeners[n]=f;}replaceChildren(...x){this.children=x;}append(...x){this.children.push(...x);}}
 const nodes=Object.fromEntries(['verify-history','verified-history-status','verified-posts','refresh','confirm'].map(n=>[n,new Element()]));const doc={getElementById:n=>nodes[n],createElement:()=>new Element()};
 let activeSignal,bodyRelease,bodyMode='hold';
 const panel=mountStrictHistory(doc,async(url,opts)=>{activeSignal=opts.signal;return {ok:true,text:()=>bodyMode==='hold'?new Promise(r=>bodyRelease=r):Promise.resolve(JSON.stringify(good))};});
 const old=panel.verify();await until(()=>bodyRelease);panel.clear();assert(activeSignal.aborted,'refresh must cancel pending request body');
 bodyMode='good';await panel.verify();const status=nodes['verified-history-status'].textContent;assert.equal(nodes['verified-posts'].children.length,2);
 bodyRelease(JSON.stringify({...good,posts:[]}));await old;assert.equal(nodes['verified-posts'].children.length,2);assert.equal(nodes['verified-history-status'].textContent,status);checks.push('late old body cannot overwrite a newer verified result');
 bodyMode='hold';bodyRelease=null;const during=panel.verify();await until(()=>bodyRelease);nodes.confirm.listeners.click();assert(activeSignal.aborted);bodyRelease(JSON.stringify(good));await during;assert.equal(nodes['verified-posts'].children.length,0);checks.push('action confirmation cancels in-flight verification');
 console.log(JSON.stringify({passed:checks.length,checks,scope:'Recorded valid local proofs served over real HTTP sockets; controlled interruptions and server recreation. Minimal DOM tests; no fresh EVM execution or independent operator claim.'},null,2));
}finally{if(app?.server.listening){app.server.closeAllConnections();await new Promise(r=>app.server.close(r));}proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}
