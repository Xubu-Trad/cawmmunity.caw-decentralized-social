import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {bytesToHex} from '@ethereumjs/util';
import {loadWitnessAdapter} from './witness-adapter.mjs';
import {executeSelectedLondon} from './selected-london-executor.mjs';
const root=pathToFileURL(resolve(process.argv[2])+'/');
const f=JSON.parse(readFileSync(process.argv[3]));
const {inspectReplayDependencies}=await import(new URL('reference/replay-dependencies.mjs',root));
const {inspectBlockReceipts}=await import(new URL('reference/ethereum-block-receipts.mjs',root));
const {inspectHeaderBoundStateProof}=await import(new URL('reference/header-bound-state-proof.mjs',root));
const factory=await loadWitnessAdapter(root);
function deps(s){s={...s,witnesses:s.witnesses.filter(w=>w.proof.address!=='0x'+'00'.repeat(19)+'01')};return {schema:'caw-replay-dependencies/1',header:s.header,selection:{profile:'london-16',parentHash:s.header.hash,dependencies:s.witnesses.map(w=>({address:w.proof.address,storageKeys:w.proof.storageProof.map(p=>'0x'+BigInt(p.key).toString(16).padStart(64,'0')),expectedCodeHash:w.proof.codeHash}))},witnesses:s.witnesses};}
const results=[];
for(const m of f.mined){
 const input={schema:'caw-replay-input-binding/1',anchor:{schema:'caw-first-transaction-anchor/1',parentHeader:m.parent,header:m.header,rawTransactions:[m.submission.raw],selection:{profile:'london-16',parentHash:m.parent.hash,blockHash:m.header.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:m.submission.hash}},dependencies:deps(m.parentWitnesses)};
 const expected=inspectReplayDependencies(JSON.stringify(deps(m.childWitnesses)));
 const receipt=m.row.receipt;
 inspectBlockReceipts(m.header,[receipt],{schema:'caw-block-receipts-selection/1',profile:'london-16',hash:m.header.hash});
 const native='0x'+'00'.repeat(19)+'01';
 const nativeProof=m.parentWitnesses.witnesses.find(w=>w.proof.address===native);
 const absence=inspectHeaderBoundStateProof(JSON.stringify({header:m.parent,proof:nativeProof.proof}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:m.parent.hash,address:native,storageKeys:[]}));
 assert.equal(absence.proof.accountExists,false);
 const e=factory(input);
 if(m.label==='restored'){
  let missingAddress=null;const get=e.stateManager.getAccount;
  const diagnostic={...e,stateManager:{...e.stateManager,getAccount:async function(a){try{return await get(a);}catch(error){missingAddress=a.toString();throw error;}}}};
  await assert.rejects(executeSelectedLondon(diagnostic,input),{code:'WITNESS_STATE_MISSING_ACCOUNT'});
  assert.equal(missingAddress,native);assert.throws(()=>e.healthy());
  results.push({label:m.label,replayCompleted:false,blocker:'WITNESS_STATE_MISSING_ACCOUNT',missingAddress,nativeAccountAbsenceProven:true});
  continue;
 }
 const result=await executeSelectedLondon(e,input);e.healthy();
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
 const missing=factory(partial);await assert.rejects(executeSelectedLondon(missing,partial),{code:'WITNESS_STATE_MISSING_SLOT'});assert.throws(()=>missing.healthy());
 results.push({label:m.label,status:result.receipt.status,gas:result.totalGasSpent.toString(),selectedChildAccountsAndSlotsMatch:true,missingWalletModeRefused:true});
 console.log(JSON.stringify({progress:results.at(-1)}));
}
console.log(JSON.stringify({schema:'caw-wallet-witness-replay/1',cases:results,stateRootRecomputed:false,independentOperator:false,publicChainAuthenticated:false,arbitraryWalletCompatibility:false,productionAccepted:false}));

