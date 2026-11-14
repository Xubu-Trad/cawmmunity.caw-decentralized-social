import { inspectBlockReceipts } from '../../reference/ethereum-block-receipts.mjs';
import { decodeCandidateLog } from './c007-claim-event-codec.mjs';
import { bindCandidateAdmission } from './c007-admission-binding.mjs';

// Recomputes receipt commitments itself. Never accepts a caller's verified flag.
export function inspectCandidateReceiptEvents(header, receipts, receiptSelection, context) {
  if(!context || Object.keys(context).sort().join(',')!=='chainId,emitter,profile'
    || typeof context.emitter!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(context.emitter)
    || typeof context.chainId!=='string'||!/^(0|[1-9][0-9]*)$/.test(context.chainId)
    || context.chainId.length>78||BigInt(context.chainId)>=(1n<<256n)
    || typeof context.profile!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(context.profile))throw Error('CONTEXT');
  const checked=inspectBlockReceipts(header,receipts,receiptSelection), events=[];
  for(const receipt of checked.receipts) {
    if(receipt.status==='0x0') {
      if(receipt.logs.length)throw Error('FAILED_RECEIPT_LOGS');
      continue;
    }
    for(let i=0;i<receipt.logs.length;i++) {
      const original=receipt.logs[i];
      if(original.address.toLowerCase()!==context.emitter.toLowerCase())continue;
      const log={address:original.address,topics:[...original.topics],data:original.data};
      const decoded=decodeCandidateLog(log,context.emitter);
      const event=decoded.kind==='admission'?bindCandidateAdmission(log,context):decoded;
      events.push(Object.freeze({transactionIndex:receipt.index,receiptLogIndex:i,event:Object.freeze(event)}));
    }
  }
  return Object.freeze({schema:'caw-candidate-receipt-events-research/1',
    status:'RECEIPT_COMMITMENT_ONLY',blockHash:checked.blockHash,blockNumber:checked.blockNumber,
    receiptCommitmentVerified:true,transactionAssociationVerified:false,executionVerified:false,
    signatureVerified:false,feeBackingVerified:false,chainAuthenticated:false,
    consensusVerified:false,finalityVerified:false,events:Object.freeze(events)});
}
