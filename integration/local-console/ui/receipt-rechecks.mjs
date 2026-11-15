import {verifyWithdrawalReceipt} from './receipt-status.mjs';
import {validateReceiptOutcome,OUTCOME_PREFIX} from './receipt-outcomes.mjs';
import {withJournalLock} from './withdrawal-journal.mjs';
export const RECHECK_PREFIX='caw.local.receipt-rechecks.v1.';
const idPattern=/^0x[0-9a-f]{32}$/;
function keys(v,n){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==n.slice().sort().join(','))throw Error('Saved receipt recheck has an unexpected format.');}
function classification(original,result,error,state){
 if(error!==null){if(result!==null||typeof error!=='string'||!error.length||error.length>400)throw Error('Invalid inconclusive recheck.');return 'INCONCLUSIVE';}
 keys(result,['status','blockNumber','blockHash']);
 if(result.status==='pending'){if(result.blockNumber!==null||result.blockHash!==null)throw Error('Invalid unconfirmed recheck.');return 'NOT_CURRENTLY_CONFIRMED';}
 validateReceiptOutcome({...original,receipt:result},state);
 return result.status===original.receipt.status&&BigInt(result.blockNumber)===BigInt(original.receipt.blockNumber)&&result.blockHash.toLowerCase()===original.receipt.blockHash.toLowerCase()?'MATCHES_PRIOR':'CONFLICTS_PRIOR';
}
function validate(log,original,state){
 keys(log,['version','original','entries']);
 if(log.version!==1||JSON.stringify(log.original)!==JSON.stringify(original)||!Array.isArray(log.entries)||log.entries.length>64)throw Error('Saved rechecks do not match this original receipt or exceed the history limit.');
 const ids=new Set();
 for(const e of log.entries){keys(e,['id','checkedAt','classification','result','error']);if(!idPattern.test(e.id)||ids.has(e.id)||!Number.isSafeInteger(e.checkedAt)||e.checkedAt<0||e.classification!==classification(original,e.result,e.error,state))throw Error('Invalid saved receipt recheck entry.');ids.add(e.id);}
 return log;
}
export function readReceiptRechecks(storage,original,state){
 validateReceiptOutcome(original,state);const raw=storage.getItem(RECHECK_PREFIX+original.action.id);
 if(raw===null)return {version:1,original,entries:[]};
 if(typeof raw!=='string'||raw.length>65536)throw Error('Saved recheck history exceeds the local limit.');
 return validate(JSON.parse(raw),original,state);
}
export async function recheckReceiptOutcome(storage,locks,state,original,provider,id,checkedAt=Date.now()){
 validateReceiptOutcome(original,state);if(!idPattern.test(id)||!Number.isSafeInteger(checkedAt)||checkedAt<0)throw Error('Invalid receipt recheck identity.');
 // Hold a private copy across provider awaits; no original archive entry is rewritten.
 const selected=structuredClone(original),rawOriginal=JSON.stringify(selected);
 let result=null,error=null;
 try{result=await verifyWithdrawalReceipt(provider,selected.transactionHash,selected.action.plan);}
 catch(e){error=String(e?.message||'Receipt check failed').slice(0,400);}
 const entry={id,checkedAt,classification:classification(selected,result,error,state),result,error};
 return withJournalLock(locks,()=>{
  if(storage.getItem(OUTCOME_PREFIX+selected.action.id)!==rawOriginal)throw Error('Original receipt record changed during recheck. Nothing was appended.');
  const log=readReceiptRechecks(storage,selected,state);
  if(log.entries.length>=64)throw Error('Recheck history is full. Existing evidence retained.');
  if(log.entries.some(x=>x.id===id))throw Error('Receipt recheck identity already exists.');
  const next={...log,entries:[...log.entries,entry]};validate(next,selected,state);
  const raw=JSON.stringify(next);if(raw.length>65536)throw Error('Recheck history exceeds the local limit. Existing evidence retained.');
  const key=RECHECK_PREFIX+selected.action.id;storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)throw Error('Receipt recheck was not saved reliably. Original receipt retained.');
  return entry;
 });
}
