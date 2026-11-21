import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {AUTHORITY_SLOTS} from './verify-console-authority.mjs';
import {accountingSlots} from './verify-console-accounting.mjs';
import {verifyWithdrawalEffects} from './verify-withdrawal-effects.mjs';
import {makeWithdrawalProofPackage} from './withdrawal-proof-package.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
const abi=new Interface(['function withdraw(uint256,uint256,uint256)']);
// RPC metadata locates candidates only. The reader below authenticates all
// values under separately selected local headers; no provider summary is proof.
export async function acquireWithdrawalReceipt(read,config,local){
 const original=local.value.original,plan=original.action.plan;
 assert.equal(original.action.version,1,'WITHDRAWAL_EXPORT_REQUIRED');
 for(const k of ['wallet','registry','custody','token'])assert.equal(original.action.contracts[k].toLowerCase(),config.contracts[k].address,'WITHDRAWAL_DEPLOYMENT');
 const located=await read('eth_getTransactionReceipt',[original.transactionHash]);
 assert(located?.blockHash,'WITHDRAWAL_RECEIPT_UNAVAILABLE');
 const header=await read('eth_getBlockByHash',[located.blockHash,false]);
 assert(header&&header.transactions?.length===1,'WITHDRAWAL_SINGLE_TRANSACTION_ONLY');
 assert.equal(header.transactions[0].toLowerCase(),original.transactionHash.toLowerCase(),'WITHDRAWAL_LOCATOR');
 const parent=await read('eth_getBlockByHash',[header.parentHash,false]);assert(parent,'WITHDRAWAL_PARENT_UNAVAILABLE');
 const rawTransactions=[await read('eth_getRawTransactionByHash',[header.transactions[0]])];
 const tx=inspectBlockSenders(header,rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:header.hash,chainId:'0x7a69',allowUnprotectedLegacy:false}).transactions[0];
 assert.equal(tx.to,config.contracts.custody.address,'WITHDRAWAL_EOA_SCOPE_ONLY');
 const decoded=abi.decodeFunctionData('withdraw',tx.data);assert.equal(decoded[0],2n,'WITHDRAWAL_ACCOUNT');
 async function boundary(h){
  const at={blockHash:h.hash,requireCanonical:true},proofs={};
  const value=(p,k)=>{const v=p.storageProof?.find(x=>x.key===k)?.value;assert(/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(v),'WITHDRAWAL_PROOF_VALUE');return BigInt(v);};
  proofs.registry=await read('eth_getProof',[config.contracts.registry.address,[AUTHORITY_SLOTS.owner,AUTHORITY_SLOTS.epoch],at]);
  const ownerValue=value(proofs.registry,AUTHORITY_SLOTS.owner);assert(ownerValue>0xffffn&&ownerValue<2n**160n,'WITHDRAWAL_OWNER');
  const owner='0x'+ownerValue.toString(16).padStart(40,'0'),keys=accountingSlots(config,owner);
  for(const [k,slots]of Object.entries({posting:[AUTHORITY_SLOTS.nonce],custody:keys.custody,token:keys.token}))proofs[k]=await read('eth_getProof',[config.contracts[k].address,slots,at]);
  proofs.owner=await read('eth_getProof',[owner,[],at]);
  // accountingSlots preserves wallet, owner, custody order for supported EOA.
  assert.equal(keys.token.length,3,'WITHDRAWAL_EOA_SCOPE_ONLY');
  return {header:h,proofs,observed:{owner,epoch:String(value(proofs.registry,AUTHORITY_SLOTS.epoch)),nonce:String(value(proofs.posting,AUTHORITY_SLOTS.nonce)),credit:String(value(proofs.custody,keys.custody[3])),unpaidLiability:String(value(proofs.custody,keys.custody[0])),balances:Object.fromEntries(['wallet','owner','custody'].map((k,i)=>[k,String(value(proofs.token,keys.token[i]))]))}};
 }
 const evidence={before:await boundary(parent),after:await boundary(header),rawTransactions,receipts:[located]};
 const selection={config,startHash:parent.hash,endHash:header.hash,transactionHash:original.transactionHash.toLowerCase(),amount:String(decoded[2])};
 const result=verifyWithdrawalEffects(evidence,selection);
 for(const h of [parent,header])assert.equal((await read('eth_getBlockByNumber',[h.number,false]))?.hash,h.hash,'WITHDRAWAL_REORG');
 const discrepancies=[],same=(k,a,b)=>{if(String(a).toLowerCase()!==String(b).toLowerCase())discrepancies.push(k);};
 for(const k of ['from','to','data','nonce','value','chainId'])same('plan.'+k,plan[k],tx[k]);
 same('plan.amount',plan.amount,result.amount);same('plan.epoch',plan.epoch,String(decoded[1]));
 if(plan.blockHash.toLowerCase()!==parent.hash||BigInt(plan.blockNumber)!==BigInt(parent.number))discrepancies.push('plan.reviewAnchorOutsideSelectedHistory');
 same('receipt.status',original.receipt.status,'confirmed');same('receipt.blockHash',original.receipt.blockHash,header.hash);
 if(BigInt(original.receipt.blockNumber)!==BigInt(header.number))discrepancies.push('receipt.blockNumber');
 const proofPackage=makeWithdrawalProofPackage(evidence,selection);
 return {...result,status:'INCLUDED_WITHDRAWAL'+(discrepancies.length?'_WITH_LOCAL_RECORD_DISCREPANCIES':'_MATCHES_LOCAL_RECORD'),localRecordStatus:local.status,retainedObservations:local.observations,transactionIncluded:true,signaturesVerified:true,transactionAndReceiptCommitmentsVerified:true,ownershipVerified:true,blockHash:header.hash,blockNumber:header.number,selectedHistoryEndHash:header.hash,discrepancies,proofPackage};
}
