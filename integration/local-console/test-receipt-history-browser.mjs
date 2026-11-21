import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {fixturePlan} from './test-accounting-review-fixture.mjs';
import {makeWithdrawalProofPackage,verifyWithdrawalDownload} from './withdrawal-proof-package.mjs';
const dir=path.resolve(process.argv[2]),out=process.argv[3]?path.resolve(process.argv[3]):path.join(dir,'receipt-panel-browser');await fs.mkdir(out);const fixture=JSON.parse(await fs.readFile(path.join(dir,'accounting-withdrawal.json'))),s=fixture.before;
const retained=new URL('../../evidence/console-withdrawal-20261116/',import.meta.url);
const readRetained=async name=>JSON.parse(await fs.readFile(new URL(name,retained)));
const [record,report,selection,evidence,accounting]=await Promise.all(['withdrawal-export.json','console-result.json','withdrawal-selection.json','withdrawal-boundaries.json','accounting-withdrawal.json'].map(readRetained));
const proofPackage=makeWithdrawalProofPackage(evidence,selection);
let proofResponse=null,verificationRequests=0,walletRequests=0;
let mode='valid',receiptMode='pending',sent=0,txRequest=null;const txHash='0x'+'34'.repeat(32),receiptHash='0x'+'56'.repeat(32);const checks=[];
const server=http.createServer(async(req,res)=>{
 try{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/test-wallet'){
   walletRequests++;const parts=[];for await(const p of req)parts.push(p);const q=JSON.parse(Buffer.concat(parts));let value;const liveReceiptHash=receiptMode==='moved'?'0x'+'78'.repeat(32):receiptHash;if(receiptMode==='offline')throw Error('Provider unavailable');
   if(q.method==='eth_chainId')value='0x7a69';
   else if(['eth_accounts','eth_requestAccounts'].includes(q.method))value=[s.signer];
   else if(q.method==='eth_getBlockByNumber')value=q.params[0]==='0x0'?{hash:s.genesisHash}:q.params[0]==='0x20'?{hash:liveReceiptHash,number:'0x20'}:{hash:s.blockHash,number:s.blockNumber};
   else if(q.method==='eth_getTransactionCount')value='0x0';
   else if(q.method==='eth_sendTransaction'){sent++;txRequest=q.params[0];value=txHash;}
   else if(q.method==='eth_getTransactionByHash')value={hash:txHash,from:txRequest.from,to:txRequest.to,input:txRequest.data,value:txRequest.value,nonce:txRequest.nonce,chainId:'0x7a69',blockHash:liveReceiptHash,blockNumber:'0x20'};
   else if(q.method==='eth_getTransactionReceipt')value=receiptMode==='pending'?null:{transactionHash:receiptMode==='mismatch'?'0x'+'99'.repeat(32):txHash,from:txRequest.from,to:txRequest.to,status:receiptMode==='reverted'?'0x0':'0x1',blockHash:liveReceiptHash,blockNumber:'0x20',logs:[]};
   else throw Error('Unexpected wallet method '+q.method);
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(req.url==='/api/replay-withdrawal-export'){
   const parts=[];for await(const part of req)parts.push(part);
   const body=JSON.parse(Buffer.concat(parts));
   assert.equal(body.exportSha256,record.sha256);
   res.end(JSON.stringify(verifyWithdrawalDownload(body.packageText,selection)));return;
  }
  if(req.url==='/api/verified-receipt'){
   verificationRequests++;res.setHeader('Content-Type','application/json');
   if(!proofResponse){res.statusCode=422;res.end(JSON.stringify({error:'Withdrawal proofs unavailable in controlled browser fixture.'}));return;}
   const body=[];for await(const part of req)body.push(part);
   assert.deepEqual(JSON.parse(JSON.parse(Buffer.concat(body)).exportText),record);
   res.end(JSON.stringify(proofResponse));return;
  }
  if(req.url==='/api/state'){
   let v=structuredClone(proofResponse?accounting.after:receiptMode==='confirmed'?fixture.after:s);
   if(mode==='owner balance')v.balances.owner=String(BigInt(v.balances.owner)+1n);
   if(mode==='custody balance')v.balances.custody=String(BigInt(v.balances.custody)+1n);
   if(mode==='new credit'){for(const k of ['credit','creditedLiability','unpaidLiability'])v[k]=String(BigInt(v[k])+1n);v.balances.custody=String(BigInt(v.balances.custody)+1n);}
   if(mode==='missing proof')delete v.accountingProofsVerified;
   if(mode==='new block'){v.blockHash=v.accountingHeaderHash=v.authorityHeaderHash='0x'+'22'.repeat(32);v.blockNumber='0xff';}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(v));return;
  }
  if(req.url==='/api/posts'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:s.status,genesisHash:s.genesisHash,posting:s.contracts.posting,posts:[]}));return;}
  if(req.url.endsWith('-plan')){const kind=req.url.includes('withdrawal')?'withdrawal':req.url.includes('transfer')?'transfer':'post';res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixturePlan(s,kind,s.credit)));return;}
  const file=req.url==='/'?'index.html':req.url.slice(1);if(!/^[a-z0-9-]+\.(mjs|html|css)$/.test(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(new URL('./ui/'+file,import.meta.url)));
 }catch(e){res.statusCode=500;res.end(String(e));}
});
let browser, startupError, browserLog='', stage='local server';
async function recordFailure(error){
 const status=stage==='browser checks'?'FAILED':'NOT_RUN';
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({status,stage,completed:checks.length,checks,error:error.message,browserLog},null,2)+'\n');
}
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 stage='Chromium startup';
 assert(process.env.CHROME_BIN,'Set CHROME_BIN to the Chromium executable.');
 browser=spawn(process.env.CHROME_BIN,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--remote-debugging-port=0','--user-data-dir='+path.join(out,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',chunk=>{browserLog=(browserLog+chunk.toString()).slice(-2048);});
 browser.on('error',error=>{startupError=error;});
}catch(error){await recordFailure(error);server.close();throw error;}
let ws,id=0;const pending=new Map(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
function cmd(method,params={}){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>reject(Error('CDP_TIMEOUT '+method)),15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
async function ev(expression){const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression){stage='browser checks';for(let n=0;n<100;n++){if(await ev(expression))return;await sleep(100);}throw Error('UI_TIMEOUT '+expression+' '+await ev('document.body.innerText'));}
const el=id=>`document.getElementById(${JSON.stringify(id)})`;
async function prepare(kind){mode='valid';await ev(el('refresh')+'.click()');await until('!'+el('prepare')+'.disabled');await ev(el('amount')+`.value='2';`+el('recipient')+`.value='0x${'11'.repeat(20)}';`+el('post-text')+`.value='review test';`+el(kind==='withdrawal'?'withdraw-form':kind+'-form')+'.requestSubmit()');await until('!'+el('confirm')+'.disabled');assert((await ev(el('accounting-review')+'.textContent')).includes('Expected accounting'));}
try{
 let port;for(let n=0;n<100;n++){
  if(startupError)throw startupError;
  if(browser.exitCode!==null||browser.signalCode)throw Error('Chromium exited before opening its debugging port: '+(browser.signalCode??browser.exitCode));
  try{port=Number((await fs.readFile(path.join(out,'profile/DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await sleep(100);}
 }assert(port,'Chromium debugging port did not open in time.');
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const v=JSON.parse(e.data),p=pending.get(v.id);if(p){pending.delete(v.id);clearTimeout(p.timer);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);}});
 await cmd('Page.enable');await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.ethereum={async request(q){const r=await fetch('/test-wallet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)});return r.json();},on(){},removeListener(){}};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.failArchive&&(k.startsWith('caw.local.receipt-outcome.v1.')||k.startsWith('caw.local.receipt-rechecks.v1.')))throw Error('Test archive write failure');return set.call(this,k,v);};`});
 await cmd('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await until(el('accounting-status')+"?.textContent==='Verified against selected local state'");await until('!'+el('connect')+'.disabled');await ev(el('connect')+'.click()');await until('!'+el('prepare')+'.disabled');
 const journal='caw.local.withdrawal.v1',last='caw.local.receipt-outcome.latest.v1',prefix='caw.local.receipt-outcome.v1.';
 async function reload(){await cmd('Page.reload');await until(el('accounting-status')+"?.textContent==='Verified against selected local state'");await until('!'+el('connect')+'.disabled');}
 async function start(){receiptMode='pending';await ev('localStorage.clear()');await reload();await ev(el('connect')+'.click()');await until('!'+el('prepare')+'.disabled');await prepare('withdrawal');await ev(el('confirm')+'.click()');await until('!'+el('refresh')+'.disabled && '+el('message')+".textContent.includes('Transaction pending')");}
 await start();receiptMode='confirmed';await ev(el('check-receipt')+'.click()');await until('!'+el('refresh')+'.disabled && '+el('last-receipt-outcome')+".textContent.includes('Saved local receipt check · confirmed')");
 const savedId=await ev(`localStorage.getItem('${last}')`),original=await ev(`localStorage.getItem('${prefix}'+localStorage.getItem('${last}'))`),logKey='caw.local.receipt-rechecks.v1.'+savedId,sends=sent;
 for(const [modeValue,expected]of [['confirmed','MATCHES_PRIOR'],['pending','NOT_CURRENTLY_CONFIRMED'],['reverted','CONFLICTS_PRIOR'],['moved','CONFLICTS_PRIOR'],['mismatch','INCONCLUSIVE'],['offline','INCONCLUSIVE']]){
  receiptMode=modeValue;await until('!'+el('recheck-outcome')+'.disabled');await ev(el('recheck-outcome')+'.click()');await until('!'+el('refresh')+'.disabled && '+el('message')+`.textContent.includes('${expected}')`);
  const log=JSON.parse(await ev(`localStorage.getItem('${logKey}')`));assert.equal(log.entries.at(-1).classification,expected);assert.equal(await ev(`localStorage.getItem('${prefix}${savedId}')`),original);assert.equal(sent,sends);checks.push(modeValue+' recheck appended without rewriting original or resending');
 }
 receiptMode='confirmed';await reload();assert((await ev(el('last-receipt-outcome')+'.textContent')).includes('Previous confirmation not reproduced'));assert((await ev(el('last-receipt-outcome')+'.textContent')).includes('Conflicts with the prior'));assert.equal(JSON.parse(await ev(`localStorage.getItem('${logKey}')`)).entries.length,6);assert.equal(sent,sends);checks.push('reload retains matching stale conflicting and inconclusive history');
 await ev(el('connect')+'.click()');await until('!'+el('recheck-outcome')+'.disabled');const previous=await ev(`localStorage.getItem('${logKey}')`);await ev('window.failArchive=true');await ev(el('recheck-outcome')+'.click()');await until('!'+el('refresh')+'.disabled && '+el('message')+".textContent.includes('Recheck not recorded')");assert.equal(await ev(`localStorage.getItem('${logKey}')`),previous);assert.equal(await ev(`localStorage.getItem('${prefix}${savedId}')`),original);checks.push('failed recheck write preserves prior history and original');
 await ev('window.failArchive=false');await ev(el('recheck-outcome')+'.click()');await until('!'+el('refresh')+'.disabled && '+el('message')+".textContent.includes('MATCHES_PRIOR')");assert.equal(JSON.parse(await ev(`localStorage.getItem('${logKey}')`)).entries.length,7);assert.equal(sent,sends);checks.push('write retry adds observation without transaction submission');

 // Capture the exact download blob without filesystem download permissions.
 await ev(`window.exportDownload=null;HTMLAnchorElement.prototype.click=function(){if(this.download){window.exportName=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.exportDownload=t);}}`);
 await reload();
 await ev(`window.exportDownload=null;HTMLAnchorElement.prototype.click=function(){if(this.download){window.exportName=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.exportDownload=t);}}`);
 await until('!'+el('export-outcome')+'.disabled');await ev(el('export-outcome')+'.click()');await until('window.exportDownload!==null');
 const downloaded=await ev('window.exportDownload'),envelope=JSON.parse(downloaded),payload=JSON.parse(envelope.payload);
 assert.deepEqual(payload.original,JSON.parse(original));assert.equal(payload.rechecks.entries.length,7);assert.equal(sent,sends);checks.push('download after reload without wallet connection retains original and all rechecks');
 const checked=await ev(`import('/receipt-export.mjs').then(m=>m.verifyReceiptExport(window.exportDownload,${JSON.stringify(fixture.before)})).then(v=>v.observations)`);assert.equal(checked,7);checks.push('download checksum and structure verify in browser');
 await fs.writeFile(path.join(out,'download.json'),downloaded);
 await ev(el('verify-receipt-history')+'.click()');await until(el('receipt-history-status')+".textContent.includes('Withdrawal proofs unavailable')");assert.equal(sent,sends);checks.push('real console retains unverified withdrawal when proof acquisition fails without resend');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await ev(el('verify-receipt-history')+".scrollIntoView({block:'center'})");const panelShot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'receipt-panel.png'),Buffer.from(panelShot.data,'base64'));
 await ev(`localStorage.setItem('${logKey}','corrupt');window.exportDownload=null`);await ev(el('export-outcome')+'.click()');await until('!'+el('refresh')+'.disabled && '+el('message')+".textContent.includes('Receipt export unavailable')");assert.equal(await ev('window.exportDownload'),null);assert.equal(await ev(`localStorage.getItem('${logKey}')`),'corrupt');checks.push('corrupt history blocks download without deleting evidence');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await ev(el('last-receipt-outcome')+".scrollIntoView({block:'start'})");assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);const shot=await cmd('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(out,'rechecks.png'),Buffer.from(shot.data,'base64'));checks.push('receipt recheck history fits desktop layout');
 const proofButton=el('export-withdrawal-proofs'),verifyButton=el('verify-receipt-history'),proofStatus=el('receipt-history-status');
 assert.equal(await ev(proofButton+'.disabled'),true);
 const retainedOriginal=JSON.parse(record.payload).original,id=retainedOriginal.action.id;
 const good={...report.result,proofPackage};
 proofResponse=good;
 await ev(`localStorage.clear();localStorage.setItem('${prefix}${id}',${JSON.stringify(JSON.stringify(retainedOriginal))});localStorage.setItem('${last}','${id}')`);
 await reload();
 const storageBefore=await ev('JSON.stringify(localStorage)'),readsBefore=walletRequests;
 const verifyProof=async()=>{await ev(verifyButton+'.click()');await until('!'+proofButton+'.disabled');};
 await verifyProof();
 const verifiedRequests=verificationRequests,filename='caw-withdrawal-proofs-'+selection.transactionHash+'.json';
 await cmd('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out});
 await ev(proofButton+'.click()');
 let savedProof;
 for(let i=0;i<100;i++){try{savedProof=await fs.readFile(path.join(out,filename),'utf8');break;}catch(e){if(e.code!=='ENOENT')throw e;await sleep(100);}}
 assert.equal(savedProof,JSON.stringify(proofPackage));assert.equal(verificationRequests,verifiedRequests);
 assert.equal(walletRequests,readsBefore);assert.equal(sent,sends);assert.equal(await ev('JSON.stringify(localStorage)'),storageBefore);
 checks.push('real Chromium download preserves the verified package bytes without another verification, wallet read or storage write');

 await ev(`localStorage.removeItem('${last}');`+proofButton+'.click()');
 await until(proofStatus+".textContent.includes('selection')||"+proofStatus+".textContent.includes('selected receipt changed')");
 assert.equal(await ev(proofButton+'.disabled'),true);assert.equal(verificationRequests,verifiedRequests);
 await ev(`localStorage.setItem('${last}','${id}')`);await verifyProof();
 await ev("window.dispatchEvent(new StorageEvent('storage'))");
 assert.equal(await ev(proofButton+'.disabled'),true);checks.push('changed saved receipt and storage events invalidate the verified download');

 for(const [name,mutate] of [
  ['withdrawal absent despite accounting claim',v=>{v.status='NOT_FOUND_IN_SELECTED_VERIFIED_WITHDRAWAL_HISTORY';v.transactionIncluded=false;}],
  ['altered custody credit',v=>v.proofPackage.evidence.after.observed.credit='999'],
  ['missing owner proof',v=>delete v.proofPackage.evidence.before.proofs.owner],
  ['altered receipt status',v=>v.proofPackage.evidence.receipts[0].status='0x0'],
  ['missing package',v=>delete v.proofPackage],
  ['mismatched selected block',v=>v.proofPackage.selection.endHash=selection.startHash],
  ['missing receipt',v=>v.proofPackage.evidence.receipts=[]],
  ['wrong signed transaction bytes',v=>v.proofPackage.evidence.rawTransactions=['0x12']],
  ['oversized package',v=>v.proofPackage.padding='x'.repeat(1024*1024)],
  ['oversized response',v=>v.padding='x'.repeat(2*1024*1024)]
 ]){
  proofResponse=structuredClone(good);mutate(proofResponse);await ev(verifyButton+'.click()');
  await until(proofStatus+".textContent.includes('Not accepted')");assert.equal(await ev(proofButton+'.disabled'),true);
  checks.push('withdrawal download unavailable for '+name);
 }
 proofResponse={...good,status:'INCLUDED_WITHDRAWAL_WITH_LOCAL_RECORD_DISCREPANCIES',discrepancies:['plan.amount']};
 await verifyProof();assert.match(await ev(proofStatus+'.textContent'),/saved fields disagree/);
 await ev(el('refresh')+'.click()');assert.equal(await ev(proofButton+'.disabled'),true);
 checks.push('verified package with a saved-field discrepancy stays distinct and refresh disables download');
 assert.equal(walletRequests,readsBefore);assert.equal(sent,sends);
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:checks.length,checks,scope:'Headless Chromium with controlled provider responses and retained local withdrawal evidence. Browser checks cover download fidelity and invalidation. No fresh signing or execution.'},null,2)+'\n');console.log(checks.length+' browser checks passed');
}catch(error){await recordFailure(error);throw error;}
finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
