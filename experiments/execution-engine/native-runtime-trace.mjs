import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fromMerkleStateProof} from '@ethereumjs/statemanager';
import {bytesToHex,createAddressFromString} from '@ethereumjs/util';
import {executeSelectedLondon} from './selected-london-executor.mjs';
import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
import {inspectBlockBodyCapture} from '../paid-body-acquisition/verify_body.mjs';
const raw=readFileSync(process.argv[2]);assert.ok(raw.length<1048576);
const f=JSON.parse(raw),d=f.directNative,native='0x'+'00'.repeat(19)+'01';
const proofs=[...d.parentWitnesses.witnesses.map(w=>w.proof),d.parentProof];
for(const proof of proofs)inspectHeaderBoundStateProof(JSON.stringify({header:d.parent,proof}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:d.parent.hash,address:proof.address,storageKeys:[]}));
inspectBlockBodyCapture({schema:'caw-block-body-capture/1',selection:{block_number:d.child.number,block_hash:d.child.hash},header:d.child,raw_transactions:[d.submission.raw],receipts:[d.row.receipt]},{schema:'caw-block-body-selection/1',profile:'london-16',number:d.child.number,hash:d.child.hash});
const stateManager=await fromMerkleStateProof(proofs,true);
assert.equal(bytesToHex(await stateManager.getStateRoot()),d.parent.stateRoot);
assert.equal(await stateManager.getAccount(createAddressFromString(native)),undefined);
const input={anchor:{parentHeader:d.parent,header:d.child,rawTransactions:[d.submission.raw],selection:{profile:'london-16',parentHash:d.parent.hash,blockHash:d.child.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:d.submission.hash}}};
// A separate ordinary run controls for observer-induced changes.
const baselineManager=await fromMerkleStateProof(proofs,true);
const baselineResult=await executeSelectedLondon({stateManager:baselineManager},input);
const baselineRoot=bytesToHex(await baselineManager.getStateRoot());
const events=[],originals=new Map();
function summary(account) {
 return account===undefined?{exists:false}:{exists:true,nonce:account.nonce.toString(),balance:account.balance.toString(),codeHash:bytesToHex(account.codeHash),storageRoot:bytesToHex(account.storageRoot)};
}
for(const method of ['getAccount','putAccount','deleteAccount','checkpoint','commit','revert']) {
 const original=stateManager[method];assert.equal(typeof original,'function');originals.set(method,original);
 stateManager[method]=async function(...args) {
  const selected=args[0]?.toString()===native;
  const lifecycle=['checkpoint','commit','revert'].includes(method);
  const candidate=selected&&method==='putAccount'?summary(args[1]):undefined;
  const result=await Reflect.apply(original,this,args);
  if(selected||lifecycle) {
   assert.ok(events.length<128,'TRACE_EVENT_BOUND');
   events.push({method,...(selected?{address:native}:{}),...(candidate?{account:candidate}:{}),...(selected&&method==='getAccount'?{account:summary(result)}:{})});
  }
  return result;
 };
}
let result;
try { result=await executeSelectedLondon({stateManager},input); }
finally { for(const [method,original] of originals)stateManager[method]=original; }
assert.equal(bytesToHex(await stateManager.getStateRoot()),baselineRoot);
assert.deepEqual(result.receipt,baselineResult.receipt);
assert.equal(result.totalGasSpent,baselineResult.totalGasSpent);
assert.equal(await baselineManager.getAccount(createAddressFromString(native)),undefined);
assert.ok(events.some(e=>e.method==='getAccount'&&e.account.exists===false));
assert.ok(events.some(e=>e.method==='deleteAccount'));

assert.equal(result.receipt.status,1);assert.equal(result.totalGasSpent,BigInt(d.row.receipt.gasUsed));
assert.equal(result.receipt.cumulativeBlockGasUsed,BigInt(d.row.receipt.cumulativeGasUsed));
assert.equal(bytesToHex(result.receipt.bitvector),d.row.receipt.logsBloom);assert.deepEqual(result.receipt.logs,[]);assert.deepEqual(d.row.receipt.logs,[]);
for(const w of d.childWitnesses.witnesses){
 const p=inspectHeaderBoundStateProof(JSON.stringify({header:d.child,proof:w.proof}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:d.child.hash,address:w.proof.address,storageKeys:[]})).proof;
 const a=await stateManager.getAccount(createAddressFromString(p.address));assert.ok(a);assert.equal(a.balance,BigInt(p.balance));assert.equal(a.nonce,BigInt(p.nonce));
}
const child=inspectHeaderBoundStateProof(JSON.stringify({header:d.child,proof:d.childProof}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:d.child.hash,address:native,storageKeys:[]})).proof;
assert.equal(child.accountExists,true);assert.equal(await stateManager.getAccount(createAddressFromString(native)),undefined);
const computed=bytesToHex(await stateManager.getStateRoot());assert.notEqual(computed,d.child.stateRoot);
console.log(JSON.stringify({schema:'caw-native-runtime-trace/1',events,observerControlMatched:true,acquisitionRuntimeObserved:false,parentRootMatched:true,receiptAndGasMatched:true,senderAndFeeRecipientMatched:true,capturedNativeExists:true,replayedNativeExists:false,computedPostTransactionRoot:computed,capturedChildRoot:d.child.stateRoot,rootsMatch:false,experimentalAdapterUsed:false,wholeBlockExecutionVerified:false,independentOperator:false,productionAccepted:false}));
