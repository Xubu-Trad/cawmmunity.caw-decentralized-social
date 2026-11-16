import assert from 'node:assert/strict';
import {verifyReceiptExport} from './ui/receipt-export.mjs';
import {verifyPostingHistory} from './verify-posting-history.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
export async function verifyReceiptHistory(text,state,bundle,selection){
 const local=await verifyReceiptExport(text,state),original=local.value.original,plan=original.action.plan;
 assert([2,3].includes(original.action.version),'POST_OR_TRANSFER_EXPORT_REQUIRED');
 const transfer=original.action.version===2,kind=transfer?'TRANSFER':'POST';
 for(const k of ['wallet','registry','posting'])assert.equal(original.action.contracts[k].toLowerCase(),selection.contracts[k].address,'EXPORT_DEPLOYMENT_SELECTION');
 assert.equal(state.controller.toLowerCase(),selection.controller,'EXPORT_CONTROLLER_SELECTION');
 // Never accept a caller-supplied summary as verified history.
 const history=verifyPostingHistory(bundle,selection);
 const matches=(transfer?(history.transfers??[]):history.posts).filter(p=>p.transactionHash===original.transactionHash.toLowerCase());
 assert(matches.length<=1,'AMBIGUOUS_POST_TRANSACTION');
 const base={localRecordStatus:local.status,retainedObservations:local.observations,transactionHash:original.transactionHash,selectedEndpointsTrusted:true,publicChainAuthenticated:false,consensusVerified:false,executionReplayed:false,accountingEffectsVerified:false};
 if(!matches.length)return {...base,status:'NOT_FOUND_IN_SELECTED_VERIFIED_'+kind+'_HISTORY',transactionIncluded:false};
 const post=matches[0],row=bundle.blocks.find(r=>r.header.hash===post.blockHash);assert(row,'POST_BLOCK_REQUIRED');
 const tx=inspectBlockSenders(row.header,row.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:row.header.hash,chainId:'0x7a69',allowUnprotectedLegacy:false}).transactions.find(t=>t.hash===post.transactionHash);assert(tx,'POST_TRANSACTION_REQUIRED');
 const discrepancies=[];
 const same=(name,a,b)=>{if(String(a).toLowerCase()!==String(b).toLowerCase())discrepancies.push(name);};
 for(const k of ['from','to','data','nonce','value','chainId'])same('plan.'+k,plan[k],tx[k]);
 if(transfer){same('plan.epoch',plan.epoch,post.priorEpoch);same('plan.owner',plan.owner,post.from);same('plan.recipient',plan.recipient,post.to);}
 else{
 for(const [k,v]of [['epoch',post.epoch],['postNonce',post.nonce],['owner',post.author],['textHash',post.textHash]])same('plan.'+k,plan[k],v);
 if(plan.text!==post.text)discrepancies.push('plan.text');
 }
 const anchors=[bundle.anchor,...bundle.blocks.map(r=>r.header)];
 if(!anchors.some(a=>a.hash===plan.blockHash.toLowerCase()&&BigInt(a.number)===BigInt(plan.blockNumber)&&BigInt(a.number)<BigInt(row.header.number)))discrepancies.push('plan.reviewAnchorOutsideSelectedHistory');
 same('receipt.status',original.receipt.status,'confirmed');same('receipt.blockHash',original.receipt.blockHash,post.blockHash);
 if(BigInt(original.receipt.blockNumber)!==BigInt(post.blockNumber))discrepancies.push('receipt.blockNumber');
 return {...base,status:'INCLUDED_'+kind+(discrepancies.length?'_WITH_LOCAL_RECORD_DISCREPANCIES':'_MATCHES_LOCAL_RECORD'),transactionIncluded:true,signaturesVerified:true,transactionAndReceiptCommitmentsVerified:true,ownershipVerified:true,blockNumber:post.blockNumber,blockHash:post.blockHash,discrepancies};
}
