import {verifyWithdrawalPlan} from './withdrawal-plan.mjs';
import {verifyTransferPlan} from './account-transfer-plan.mjs';
import {verifyPostPlan} from './post-plan.mjs';
export const JOURNAL_KEY='caw.local.withdrawal.v1';
const LOCK_NAME='caw.local.withdrawal.v1';
const address=/^0x[0-9a-fA-F]{40}$/,hash=/^0x[0-9a-fA-F]{64}$/,quantity=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
function keys(value,names){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==names.slice().sort().join(','))throw Error('Saved withdrawal has an unexpected format.');}
export function validateJournal(record,state){
 if(state?.chainId!=='0x7a69')throw Error('Saved withdrawal requires the selected local chain.');
 keys(record,['version','id','phase','plan','contracts','hash']);
 if(![1,2,3].includes(record.version)||!/^0x[0-9a-f]{32}$/.test(record.id)||!['awaiting-wallet','submitted'].includes(record.phase))throw Error('Invalid saved withdrawal identity.');
 const contractNames=['wallet','registry','custody','token',...(record.version===3||Object.hasOwn(record.contracts??{},'posting')?['posting']:[])];
 keys(record.contracts,contractNames);
 for(const n of contractNames)if(!address.test(record.contracts[n])||!same(record.contracts[n],state?.contracts?.[n]))throw Error('Saved withdrawal belongs to another contract selection.');
 if(new Set(Object.values(record.contracts).map(x=>x.toLowerCase())).size!==contractNames.length)throw Error('Invalid saved contract selection.');
 const transfer=record.version===2,post=record.version===3;
 keys(record.plan,['chainId','from','to','data','value','epoch','blockNumber','blockHash','genesisHash','nonce',...(post?['action','owner','posting','postNonce','text','textHash','profile']:transfer?['action','recipient','owner','registry']:['amount'])]);
 const p=record.plan;
 if((!transfer&&!post&&(typeof p.amount!=='string'||!/^[1-9][0-9]{0,77}$/.test(p.amount)))||typeof p.epoch!=='string'||!/^(?:0|[1-9][0-9]{0,77})$/.test(p.epoch))throw Error('Invalid saved withdrawal amount or epoch.');
 if(typeof p.nonce!=='string'||!quantity.test(p.nonce)||BigInt(p.nonce)>=2n**64n)throw Error('Invalid saved withdrawal nonce.');
 // Restore a historical intent; current credit and epoch may have changed.
 // The selected deployment and controller must still match before receipt checking.
 const wrapped=same(p.to,state.contracts.wallet),direct=same(p.to,post?state.contracts.posting:transfer?state.contracts.registry:state.contracts.custody);
 if(!wrapped&&!direct)throw Error('Saved action has an unsupported transaction target.');
 const historical={...state,owner:wrapped?state.contracts.wallet:p.from,signer:wrapped?state.controller:p.from,ownerType:wrapped?'fixture-wallet':'eoa',epoch:p.epoch,credit:p.amount};
 if(post)verifyPostPlan(p,{...historical,posting:{...state.posting,nonce:p.postNonce}},historical.signer,p.text);
 else if(transfer)verifyTransferPlan(p,historical,historical.signer,p.recipient);
 else verifyWithdrawalPlan(p,historical,historical.signer,p.amount);
 if(record.phase==='awaiting-wallet'?record.hash!==null:!hash.test(record.hash))throw Error('Invalid saved transaction hash.');
 return record;
}
export function readJournal(storage,state){
 const raw=storage.getItem(JOURNAL_KEY);
 if(raw===null)return null;
 if(typeof raw!=='string'||raw.length>8192)throw Error('Saved withdrawal is too large. Keep it for recovery; do not resubmit.');
 let record;try{record=JSON.parse(raw);}catch{throw Error('Saved withdrawal is unreadable. Keep it for recovery; do not resubmit.');}
 return validateJournal(record,state);
}
async function locked(locks,action){
 if(!locks?.request)throw Error('This browser cannot safely coordinate withdrawal requests. No transaction requested.');
 return locks.request(LOCK_NAME,{mode:'exclusive',ifAvailable:true},lock=>{
  if(!lock)throw Error('Another tab is updating this withdrawal. Check its outcome first.');
  return action();
 });
}
function persist(storage,record,state){
 validateJournal(record,state);const raw=JSON.stringify(record);storage.setItem(JOURNAL_KEY,raw);
 if(storage.getItem(JOURNAL_KEY)!==raw)throw Error('Withdrawal record was not saved reliably. No new submission is allowed.');
 return record;
}
export async function beginWithdrawal(storage,locks,state,plan,id){
 return locked(locks,()=>{
  if(storage.getItem(JOURNAL_KEY)!==null)throw Error('A saved withdrawal already exists. Resolve it before submitting another.');
  verifyWithdrawalPlan(plan,state,state.signer??state.controller,plan.amount);
  return persist(storage,{version:1,id,phase:'awaiting-wallet',plan:{...plan},contracts:{...state.contracts},hash:null},state);
 });
}
export async function beginTransfer(storage,locks,state,plan,id){
 return locked(locks,()=>{
  if(storage.getItem(JOURNAL_KEY)!==null)throw Error('A saved withdrawal or transfer already exists. Resolve it before submitting another.');
  verifyTransferPlan(plan,state,state.signer??state.controller,plan.recipient);
  return persist(storage,{version:2,id,phase:'awaiting-wallet',plan:{...plan},contracts:{...state.contracts},hash:null},state);
 });
}
export async function beginPost(storage,locks,state,plan,id){
 return locked(locks,()=>{
  if(storage.getItem(JOURNAL_KEY)!==null)throw Error('A saved action already exists. Resolve it before submitting another.');
  verifyPostPlan(plan,state,state.signer??state.controller,plan.text);
  return persist(storage,{version:3,id,phase:'awaiting-wallet',plan:{...plan},contracts:{...state.contracts},hash:null},state);
 });
}
export async function rememberHash(storage,locks,state,id,txHash){
 return locked(locks,()=>{
  const record=readJournal(storage,state);
  if(!record||record.id!==id)throw Error('Saved withdrawal changed. Do not replace another tab’s record.');
  if(record.phase==='submitted'&&!same(record.hash,txHash))throw Error('Saved withdrawal already has a different transaction.');
  return persist(storage,{...record,phase:'submitted',hash:txHash},state);
 });
}
// Call only after a matching verified receipt, explicit rejection, or before send.
export async function finishWithdrawal(storage,locks,state,id){
 return locked(locks,()=>{
  const record=readJournal(storage,state);
  if(!record||record.id!==id)throw Error('Saved withdrawal changed. Its record has not been removed.');
  storage.removeItem(JOURNAL_KEY);
  if(storage.getItem(JOURNAL_KEY)!==null)throw Error('Saved withdrawal could not be cleared. Check again before another action.');
 });
}
