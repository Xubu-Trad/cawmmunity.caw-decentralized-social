import {verifyWalletProviderContext} from './wallet-provider.mjs';
import {verifyWithdrawalPlan} from './withdrawal-plan.mjs';
import {verifyTransferPlan} from './account-transfer-plan.mjs';
import {verifyWithdrawalReceipt,verifyRecoveryTransaction} from './receipt-status.mjs';
import {JOURNAL_KEY,readJournal,beginWithdrawal,beginTransfer,rememberHash,finishWithdrawal} from './withdrawal-journal.mjs';
const $=id=>document.getElementById(id);
const CHAIN='0x7a69',address=/^0x[0-9a-fA-F]{40}$/;
let state=null,account=null,provider=null,plan=null,generation=0,busy=false,pending=null,refreshing=false,saved=null,journalError=null;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
function clearPlan(){plan=null;generation++;$('review').hidden=true;controls();}
function controls(){const valid=state&&account&&same(account,state.signer);$('prepare-transfer').disabled=busy||refreshing||!valid||!!saved||!!journalError||!!pending;$('prepare').disabled=busy||refreshing||!valid||!!saved||!!journalError||!!pending;$('connect').disabled=busy||refreshing;$('confirm').disabled=busy||refreshing||!plan||!!saved||!!journalError||!!pending;$('refresh').disabled=busy||refreshing;$('check-receipt').hidden=!pending;$('check-receipt').disabled=busy||refreshing||!provider||!account;$('recover').disabled=busy||refreshing||!provider||!account||!saved||saved.phase!=='awaiting-wallet';$('recovery').hidden=saved?.phase!=='awaiting-wallet';}
async function api(path,options={}){const response=await fetch(path,{...options,signal:AbortSignal.timeout(8000),cache:'no-store'});const text=await response.text();if(text.length>16384)throw Error('Local response too large.');let value;try{value=JSON.parse(text);}catch{throw Error('The local service returned an unreadable response.');}if(!response.ok)throw Error(typeof value.error==='string'?value.error:'Local request rejected.');return value;}
function validState(s){if(!s||s.chainId!==CHAIN||s.status!=='LOCAL_CHAIN_RESEARCH')throw Error('This console requires the selected local research chain.');for(const a of [s.controller,s.owner,...['wallet','registry','custody','token'].map(n=>s.contracts?.[n])])if(!address.test(a))throw Error('Invalid contract or account data.');if(!['fixture-wallet','eoa','unsupported'].includes(s.ownerType)||s.ownerType!=='unsupported'&&!address.test(s.signer))throw Error('Invalid account authority.');for(const n of [s.epoch,s.credit,s.balances?.wallet,s.balances?.owner,s.balances?.custody])if(!/^\d+$/.test(String(n)))throw Error('Invalid balance or ownership data.');return s;}
async function refresh(quiet=false){if(refreshing)return false;refreshing=true;clearPlan();try{state=validState(await api('/api/state'));syncSaved();for(const [id,value]of Object.entries({epoch:state.epoch,credit:state.credit,'wallet-balance':state.balances.wallet,'owner-balance':state.balances.owner,signer:state.signer||'Unsupported contract owner','custody-balance':state.balances.custody,owner:state.owner,'contract-wallet':state.contracts.wallet,controller:state.controller}))$(id).textContent=String(value);$('block').textContent='Block '+String(state.blockNumber);$('connection-status').textContent='Local chain responding';if(!quiet)message('Chain state refreshed. Review the current ownership and credit before submitting.');}catch(e){state=null;$('connection-status').textContent='Chain unavailable';message(e.message,true);}refreshing=false;controls();return !!state;}
async function walletIdentity(request=false){if(!provider)throw Error('Connect a local test wallet first.');const chain=await readProvider().request({method:'eth_chainId'});if(chain!==CHAIN)throw Error('Select local chain 31337 in your wallet. This console does not switch networks.');const accounts=await (request?provider:readProvider()).request({method:request?'eth_requestAccounts':'eth_accounts'});if(!Array.isArray(accounts)||!address.test(accounts[0]))throw Error('No wallet account is available.');return accounts[0];}
function onWalletChange(){account=null;clearPlan();$('wallet-status').textContent='Wallet account or network changed. Reconnect to review a new action.';message('Previous action review cleared.');}
$('connect').addEventListener('click',async()=>{clearPlan();const version=generation;busy=true;controls();try{if(!window.ethereum?.request)throw Error('No compatible browser wallet found. Connect a disposable wallet configured for your local chain.');if(provider!==window.ethereum){provider?.removeListener?.('accountsChanged',onWalletChange);provider?.removeListener?.('chainChanged',onWalletChange);provider=window.ethereum;provider.on?.('accountsChanged',onWalletChange);provider.on?.('chainChanged',onWalletChange);}const selected=await walletIdentity(true);if(version!==generation)throw Error('Wallet changed during connection. Connect again.');account=selected;if(!state||!same(account,state.signer)&&!same(account,saved?.plan.from))throw Error('The selected wallet does not control this account.');$('wallet-status').textContent=(same(account,state.signer)?'Connected current signer: ':'Connected for saved receipt recovery only: ')+account;message('Local wallet connected. No signing request has been made.');}catch(e){account=null;$('wallet-status').textContent='Wallet not connected for this account.';message(e.message,true);}finally{busy=false;controls();}});
$('withdraw-form').addEventListener('submit',async event=>{event.preventDefault();if(busy||refreshing||saved||journalError||pending)return;clearPlan();const amount=$('amount').value.trim();if(!/^[1-9][0-9]{0,77}$/.test(amount)){message('Enter a positive whole number of mock units.',true);return;}busy=true;controls();const version=generation;try{if(!state||!account||!same(account,state.signer))throw Error('The connected wallet does not currently control this account.');const current=await walletIdentity();if(!same(current,account))throw Error('The connected account changed. Reconnect first.');if(BigInt(amount)>BigInt(state.credit))throw Error('Amount exceeds the last reported available credit. Refresh chain state.');const p=await api('/api/withdrawal-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount})});if(version!==generation)throw Error('Wallet state changed while preparing. Review again.');verifyWithdrawalPlan(p,state,account,amount);plan=Object.freeze(p);$('review-amount').textContent=amount+' mock units';$('review-recipient').textContent=state.owner;$('withdrawal-review').hidden=false;$('transfer-review').hidden=true;$('review-explanation').textContent=state.ownerType==='fixture-wallet'?'The controller calls the contract wallet. The withdrawal pays that contract wallet, not the controller address.':'The current owner calls custody directly. The withdrawal pays this connected wallet.';$('review-epoch').textContent=String(p.epoch);$('review').hidden=false;message('Review the plan below. Transaction bytes match this withdrawal. Nothing has been submitted.');}catch(e){clearPlan();message(e.message,true);}finally{busy=false;controls();}});
function readProvider(){const selected=provider;return {async request(req){let timer;try{return await Promise.race([selected.request(req),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Wallet read timed out. No confirmation established; check again.')),8000);})]);}finally{clearTimeout(timer);}}};}
function syncSaved(){
 try{
  saved=readJournal(localStorage,state);journalError=null;pending=saved?.phase==='submitted'?{id:saved.id,hash:saved.hash,plan:saved.plan}:null;
  $('saved-status').textContent=saved?(saved.phase==='submitted'?'Saved submission restored. Connect the selected wallet and check its receipt.':'A wallet request has an unresolved outcome. Do not submit another action. Find its transaction in your wallet and enter its hash below.'):'No unresolved action is saved.';
 }catch(e){saved=null;pending=null;journalError=e.message;$('saved-status').textContent='Recovery required: '+e.message+' New submissions are blocked.';}
 try{$('saved-record').value=(localStorage.getItem(JOURNAL_KEY)||'').slice(0,8192);}catch{$('saved-record').value='Browser storage unavailable.';}
 $('saved-details').hidden=!saved&&!journalError;controls();
}
window.addEventListener('storage',event=>{if(event.key===JOURNAL_KEY||event.key===null){clearPlan();if(state)syncSaved();}});
async function checkReceipt(){
 const selected=pending;if(!selected)return;
 const result=await verifyWithdrawalReceipt(readProvider(),selected.hash,selected.plan);const label=selected.plan.action==='transfer'?'Account transfer':'Withdrawal';
 if(pending!==selected)return;
 if(result.status==='pending'){message('Transaction pending on the local chain. Check again; do not submit a duplicate.');return;}
 await finishWithdrawal(localStorage,navigator.locks,state,selected.id);saved=null;pending=null;journalError=null;
 $('transaction').textContent=(result.status==='confirmed'?'Confirmed local transaction: ':'Reverted local transaction: ')+selected.hash+' · block '+result.blockNumber;
 const refreshed=await refresh(true);
 message(result.status==='confirmed'?label+' confirmed on the selected local chain.'+(refreshed?' Balances refreshed.':' Balance refresh failed; retry refresh.')+' This is not public-chain finality.':'The local transaction reverted. No successful action is established.',result.status!=='confirmed'||!refreshed);
}
$('confirm').addEventListener('click',async()=>{
 if(!plan||busy||refreshing||pending||saved||journalError)return;busy=true;controls();const version=generation,p=plan;let intent=null,requested=false,walletRejected=false;
 try{
  verifyActionPlan(p);await verifyWalletProviderContext(readProvider(),p);
  const nonce=await readProvider().request({method:'eth_getTransactionCount',params:[p.from,'pending']});
  if(version!==generation||plan!==p||!same(account,p.from))throw Error('Wallet changed. Prepare a new withdrawal.');
  const selected=Object.freeze({...p,nonce});
  const id='0x'+Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
  intent=await (p.action==='transfer'?beginTransfer:beginWithdrawal)(localStorage,navigator.locks,state,selected,id);saved=intent;syncSaved();
  await verifyWalletProviderContext(readProvider(),selected);
  await verifyFreshAuthority(p);
  if(version!==generation||plan!==p||!same(account,p.from)||journalError||!saved||saved.id!==intent.id||saved.phase!=='awaiting-wallet')throw Error('Wallet or saved recovery record changed before submission.');
  requested=true;
  let tx;try{tx=await provider.request({method:'eth_sendTransaction',params:[{from:selected.from,to:selected.to,data:selected.data,value:selected.value,nonce:selected.nonce}]});}catch(e){walletRejected=e.code===4001;throw e;}
  if(!/^0x[0-9a-fA-F]{64}$/.test(tx))throw Error('Wallet returned an invalid transaction identifier. Check your wallet before retrying.');
  $('transaction').textContent='Submitted transaction: '+tx;
  pending={id:intent.id,hash:tx,plan:selected};
  saved=await rememberHash(localStorage,navigator.locks,state,intent.id,tx);syncSaved();clearPlan();
  message('Transaction submitted and saved. Checking its receipt on the selected local chain…');await checkReceipt();
 }catch(e){
  if(intent&&(!requested||walletRejected)){
   try{await finishWithdrawal(localStorage,navigator.locks,state,intent.id);saved=null;pending=null;}catch(clearError){journalError=clearError.message;}
  }
  clearPlan();
  if(state&&!pending)syncSaved();
  message(saved||pending||journalError?'Action outcome unresolved: '+e.message+' Keep the saved record and check your wallet; do not resubmit.':e.message||'Wallet submission failed.',true);
 }finally{busy=false;controls();}
});
$('recover').addEventListener('click',async()=>{
 if(busy||refreshing||!saved||saved.phase!=='awaiting-wallet')return;
 const selected=saved,hash=$('recovery-hash').value.trim();busy=true;controls();
 try{
  await verifyRecoveryTransaction(readProvider(),hash,selected.plan);
  saved=await rememberHash(localStorage,navigator.locks,state,selected.id,hash);
  pending={id:selected.id,hash,plan:selected.plan};$('transaction').textContent='Recovered transaction: '+hash;
  await checkReceipt();
 }catch(e){message('Recovery not verified: '+e.message+' Saved withdrawal retained.',true);}
 finally{busy=false;controls();}
});
$('check-receipt').addEventListener('click',async()=>{if(busy)return;busy=true;controls();try{await checkReceipt();}catch(e){message('Receipt not verified: '+e.message+' Submission retained; check again.',true);}finally{busy=false;controls();}});
$('cancel').addEventListener('click',()=>{clearPlan();message('Withdrawal review cancelled.');});$('amount').addEventListener('input',clearPlan);$('recipient').addEventListener('input',clearPlan);$('refresh').addEventListener('click',()=>refresh());refresh();


function verifyActionPlan(p){
 if(p.action==='transfer')return verifyTransferPlan(p,state,account,p.recipient);
 return verifyWithdrawalPlan(p,state,account,p.amount);
}
async function verifyFreshAuthority(p){
 const latest=validState(await api('/api/state'));
 if(!same(latest.genesisHash,p.genesisHash)||latest.chainId!==p.chainId||!same(latest.signer,p.from)||latest.epoch!==p.epoch||!same(latest.owner,state.owner)||Object.keys(state.contracts).some(n=>!same(latest.contracts[n],state.contracts[n])))throw Error('Account authority changed since review. Refresh and review again.');
 if(p.action==='transfer'){
  if(latest.credit!==state.credit)throw Error('Attached credit changed since review. Refresh and review again.');
  const checked=await api('/api/transfer-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient:p.recipient})});
  verifyTransferPlan(checked,latest,p.from,p.recipient);
  if(!same(checked.data,p.data))throw Error('Account transfer changed since review.');
 }else verifyWithdrawalPlan(p,latest,p.from,p.amount);
}
$('transfer-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||refreshing||saved||journalError||pending)return;
 clearPlan();const recipient=$('recipient').value.trim();
 if(!address.test(recipient)){message('Enter the full address of a disposable local recipient wallet.',true);return;}
 busy=true;controls();const version=generation;
 try{
  if(!state||!account||!same(account,state.signer))throw Error('Connect the current account owner first.');
  const current=await walletIdentity();if(!same(current,account))throw Error('The connected wallet changed. Reconnect first.');
  const p=await api('/api/transfer-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient})});
  if(version!==generation)throw Error('Wallet state changed while preparing. Review again.');
  verifyTransferPlan(p,state,account,recipient);plan=Object.freeze(p);
  $('withdrawal-review').hidden=true;$('transfer-review').hidden=false;
  $('transfer-recipient').textContent=p.recipient;$('transfer-credit').textContent=state.credit+' mock units (current snapshot)';
  $('review-explanation').textContent='Account 2 and its attached credit move to this wallet. The previous owner loses withdrawal access. Confirm control of the recipient and give it local test ETH for future transactions. This transfer has no on-chain epoch check: an old pending transfer can remain valid if ownership returns to its sender.';
  $('review').hidden=false;message('Review the account handoff. Nothing has been submitted.');
 }catch(e){clearPlan();message(e.message,true);}finally{busy=false;controls();}
});
