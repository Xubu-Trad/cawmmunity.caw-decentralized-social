import {expectedAccounting} from './accounting-review.mjs';
const fields=['chainId','genesisHash','blockNumber','blockHash','authorityHeaderHash','accountingHeaderHash','authorityProofsVerified','accountingProofsVerified','contracts','controller','owner','ownerType','signer','epoch','credit','balances','posting','unpaidLiability','unallocatedBudget','creditedLiability'];
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
function keys(v,names){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==names.slice().sort().join(','))throw Error('Saved accounting review has an unexpected format.');}
export function captureAccountingReview(snapshot,plan,current){
 const review={version:1,snapshot:structuredClone(Object.fromEntries(fields.map(k=>[k,snapshot[k]])))};
 validateAccountingReview(review,plan,current);return review;
}
// This validates an editable local record, not the historical cryptographic proofs.
// Only a fresh acquisition may establish current verified accounting.
export function validateAccountingReview(review,plan,current){
 keys(review,['version','snapshot']);if(review.version!==1)throw Error('Unsupported saved accounting review.');
 const s=review.snapshot;keys(s,fields);keys(s.contracts,['wallet','registry','custody','token','posting']);keys(s.balances,['wallet','owner','custody']);keys(s.posting,['nonce','profile']);
 if(s.chainId!==current.chainId||!same(s.genesisHash,current.genesisHash)||!same(s.genesisHash,plan.genesisHash)||!same(s.controller,current.controller)||Object.keys(s.contracts).some(k=>!same(s.contracts[k],current.contracts[k]))||!same(s.signer,plan.from)||s.epoch!==plan.epoch)throw Error('Saved accounting review does not match this action or deployment.');
 expectedAccounting(s,plan);return review;
}
