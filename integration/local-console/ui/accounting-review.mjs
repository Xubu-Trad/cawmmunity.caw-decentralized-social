import {requireAccountingSnapshot} from './accounting-panel.mjs';
import {verifyWithdrawalPlan} from './withdrawal-plan.mjs';
import {verifyTransferPlan} from './account-transfer-plan.mjs';
import {verifyPostPlan} from './post-plan.mjs';
const fields=['credit','unpaidLiability','unallocatedBudget','creditedLiability'];
export function requireReviewedAccounting(reviewed,latest){
 requireAccountingSnapshot(reviewed);requireAccountingSnapshot(latest);
 if(fields.some(k=>reviewed[k]!==latest[k])||['wallet','owner','custody'].some(k=>reviewed.balances[k]!==latest.balances[k]))throw Error('Accounting changed since review. Refresh and review the new balances before signing.');
}
export function expectedAccounting(state,plan){
 requireAccountingSnapshot(state);
 const after={...Object.fromEntries(fields.map(k=>[k,state[k]])),balances:{...state.balances}};
 let detail;
 if(plan.action==='post'){
  verifyPostPlan(plan,state,state.signer,plan.text);
  detail='This research post has no mock-token fee. Credit and token balances are unchanged.';
 }else if(plan.action==='transfer'){
  verifyTransferPlan(plan,state,state.signer,plan.recipient);
  detail='Control of account 2 and its credit moves to '+plan.recipient+'. Tokens already held by the previous owner or contract wallet do not move. The recipient balance is not projected.';
 }else{
  verifyWithdrawalPlan(plan,state,state.signer,plan.amount);
  const amount=BigInt(plan.amount);
  for(const k of ['credit','unpaidLiability','creditedLiability'])after[k]=String(BigInt(after[k])-amount);
  after.balances.custody=String(BigInt(after.balances.custody)-amount);
  after.balances.owner=String(BigInt(after.balances.owner)+amount);
  if(state.owner.toLowerCase()===state.contracts.wallet.toLowerCase())after.balances.wallet=String(BigInt(after.balances.wallet)+amount);
  detail='Withdrawal pays '+state.owner+'. The same address may appear as both current owner and original wallet; those rows are not separate payments.';
 }
 for(const n of [...fields.map(k=>after[k]),...Object.values(after.balances)])if(BigInt(n)<0n||BigInt(n)>=2n**256n)throw Error('Expected accounting is outside the supported range.');
 return {after,detail,rows:[['Account credit',state.credit,after.credit],['Total unpaid liability',state.unpaidLiability,after.unpaidLiability],['Custody token balance',state.balances.custody,after.balances.custody],['Current owner token balance (before handoff)',state.balances.owner,after.balances.owner],['Original wallet token balance',state.balances.wallet,after.balances.wallet]]};
}
export function showAccountingReview(document,state,plan){
 const p=expectedAccounting(state,plan),box=document.getElementById('accounting-review');box.replaceChildren();
 const title=document.createElement('h3');title.textContent='Expected accounting · mock units';box.append(title);
 const basis=document.createElement('p');basis.className='subtle';basis.textContent='Based on verified block '+state.blockNumber+' · '+state.blockHash;box.append(basis);
 const list=document.createElement('dl');
 for(const [label,before,after]of p.rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=before+' → '+after;list.append(dt,dd);}box.append(list);
 const note=document.createElement('p');note.textContent=p.detail+' Expected effects only, not a completed transaction. Local ETH gas is separate and not estimated here. State is rechecked before the wallet request, but can still change while the wallet is open or before execution.';box.append(note);
}
