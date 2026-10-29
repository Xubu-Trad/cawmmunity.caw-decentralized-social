import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {bytesToHex} from '@ethereumjs/util';
import {Account,createAddressFromString,hexToBytes} from '@ethereumjs/util';
import {loadNativeAbsenceAdapter} from './native-absence-adapter.mjs';
import {executeSelectedLondon} from './selected-london-executor.mjs';
const root=pathToFileURL(resolve(process.argv[2])+'/');
const f=JSON.parse(readFileSync(process.argv[3]));
const {inspectReplayDependencies}=await import(new URL('reference/replay-dependencies.mjs',root));
const {inspectBlockReceipts}=await import(new URL('reference/ethereum-block-receipts.mjs',root));
const {inspectHeaderBoundStateProof}=await import(new URL('reference/header-bound-state-proof.mjs',root));
const factory=await loadNativeAbsenceAdapter(root);
function deps(s){s={...s,witnesses:s.witnesses.filter(w=>w.proof.address!=='0x'+'00'.repeat(19)+'01')};return {schema:'caw-replay-dependencies/1',header:s.header,selection:{profile:'london-16',parentHash:s.header.hash,dependencies:s.witnesses.map(w=>({address:w.proof.address,storageKeys:w.proof.storageProof.map(p=>'0x'+BigInt(p.key).toString(16).padStart(64,'0')),expectedCodeHash:w.proof.codeHash}))},witnesses:s.witnesses};}
const results=[];
const boundaryChecks=[];
for(const m of f.mined){
 const input={schema:'caw-replay-input-binding/1',anchor:{schema:'caw-first-transaction-anchor/1',parentHeader:m.parent,header:m.header,rawTransactions:[m.submission.raw],selection:{profile:'london-16',parentHash:m.parent.hash,blockHash:m.header.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:m.submission.hash}},dependencies:deps(m.parentWitnesses)};
 const expected=inspectReplayDependencies(JSON.stringify(deps(m.childWitnesses)));
 const receipt=m.row.receipt;
 inspectBlockReceipts(m.header,[receipt],{schema:'caw-block-receipts-selection/1',profile:'london-16',hash:m.header.hash});
 const native='0x'+'00'.repeat(19)+'01';
 const nativeProof=m.parentWitnesses.witnesses.find(w=>w.proof.address===native);
 const absence=inspectHeaderBoundStateProof(JSON.stringify({header:m.parent,proof:nativeProof.proof}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:m.parent.hash,address:native,storageKeys:[]}));
 assert.equal(absence.proof.accountExists,false);
 const absentText=JSON.stringify({header:m.parent,proof:nativeProof.proof});
 if(m.label==='restored'){
  const fresh=()=>factory(input,absentText),nativeAddress=createAddressFromString(native);
  const group=async(name,fn)=>{await fn();boundaryChecks.push(name);};
  await group('proven absence reads and nested rollback',async()=>{const e=fresh(),s=e.stateManager;assert.equal(await s.getAccount(nativeAddress),undefined);await s.checkpoint();await s.putAccount(nativeAddress,new Account());assert.equal((await s.getAccount(nativeAddress)).balance,0n);await s.checkpoint();await s.deleteAccount(nativeAddress);assert.equal(await s.getAccount(nativeAddress),undefined);await s.revert();assert.ok(await s.getAccount(nativeAddress));await s.revert();assert.equal(await s.getAccount(nativeAddress),undefined);e.healthy();});
  await group('returned account does not mutate stored touch',async()=>{const e=fresh(),s=e.stateManager;await s.putAccount(nativeAddress,new Account());const a=await s.getAccount(nativeAddress);a.balance=9n;assert.equal((await s.getAccount(nativeAddress)).balance,0n);});
  for(const field of ['balance','nonce'])await group('reject nonzero '+field,async()=>{const e=fresh(),a=new Account();a[field]=1n;await assert.rejects(e.stateManager.putAccount(nativeAddress,a),{code:'NATIVE_ABSENCE_NONEMPTY_WRITE'});assert.throws(()=>e.healthy());assert.throws(()=>e.overlay.account(m.row.transaction.from));});
  await group('reject code writes',async()=>{const e=fresh();await assert.rejects(e.stateManager.putCode(nativeAddress,hexToBytes('0x00')),{code:'NATIVE_ABSENCE_WRITE_OR_STORAGE_UNSUPPORTED'});assert.throws(()=>e.healthy());});
  await group('reject storage reads',async()=>{const e=fresh();await assert.rejects(e.stateManager.getStorage(nativeAddress,new Uint8Array(32)),{code:'NATIVE_ABSENCE_WRITE_OR_STORAGE_UNSUPPORTED'});});
  await group('reject unproved account',async()=>{const e=fresh();await assert.rejects(e.stateManager.getAccount(createAddressFromString('0x'+'ab'.repeat(20))),{code:'WITNESS_STATE_MISSING_ACCOUNT'});assert.throws(()=>e.healthy());});
  await group('reject wrong-parent absence proof',async()=>{assert.throws(()=>factory(input,JSON.stringify({header:f.mined[0].parent,proof:f.mined[0].parentWitnesses.witnesses.find(w=>w.proof.address===native).proof})));});
  await group('reject missing absence proof',async()=>{assert.throws(()=>factory(input,'{}'));});
  await group('cleanup cannot revive failed attempt',async()=>{const e=fresh();await e.stateManager.checkpoint();await assert.rejects(e.stateManager.putStorage(nativeAddress,new Uint8Array(32),new Uint8Array()));await e.stateManager.revert();assert.throws(()=>e.healthy());});
  await group('commit preserves empty touch and deletion',async()=>{const e=fresh(),s=e.stateManager;await s.checkpoint();await s.putAccount(nativeAddress,new Account());await s.commit();assert.ok(await s.getAccount(nativeAddress));await s.checkpoint();await s.deleteAccount(nativeAddress);await s.commit();assert.equal(await s.getAccount(nativeAddress),undefined);e.healthy();});
  await group('extra account-read argument rejects',async()=>{const e=fresh();await assert.rejects(e.stateManager.getAccount(nativeAddress,0),{code:'NATIVE_ABSENCE_ARGUMENTS'});assert.throws(()=>e.healthy());});
  await group('fake address text rejects',async()=>{const e=fresh();await assert.rejects(e.stateManager.getAccount({bytes:nativeAddress.bytes,toString:()=> '0x'+'ab'.repeat(20)}),{code:'NATIVE_ABSENCE_ADDRESS'});});
  for(const field of ['codeHash','storageRoot'])await group('nonempty '+field+' rejects',async()=>{const e=fresh(),a=new Account();a[field]=new Uint8Array(32);await assert.rejects(e.stateManager.putAccount(nativeAddress,a),{code:'NATIVE_ABSENCE_NONEMPTY_WRITE'});});
  await group('original storage cannot invent absent slots',async()=>{const e=fresh();await assert.rejects(e.stateManager.originalStorageCache.get(nativeAddress,new Uint8Array(32)),{code:'NATIVE_ABSENCE_STORAGE_UNSUPPORTED'});assert.throws(()=>e.healthy());});
  await group('discard prevents native reads',async()=>{const e=fresh();e.overlay.discard();await assert.rejects(e.stateManager.getAccount(nativeAddress));});
  await group('present account proof cannot stand in for native absence',async()=>{const w=m.parentWitnesses.witnesses.find(w=>w.proof.address===f.wallet);assert.throws(()=>factory(input,JSON.stringify({header:m.parent,proof:w.proof})));});
 }
 const e=factory(input,absentText);
 let result;try{result=await executeSelectedLondon(e,input);e.healthy();}catch(error){console.log(JSON.stringify({firstFailure:e.firstFailure}));throw error;}
 const childNative=m.childWitnesses.witnesses.find(w=>w.proof.address===native);
 const childAbsence=inspectHeaderBoundStateProof(JSON.stringify({header:m.header,proof:childNative.proof}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:m.header.hash,address:native,storageKeys:[]}));
 const childNativeAccount=await e.stateManager.getAccount(createAddressFromString(native));
 const nativeChildMatches=(childNativeAccount!==undefined)===childAbsence.proof.accountExists;
 // Retain the newly reproduced engine/capture disagreement; do not force a
 // matching account into the adapter or call this complete state agreement.
 assert.equal(nativeChildMatches,m.label==='reject','RETAINED_NATIVE_CLEANUP_OUTCOME');
 if(m.label==='restored'){
  assert.equal(childNativeAccount,undefined);
  assert.equal(childAbsence.proof.accountExists,true);
  assert.equal(BigInt(childAbsence.proof.balance),0n);assert.equal(BigInt(childAbsence.proof.nonce),0n);
  const empty=new Account();assert.equal(childAbsence.proof.codeHash,bytesToHex(empty.codeHash));assert.equal(childAbsence.proof.storageHash,bytesToHex(empty.storageRoot));
 }
 if(childNativeAccount){
  assert.equal(childNativeAccount.nonce,BigInt(childAbsence.proof.nonce));
  assert.equal(childNativeAccount.balance,BigInt(childAbsence.proof.balance));
  assert.equal(bytesToHex(childNativeAccount.codeHash),childAbsence.proof.codeHash);
  assert.equal(bytesToHex(childNativeAccount.storageRoot),childAbsence.proof.storageHash);
 }
 assert.equal(result.receipt.status,Number(BigInt(receipt.status)));
 assert.equal(result.totalGasSpent,BigInt(receipt.gasUsed));
 assert.equal(result.receipt.cumulativeBlockGasUsed,BigInt(receipt.cumulativeGasUsed));
 assert.equal(bytesToHex(result.receipt.bitvector),receipt.logsBloom);
 assert.deepEqual(result.receipt.logs.map(([address,topics,data])=>({address:bytesToHex(address),topics:topics.map(bytesToHex),data:bytesToHex(data)})),receipt.logs.map(({address,topics,data})=>({address,topics,data})));
 for(const d of expected.dependencies){const p=d.state.proof,actual=e.overlay.account(p.address);
  assert.equal(BigInt(actual.nonce),BigInt(p.nonce));assert.equal(BigInt(actual.balance),BigInt(p.balance));
 }
 for(const w of m.childWitnesses.witnesses)for(const p of w.proof.storageProof)assert.equal(BigInt(e.overlay.storage(w.proof.address,'0x'+BigInt(p.key).toString(16).padStart(64,'0'))),BigInt(p.value));
 const partial=structuredClone(input);const wallet=partial.dependencies.witnesses.findIndex(w=>w.proof.address===f.wallet);
 partial.dependencies.selection.dependencies[wallet].storageKeys=[];partial.dependencies.witnesses[wallet].proof.storageProof=[];
 const missing=factory(partial,absentText);await assert.rejects(executeSelectedLondon(missing,partial),{code:'WITNESS_STATE_MISSING_SLOT'});assert.throws(()=>missing.healthy());
 results.push({label:m.label,status:result.receipt.status,gas:result.totalGasSpent.toString(),previouslySelectedChildAccountsAndSlotsMatch:true,nativeChildAccountMatches:nativeChildMatches,capturedNativeChildExists:childAbsence.proof.accountExists,replayedNativeChildExists:childNativeAccount!==undefined,completeSelectedChildAgreement:nativeChildMatches,missingWalletModeRefused:true});
 console.log(JSON.stringify({progress:results.at(-1)}));
}
console.log(JSON.stringify({schema:'caw-wallet-native-replay/1',cases:results,boundaryChecks,stateRootRecomputed:false,independentOperator:false,publicChainAuthenticated:false,arbitraryWalletCompatibility:false,productionAccepted:false}));



