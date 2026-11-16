// Real headless-browser journey with a controlled EIP-1193 adapter.
// Local signed Geth execution only; not extension compatibility or independent reproduction.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {Wallet,JsonRpcProvider,Interface,toUtf8Bytes,keccak256}=createRequire(import.meta.url)('ethers');
const [browserExe,url,rpcUrl,output]=process.argv.slice(2);
assert.ok(browserExe&&output,'browser executable and fresh output directory required');
for(const raw of [url,rpcUrl]){const u=new URL(raw);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.protocol,'http:');assert.equal(u.username+u.password+u.search+u.hash,'');}
await fs.mkdir(output,{recursive:false});
const rpc=new JsonRpcProvider(rpcUrl,31337,{staticNetwork:true});
const key=n=>'0x'+String(n).padStart(64,'0');
// Published disposable fixture keys; these must never be used on a public network.
const controller=new Wallet(key(3),rpc),recipient=new Wallet(key(4),rpc);
assert.equal(recipient.address.toLowerCase(),'0x1eff47bc3a10a45d4b230b5d10e37751fe6aa718');
const walletABI=new Interface(['function execute(address,bytes) returns(bytes)']);
const registryABI=new Interface(['function safeTransferFrom(address,address,uint256)','function authority(uint256) view returns(address,uint256)']);
const custodyABI=new Interface(['function withdraw(uint256,uint256,uint256)','function credits(uint256) view returns(uint256)']);
const tokenABI=new Interface(['function balanceOf(address) view returns(uint256)']);
const postingABI=new Interface(['function publish(uint256,uint256,uint256,bytes)']);
const errorABI=new Interface(['error Error(string)']);
const firstText='<img src=x onerror="window.__postExecuted=true"> 🌒';
const secondText='\uFEFFwords. proof. community. 新しい持ち主の声 🌒';
let browser,ws,nextId=0,activeSigner=controller,expectedApproval=null;
const requests=new Map(),calls=[],sent=[],walletPrompts=[],pageErrors=[],results=[],funding=[],readOnlyChecks=[],rejectedPlans=[];
let browserLog='',initial,afterFirstPost,afterTransfer,afterSecondPost,final,clientVersion,finalFeed;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function record(name){results.push({name,pass:true});console.log('PASS '+name);}
function cmd(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{requests.delete(id);reject(Error('CDP_TIMEOUT '+method));},12000);requests.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
async function until(expression){for(let i=0;i<200;i++){if(await evaluate(expression))return;await sleep(50);}throw Error('UI_TIMEOUT '+expression+' '+await evaluate('document.body.innerText'));}
async function click(id){await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);}
async function fill(id,value){await evaluate(`{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));}`);}
async function idle(){await until("!document.getElementById('connect').disabled");}
async function status(){return evaluate("document.getElementById('message').textContent");}
async function configure(settings){await evaluate('Object.assign(window.__test,'+JSON.stringify(settings)+')');}
async function fetchState(){const r=await fetch(url+'/api/state');assert.equal(r.status,200);return r.json();}
async function fetchPosts(){const r=await fetch(url+'/api/posts');assert.equal(r.status,200);const value=await r.json();assert.equal(value.status,'LOCAL_CHAIN_RESEARCH');assert.ok(Array.isArray(value.posts));return value;}
async function selectedChain(){assert.equal(await rpc.send('eth_chainId',[]),'0x7a69');assert.equal((await rpc.getBlock(0)).hash,initial.genesisHash);}
async function tokenBalance(address){return tokenABI.decodeFunctionResult('balanceOf',await rpc.call({to:initial.contracts.token,data:tokenABI.encodeFunctionData('balanceOf',[address])}))[0].toString();}
async function readOnlyCall(name,tx,state,expectedRevert=null){
 // Read the raw envelope so a transport failure can never satisfy a revert check.
 const id=1000+readOnlyChecks.length,at={blockHash:state.blockHash,requireCanonical:true};
 const response=await fetch(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method:'eth_call',params:[tx,at]}),signal:AbortSignal.timeout(5000)});
 assert.equal(response.status,200);const envelope=await response.json();assert.equal(envelope.jsonrpc,'2.0');assert.equal(envelope.id,id);
 const entry={name,transaction:tx,at};
 if(expectedRevert!==null){
  assert.equal(Object.hasOwn(envelope,'result'),false,'reverted call must not also contain a result');assert.equal(envelope.error?.code,3,'Geth execution-reverted envelope required');
  assert.equal(typeof envelope.error?.data,'string','exact revert bytes required');
  const decoded=errorABI.parseError(envelope.error.data);assert.equal(decoded?.name,'Error');assert.equal(decoded.args[0],expectedRevert);
  entry.errorData=envelope.error.data;entry.decodedRevert=decoded.args[0];
 }else{assert.equal(Object.hasOwn(envelope,'error'),false);assert.equal(envelope.result,'0x');entry.result=envelope.result;}
 readOnlyChecks.push(entry);
}
try{
 initial=await fetchState();assert.equal(initial.chainId,'0x7a69');assert.equal(initial.credit,'2');
 assert.equal(initial.owner,initial.contracts.wallet);assert.equal(initial.controller,controller.address.toLowerCase());
 assert.equal(initial.epoch,'1');assert.equal(initial.posting.nonce,'0');assert.match(initial.contracts.posting,/^0x[0-9a-f]{40}$/);assert.equal((await fetchPosts()).posts.length,0);
 assert.equal(initial.balances.wallet,'0');assert.equal(initial.balances.custody,'10');
 await selectedChain();clientVersion=await rpc.send('web3_clientVersion',[]);assert.match(clientVersion,/Geth/);
 assert.equal(await tokenBalance(recipient.address),'0');
 const transferData=walletABI.encodeFunctionData('execute',[initial.contracts.registry,registryABI.encodeFunctionData('safeTransferFrom',[initial.contracts.wallet,recipient.address,2])]);
 const withdrawalData=custodyABI.encodeFunctionData('withdraw',[2,BigInt(initial.epoch)+1n,2]);
 const firstPostData=walletABI.encodeFunctionData('execute',[initial.contracts.posting,postingABI.encodeFunctionData('publish',[2,BigInt(initial.epoch),0,toUtf8Bytes(firstText)])]);
 const secondPostData=postingABI.encodeFunctionData('publish',[2,BigInt(initial.epoch)+1n,1,toUtf8Bytes(secondText)]);
 for(const [name,invalidRecipient] of [['zero','0x'+'0'.repeat(40)],['low reserved address','0x'+'0'.repeat(39)+'1'],['reserved range boundary','0x'+'0'.repeat(36)+'ffff'],['current owner',initial.owner],['custody contract',initial.contracts.custody],['registry contract',initial.contracts.registry],['token contract',initial.contracts.token]]){
  const response=await fetch(url+'/api/transfer-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient:invalidRecipient})});
  assert.equal(response.status,422);const rejection=await response.json();assert.deepEqual(rejection,{error:'INVALID_RECIPIENT'});rejectedPlans.push({name,recipient:invalidRecipient,status:response.status,error:rejection.error});
 }
 const unchanged=await fetchState();assert.equal(unchanged.owner,initial.owner);assert.equal(unchanged.epoch,initial.epoch);assert.equal(unchanged.credit,initial.credit);
 record('real server rejects zero, low reserved addresses, current-owner and selected-contract transfer recipients without submitting');
 const profile=path.resolve(output,'browser-profile');
 browser=spawn(browserExe,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-networking','--disable-sync','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',b=>{browserLog+=b;});let port;
 for(let i=0;i<200;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{if(browser.exitCode!==null)throw Error('BROWSER_EXIT '+browserLog);await sleep(100);}}
 assert.ok(port,'browser debug port');const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',async event=>{
  const v=JSON.parse(event.data);
  if(v.id){const p=requests.get(v.id);if(p){clearTimeout(p.timer);requests.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}return;}
  if(v.method==='Runtime.exceptionThrown')pageErrors.push(v.params.exceptionDetails);
  if(v.method!=='Runtime.bindingCalled'||v.params.name!=='__walletBridge')return;
  const {id,req}=JSON.parse(v.params.payload);calls.push(req.method);let value;
  try{
   if(['eth_requestAccounts','eth_accounts'].includes(req.method)){value=[activeSigner.address];if(req.method==='eth_requestAccounts')walletPrompts.push({kind:'connect',account:activeSigner.address});}
   else if(req.method==='eth_sendTransaction'){
    assert.ok(expectedApproval,'no signing request is allowed without the selected UI confirm click');
    const tx=req.params[0],kind=expectedApproval;expectedApproval=null;
    assert.equal(tx.from.toLowerCase(),activeSigner.address.toLowerCase());assert.equal(tx.value,'0x0');
    assert.match(tx.nonce,/^0x(?:0|[1-9a-f][0-9a-f]*)$/i);await selectedChain();
    if(kind==='transfer'){
     assert.equal(activeSigner.address,controller.address);assert.equal(tx.to.toLowerCase(),initial.contracts.wallet);assert.equal(tx.data.toLowerCase(),transferData.toLowerCase());
    }else if(kind==='post-wallet'){
     assert.equal(activeSigner.address,controller.address);assert.equal(tx.to.toLowerCase(),initial.contracts.wallet);assert.equal(tx.data.toLowerCase(),firstPostData.toLowerCase());
    }else if(kind==='post-owner'){
     assert.equal(activeSigner.address,recipient.address);assert.equal(tx.to.toLowerCase(),initial.contracts.posting);assert.equal(tx.data.toLowerCase(),secondPostData.toLowerCase());
    }else{
     assert.equal(kind,'withdrawal');assert.equal(activeSigner.address,recipient.address);assert.equal(tx.to.toLowerCase(),initial.contracts.custody);assert.equal(tx.data.toLowerCase(),withdrawalData.toLowerCase());
    }
    walletPrompts.push({kind,from:tx.from,to:tx.to,value:tx.value,nonce:tx.nonce,data:tx.data});
    const response=await activeSigner.sendTransaction({to:tx.to,data:tx.data,value:0n,nonce:tx.nonce});sent.push({kind,hash:response.hash});value=response.hash;
   }else{assert.ok(['eth_chainId','eth_getTransactionCount','eth_getBlockByNumber','eth_getTransactionReceipt','eth_getTransactionByHash'].includes(req.method));value=await rpc.send(req.method,req.params??[]);}
   await evaluate(`window.__walletResolve(${id},${JSON.stringify({result:value})})`);
  }catch(e){pageErrors.push({bridgeError:e.message});await evaluate(`window.__walletResolve(${id},${JSON.stringify({error:{message:e.message,code:-32000}})})`).catch(()=>{});}
 });
 await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Runtime.addBinding',{name:'__walletBridge'});
 await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.__verification=[];window.__held=false;window.__hold=false;window.__test={receiptMode:'pending',tamperTransfer:false,tamperPost:false,staleAuthority:false};let seq=0;const waiting=new Map(),listeners=new Map();
 window.__walletResolve=(id,v)=>{const p=waiting.get(id);if(!p)return;waiting.delete(id);v.error?p.reject(Object.assign(Error(v.error.message),v.error)):p.resolve(v.result);};
 const bridge=req=>new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});window.__walletBridge(JSON.stringify({id,req}));});
 window.ethereum={on(name,fn){listeners.set(name,fn);},removeListener(name){listeners.delete(name);},async request(req){
  if(req.method==='eth_getTransactionReceipt'&&window.__test.receiptMode==='pending')return null;
  if(req.method==='eth_getTransactionReceipt'&&window.__test.receiptMode==='error')throw Error('Receipt service unavailable');
  return bridge(req);
 }};
 window.__walletEvent=(name,value)=>listeners.get(name)?.(value);
 const realFetch=window.fetch.bind(window);window.fetch=async(...args)=>{const r=await realFetch(...args);if(args[0]==='/api/verified-receipt'){window.__verification.push({request:JSON.parse(args[1].body),response:await r.clone().json()});if(window.__hold){window.__held=true;await new Promise(resolve=>window.__release=resolve);}}if((window.__test.tamperTransfer&&args[0]==='/api/transfer-plan')||(window.__test.tamperPost&&args[0]==='/api/post-plan')){const p=await r.json();p.data+='00';return new Response(JSON.stringify(p),{status:r.status,headers:r.headers});}if(window.__test.staleAuthority&&args[0]==='/api/state'){const s=await r.json();s.epoch=String(BigInt(s.epoch)+2n);return new Response(JSON.stringify(s),{status:r.status,headers:r.headers});}return r;};
 `});
 await cmd('Page.navigate',{url});await until("document.getElementById('credit')?.textContent==='2'");await idle();
 assert.equal(calls.length,0);assert.equal(sent.length,0);record('initial page performs no wallet requests or transaction submission');
 await click('connect');await idle();assert.match(await status(),/Local wallet connected/);record('original controller connects to owned account');
 // Publish through the contract wallet while preserving the exact UTF-8 bytes.
 await fill('post-text',firstText);await configure({tamperPost:true});await click('prepare-post');await idle();
 assert.match(await status(),/bytes do not match/i);assert.equal(await evaluate("document.getElementById('review').hidden"),true);assert.equal(sent.length,0);
 await configure({tamperPost:false});record('altered posting calldata is rejected before any signing request');
 await click('prepare-post');await idle();assert.equal(await evaluate("document.getElementById('post-review').hidden"),false);
 assert.equal(await evaluate("document.getElementById('post-review-text').textContent"),firstText);assert.equal(await evaluate("document.getElementById('post-review-nonce').textContent"),'0');
 assert.equal(await evaluate("document.querySelectorAll('#post-review img').length"),0);assert.notEqual(await evaluate('window.__postExecuted'),true);assert.equal(sent.length,0);
 record('post review shows exact unicode and markup as inert text with current posting nonce');
 await click('cancel');assert.equal(sent.length,0);record('cancelling post review makes no signing request');
 await click('prepare-post');await idle();await fill('post-text',firstText);assert.equal(await evaluate("document.getElementById('review').hidden"),true);record('editing post text invalidates its prepared transaction');
 await click('prepare-post');await idle();expectedApproval='post-wallet';await click('confirm');await idle();
 assert.equal(expectedApproval,null);assert.equal(sent.length,1);assert.match(await status(),/Transaction pending/i);
 assert.equal(await evaluate("document.getElementById('prepare-post').disabled"),true);assert.equal(await evaluate("document.getElementById('prepare-transfer').disabled"),true);assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);
 record('explicit approval submits one wallet-wrapped post and blocks duplicate actions while receipt is pending');
 const postHash=sent[0].hash;
 await cmd('Page.reload',{ignoreCache:true});await until("document.getElementById('saved-status')?.textContent.includes('Saved submission restored')");await idle();
 assert.equal(sent.length,1);assert.equal(await evaluate("JSON.parse(localStorage.getItem('caw.local.withdrawal.v1')).hash"),postHash);
 await click('connect');await idle();await configure({receiptMode:'error'});await click('check-receipt');await idle();assert.match(await status(),/Receipt not verified/);
 assert.equal(sent.length,1);assert.equal(await evaluate("JSON.parse(localStorage.getItem('caw.local.withdrawal.v1')).hash"),postHash);
 await configure({receiptMode:'normal'});await click('check-receipt');await idle();assert.match(await status(),/post confirmed/i);
 assert.equal(await evaluate("localStorage.getItem('caw.local.withdrawal.v1')"),null);assert.equal(sent.length,1);
 afterFirstPost=await fetchState();assert.equal(afterFirstPost.posting.nonce,'1');assert.equal(afterFirstPost.credit,'2');assert.equal(afterFirstPost.balances.custody,'10');assert.equal(afterFirstPost.owner,initial.owner);
 const firstFeed=await fetchPosts();assert.equal(firstFeed.posts.length,1);assert.equal(firstFeed.posts[0].text,firstText);assert.equal(firstFeed.posts[0].textHash,keccak256(toUtf8Bytes(firstText)));assert.equal(firstFeed.posts[0].author.toLowerCase(),initial.contracts.wallet);assert.equal(firstFeed.posts[0].transactionHash,postHash);assert.equal(String(firstFeed.posts[0].nonce),'0');
 await until(`document.getElementById('posts').textContent.includes(${JSON.stringify(firstText)})`);assert.equal(await evaluate("document.querySelectorAll('#posts img').length"),0);assert.notEqual(await evaluate('window.__postExecuted'),true);
 record('reloaded post recovers the same transaction; exact on-chain text appears safely and custody credit remains unchanged');

 await click('verify-receipt-history');await until("document.getElementById('receipt-history-status').textContent.includes('compared saved fields match')");
 const firstVerified=await evaluate('window.__verification.at(-1)');assert.equal(firstVerified.response.transactionHash,postHash);assert.equal(firstVerified.response.transactionIncluded,true);assert.equal(firstVerified.response.publicChainAuthenticated,false);assert.equal(sent.length,1);
 record('freshly mined browser post passes strict server history and receipt binding');
 await fs.writeFile(path.join(output,'post-export.json'),firstVerified.request.exportText);await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(firstVerified.response,null,2));await fs.writeFile(path.join(output,'review-state.json'),JSON.stringify(initial,null,2));
 await cmd('Page.reload',{ignoreCache:true});await until("document.getElementById('last-receipt-outcome')?.textContent.includes('Saved local receipt check')");await idle();
 await click('verify-receipt-history');await until("document.getElementById('receipt-history-status').textContent.includes('compared saved fields match')");assert.equal(sent.length,1);record('reload verifies retained post without reconnecting or resending');
 await evaluate('window.__held=false;window.__hold=true');
 await click('verify-receipt-history');await until('window.__held===true');await click('refresh');await idle();await evaluate('window.__hold=false;window.__release()');await sleep(100);
 assert.match(await evaluate("document.getElementById('receipt-history-status').textContent"),/^Not checked/);assert.equal(sent.length,1);record('refresh discards a delayed real verification response without erasing receipt');
 await click('verify-receipt-history');await until("document.getElementById('receipt-history-status').textContent.includes('compared saved fields match')");assert.equal(sent.length,1);record('explicit retry after interrupted delivery verifies without resubmission');
 const last=await fetchState();assert.equal(last.credit,initial.credit);assert.equal(last.balances.custody,initial.balances.custody);assert.equal(last.posting.nonce,'1');assert.equal(pageErrors.length,0);
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.getElementById('verify-receipt-history').scrollIntoView({block:'center'})");const shot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'verified-fresh-post.png'),Buffer.from(shot.data,'base64'));
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({status:'pass',scope:'Fresh isolated Geth deployment and one signed browser post through controlled EIP-1193 adapter; not wallet-extension compatibility, independent operator reproduction or public deployment. Delivery interruption is controlled after the real verification response arrives.',clientVersion,cases:results,initial,afterFirstPost,final:last,transactions:sent,verification:firstVerified.response,pageErrors},null,2)+'\n');
}catch(e){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:e.message,stack:e.stack,results,pageErrors,sent},null,2));throw e;}
finally{if(ws?.readyState===WebSocket.OPEN){await cmd('Browser.close').catch(()=>{});ws.close();}browser?.kill();await fs.writeFile(path.join(output,'browser.log'),browserLog);rpc.destroy();}
