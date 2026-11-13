// Isolated Chromium/Edge integration test with a controlled EIP-1193 adapter.
// This is NOT wallet-extension compatibility or an independent operator run.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {Wallet,JsonRpcProvider}=createRequire(import.meta.url)('ethers');
const [browserExe,url,rpcUrl,output]=process.argv.slice(2);
for(const u of [url,rpcUrl]) { const parsed=new URL(u); assert.equal(parsed.hostname,'127.0.0.1'); assert.equal(parsed.protocol,'http:'); }
await fs.mkdir(output,{recursive:false});
const initial=await (await fetch(url+'/api/state')).json();
assert.equal(initial.chainId,'0x7a69'); assert.equal(initial.credit,'2');
const rpc=new JsonRpcProvider(rpcUrl,31337,{staticNetwork:true});
// Public disposable fixture key, used only on the explicitly selected local chain.
const signer=new Wallet('0x'+'0'.repeat(63)+'3',rpc);
assert.equal(signer.address.toLowerCase(),initial.controller);
assert.equal((await rpc.getBlock(0)).hash,initial.genesisHash);
const profile=path.resolve(output,'browser-profile');
const browser=spawn(browserExe,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-networking','--disable-sync','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let browserLog='';browser.stderr.on('data',b=>{browserLog+=b;});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,nextId=0,requests=new Map(),calls=[],sent=[],pageErrors=[];const results=[];
function cmd(method,params={}) {return new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{requests.delete(id);reject(Error('CDP_TIMEOUT '+method));},12000);requests.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression) {const v=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result?.value;}
async function until(expression) {for(let n=0;n<100;n++){if(await evaluate(expression))return;await sleep(50);}throw Error('UI_TIMEOUT '+expression+' '+await evaluate('document.body.innerText'));}
async function click(id) {await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);}
async function status(){return await evaluate("document.getElementById('message').textContent");}
async function configure(value){await evaluate('Object.assign(window.__test,'+JSON.stringify(value)+')');}
async function idle(){await until("!document.getElementById('connect').disabled");}
function record(name){results.push({name,pass:true});console.log('PASS '+name);}
try {
 let port;
 for(let n=0;n<200;n++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{if(browser.exitCode!==null)throw Error('BROWSER_EXIT '+browserLog);await sleep(100);}}
 assert.ok(port,'browser debug port');
 const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',async event=>{
  const v=JSON.parse(event.data);
  if(v.id){const p=requests.get(v.id);if(p){clearTimeout(p.timer);requests.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}return;}
  if(v.method==='Runtime.exceptionThrown')pageErrors.push(v.params.exceptionDetails);
  if(v.method!=='Runtime.bindingCalled'||v.params.name!=='__walletBridge')return;
  const {id,req}=JSON.parse(v.params.payload);calls.push(req.method);let value;
  try {
   if(req.method==='eth_requestAccounts'||req.method==='eth_accounts')value=[signer.address];
   else if(req.method==='eth_sendTransaction'){
    const tx=req.params[0];assert.equal(tx.from.toLowerCase(),initial.controller);assert.equal(tx.to.toLowerCase(),initial.contracts.wallet);assert.equal(tx.value,'0x0');
    assert.equal((await rpc.getBlock(0)).hash,initial.genesisHash);
    const response=await signer.sendTransaction({to:tx.to,data:tx.data,value:0n,nonce:tx.nonce});sent.push(response.hash);value=response.hash;
   }else {assert.ok(['eth_chainId','eth_getTransactionCount','eth_getBlockByNumber','eth_getTransactionReceipt','eth_getTransactionByHash'].includes(req.method));value=await rpc.send(req.method,req.params??[]);}
   await evaluate(`window.__walletResolve(${id},${JSON.stringify({result:value})})`);
  }catch(e){await evaluate(`window.__walletResolve(${id},${JSON.stringify({error:{message:e.message,code:-32000}})})`).catch(()=>{});}
 });
 await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Runtime.addBinding',{name:'__walletBridge'});
 await cmd('Page.navigate',{url});await until("document.getElementById('credit')?.textContent==='2'");
 await click('connect');await idle();assert.match(await status(),/No compatible browser wallet/);assert.equal(calls.length,0);record('missing injected wallet fails without signing');
 await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.__test={chain:'0x7a69',wrongAccount:false,rejectConnect:false,changeDuringConnect:false,badGenesis:false,receiptMode:'normal',rejectSend:false,tamperPlan:false,loseResponse:false};
 let seq=0;const waiting=new Map(),listeners=new Map();
 window.__walletResolve=(id,v)=>{const p=waiting.get(id);if(!p)return;waiting.delete(id);v.error?p.reject(Object.assign(Error(v.error.message),v.error)):p.resolve(v.result);};
 const bridge=req=>new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});window.__walletBridge(JSON.stringify({id,req}));});
 window.ethereum={on(n,f){listeners.set(n,f);},removeListener(n){listeners.delete(n);},async request(req){
  if(req.method==='eth_chainId')return window.__test.chain;
  if(req.method==='eth_requestAccounts'&&window.__test.rejectConnect)throw Object.assign(Error('Connection rejected by test wallet'),{code:4001});
  if(req.method==='eth_requestAccounts'&&window.__test.changeDuringConnect)listeners.get('accountsChanged')?.([]);
  if(['eth_requestAccounts','eth_accounts'].includes(req.method)&&window.__test.wrongAccount)return ['0x'+'44'.repeat(20)];
  if(req.method==='eth_getBlockByNumber'&&req.params[0]==='0x0'&&window.__test.badGenesis)return {hash:'0x'+'55'.repeat(32)};
  if(req.method==='eth_sendTransaction'&&window.__test.rejectSend)throw Object.assign(Error('Signature rejected by test wallet'),{code:4001});
  if(req.method==='eth_getTransactionReceipt'&&window.__test.receiptMode==='pending')return null;
  if(req.method==='eth_getTransactionReceipt'&&window.__test.receiptMode==='error')throw Object.assign(Error('Receipt service unavailable'),{code:4001});
  const result=await bridge(req);if(req.method==='eth_sendTransaction'&&window.__test.loseResponse)return new Promise(()=>{});return result;
 }};
 window.__walletEvent=(name,value)=>listeners.get(name)?.(value);
 const realFetch=window.fetch.bind(window);window.fetch=async(...args)=>{const r=await realFetch(...args);if(window.__test.tamperPlan&&args[0]==='/api/withdrawal-plan'){const p=await r.json();p.data+='00';return new Response(JSON.stringify(p),{status:r.status,headers:r.headers});}return r;};
 `});
 await cmd('Page.reload',{ignoreCache:true});await until("document.getElementById('credit')?.textContent==='2'");assert.equal(calls.length,0);record('page load makes no wallet request');
 for(const [settings,pattern,name]of [[{chain:'0x1'},/Select local chain/,'wrong chain rejected'],[{chain:'0x7a69',wrongAccount:true},/does not control this account/,'wrong controller rejected'],[{wrongAccount:false,rejectConnect:true},/Connection rejected/,'connection rejection handled'],[{rejectConnect:false,changeDuringConnect:true},/changed during connection/,'account event during connect rejects late response']]){
  await configure(settings);await click('connect');await idle();assert.match(await status(),pattern);assert.equal(sent.length,0);assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);record(name);
 }
 await configure({changeDuringConnect:false});await click('connect');await idle();assert.match(await status(),/Local wallet connected/);record('controller connects without transaction submission');
 async function prepare(){await click('prepare');await idle();}
 await prepare();assert.equal(await evaluate("document.getElementById('review').hidden"),false);await click('cancel');assert.equal(sent.length,0);record('review cancellation does not submit');
 await configure({tamperPlan:true});await prepare();assert.match(await status(),/bytes do not match/);assert.equal(await evaluate("document.getElementById('review').hidden"),true);await configure({tamperPlan:false});record('tampered calldata rejected in browser');
 await prepare();await evaluate("document.getElementById('amount').dispatchEvent(new Event('input',{bubbles:true}))");assert.equal(await evaluate("document.getElementById('review').hidden"),true);record('amount edit invalidates review');
 await prepare();await configure({badGenesis:true});await click('confirm');await idle();assert.match(await status(),/different local chain/);assert.equal(sent.length,0);await configure({badGenesis:false});record('same chain id with different genesis cannot submit');
 await prepare();await configure({rejectSend:true});await click('confirm');await idle();assert.match(await status(),/Signature rejected/);assert.equal(sent.length,0);await configure({rejectSend:false});record('rejected signature does not submit');
 await prepare();await configure({receiptMode:'pending'});await click('confirm');await idle();assert.match(await status(),/Transaction pending/);assert.equal(sent.length,1);assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);record('signed withdrawal pending blocks duplicate submission');
 // A full reload discards page memory but must retain the submitted hash.
 await cmd('Page.reload',{ignoreCache:true});await until("document.getElementById('saved-status')?.textContent.includes('Saved submission restored')");
 assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);assert.equal(sent.length,1);
 await click('connect');await idle();record('reload restores pending withdrawal without resubmission');
 await configure({receiptMode:'error'});await click('check-receipt');await idle();assert.match(await status(),/Receipt not verified/);assert.equal(await evaluate("document.getElementById('check-receipt').hidden"),false);assert.equal(sent.length,1);record('receipt error retains submitted transaction');
 await configure({receiptMode:'normal'});await click('check-receipt');await idle();assert.match(await status(),/Withdrawal confirmed/);assert.equal(await evaluate("document.getElementById('credit').textContent"),'1');assert.equal(await evaluate("document.getElementById('wallet-balance').textContent"),'1');assert.equal(await evaluate("document.getElementById('custody-balance').textContent"),'9');record('receipt retry confirms exact withdrawal and refreshes balances');
 assert.equal(await evaluate("localStorage.getItem('caw.local.withdrawal.v1')"),null);record('verified receipt clears only its saved record');
 // A provider can broadcast successfully while the page never gets its hash.
 await prepare();await configure({loseResponse:true});await click('confirm');
 for(let n=0;n<100&&sent.length<2;n++)await sleep(50);assert.equal(sent.length,2);
 assert.equal(await evaluate("JSON.parse(localStorage.getItem('caw.local.withdrawal.v1')).phase"),'awaiting-wallet');
 await cmd('Page.reload',{ignoreCache:true});await until("document.getElementById('saved-status')?.textContent.includes('unresolved outcome')");
 assert.equal(sent.length,2);assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);record('lost wallet response restores unresolved intent without resubmission');
 await click('connect');await idle();
 await evaluate("document.getElementById('recovery-hash').value="+JSON.stringify(sent[0]));await click('recover');await idle();
 assert.match(await status(),/Recovery not verified/);assert.notEqual(await evaluate("localStorage.getItem('caw.local.withdrawal.v1')"),null);record('older identical withdrawal hash cannot clear a later nonce');
 await evaluate("document.getElementById('recovery-hash').value="+JSON.stringify(sent[1]));await click('recover');await idle();
 assert.match(await status(),/Withdrawal confirmed/);assert.equal(await evaluate("document.getElementById('credit').textContent"),'0');assert.equal(await evaluate("document.getElementById('wallet-balance').textContent"),'2');assert.equal(await evaluate("document.getElementById('custody-balance').textContent"),'8');
 assert.equal(await evaluate("localStorage.getItem('caw.local.withdrawal.v1')"),null);assert.equal(sent.length,2);record('correct nonce-bound hash recovers interrupted submission and balances');
 await evaluate("localStorage.setItem('caw.local.withdrawal.v1','{broken')");await click('refresh');await until("document.getElementById('saved-status').textContent.includes('Recovery required')");
 assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);assert.equal(await evaluate("localStorage.getItem('caw.local.withdrawal.v1')"),'{broken');record('corrupt journal retained and new withdrawal blocked');
 await evaluate("localStorage.removeItem('caw.local.withdrawal.v1')");await click('refresh');await until("document.getElementById('saved-status').textContent.includes('No unresolved')");

 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 const screenshot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'console-confirmed.png'),Buffer.from(screenshot.data,'base64'));
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);record('mobile layout fits viewport');
 const mobile=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'console-mobile.png'),Buffer.from(mobile.data,'base64'));
 assert.equal(pageErrors.length,0);
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({status:'pass',browser:await cmd('Browser.getVersion'),scope:'headless browser with controlled EIP-1193 adapter; real signed local Geth transaction; not an actual wallet extension',cases:results,signedTransactions:sent,creditBefore:'2',creditAfter:'0',walletBalance:'2',custodyBalance:'8',pageErrors},null,2)+'\n');
} catch(e) {await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:e.message,stack:e.stack,results,pageErrors},null,2));throw e;}
finally {if(ws?.readyState===WebSocket.OPEN){await cmd('Browser.close').catch(()=>{});ws.close();}browser.kill();await fs.writeFile(path.join(output,'browser.log'),browserLog);rpc.destroy();}
