import {JOURNAL_KEY,readJournal,validateJournal,withJournalLock} from './withdrawal-journal.mjs';
export const OUTCOME_PREFIX='caw.local.receipt-outcome.v1.';
export const LAST_OUTCOME_KEY='caw.local.receipt-outcome.latest.v1';
const idPattern=/^0x[0-9a-f]{32}$/,hash=/^0x[0-9a-fA-F]{64}$/,quantity=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
function keys(v,n){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==n.slice().sort().join(','))throw Error('Saved receipt outcome has an unexpected format.');}
export function validateReceiptOutcome(value,state){
 keys(value,['version','scope','action','transactionHash','receipt']);
 if(value.version!==1||value.scope!=='LOCAL_PROVIDER_RECEIPT_CHECK')throw Error('Unsupported saved receipt outcome.');
 validateJournal(value.action,state);const r=value.receipt;
 keys(r,['status','blockNumber','blockHash']);
 if(value.action.phase!=='submitted'||!hash.test(value.transactionHash)||value.transactionHash.toLowerCase()!==value.action.hash.toLowerCase()||!['confirmed','reverted'].includes(r.status)||!hash.test(r.blockHash)||!quantity.test(r.blockNumber)||BigInt(r.blockNumber)<BigInt(value.action.plan.blockNumber))throw Error('Receipt outcome does not match the submitted action.');
 return value;
}
function parse(raw,state){if(typeof raw!=='string'||raw.length>10240)throw Error('Saved receipt outcome is missing or too large.');return validateReceiptOutcome(JSON.parse(raw),state);}
export function readLastReceiptOutcome(storage,state){
 const id=storage.getItem(LAST_OUTCOME_KEY);if(id===null)return null;
 if(!idPattern.test(id))throw Error('Saved receipt outcome pointer is invalid.');
 const value=parse(storage.getItem(OUTCOME_PREFIX+id),state);if(value.action.id!==id)throw Error('Saved receipt outcome identity mismatch.');return value;
}
// Call only with the result of the existing matching transaction/receipt check.
// The archive is editable local evidence, not cryptographic receipt inclusion.
export async function archiveReceiptOutcome(storage,locks,state,id,txHash,result){
 return withJournalLock(locks,()=>{
  const record=readJournal(storage,state);
  if(!record||record.id!==id||record.phase!=='submitted'||record.hash.toLowerCase()!==String(txHash).toLowerCase())throw Error('Pending action changed; receipt outcome was not saved.');
  const value=validateReceiptOutcome({version:1,scope:'LOCAL_PROVIDER_RECEIPT_CHECK',action:record,transactionHash:record.hash,receipt:{status:result?.status,blockNumber:result?.blockNumber,blockHash:result?.blockHash}},state);
  const raw=JSON.stringify(value),key=OUTCOME_PREFIX+id;if(raw.length>10240)throw Error('Receipt outcome exceeds the local archive limit.');
  const existing=storage.getItem(key);
  if(existing!==null){parse(existing,state);if(JSON.stringify(JSON.parse(existing))!==raw)throw Error('A different receipt outcome already exists. Pending action retained.');}
  else storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)throw Error('Receipt outcome was not saved reliably. Pending action retained.');
  storage.setItem(LAST_OUTCOME_KEY,id);
  if(storage.getItem(LAST_OUTCOME_KEY)!==id)throw Error('Receipt outcome pointer was not saved reliably. Pending action retained.');
  storage.removeItem(JOURNAL_KEY);
  if(storage.getItem(JOURNAL_KEY)!==null)throw Error('Receipt saved, but pending cleanup failed. Retry receipt checking; do not resubmit.');
  return value;
 });
}
