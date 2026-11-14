import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const dir=path.resolve(process.argv[2]),out=path.join(dir,'review-browser');await fs.mkdir(out);const fixture=JSON.parse(await fs.readFile(path.join(dir,'accounting-withdrawal.json'))),s=fixture.before;
const {fixturePlan}=await import(pathToFileURL(path.join(dir,'src/integration/local-console/test-accounting-review-fixture.mjs')));
let mode='valid';const checks=[];
const server=http.createServer(async(req,res)=>{
 try{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/api/state'){
   let v=structuredClone(mode==='credit spent'?fixture.after:s);
   if(mode==='owner balance')v.balances.owner=String(BigInt(v.balances.owner)+1n);
   if(mode==='custody balance')v.balances.custody=String(BigInt(v.balances.custody)+1n);
   if(mode==='new credit'){for(const k of ['credit','creditedLiability','unpaidLiability'])v[k]=String(BigInt(v[k])+1n);v.balances.custody=String(BigInt(v.balances.custody)+1n);}
   if(mode==='missing proof')delete v.accountingProofsVerified;
   if(mode==='new block'){v.blockHash=v.accountingHeaderHash=v.authorityHeaderHash='0x'+'22'.repeat(32);v.blockNumber='0xff';}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));return;
  }
  if(req.url==='/api/posts'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:s.status,genesisHash:s.genesisHash,posting:s.contracts.posting,posts:[]}));return;}
  if(req.url.endsWith('-plan')){const kind=req.url.includes('withdrawal')?'withdrawal':req.url.includes('transfer')?'transfer':'post';res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixturePlan(s,kind)));return;}
  const file=req.url==='/'?'index.html':req.url.slice(1);if(!/^[a-z0-9-]+\.(mjs|html|css)$/.test(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(path.join(dir,'src/integration/local-console/ui',file)));
 }catch(e){res.statusCode=500;res.end(String(e));}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
assert(process.env.CHROME_BIN);const browser=spawn(process.env.CHROME_BIN,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(out,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,id=0;const pending=new Map(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
function cmd(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error('CDP_TIMEOUT '+method)),15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
async function ev(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){for(let n=0;n<100;n++){if(await ev(expression))return;await sleep(100);}throw Error('UI_TIMEOUT '+expression+' '+await ev('document.body.innerText'));}
const el=id=>`document.getElementById(${JSON.stringify(id)})`;
async function prepare(kind){mode='valid';await ev(el('refresh')+'.click()');await until('!'+el('prepare')+'.disabled');await ev(el('amount')+`.value='1';`+el('recipient')+`.value='0x${'11'.repeat(20)}';`+el('post-text')+`.value='review test';`+el(kind==='withdrawal'?'withdraw-form':kind+'-form')+'.requestSubmit()');await until('!'+el('confirm')+'.disabled');assert((await ev(el('accounting-review')+'.textContent')).includes('Expected accounting'));}
try{
 let port;for(let n=0;n<100;n++){try{port=Number((await fs.readFile(path.join(out,'profile/DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await sleep(100);}}assert(port);
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const v=JSON.parse(e.data),p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}});
 await cmd('Page.enable');await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.walletSends=0;window.ethereum={async request(q){if(q.method==='eth_chainId')return '0x7a69';if(['eth_accounts','eth_requestAccounts'].includes(q.method))return [${JSON.stringify(s.signer)}];if(q.method==='eth_getBlockByNumber')return {hash:q.params[0]==='0x0'?${JSON.stringify(s.genesisHash)}:${JSON.stringify(s.blockHash)}};if(q.method==='eth_getTransactionCount')return '0x0';if(q.method==='eth_sendTransaction'){window.walletSends++;throw Object.assign(Error('Test wallet declined'),{code:4001});}throw Error('Unexpected wallet method '+q.method);},on(){},removeListener(){}};`});
 await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await until(el('accounting-status')+"?.textContent==='Verified against selected local state'");await until('!'+el('connect')+'.disabled');await ev(el('connect')+'.click()');await until('!'+el('prepare')+'.disabled');
 for(const kind of ['withdrawal','transfer','post']){
  await prepare(kind);const text=await ev(el('accounting-review')+'.textContent');assert(text.includes(kind==='withdrawal'?'2 → 1':'2 → 2'));assert(text.includes('Local ETH gas is separate'));checks.push(kind+' preview and gas boundary displayed');
  mode='credit spent';const before=await ev('window.walletSends');await ev(el('confirm')+'.click()');await until(el('review')+'.hidden && !'+el('refresh')+'.disabled');assert.equal(await ev('window.walletSends'),before);assert.equal(await ev("localStorage.getItem('caw.local.withdrawal.v1')"),null);assert((await ev(el('message')+'.textContent')).includes('Accounting changed'));checks.push(kind+' changed credit blocks wallet request and clears unsent journal');
 }
 for(const change of ['owner balance','custody balance','new credit','missing proof']){
  await prepare('withdrawal');mode=change;const before=await ev('window.walletSends');await ev(el('confirm')+'.click()');await until(el('review')+'.hidden && !'+el('refresh')+'.disabled');assert.equal(await ev('window.walletSends'),before);assert.equal(await ev("localStorage.getItem('caw.local.withdrawal.v1')"),null);checks.push(change+' blocks wallet request');
 }
 for(const kind of ['withdrawal','transfer','post']){
  await prepare(kind);mode='new block';const before=await ev('window.walletSends');await ev(el('confirm')+'.click()');await until(el('review')+'.hidden && !'+el('refresh')+'.disabled');assert.equal(await ev('window.walletSends'),before+1);assert.equal(await ev("localStorage.getItem('caw.local.withdrawal.v1')"),null);checks.push(kind+' unchanged accounting at new block reaches wallet; explicit rejection cleans up');
 }
 await prepare('withdrawal');await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await ev(el('accounting-review')+".scrollIntoView({block:'center'})");assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);const shot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'preview.png'),Buffer.from(shot.data,'base64'));checks.push('preview fits desktop layout');
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:checks.length,checks,scope:'Headless Chromium with controlled fresh-fixture state changes and a rejecting wallet adapter. No real signing or new contract execution.'},null,2)+'\n');console.log(checks.length+' browser checks passed');
}finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
