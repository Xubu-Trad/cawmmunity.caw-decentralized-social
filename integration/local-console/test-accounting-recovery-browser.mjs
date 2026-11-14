import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const dir=path.resolve(process.argv[2]),out=path.join(dir,'recovery-browser');await fs.mkdir(out);const fixture=JSON.parse(await fs.readFile(path.join(dir,'accounting-withdrawal.json'))),s=fixture.before;
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
 await cmd('Page.enable');await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.walletSends=0;window.ethereum={async request(q){if(q.method==='eth_chainId')return '0x7a69';if(['eth_accounts','eth_requestAccounts'].includes(q.method))return [${JSON.stringify(s.signer)}];if(q.method==='eth_getBlockByNumber')return {hash:q.params[0]==='0x0'?${JSON.stringify(s.genesisHash)}:${JSON.stringify(s.blockHash)}};if(q.method==='eth_getTransactionCount')return '0x0';if(q.method==='eth_sendTransaction'){window.walletSends++;throw Error('Transport outcome unknown');}if(q.method==='eth_getTransactionReceipt')return null;if(q.method==='eth_getTransactionByHash'){const p=JSON.parse(localStorage.getItem('caw.local.withdrawal.v1')).plan;return {hash:q.params[0],from:p.from,to:p.to,input:p.data,value:p.value,nonce:p.nonce,chainId:p.chainId};}throw Error('Unexpected wallet method '+q.method);},on(){},removeListener(){}};`});
 await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await until(el('accounting-status')+"?.textContent==='Verified against selected local state'");await until('!'+el('connect')+'.disabled');await ev(el('connect')+'.click()');await until('!'+el('prepare')+'.disabled');
 const key='caw.local.withdrawal.v1';let retained;
 async function reload(){await cmd('Page.reload');await until(el('accounting-status')+"?.textContent==='Verified against selected local state'");await until('!'+el('connect')+'.disabled');}
 for(const kind of ['withdrawal','transfer','post']){
  mode='valid';await ev('localStorage.clear()');await reload();await ev(el('connect')+'.click()');await until('!'+el('prepare')+'.disabled');await prepare(kind);await ev(el('confirm')+'.click()');
  await until('!'+el('refresh')+'.disabled && '+el('saved-status')+".textContent.includes('unresolved outcome')");
  const original=JSON.parse(await ev(`localStorage.getItem('${key}')`));assert.equal(original.phase,'awaiting-wallet');assert(original.accountingReview);assert.equal(await ev('window.walletSends'),1);checks.push(kind+' unresolved wallet outcome retains review');
  mode='credit spent';await reload();await until('!'+el('saved-accounting-review')+'.hidden');const text=await ev(el('saved-accounting-review')+'.textContent');assert(text.includes('Saved expected accounting'));assert(text.includes('not fresh proof or confirmation'));assert(text.includes(kind==='withdrawal'?'2 → 1':'2 → 2'));assert.equal(await ev(el('credit')+'.textContent'),'0');assert.equal(await ev('window.walletSends'),0);checks.push(kind+' reload separates earlier expectation from current zero credit');
  await ev(el('connect')+'.click()');await until('!'+el('recover')+'.disabled');for(const n of ['prepare','prepare-transfer','prepare-post','confirm'])assert.equal(await ev(el(n)+'.disabled'),true);checks.push(kind+' unresolved recovery blocks duplicate actions');
  await ev(el('recovery-hash')+`.value='0x${'34'.repeat(32)}';`+el('recover')+'.click()');await until('!'+el('refresh')+'.disabled && '+el('message')+".textContent.includes('Transaction pending')");
  const submitted=JSON.parse(await ev(`localStorage.getItem('${key}')`));assert.equal(submitted.phase,'submitted');assert.deepEqual(submitted.accountingReview,original.accountingReview);checks.push(kind+' matched transaction hash preserves review without confirming execution');
  await reload();await until('!'+el('saved-accounting-review')+'.hidden');assert((await ev(el('saved-status')+'.textContent')).includes('Saved submission restored'));assert.equal(await ev('window.walletSends'),0);assert.deepEqual(JSON.parse(await ev(`localStorage.getItem('${key}')`)).accountingReview,original.accountingReview);checks.push(kind+' submitted reload retains review and never resends');retained=submitted;
 }
 const legacy=structuredClone(retained);delete legacy.accountingReview;await ev(`localStorage.setItem('${key}',${JSON.stringify(JSON.stringify(legacy))})`);await reload();assert((await ev(el('saved-accounting-review')+'.textContent')).includes('no saved accounting review'));checks.push('legacy pending record explicitly has no review');
 const corrupt=structuredClone(retained);corrupt.accountingReview.snapshot.epoch='99';const raw=JSON.stringify(corrupt);await ev(`localStorage.setItem('${key}',${JSON.stringify(raw)})`);await reload();assert((await ev(el('saved-status')+'.textContent')).includes('Recovery required'));assert.equal(await ev(el('saved-accounting-review')+'.textContent'),'');assert.equal(await ev(`localStorage.getItem('${key}')`),raw);assert.equal(await ev(el('prepare-post')+'.disabled'),true);checks.push('mismatched review is retained but not displayed or used for actions');
 await ev(`localStorage.setItem('${key}',${JSON.stringify(JSON.stringify(retained))})`);await reload();await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await ev(el('saved-accounting-review')+".scrollIntoView({block:'center'})");assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);const shot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'recovery.png'),Buffer.from(shot.data,'base64'));checks.push('saved review fits desktop layout');
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:checks.length,checks,scope:'Headless Chromium reload and pending recovery with controlled snapshots, unknown wallet outcome and matching synthetic transaction. No real signing, execution or confirmation.'},null,2)+'\n');console.log(checks.length+' browser checks passed');
}finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
