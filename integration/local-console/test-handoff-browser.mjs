// Real headless-browser journey with a controlled EIP-1193 adapter.
// Local signed Geth execution only; not extension compatibility or independent reproduction.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {Wallet,JsonRpcProvider,Interface}=createRequire(import.meta.url)('ethers');
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
const errorABI=new Interface(['error Error(string)']);
let browser,ws,nextId=0,activeSigner=controller,expectedApproval=null;
const requests=new Map(),calls=[],sent=[],walletPrompts=[],pageErrors=[],results=[],funding=[],readOnlyChecks=[],rejectedPlans=[];
let browserLog='',initial,afterTransfer,final,clientVersion;
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
 assert.equal(initial.balances.wallet,'0');assert.equal(initial.balances.custody,'10');
 await selectedChain();clientVersion=await rpc.send('web3_clientVersion',[]);assert.match(clientVersion,/Geth/);
 assert.equal(await tokenBalance(recipient.address),'0');
 const gasBefore=await rpc.getBalance(recipient.address);
 if(gasBefore<10n**16n){
  // Only this selected local chain is funded, from the disposable controller.
  // The exact native-token transfer is retained separately from UI transactions.
  await selectedChain();const value=10n**16n-gasBefore;
  const tx=await controller.sendTransaction({to:recipient.address,value});const receipt=await tx.wait();assert.equal(receipt.status,1);
  funding.push({purpose:'local recipient transaction gas',from:controller.address,to:recipient.address,valueWei:String(value),transactionHash:tx.hash,blockNumber:receipt.blockNumber});
 }
 const transferData=walletABI.encodeFunctionData('execute',[initial.contracts.registry,registryABI.encodeFunctionData('safeTransferFrom',[initial.contracts.wallet,recipient.address,2])]);
 const withdrawalData=custodyABI.encodeFunctionData('withdraw',[2,BigInt(initial.epoch)+1n,2]);
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
 window.__test={receiptMode:'pending',tamperTransfer:false,staleAuthority:false};let seq=0;const waiting=new Map(),listeners=new Map();
 window.__walletResolve=(id,v)=>{const p=waiting.get(id);if(!p)return;waiting.delete(id);v.error?p.reject(Object.assign(Error(v.error.message),v.error)):p.resolve(v.result);};
 const bridge=req=>new Promise((resolve,reject)=>{const id=++seq;waiting.set(id,{resolve,reject});window.__walletBridge(JSON.stringify({id,req}));});
 window.ethereum={on(name,fn){listeners.set(name,fn);},removeListener(name){listeners.delete(name);},async request(req){
  if(req.method==='eth_getTransactionReceipt'&&window.__test.receiptMode==='pending')return null;
  if(req.method==='eth_getTransactionReceipt'&&window.__test.receiptMode==='error')throw Error('Receipt service unavailable');
  return bridge(req);
 }};
 window.__walletEvent=(name,value)=>listeners.get(name)?.(value);
 const realFetch=window.fetch.bind(window);window.fetch=async(...args)=>{const r=await realFetch(...args);if(window.__test.tamperTransfer&&args[0]==='/api/transfer-plan'){const p=await r.json();p.data+='00';return new Response(JSON.stringify(p),{status:r.status,headers:r.headers});}if(window.__test.staleAuthority&&args[0]==='/api/state'){const s=await r.json();s.epoch=String(BigInt(s.epoch)+2n);return new Response(JSON.stringify(s),{status:r.status,headers:r.headers});}return r;};
 `});
 await cmd('Page.navigate',{url});await until("document.getElementById('credit')?.textContent==='2'");
 assert.equal(calls.length,0);assert.equal(sent.length,0);record('initial page performs no wallet requests or transaction submission');
 await click('connect');await idle();assert.match(await status(),/Local wallet connected/);record('original controller connects to owned account');
 await fill('recipient',recipient.address);await click('prepare-transfer');await idle();
 assert.equal(await evaluate("document.getElementById('transfer-review').hidden"),false);
 assert.equal((await evaluate("document.getElementById('transfer-recipient').textContent")).toLowerCase(),recipient.address.toLowerCase());
 assert.match(await evaluate("document.getElementById('transfer-credit').textContent"),/^2(?:\D|$)/);assert.equal(sent.length,0);
 record('transfer review identifies exact new owner and credit moving with account');
 await click('cancel');assert.equal(sent.length,0);record('cancelled ownership transfer does not request a transaction');
 await configure({tamperTransfer:true});await click('prepare-transfer');await idle();assert.match(await status(),/bytes do not match/i);assert.equal(await evaluate("document.getElementById('review').hidden"),true);assert.equal(sent.length,0);await configure({tamperTransfer:false});record('modified transfer bytes are rejected before signing');
 await click('prepare-transfer');await idle();await fill('recipient',recipient.address);assert.equal(await evaluate("document.getElementById('review').hidden"),true);record('recipient edit invalidates prepared transfer');
 await click('prepare-transfer');await idle();await configure({staleAuthority:true});await click('confirm');await idle();
 assert.match(await status(),/Account authority changed since review/);assert.equal(sent.length,0);assert.equal(walletPrompts.filter(x=>x.kind==='transfer').length,0);assert.equal(await evaluate("localStorage.getItem('caw.local.withdrawal.v1')"),null);assert.equal(await evaluate("document.getElementById('review').hidden"),true);
 await configure({staleAuthority:false});record('altered fresh-state epoch cancels stale review and clears unsent intent before any signing request');
 await click('prepare-transfer');await idle();expectedApproval='transfer';await click('confirm');await idle();
 assert.equal(expectedApproval,null);assert.equal(sent.length,1);assert.match(await status(),/Transaction pending/i);
 assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);assert.equal(await evaluate("document.getElementById('prepare-transfer').disabled"),true);
 record('one explicit approval submits exact ownership transfer and pending receipt blocks duplicate actions');
 await cmd('Page.reload',{ignoreCache:true});await until("document.getElementById('saved-status')?.textContent.includes('Saved submission restored')");
 assert.equal(sent.length,1);assert.equal(await evaluate("document.getElementById('prepare-transfer').disabled"),true);
 await click('connect');await idle();assert.match(await status(),/Local wallet connected|receipt|recovery/i);
 await configure({receiptMode:'error'});await click('check-receipt');await idle();assert.match(await status(),/Receipt not verified/);assert.equal(sent.length,1);assert.equal(await evaluate("document.getElementById('check-receipt').hidden"),false);
 record('reload and receipt service failure retain transfer without resubmission after live ownership changes');
 await configure({receiptMode:'normal'});await click('check-receipt');await idle();assert.match(await status(),/transfer confirmed/i);
 afterTransfer=await fetchState();assert.equal(afterTransfer.owner,recipient.address.toLowerCase());assert.equal(afterTransfer.epoch,String(BigInt(initial.epoch)+1n));assert.equal(afterTransfer.credit,'2');assert.equal(afterTransfer.balances.custody,'10');
 assert.equal(await evaluate("localStorage.getItem('caw.local.withdrawal.v1')"),null);assert.equal(sent.length,1);
 record('verified transfer receipt recovers new owner and incremented epoch with credit unchanged');
 const formerWithdrawal=walletABI.encodeFunctionData('execute',[initial.contracts.custody,custodyABI.encodeFunctionData('withdraw',[2,BigInt(afterTransfer.epoch),1])]);
 await readOnlyCall('former contract wallet withdrawal rejected', {from:controller.address,to:initial.contracts.wallet,data:formerWithdrawal},afterTransfer,'OWNER');
 await readOnlyCall('new owner stale-epoch withdrawal rejected',{from:recipient.address,to:initial.contracts.custody,data:custodyABI.encodeFunctionData('withdraw',[2,BigInt(initial.epoch),1])},afterTransfer,'EPOCH');
 await readOnlyCall('new owner current-epoch withdrawal allowed',{from:recipient.address,to:initial.contracts.custody,data:withdrawalData},afterTransfer);
 const afterCalls=await fetchState();assert.equal(afterCalls.credit,'2');assert.equal(afterCalls.balances.custody,'10');assert.equal(afterCalls.balances.owner,'0');assert.equal(sent.length,1);
 record('fixed-block calls reject former wallet with OWNER and stale epoch with EPOCH; current owner and epoch succeed without state mutation');
 await click('connect');await idle();assert.doesNotMatch(await status(),/^Local wallet connected/);assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);assert.equal(await evaluate("document.getElementById('prepare-transfer').disabled"),true);assert.equal(sent.length,1);
 record('former controller cannot prepare another transfer or withdrawal');
 activeSigner=recipient;await evaluate(`window.__walletEvent('accountsChanged',[${JSON.stringify(recipient.address)}])`);
 assert.equal(await evaluate("document.getElementById('prepare').disabled"),true);await click('connect');await idle();assert.match(await status(),/Local wallet connected/);
 await fill('amount','2');await click('prepare');await idle();assert.equal(await evaluate("document.getElementById('review').hidden"),false);
 assert.equal((await evaluate("document.getElementById('review-recipient').textContent")).toLowerCase(),recipient.address.toLowerCase());assert.equal(sent.length,1);
 record('new owner reconnects and reviews direct withdrawal to its own address');
 expectedApproval='withdrawal';await click('confirm');await idle();assert.equal(expectedApproval,null);assert.equal(sent.length,2);assert.match(await status(),/Withdrawal confirmed/);
 final=await fetchState();assert.equal(final.owner,recipient.address.toLowerCase());assert.equal(final.credit,'0');assert.equal(final.balances.custody,'8');assert.equal(final.balances.owner,'2');assert.equal(final.balances.wallet,'0');
 assert.equal(await tokenBalance(recipient.address),'2');assert.equal(await tokenBalance(initial.contracts.custody),'8');
 assert.equal(await evaluate("localStorage.getItem('caw.local.withdrawal.v1')"),null);
 record('new owner receives two mock units; custody eight and account credit zero agree with direct RPC reads');
 const chainTransactions=[];
 for(const tx of sent){const receipt=await rpc.getTransactionReceipt(tx.hash);assert.equal(receipt.status,1);const transaction=await rpc.getTransaction(tx.hash);chainTransactions.push({kind:tx.kind,hash:tx.hash,from:transaction.from,to:transaction.to,nonce:transaction.nonce,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,status:receipt.status});}
 assert.equal(walletPrompts.filter(x=>x.kind==='transfer').length,1);assert.equal(walletPrompts.filter(x=>x.kind==='withdrawal').length,1);assert.equal(pageErrors.length,0);
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});const shot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'handoff-confirmed.png'),Buffer.from(shot.data,'base64'));
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);record('handoff console fits narrow viewport');
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify({status:'pass',scope:'Headless browser and controlled EIP-1193 adapter; signed local Geth transfer and new-owner withdrawal. Not a real extension, independent operator or public-chain test.',browser:await cmd('Browser.getVersion'),clientVersion,cases:results,initial,afterTransfer,final,localGasFunding:funding,walletPrompts,transactions:chainTransactions,rejectedPlans,readOnlyChecks,pageErrors},null,2)+'\n');
}catch(e){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:e.message,stack:e.stack,results,pageErrors,sent,funding,initial,afterTransfer,final,rejectedPlans,readOnlyChecks},null,2)+'\n');throw e;}
finally{if(ws?.readyState===WebSocket.OPEN){await cmd('Browser.close').catch(()=>{});ws.close();}browser?.kill();await fs.writeFile(path.join(output,'browser.log'),browserLog);rpc.destroy();}
