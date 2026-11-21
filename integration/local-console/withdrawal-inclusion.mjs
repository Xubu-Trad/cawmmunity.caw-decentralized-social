import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { inspectBlockTransactionReceipts } from '../../reference/ethereum-block-transactions.mjs';
import { inspectBlockSenders } from '../../reference/ethereum-block-senders.mjs';
import { withdrawalData } from './ui/withdrawal-plan.mjs';

const events = new Interface(['event ResearchWithdrawal(uint256 indexed account,address indexed recipient,uint256 epoch,uint256 amount)']);

// The caller selects the header and expected identities independently of the block body.
export function verifyWalletWithdrawalInclusion({header, rawTransactions, receipts}, pins) {
  const {blockHash, transactionHash, controller, wallet, custody, epoch, amount} = pins;
  for (const hash of [blockHash,transactionHash]) assert.match(hash,/^0x[0-9a-f]{64}$/);
  for (const address of [controller,wallet,custody]) assert.match(address,/^0x[0-9a-f]{40}$/);
  assert.equal(new Set([controller,wallet,custody]).size,3,'DISTINCT_ROLES_REQUIRED');
  assert.match(epoch,/^(0|[1-9][0-9]{0,77})$/);
  assert.match(amount,/^[1-9][0-9]{0,77}$/);
  const selected = {profile:'shanghai-17',hash:blockHash};
  const body = inspectBlockTransactionReceipts(header,rawTransactions,receipts,
    {...selected,schema:'caw-block-transactions-selection/1'});
  const signed = inspectBlockSenders(header,rawTransactions,
    {...selected,schema:'caw-block-senders-selection/1',chainId:'0x7a69',allowUnprotectedLegacy:false});
  const positions = signed.transactions.flatMap((tx,i)=>tx.hash===transactionHash?[i]:[]);
  assert.equal(positions.length,1,'UNIQUE_SELECTED_TRANSACTION_REQUIRED');
  const index = positions[0], tx = signed.transactions[index];
  assert.equal(tx.from,controller,'UNEXPECTED_SIGNER');
  assert.equal(tx.to,wallet,'UNEXPECTED_WALLET');
  assert.equal(BigInt(tx.value),0n,'UNEXPECTED_VALUE');
  assert.equal(tx.data,withdrawalData(custody,epoch,amount,'fixture-wallet'),'WITHDRAWAL_CALLDATA');
  assert.equal(body.receipts[index].status,'0x1','WITHDRAWAL_REVERTED');
  const expected = events.encodeEventLog('ResearchWithdrawal',[2,wallet,epoch,amount]);
  const logs = receipts[index].logs.filter(log=>log.address===custody && log.topics[0]===expected.topics[0]);
  assert.equal(logs.length,1,'SELECTED_WITHDRAWAL_EVENT_REQUIRED');
  assert.deepEqual(logs[0].topics,expected.topics,'WITHDRAWAL_EVENT_TOPICS');
  assert.equal(logs[0].data,expected.data,'WITHDRAWAL_EVENT_DATA');
  return {status:'INCLUDED_WALLET_WITHDRAWAL_EVENT',blockHash,transactionHash,transactionIndex:index,
    transactionCount:body.transactionCount,signer:controller,wallet,eventRecipient:wallet,epoch,amount,
    accountingEffectsVerified:false,publicChainAuthenticated:false};
}
