import {OUTCOME_PREFIX,validateReceiptOutcome} from './receipt-outcomes.mjs';
import {RECHECK_PREFIX,readReceiptRechecks} from './receipt-rechecks.mjs';
import {withJournalLock} from './withdrawal-journal.mjs';
const scope='EDITABLE_LOCAL_RECEIPT_OBSERVATIONS_NOT_CHAIN_PROOF';
const limit=100000;
export function downloadJson(document,filename,text){
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=filename;
 try{document.body.append(a);a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
function keys(v,n){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==n.slice().sort().join(','))throw Error('Unexpected receipt export format.');}
async function digest(text){return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function exportReceiptHistory(storage,locks,state,selected){
 const payload=await withJournalLock(locks,()=>{
  validateReceiptOutcome(selected,state);
  const originalRaw=storage.getItem(OUTCOME_PREFIX+selected.action.id);
  if(originalRaw!==JSON.stringify(selected))throw Error('Selected receipt changed. Reload before exporting.');
  const rechecks=readReceiptRechecks(storage,selected,state);
  return JSON.stringify({version:1,scope,original:structuredClone(selected),rechecks});
 });
 if(payload.length>limit)throw Error('Receipt export exceeds the size limit.');
 const sha256=await digest(payload);
 // Hash covers the exact payload string, not its credibility or chain inclusion.
 return {filename:'caw-receipt-'+selected.action.id+'.json',text:JSON.stringify({version:1,algorithm:'SHA-256',sha256,payload},null,2)+'\n'};
}
export async function verifyReceiptExport(text,state){
 if(typeof text!=='string'||text.length>2*limit)throw Error('Receipt export is missing or too large.');
 const outer=JSON.parse(text);keys(outer,['version','algorithm','sha256','payload']);
 if(outer.version!==1||outer.algorithm!=='SHA-256'||!/^[0-9a-f]{64}$/.test(outer.sha256)||typeof outer.payload!=='string'||outer.payload.length>limit)throw Error('Unsupported receipt export.');
 if(await digest(outer.payload)!==outer.sha256)throw Error('Receipt export checksum mismatch.');
 const value=JSON.parse(outer.payload);keys(value,['version','scope','original','rechecks']);
 if(value.version!==1||value.scope!==scope)throw Error('Unsupported receipt export scope.');
 validateReceiptOutcome(value.original,state);
 if(JSON.stringify(value.original).length>10240)throw Error('Original receipt exceeds the archive limit.');
 const raw=JSON.stringify(value.rechecks);
 readReceiptRechecks({getItem:key=>key===RECHECK_PREFIX+value.original.action.id?raw:null},value.original,state);
 return {status:'LOCAL_RECORD_STRUCTURE_AND_CHECKSUM_VALID',transactionHash:value.original.transactionHash,observations:value.rechecks.entries.length,scope,value};
}
