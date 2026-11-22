import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {reconstruct} from './reconstruct-accounting.mjs';
const [historyPath,compilerPath,capturePath,finalPath,out]=process.argv.slice(2);
// Exact experiment input pins, not a general chain trust policy.
for(const [path,pin] of [[compilerPath,'db26070ddc049b27b70695ef2f416b8cdc3886fa426ae7b972f6f650b5ea8bbf'],[capturePath,'d4524317e9de7ef8e0a362b6d2a444a6d7ba5618703405658e8bfb83ce980cfe'],[finalPath,'64f5c0af9b3dc6564c01c75a4a8b2926a90275a8abde82da5f6cb979e1f8aa35']]){
 assert(fs.statSync(path).size<8*1024*1024,'INPUT_LIMIT');assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),pin,'INPUT_PIN');
}
assert(fs.statSync(historyPath).size<8*1024*1024,'HISTORY_LIMIT');
const history=JSON.parse(fs.readFileSync(historyPath)).history;
const contracts=JSON.parse(fs.readFileSync(compilerPath)).contracts['DeployedCustodyStakeResearch.sol'];
const capture=JSON.parse(fs.readFileSync(capturePath));
assert.equal(capture.chainId,'0x7a69');const blocks=capture.blocks.slice(1);
inspectExecutionHeaderChain(blocks.map(b=>b.block),{schema:'caw-execution-header-chain-selection/1',profile:'shanghai-17',startHash:blocks[0].block.hash,endHash:blocks.at(-1).block.hash});
const regenerated=[];
for(const b of blocks){
 const combined=inspectBlockTransactionReceipts(b.block,b.rawTransactions,b.receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:b.block.hash});
 const senders=inspectBlockSenders(b.block,b.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:b.block.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});
 for(let i=0;i<senders.transactions.length;i++)regenerated.push({blockNumber:b.block.number,blockHash:b.block.hash,transaction:senders.transactions[i],decoded:combined.transactions[i],receipt:combined.receipts[i],association:combined.associations[i]});
}
assert.deepEqual(history,regenerated,'REGENERATED_VERIFIED_HISTORY');
const times=Object.fromEntries(capture.blocks.map(b=>[b.block.hash,b.block.timestamp]));
const expected=JSON.parse(fs.readFileSync(finalPath));
const result=reconstruct(history,contracts,times);assert.deepEqual(result.final,expected,'FINAL_SNAPSHOT');assert.equal(result.failedTransactionsSkipped,8);
const negatives=[];
function reject(name,mutate){const h=structuredClone(history);mutate(h);assert.throws(()=>{const r=reconstruct(h,contracts,times);assert.deepEqual(r.final,expected);},name);negatives.push(name);}
reject('reordered_ownership_history',h=>[h[18],h[19]]=[h[19],h[18]]);
reject('apply_failed_withdrawal',h=>h[19].receipt.status='0x1');
reject('omit_successful_withdrawal_effect',h=>h[21].receipt.status='0x0');
reject('wrong_successful_withdrawal_sender',h=>h[21].transaction.from=h[9].transaction.from);
reject('alter_fee_event_allocation',h=>h[15].receipt.logs[0].data='0x'+'00'.repeat(128));
reject('alter_stake_proof',h=>{const t=h[12].transaction;t.data=t.data.slice(0,-64)+'00'.repeat(31)+'01';});
reject('unknown_successful_target',h=>h[9].transaction.to='0x'+'11'.repeat(20));
reject('reverted_transaction_with_log',h=>h[16].receipt.logs=structuredClone(h[15].receipt.logs));
reject('constructor_code_mismatch',h=>{const t=h[3].transaction;t.data='0x00'+t.data.slice(4);});
const wrongFinal={...expected,balance:String(BigInt(expected.balance)+1n)};assert.throws(()=>assert.deepEqual(result.final,wrongFinal));negatives.push('one_unit_final_balance_mismatch');
const report={schema:'caw-synthetic-accounting-reconstruction/1',...result,matchedSnapshotFields:Object.keys(expected).length,negativeControls:negatives,source:'verified transaction inputs and receipt status/logs; constructor bytes from pinned compiler output',finalSnapshotAuthenticated:false,evmExecutionReplayed:false,nativeGasBalancesReconstructed:false,tokenWalletBalancesCompared:false};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({transactions:history.length,matchedFields:report.matchedSnapshotFields,negatives,final:result.final}));
