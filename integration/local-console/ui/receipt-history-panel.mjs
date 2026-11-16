export function mountReceiptHistory(document,getExport,fetcher=fetch,eventSource=globalThis.window){
 const button=document.getElementById('verify-receipt-history'),status=document.getElementById('receipt-history-status');
 let generation=0,active=null;
 function clear(){generation++;active?.abort();active=null;button.disabled=false;status.textContent='Not checked against signed history. Saved receipt observations remain separate.';}
 async function verify(){
  const token=++generation;active?.abort();const controller=new AbortController();active=controller;button.disabled=true;status.textContent='Checking the saved action against signed history and ownership proofs…';
  try{
   const text=await getExport();if(token!==generation)return;const envelope=JSON.parse(text),original=JSON.parse(envelope.payload).original;
   const response=await fetcher('/api/verified-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exportText:text}),cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});
   const raw=await response.text();if(raw.length>16384)throw Error('Receipt verification response exceeds limit.');const v=JSON.parse(raw);const kind=original.action.version===1?'WITHDRAWAL':original.action.version===2?'TRANSFER':'POST',labelKind=kind==='WITHDRAWAL'?'Withdrawal':kind==='TRANSFER'?'Ownership transfer':'Post';
   if(!response.ok)throw Error(v.error||'History verification rejected.');
   if(v.verificationLocation!=='local-console-server'||v.exportSha256!==envelope.sha256||v.transactionHash?.toLowerCase()!==original.transactionHash.toLowerCase()||v.localRecordStatus!=='LOCAL_RECORD_STRUCTURE_AND_CHECKSUM_VALID'||v.selectedEndpointsTrusted!==true||v.publicChainAuthenticated!==false||v.consensusVerified!==false||v.executionReplayed!==false||v.accountingEffectsVerified!==(kind==='WITHDRAWAL')||!/^0x[0-9a-f]{64}$/.test(v.selectedHistoryEndHash))throw Error('Receipt verification identity or scope mismatch.');
   let label;
   if(v.status==='NOT_FOUND_IN_SELECTED_VERIFIED_'+kind+'_HISTORY'&&v.transactionIncluded===false)label='Not found in the selected verified action history. This does not prove it never occurred.';
   else{
    if(v.transactionIncluded!==true||v.signaturesVerified!==true||v.transactionAndReceiptCommitmentsVerified!==true||v.ownershipVerified!==true||!Array.isArray(v.discrepancies)||v.discrepancies.length>16||v.discrepancies.some(x=>typeof x!=='string'||x.length>100)||!/^0x[0-9a-f]{64}$/.test(v.blockHash)||!/^0x[0-9a-f]+$/.test(v.blockNumber))throw Error('Missing verified inclusion details.');
    if(v.status==='INCLUDED_'+kind+'_MATCHES_LOCAL_RECORD'&&v.discrepancies.length===0)label=labelKind+' included in selected verified history; compared saved fields match.';
    else if(v.status==='INCLUDED_'+kind+'_WITH_LOCAL_RECORD_DISCREPANCIES'&&v.discrepancies.length>0)label=labelKind+' included, but saved fields disagree: '+v.discrepancies.join(', ')+'. Original observations retained.';
    else throw Error('Invalid receipt comparison status.');
   }
   if(token!==generation)return;
   status.textContent=label+(kind==='WITHDRAWAL'?' Custody, credit and recipient token changes verified for this selected local block. Not public-chain finality.':' Checked by this console server against selected local headers. Not public-chain finality or accounting verification.');
  }catch(e){if(token===generation)status.textContent='Not accepted: '+e.message+' Saved observations have not been changed.';}
  finally{if(token===generation){active=null;button.disabled=false;}}
 }
 button.addEventListener('click',verify);
 for(const id of ['refresh','confirm','check-receipt','recheck-outcome'])document.getElementById(id).addEventListener('click',clear);
 eventSource?.addEventListener('storage',clear);
 return {verify,clear};
}
