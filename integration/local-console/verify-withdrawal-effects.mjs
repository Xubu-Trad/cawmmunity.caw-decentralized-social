import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {verifyConsoleAuthority} from './verify-console-authority.mjs';
import {verifyConsoleAccountingDetails} from './verify-console-accounting.mjs';
import {withdrawalData} from './ui/withdrawal-plan.mjs';
const custodyEvents=new Interface(['event ResearchWithdrawal(uint256 indexed account,address indexed recipient,uint256 epoch,uint256 amount)']);

// Selected local research fixture only. Endpoints are assumptions, not consensus.
export function verifyWithdrawalEffects(evidence,selection){
 const {before,after,rawTransactions,receipts}=evidence;
 const config=selection.config;
 assert.equal(before.header.hash,selection.startHash,'WITHDRAWAL_START');
 assert.equal(after.header.hash,selection.endHash,'WITHDRAWAL_END');
 assert.equal(after.header.parentHash,before.header.hash,'WITHDRAWAL_PARENT');
 assert.equal(BigInt(after.header.number),BigInt(before.header.number)+1n,'WITHDRAWAL_ADJACENT');
 assert.equal(rawTransactions.length,1,'WITHDRAWAL_SINGLE_TRANSACTION_ONLY');
 assert.match(selection.amount,/^[1-9][0-9]{0,77}$/,'WITHDRAWAL_AMOUNT');
 const amount=BigInt(selection.amount);assert(amount<2n**256n,'WITHDRAWAL_AMOUNT');
 const a=before.observed,b=after.observed;
 for(const v of [before,after])verifyConsoleAuthority(v.header,v.proofs,config,v.observed);
 const prior=verifyConsoleAccountingDetails(before.header,before.proofs,config,a);
 const final=verifyConsoleAccountingDetails(after.header,after.proofs,config,b);
 const checked=inspectBlockTransactionReceipts(after.header,rawTransactions,receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:selection.endHash});
 const signed=inspectBlockSenders(after.header,rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:selection.endHash,chainId:'0x7a69',allowUnprotectedLegacy:false});
 const tx=signed.transactions[0],wallet=a.owner===config.contracts.wallet.address;
 if(wallet){
  // This reviewed runtime embeds the controller as a Solidity immutable. Both
  // boundary account proofs above bind the deployed wallet to this exact code.
  assert.equal(config.contracts.wallet.codeHash,'0xb220f8ed76b2c9f7dad6daae038bbdaa3eff821e96b9e6cd6714654c70702712','WITHDRAWAL_WALLET_RUNTIME');
  assert.equal(config.controller,'0x6813eb9362372eef6200f3b1dbc3f819671cba69','WITHDRAWAL_IMMUTABLE_CONTROLLER');
  const roles=[config.controller,...Object.values(config.contracts).map(contract=>contract.address)];
  assert.equal(new Set(roles).size,roles.length,'WITHDRAWAL_DISTINCT_ROLES');
 }
 assert.equal(tx.hash,selection.transactionHash,'WITHDRAWAL_TRANSACTION');
 assert.equal(tx.from,wallet?config.controller:a.owner,'WITHDRAWAL_SIGNER');
 assert.equal(tx.to,wallet?config.contracts.wallet.address:config.contracts.custody.address,'WITHDRAWAL_TARGET');
 assert.equal(BigInt(tx.value),0n,'WITHDRAWAL_VALUE');
 assert.equal(tx.data,withdrawalData(config.contracts.custody.address,a.epoch,selection.amount,wallet?'fixture-wallet':'eoa'),'WITHDRAWAL_CALLDATA');
 assert.equal(checked.receipts[0].status,'0x1','WITHDRAWAL_REVERTED');
 if(wallet){
  const event=custodyEvents.encodeEventLog('ResearchWithdrawal',[2,a.owner,a.epoch,amount]);
  const matches=receipts[0].logs.filter(log=>log.address===config.contracts.custody.address&&log.topics[0]===event.topics[0]);
  assert.equal(matches.length,1,'WITHDRAWAL_RECIPIENT_EVENT');
  assert.deepEqual(matches[0].topics,event.topics,'WITHDRAWAL_EVENT_RECIPIENT');
  assert.equal(matches[0].data,event.data,'WITHDRAWAL_EVENT_AMOUNT');
 }
 for(const key of ['owner','epoch','nonce'])assert.equal(b[key],a[key],'WITHDRAWAL_AUTHORITY_CHANGED');
 const delta=(old,newValue,expected,label)=>assert.equal(BigInt(newValue)-BigInt(old),expected,label);
 delta(a.credit,b.credit,-amount,'WITHDRAWAL_CREDIT_DELTA');
 delta(prior.unpaidLiability,final.unpaidLiability,-amount,'WITHDRAWAL_LIABILITY_DELTA');
 delta(prior.creditedLiability,final.creditedLiability,-amount,'WITHDRAWAL_CREDITED_DELTA');
 assert.equal(final.unallocatedBudget,prior.unallocatedBudget,'WITHDRAWAL_BUDGET_CHANGED');
 for(const id of ['3','4'])assert.equal(final.accountCredits[id],prior.accountCredits[id],'WITHDRAWAL_OTHER_CREDIT_CHANGED');
 delta(a.balances.custody,b.balances.custody,-amount,'WITHDRAWAL_CUSTODY_DELTA');
 delta(a.balances.owner,b.balances.owner,amount,'WITHDRAWAL_RECIPIENT_DELTA');
 delta(a.balances.wallet,b.balances.wallet,wallet?amount:0n,'WITHDRAWAL_WALLET_DELTA');
 const authority=wallet?{controller:tx.from,controllerVerified:true,recipientBalanceVerified:true,ownerType:'fixture-wallet'}:{};
 return {status:'LOCAL_WITHDRAWAL_STATE_EFFECTS_VERIFIED',transactionHash:tx.hash,startHash:selection.startHash,endHash:selection.endHash,amount:selection.amount,recipient:a.owner,...authority,accountingEffectsVerified:true,transactionSignatureVerified:true,receiptCommitmentVerified:true,selectedEndpointsTrusted:true,publicChainAuthenticated:false,consensusVerified:false,executionReplayed:false,scope:'SELECTED_SINGLE_TRANSACTION_LOCAL_RESEARCH_FIXTURE'};
}
