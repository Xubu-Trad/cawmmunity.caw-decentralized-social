import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
const dir=path.resolve(process.argv[2]);const out=path.join(dir,process.env.BROWSER_OUTPUT||'browser');await fs.mkdir(out);const fixture=JSON.parse(await fs.readFile(path.join(dir,'accounting-withdrawal.json')));
let mode='valid',held=null,submissions=0;const checks=[];
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url==='/api/state'){
   if(mode==='delayed')await new Promise(r=>held=r);
   let s=structuredClone(mode==='zero'?fixture.after:fixture.before);
   if(mode==='missing flag')delete s.accountingProofsVerified;
   if(mode==='wrong block')s.accountingHeaderHash='0x'+'11'.repeat(32);
   if(mode==='conflicting liability')s.unpaidLiability='999';
   if(mode==='missing balances')delete s.balances;
   res.setHeader('Content-Type','application/json');if(mode==='proof rejected'){res.statusCode=422;s={error:'Accounting proof rejected'};}res.end(JSON.stringify(s));return;
  }
  if(req.url==='/api/posts'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:fixture.before.status,genesisHash:fixture.before.genesisHash,posting:fixture.before.contracts.posting,posts:[]}));return;}
  if(req.url.startsWith('/api/')){submissions++;res.statusCode=404;res.end('{}');return;}
  const file=req.url==='/'?'index.html':req.url.slice(1);if(!/^[a-z0-9-]+\.(mjs|html|css)$/.test(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(path.join(dir,'ui',file)));
 }catch(e){res.statusCode=500;res.end(String(e));}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const chrome=process.env.CHROME_BIN;assert(chrome,'Set CHROME_BIN to the local Chrome executable');
const browser=spawn(chrome,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(out,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,id=0;const pending=new Map(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
function cmd(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error('CDP_TIMEOUT '+method+' '+JSON.stringify(params))),15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
async function ev(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let n=0;n<100;n++){if(await ev(expression))return;await sleep(100);}throw Error('UI_TIMEOUT '+expression+' '+await ev('document.body.innerText'));}
const el=id=>`document.getElementById(${JSON.stringify(id)})`;
async function blocked(){assert.equal(await ev(el('credit')+'.textContent'),'—');assert.equal(await ev(el('custody-balance')+'.textContent'),'—');assert.equal(await ev(el('unpaid-liability')+'.textContent'),'—');for(const n of ['prepare','prepare-transfer','prepare-post','confirm'])assert.equal(await ev(el(n)+'.disabled'),true);assert.equal(await ev(el('review')+'.hidden'),true);}
try{
 let port;for(let i=0;i<100;i++){try{port=Number((await fs.readFile(path.join(out,'profile/DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await sleep(100);}}assert(port);
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(tabs.find(x=>x.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data),p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}});
 await cmd('Page.enable');await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.ethereum={request:async q=>q.method==='eth_chainId'?'0x7a69':q.method==='eth_accounts'||q.method==='eth_requestAccounts'?[${JSON.stringify(fixture.before.signer)}]:Promise.reject(Error('No signing allowed in display test')),on(){},removeListener(){}};`});
 await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await until(el('accounting-status')+"?.textContent==='Verified against selected local state'");await until('!'+el('connect')+'.disabled');
 assert.equal(await ev(el('credit')+'.textContent'),fixture.before.credit);assert.equal(await ev(el('unpaid-liability')+'.textContent'),fixture.before.unpaidLiability);assert((await ev(el('accounting-header')+'.textContent')).includes(fixture.before.blockHash));checks.push('verified values and exact block displayed');
 await ev(el('connect')+'.click()');await until('!'+el('prepare')+'.disabled');checks.push('verified snapshot permits planning for current signer');
 mode='delayed';await ev(el('refresh')+'.click()');await until(el('accounting-status')+".textContent==='Checking accounting proofs…'");await blocked();checks.push('refresh immediately clears stale balances and blocks actions');mode='valid';held();await until(el('accounting-status')+".textContent==='Verified against selected local state'");await until('!'+el('refresh')+'.disabled');checks.push('successful refresh restores verified display');
 for(mode of ['missing flag','wrong block','conflicting liability','missing balances','proof rejected']){
  await ev(el('refresh')+'.click()');await until(el('connection-status')+".textContent==='Chain unavailable'");await blocked();checks.push(mode+' clears display and blocks actions');await until('!'+el('refresh')+'.disabled');
 }
 mode='zero';await ev(el('refresh')+'.click()');await until(el('accounting-status')+".textContent==='Verified against selected local state'");assert.equal(await ev(el('credit')+'.textContent'),'0');assert.equal(await ev(el('owner-balance')+'.textContent'),fixture.after.balances.owner);checks.push('retry accepts genuine zero credit and updated owner balance');
 assert.equal(submissions,0);checks.push('display controls never request a transaction plan or signature');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});assert.equal(await ev('document.documentElement.scrollWidth<=window.innerWidth'),true);checks.push('desktop layout does not overflow');const shot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'verified.png'),Buffer.from(shot.data,'base64'));
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:checks.length,checks,scope:'Real headless browser; controlled local HTTP snapshots from fresh Geth. No real wallet extension or independent operator.'},null,2)+'\n');console.log(checks.length+' browser checks passed');
}finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}




