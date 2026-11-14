import {id} from 'ethers';
import http from 'node:http';
import assert from 'node:assert/strict';
export async function accountingHttpControls(createConsole,cfg){
 let mode='valid',touched=0;
 const proxy=http.createServer(async(req,res)=>{
  try{
   const parts=[];for await(const p of req)parts.push(p);
   const q=JSON.parse(Buffer.concat(parts));
   const v=await(await fetch(cfg.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)})).json();
   const target=q.params?.[0]?.to?.toLowerCase()||q.params?.[0];
   if(q.method==='eth_getProof'&&target===cfg.contracts.custody.address){
    if(mode==='missing custody'){v.result=null;touched++;}
    if(mode==='missing liability'){v.result.storageProof.shift();touched++;}
    if(mode==='conflicting proof value'){v.result.storageProof[0].value='0xff';touched++;}
   }
   if(q.method==='eth_getProof'&&target===cfg.contracts.token.address&&mode==='missing token'){v.result=null;touched++;}
   if(q.method==='eth_call'&&target===cfg.contracts.custody.address&&q.params[0].data.startsWith(id('credits(uint256)').slice(0,10))&&mode==='conflicting credit'){v.result='0x'+'f'.repeat(64);touched++;}
   if(q.method==='eth_call'&&target===cfg.contracts.token.address&&mode==='conflicting balance'){v.result='0x'+'f'.repeat(64);touched++;}
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(v));
  }catch(e){res.writeHead(500);res.end(String(e));}
 });
 await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
 const {server}=createConsole({...cfg,rpcUrl:'http://127.0.0.1:'+proxy.address().port});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,checks=[];
 const routes=[['/api/state'],['/api/withdrawal-plan',{amount:'1'}],['/api/transfer-plan',{recipient:'0x'+'11'.repeat(20)}],['/api/post-plan',{text:'proof control'}]];
 try{
  for(mode of ['valid','missing custody','missing token','missing liability','conflicting proof value','conflicting credit','conflicting balance','recovered']){
   for(const [route,body]of routes){
    touched=0;const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),v=await r.json();
    if(['valid','recovered'].includes(mode)){assert.equal(r.status,200,JSON.stringify(v));if(!body)assert.equal(v.accountingProofsVerified,true);}
    else {assert(touched>0,mode+' mutation not reached');assert.equal(r.status,422,mode);assert.equal(typeof v.error,'string');assert.equal(v.data,undefined);assert.equal(v.accountingProofsVerified,undefined);}
    checks.push(mode+' '+route);
   }
  }
  return {passed:checks.length,checks,scope:'Fresh local Geth through a mutating RPC proxy; no transaction submitted by these HTTP controls.'};
 }finally{server.closeAllConnections();proxy.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>proxy.close(r))]);}
}

