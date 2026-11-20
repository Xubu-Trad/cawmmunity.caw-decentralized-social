import {downloadJson} from './receipt-export.mjs';
import {keccak256Hex} from './keccak256.mjs';

const hash=/^0x[0-9a-f]{64}$/;

async function readVerification(response,limit){
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let raw='',bytes=0;
 for await(const chunk of response.body){
  bytes+=chunk.byteLength;
  if(bytes>limit)throw Error('Receipt verification response exceeds limit.');
  raw+=decoder.decode(chunk,{stream:true});
 }
 return JSON.parse(raw+decoder.decode());
}

function withdrawalProofText(result){
 const pkg=result.proofPackage,selection=pkg?.selection,evidence=pkg?.evidence;
 if(pkg?.schema!=='caw-console-withdrawal-proofs/1'||!selection?.config?.contracts||
    result.scope!=='SELECTED_SINGLE_TRANSACTION_LOCAL_RESEARCH_FIXTURE'||
    result.transactionSignatureVerified!==true||result.receiptCommitmentVerified!==true||
    selection.transactionHash!==result.transactionHash||!hash.test(selection.startHash)||
    selection.startHash!==result.startHash||selection.endHash!==result.endHash||
    selection.endHash!==result.blockHash||selection.endHash!==result.selectedHistoryEndHash||
    selection.amount!==result.amount||typeof selection.amount!=='string'||!/^[1-9][0-9]{0,77}$/.test(selection.amount)||
    evidence?.before?.header?.hash!==selection.startHash||evidence?.after?.header?.hash!==selection.endHash||
    evidence.after.header.parentHash!==selection.startHash||evidence.after.header.number!==result.blockNumber||
    !evidence.before.proofs||!evidence.after.proofs||!Array.isArray(evidence.rawTransactions)||
    evidence.rawTransactions.length!==1||!Array.isArray(evidence.receipts)||evidence.receipts.length!==1||
    evidence.receipts[0]?.blockHash!==selection.endHash||evidence.receipts[0]?.blockNumber!==result.blockNumber||
    keccak256Hex(evidence.rawTransactions[0])!==selection.transactionHash){
  throw Error('Withdrawal proof package does not match the verified transaction and block.');
 }
 const text=JSON.stringify(pkg);
 if(new TextEncoder().encode(text).length>1024*1024)throw Error('Withdrawal proof package exceeds limit.');
 return text;
}

export function mountReceiptHistory(document,getExport,fetcher=fetch,eventSource=globalThis.window){
 const button=document.getElementById('verify-receipt-history'),status=document.getElementById('receipt-history-status');
 const download=document.getElementById('export-withdrawal-proofs');
 let generation=0,active=null,accepted=null;
 function clear(){generation++;active?.abort();active=null;accepted=null;download.disabled=true;button.disabled=false;status.textContent='Not checked against signed history. Saved receipt observations remain separate.';}
 async function verify(){
  clear();const token=generation,controller=new AbortController();active=controller;button.disabled=true;status.textContent='Checking the saved action against signed history and ownership proofs…';
  try{
   const text=await getExport();if(token!==generation)return;const envelope=JSON.parse(text),original=JSON.parse(envelope.payload).original;
   const response=await fetcher('/api/verified-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exportText:text}),cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});
   const kind=original.action.version===1?'WITHDRAWAL':original.action.version===2?'TRANSFER':'POST',labelKind=kind==='WITHDRAWAL'?'Withdrawal':kind==='TRANSFER'?'Ownership transfer':'Post';
   const v=await readVerification(response,kind==='WITHDRAWAL'&&response.ok?2*1024*1024:16384);
   if(!response.ok)throw Error(v.error||'History verification rejected.');
   if(v.verificationLocation!=='local-console-server'||v.exportSha256!==envelope.sha256||v.transactionHash?.toLowerCase()!==original.transactionHash.toLowerCase()||v.localRecordStatus!=='LOCAL_RECORD_STRUCTURE_AND_CHECKSUM_VALID'||v.selectedEndpointsTrusted!==true||v.publicChainAuthenticated!==false||v.consensusVerified!==false||v.executionReplayed!==false||v.accountingEffectsVerified!==(kind==='WITHDRAWAL')||!/^0x[0-9a-f]{64}$/.test(v.selectedHistoryEndHash))throw Error('Receipt verification identity or scope mismatch.');
   let label;
   if(kind!=='WITHDRAWAL'&&v.status==='NOT_FOUND_IN_SELECTED_VERIFIED_'+kind+'_HISTORY'&&v.transactionIncluded===false)label='Not found in the selected verified action history. This does not prove it never occurred.';
   else{
    if(v.transactionIncluded!==true||v.signaturesVerified!==true||v.transactionAndReceiptCommitmentsVerified!==true||v.ownershipVerified!==true||!Array.isArray(v.discrepancies)||v.discrepancies.length>16||v.discrepancies.some(x=>typeof x!=='string'||x.length>100)||!/^0x[0-9a-f]{64}$/.test(v.blockHash)||!/^0x[0-9a-f]+$/.test(v.blockNumber))throw Error('Missing verified inclusion details.');
    if(v.status==='INCLUDED_'+kind+'_MATCHES_LOCAL_RECORD'&&v.discrepancies.length===0)label=labelKind+' included in selected verified history; compared saved fields match.';
    else if(v.status==='INCLUDED_'+kind+'_WITH_LOCAL_RECORD_DISCREPANCIES'&&v.discrepancies.length>0)label=labelKind+' included, but saved fields disagree: '+v.discrepancies.join(', ')+'. Original observations retained.';
    else throw Error('Invalid receipt comparison status.');
   }
   if(token!==generation)return;
   if(kind==='WITHDRAWAL'){
    const packageText=withdrawalProofText(v);
    const replay=await fetcher('/api/replay-withdrawal-export',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({exportSha256:envelope.sha256,packageText}),cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});
    if(!replay.ok)throw Error('Withdrawal export failed proof replay. Verify again.');
    const verified=await readVerification(replay,1024);
    const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(packageText)));
    const digest=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    if(verified.packageSha256!==digest)throw Error('Withdrawal export bytes differ from the replayed package.');
    const current=await getExport();
    if(token!==generation)return;
    if(current!==text)throw Error('The saved receipt or its rechecks changed. Verify again.');
    accepted={exportText:text,packageText,filename:'caw-withdrawal-proofs-'+v.transactionHash+'.json'};
    download.disabled=false;
   }
   status.textContent=label+(kind==='WITHDRAWAL'?' Custody, credit and recipient token changes verified for this selected local block. Not public-chain finality.':' Checked by this console server against selected local headers. Not public-chain finality or accounting verification.');
  }catch(e){if(token===generation)status.textContent='Not accepted: '+e.message+' Saved observations have not been changed.';}
  finally{if(token===generation){active=null;button.disabled=false;}}
 }
 async function downloadProofs(){
  const selected=accepted;
  if(!selected||download.disabled)return;
  download.disabled=true;
  try{
   const current=await getExport();
   if(accepted!==selected)return;
   if(current!==selected.exportText)throw Error('The saved receipt or its rechecks changed. Verify again.');
   downloadJson(document,selected.filename,selected.packageText);
  }catch(e){
   if(accepted===selected){clear();status.textContent='Withdrawal proof download unavailable. '+e.message;}
  }finally{if(accepted===selected)download.disabled=false;}
 }
 button.addEventListener('click',verify);
 download.addEventListener('click',downloadProofs);
 for(const id of ['refresh','confirm','recover','check-receipt','recheck-outcome'])document.getElementById(id).addEventListener('click',clear);
 eventSource?.addEventListener('storage',clear);
 eventSource?.addEventListener('pagehide',clear);
 return {verify,clear};
}
