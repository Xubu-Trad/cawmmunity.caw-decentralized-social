import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {inspectExecutionHeader} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';

// Recorded-artifact verification only: no RPC, EVM execution or consensus.
export function verifyWalletCapture(capture, baseline, evidence, expected) {
  assert.equal(capture.blocks.length,22,'CAPTURE_LENGTH');
  assert.equal(baseline.blocks.length,22,'BASELINE_LENGTH');
  assert.equal(capture.blocks[0].block.hash,baseline.blocks[0].block.hash,'GENESIS');
  let transactions=0;const blocked=[];
  for(let i=0;i<capture.blocks.length;i++){
    const row=capture.blocks[i], old=baseline.blocks[i], h=row.block;
    inspectExecutionHeader(h,{schema:'caw-execution-header-selection/1',profile:'shanghai-17',hash:h.hash});
    assert.equal(BigInt(h.number),BigInt(i),'BLOCK_NUMBER');
    assert.equal(h.stateRoot,old.block.stateRoot,'BASELINE_STATE_ROOT');
    assert.deepEqual(row.rawTransactions,old.rawTransactions,'SIGNED_INPUTS');
    if(i===0){assert.equal(row.receipts.length,0);continue;}
    assert.equal(h.parentHash,capture.blocks[i-1].block.hash,'PARENT_LINK');
    assert.equal(row.rawTransactions.length,1,'TRANSACTION_COUNT');
    assert.equal(row.receipts.length,1,'RECEIPT_COUNT');
    assert.equal(row.receipts[0].status,old.receipts[0].status,'BASELINE_RECEIPT_STATUS');
    try{
      inspectBlockTransactionReceipts(h,row.rawTransactions,row.receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:h.hash});
      inspectBlockSenders(h,row.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:h.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});
      transactions++;
    }catch(error){
      // Preserve the known reader limit as an incomplete result, never a pass.
      // Other malformed evidence is still rejected immediately.
      if(error.code!=='BLOCK_TRANSACTIONS_TRANSACTION_ENCODED_LIMIT')throw error;
      blocked.push({block:i,code:error.code,encodedBytes:(row.rawTransactions[0].length-2)/2});
    }
  }
  const tip=capture.blocks.at(-1).block;
  assert.equal(evidence.header.hash,tip.hash,'PROOF_ENDPOINT');
  const verified=inspectHeaderBoundStateProof(JSON.stringify(evidence),JSON.stringify({schema:'caw-header-state-selection/1',profile:'shanghai-17',hash:tip.hash,address:'0x19a827174f66b3c66ad7063951d7b4f94f996e77',storageKeys:expected.storage.map(x=>x.key)}));
  assert.equal(expected.storage.length,16,'EXPECTED_FIELDS');
  for(const field of expected.storage){const actual=verified.proof.storage.find(x=>x.key===field.key);assert(actual,'MISSING_FIELD');assert.equal(BigInt(actual.value).toString(),field.expected,'STORAGE_VALUE');}
  const approved=expected.storage.find(x=>x.label==='approved2');assert(approved);assert.equal(verified.proof.storage.find(x=>x.key===approved.key).exists,false,'APPROVAL_ABSENCE');
  return {status:blocked.length?'INCOMPLETE':'VERIFIED_RECORDED_ARTIFACTS',headers:22,strictlyVerifiedTransactions:transactions,matchedSignedInputs:21,matchedStateRoots:21,registryFields:16,blocked,endpoint:tip.hash,allRecordedCommitmentsVerified:blocked.length===0,executionReplayed:false,publicChainAuthenticated:false};
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(process.argv.length,6,'FOUR_INPUT_FILES_REQUIRED');
  const args=process.argv.slice(2).map(p=>{assert(fs.statSync(p).size<=8*1024*1024,'INPUT_LIMIT');return JSON.parse(fs.readFileSync(p));});
  const result=verifyWalletCapture(...args);console.log(JSON.stringify(result,null,2));if(result.status==='INCOMPLETE')process.exitCode=2;
}
