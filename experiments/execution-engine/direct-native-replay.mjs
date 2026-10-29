import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {Account,bytesToHex,createAddressFromString} from '@ethereumjs/util';
import {loadNativeAbsenceAdapter} from './native-absence-adapter.mjs';
import {executeSelectedLondon} from './selected-london-executor.mjs';
const root=pathToFileURL(resolve(process.argv[2])+'/');
const raw=readFileSync(process.argv[3]);assert.ok(raw.length<1048576);
const f=JSON.parse(raw),d=f.directNative,native='0x'+'00'.repeat(19)+'01';
assert.equal(f.localOnly,true);assert.equal(f.productionAccepted,false);
const {inspectReplayDependencies}=await import(new URL('reference/replay-dependencies.mjs',root));
const {inspectHeaderBoundStateProof}=await import(new URL('reference/header-bound-state-proof.mjs',root));
const {inspectBlockBodyCapture}=await import(new URL('experiments/paid-body-acquisition/verify_body.mjs',root));
function deps(s){return {schema:'caw-replay-dependencies/1',header:s.header,selection:{profile:'london-16',parentHash:s.header.hash,dependencies:s.witnesses.map(w=>({address:w.proof.address,storageKeys:[],expectedCodeHash:w.proof.codeHash}))},witnesses:s.witnesses};}
assert.deepEqual(d.parentWitnesses.header,d.parent);assert.deepEqual(d.childWitnesses.header,d.child);
const input={schema:'caw-replay-input-binding/1',anchor:{schema:'caw-first-transaction-anchor/1',parentHeader:d.parent,header:d.child,rawTransactions:[d.submission.raw],selection:{profile:'london-16',parentHash:d.parent.hash,blockHash:d.child.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:d.submission.hash}},dependencies:deps(d.parentWitnesses)};
inspectBlockBodyCapture({schema:'caw-block-body-capture/1',selection:{block_number:d.child.number,block_hash:d.child.hash},header:d.child,raw_transactions:[d.submission.raw],receipts:[d.row.receipt]},{schema:'caw-block-body-selection/1',profile:'london-16',number:d.child.number,hash:d.child.hash});
const expected=inspectReplayDependencies(JSON.stringify(deps(d.childWitnesses)));
const factory=await loadNativeAbsenceAdapter(root),absence=JSON.stringify({header:d.parent,proof:d.parentProof});
const e=factory(input,absence),result=await executeSelectedLondon(e,input);e.healthy();
const receipt=d.row.receipt;
assert.equal(result.receipt.status,Number(BigInt(receipt.status)));
assert.equal(result.totalGasSpent,BigInt(receipt.gasUsed));
assert.equal(result.receipt.cumulativeBlockGasUsed,BigInt(receipt.cumulativeGasUsed));
assert.equal(bytesToHex(result.receipt.bitvector),receipt.logsBloom);
assert.deepEqual(result.receipt.logs,[]);assert.deepEqual(receipt.logs,[]);
const compared=[];
for(const dep of expected.dependencies){const p=dep.state.proof,a=e.overlay.account(p.address);
 assert.equal(BigInt(a.nonce),BigInt(p.nonce));assert.equal(BigInt(a.balance),BigInt(p.balance));
 compared.push(p.address);
}
const child=inspectHeaderBoundStateProof(JSON.stringify({header:d.child,proof:d.childProof}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:d.child.hash,address:native,storageKeys:[]})).proof;
const a=await e.stateManager.getAccount(createAddressFromString(native));
assert.equal(a,undefined);assert.equal(child.accountExists,true);
assert.equal(BigInt(child.nonce),0n);assert.equal(BigInt(child.balance),0n);
const empty=new Account();assert.equal(child.codeHash,bytesToHex(empty.codeHash));assert.equal(child.storageHash,bytesToHex(empty.storageRoot));
const negatives=[];
for(const address of compared){
 const partial=structuredClone(input);
 partial.dependencies.witnesses=partial.dependencies.witnesses.filter(w=>w.proof.address!==address);
 partial.dependencies.selection.dependencies=partial.dependencies.selection.dependencies.filter(w=>w.address!==address);
 const missing=factory(partial,absence);
 await assert.rejects(executeSelectedLondon(missing,partial));assert.throws(()=>missing.healthy());negatives.push('missing dependency '+address);
}
assert.throws(()=>factory(input,JSON.stringify({header:d.child,proof:d.childProof})));negatives.push('child proof cannot substitute for parent absence');
console.log(JSON.stringify({schema:'caw-direct-native-replay/1',receiptAndGasMatch:true,gas:result.totalGasSpent.toString(),selectedAccountsMatch:compared,capturedNativeExists:child.accountExists,replayedNativeExists:a!==undefined,completeSelectedChildAgreement:false,negativeChecks:negatives,stateRootRecomputed:false,independentOperator:false,productionAccepted:false}));
