import { inspectBlockTransactionReceipts } from '../../reference/ethereum-block-transactions.mjs';
import { inspectBlockSenders } from '../../reference/ethereum-block-senders.mjs';
import { inspectCandidateReceiptEvents } from './c007-receipt-events.mjs';

export function inspectCandidateBlockEvents(header, rawTransactions, receipts, selection, context) {
  if(!selection||Object.keys(selection).sort().join(',')!=='chainId,hash,profile')throw Error('SELECTION');
  const events=inspectCandidateReceiptEvents(header,receipts,{schema:'caw-block-receipts-selection/1',profile:selection.profile,hash:selection.hash},context);
  const joined=inspectBlockTransactionReceipts(header,rawTransactions,receipts,{schema:'caw-block-transactions-selection/1',profile:selection.profile,hash:selection.hash});
  const senders=inspectBlockSenders(header,rawTransactions,{schema:'caw-block-senders-selection/1',profile:selection.profile,hash:selection.hash,chainId:selection.chainId,allowUnprotectedLegacy:false});
  if(BigInt(selection.chainId).toString()!==context.chainId)throw Error('CONTEXT_CHAIN');
  if(joined.blockHash!==events.blockHash||senders.blockHash!==events.blockHash||joined.transactionCount!==senders.transactionCount)throw Error('COMPOSITION');
  const transactions=joined.associations.map((a,i)=>{
    const tx=senders.transactions[i];
    if(a.index!==i||tx.index!==i||a.transactionHash!==tx.hash||a.transactionEncoded!==tx.encoded)throw Error('BODY_ASSOCIATION');
    return Object.freeze({index:i,hash:tx.hash,from:tx.from,to:tx.to,status:joined.receipts[i].status});
  });
  const rows=events.events.map(row=>{
    const tx=transactions[row.transactionIndex];if(!tx||tx.status!=='0x1')throw Error('EVENT_TRANSACTION');
    return Object.freeze({...row,transactionHash:tx.hash,transactionSender:tx.from});
  });
  return Object.freeze({schema:'caw-candidate-block-events-research/1',status:'COMMITMENTS_AND_TRANSACTION_SIGNATURES_ONLY',
    blockHash:joined.blockHash,chainId:selection.chainId,transactions:Object.freeze(transactions),events:Object.freeze(rows),
    transactionCommitmentVerified:true,receiptCommitmentVerified:true,transactionAssociationVerified:true,
    transactionSignaturesVerified:true,cawActionAuthorityVerified:false,executionVerified:false,feeBackingVerified:false,
    chainAuthenticated:false,consensusVerified:false,finalityVerified:false});
}
