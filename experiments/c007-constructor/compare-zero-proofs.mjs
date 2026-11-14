import fs from 'node:fs';
import assert from 'node:assert/strict';
import {MerklePatriciaTrie,verifyMPTWithMerkleProof} from '@ethereumjs/mpt';
import {MerkleStateManager,getMerkleStateProof} from '@ethereumjs/statemanager';
import {RLP} from '@ethereumjs/rlp';
import {Account,createAddressFromString} from '@ethereumjs/util';
import {inspectEthereumStateProof} from '../../reference/ethereum-state-proof.mjs';
const bytes=h=>Uint8Array.from(Buffer.from(h.slice(2),'hex')),hex=b=>'0x'+Buffer.from(b).toString('hex');
const slot=h=>bytes('0x'+BigInt(h).toString(16).padStart(64,'0'));
const capture=JSON.parse(fs.readFileSync(process.argv[2]));
const trie=new MerklePatriciaTrie({useKeyHashing:true});
const rows=[],controls=[];
for(const batch of capture.batches){
 const account=await verifyMPTWithMerkleProof(trie,bytes(capture.header.stateRoot),bytes(batch.address),batch.proof.accountProof.map(bytes));assert(account);
 const decoded=RLP.decode(account);assert(Array.isArray(decoded)&&decoded.length===4);assert.equal(hex(decoded[2]),batch.proof.storageHash,'INDEPENDENT_ACCOUNT_STORAGE_ROOT');
 for(const p of batch.proof.storageProof){
  const value=await verifyMPTWithMerkleProof(trie,decoded[2],slot(p.key),p.proof.map(bytes));
  const raw=value===null?null:hex(value);const rlp=value===null?new Uint8Array():RLP.decode(value);assert(rlp instanceof Uint8Array);
  const n=rlp.length?BigInt(hex(rlp)):0n;assert.equal(n,BigInt(p.value));
  let strict;try{inspectEthereumStateProof({...batch.proof,storageProof:[p]},{stateRoot:capture.header.stateRoot,address:batch.address,storageKeys:[hex(slot(p.key))]});strict='accepted';}catch(e){strict=e.code;}
  if(n===0n){assert.equal(raw,'0x80');assert.equal(strict,'ETH_PROOF_STORAGE');}else assert.equal(strict,'accepted');
  rows.push({address:batch.address,key:hex(slot(p.key)),claimed:p.value,independentTrieValue:raw,strictReader:strict});
 }
}
assert.equal(rows.length,20);assert.equal(rows.filter(r=>r.strictReader==='ETH_PROOF_STORAGE').length,2);
const b=capture.batches[0],p=b.proof.storageProof[0];
await assert.rejects(()=>verifyMPTWithMerkleProof(trie,new Uint8Array(32),slot(p.key),p.proof.map(bytes)));controls.push('wrong_storage_root_rejected');
const altered=p.proof.map(bytes);altered[0]=Uint8Array.from(altered[0]);altered[0][altered[0].length-1]^=1;
await assert.rejects(()=>verifyMPTWithMerkleProof(trie,bytes(b.proof.storageHash),slot(p.key),altered));controls.push('altered_proof_node_rejected');
// Independent state-manager zero semantics, without CAW contracts or Anvil.
const sm=new MerkleStateManager(),address=createAddressFromString('0x'+'11'.repeat(20)),key=slot(7);
await sm.putAccount(address,new Account(1n,0n));
// Keep a distinct nonzero slot so absence has a non-empty trie witness.
// The separate empty-root library-verifier failure is retained in lane V1.
await sm.putStorage(address,slot(8),Uint8Array.from([2]));
async function checkState(label,wanted,exists){
 const root=hex(await sm.getStateRoot()),rawProof=await getMerkleStateProof(sm,address,[key]);
 // EthereumJS emits byte-style values (e.g. 0x01). Adapt only numeric
 // JSON quantity metadata; retain raw output and every proof-node byte.
 const proof={...rawProof,storageProof:rawProof.storageProof.map(x=>({...x,value:'0x'+BigInt(x.value).toString(16)}))};
 const accepted=inspectEthereumStateProof(proof,{stateRoot:root,address:address.toString(),storageKeys:[hex(key)]});assert.equal(BigInt(accepted.storage[0].value),wanted);assert.equal(accepted.storage[0].exists,exists);
 const value=await verifyMPTWithMerkleProof(trie,bytes(proof.storageHash),key,proof.storageProof[0].proof.map(bytes));assert.equal(value===null,!exists);
 controls.push(label);return {label,root,rawProof,proof};
}
const initial=await checkState('unwritten_zero_absence_accepted',0n,false);
await sm.putStorage(address,key,Uint8Array.from([1]));const nonzero=await checkState('nonzero_inclusion_accepted',1n,true);
await sm.putStorage(address,key,new Uint8Array(32));const cleared=await checkState('cleared_zero_absence_accepted',0n,false);
assert.equal(cleared.root,initial.root);assert.notEqual(nonzero.root,initial.root);controls.push('zero_deletion_restores_initial_root');
const result={schema:'caw-independent-zero-proof-comparison/1',reference:'@ethereumjs/mpt, statemanager, rlp 10.1.3',rows,controls,referenceStateControls:[initial,nonzero,cleared],conclusion:'captured included zero leaves independently confirmed; strict absence-zero handling matches independent state manager',originalCaptureRepaired:false,completeOriginalStateProof:false,fullLifecycleIndependentlyReexecuted:false};
fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({compared:rows.length,rejectedZeroLeaves:2,controls}));
