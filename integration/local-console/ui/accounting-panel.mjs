const hash=/^0x[0-9a-f]{64}$/;
export function requireAccountingSnapshot(s){
 if(s?.accountingProofsVerified!==true||s.authorityProofsVerified!==true||!hash.test(s.blockHash)||s.accountingHeaderHash!==s.blockHash||s.authorityHeaderHash!==s.blockHash)throw Error('Accounting proof verification is missing or does not match this block.');
 for(const n of [s.credit,s.unpaidLiability,s.unallocatedBudget,s.creditedLiability,s.balances?.wallet,s.balances?.owner,s.balances?.custody])if(typeof n!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(n)||BigInt(n)>2n**256n-1n)throw Error('Invalid verified accounting values.');
 if(BigInt(s.unpaidLiability)!==BigInt(s.unallocatedBudget)+BigInt(s.creditedLiability)||BigInt(s.credit)>BigInt(s.creditedLiability)||BigInt(s.balances.custody)<BigInt(s.unpaidLiability))throw Error('Verified accounting summary conflicts with the selected state.');
 return s;
}
export function showAccounting(document,s){
 requireAccountingSnapshot(s);
 document.getElementById('accounting-status').textContent='Verified against selected local state';
 document.getElementById('accounting-header').textContent='Block '+s.blockNumber+' · '+s.blockHash;
 document.getElementById('unpaid-liability').textContent=s.unpaidLiability;
}
export function clearAccountSnapshot(document,status='Not verified. Refresh to acquire new proofs.'){
 for(const id of ['epoch','credit','wallet-balance','owner-balance','custody-balance','owner','contract-wallet','controller','signer','unpaid-liability'])document.getElementById(id).textContent='—';
 document.getElementById('accounting-status').textContent=status;
 document.getElementById('accounting-header').textContent='No accepted accounting snapshot';
 document.getElementById('block').textContent='No accepted state';
}
