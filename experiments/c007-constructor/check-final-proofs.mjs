import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectHeaderBoundCode} from '../../reference/header-bound-state-proof.mjs';
import {inspectTrieProof} from '../../reference/ethereum-state-proof.mjs';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {keccak256Hex} from '../../reference/keccak256.mjs';
import {reconstruct} from './reconstruct-accounting.mjs';
const [directory,out]=process.argv.slice(2);
const load=n=>{const p=directory+'/'+n;assert(fs.statSync(p).size<8*1024*1024);return JSON.parse(fs.readFileSync(p));};
const manifest=load('input-pins.json');
for(const [n,pin] of Object.entries(manifest.files)){assert(['acquired-history.json','compiler-output.json','expected-final.json','final-proof-batches.json'].includes(n));assert.equal(createHash('sha256').update(fs.readFileSync(directory+'/'+n)).digest('hex'),pin,'INPUT_PIN');}
assert.equal(Object.keys(manifest.files).length,4);
const capture=load('acquired-history.json'),proofs=load('final-proof-batches.json'),compiler=load('compiler-output.json').contracts['DeployedCustodyStakeResearch.sol'],expected=load('expected-final.json');
assert.equal(capture.chainId,'0x7a69');const blocks=capture.blocks.slice(1),last=blocks.at(-1).block;assert.equal(last.hash,manifest.finalHash);
assert.deepEqual(proofs.header,last);assert.equal(proofs.schema,'caw-synthetic-final-proofs/1');
inspectExecutionHeaderChain(blocks.map(b=>b.block),{schema:'caw-execution-header-chain-selection/1',profile:'shanghai-17',startHash:manifest.firstHash,endHash:manifest.finalHash});
const history=[];
for(const b of blocks){const merged=inspectBlockTransactionReceipts(b.block,b.rawTransactions,b.receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:b.block.hash});const senders=inspectBlockSenders(b.block,b.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:b.block.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});for(let i=0;i<senders.transactions.length;i++)history.push({blockNumber:b.block.number,blockHash:b.block.hash,transaction:senders.transactions[i],receipt:merged.receipts[i],association:merged.associations[i]});}
const model=reconstruct(history,compiler,Object.fromEntries(blocks.map(b=>[b.block.hash,b.block.timestamp])));assert.deepEqual(model.final,expected);
const W=n=>BigInt(n).toString(16).padStart(64,'0');
const mapping=(key,slot)=>keccak256Hex('0x'+W(key)+W(slot));
const vaultArtifact=compiler.DeployedCustodyStakeResearch,tokenArtifact=compiler.MockTokenResearch;
const slot=(c,label)=>{const x=c.storageLayout.storage.find(x=>x.label===label);assert(x);return x;};
const fields=Object.keys(expected).filter(x=>!['balance','nonce'].includes(x)).map(label=>{const x=slot(vaultArtifact,label);return {label,slot:'0x'+W(x.slot),offset:x.offset,bytes:Number(vaultArtifact.storageLayout.types[x.type].numberOfBytes)};});
fields.push({label:'nonce',slot:mapping(1,slot(vaultArtifact,'postNonces').slot),offset:0,bytes:32});
const walletFields=Object.keys(model.wallets).map(label=>({label,slot:mapping(BigInt(label),slot(tokenArtifact,'balanceOf').slot),offset:0,bytes:32}));
function expectedCode(artifact,token){let code=artifact.evm.deployedBytecode.object;const refs=Object.values(artifact.evm.deployedBytecode.immutableReferences??{});assert(refs.length<2,'IMMUTABLE_SCOPE');for(const list of refs)for(const ref of list){assert.equal(ref.length,32);code=code.slice(0,ref.start*2)+W(BigInt(token))+code.slice((ref.start+ref.length)*2);}return '0x'+code;}
const codes={[model.vault]:expectedCode(vaultArtifact,model.token),[model.token]:expectedCode(tokenArtifact,model.token)};
function verify(bundle){
 assert.deepEqual(bundle.header,last,'FINAL_HEADER');assert.equal(bundle.batches.length,3,'BATCH_COUNT');
 const seen=new Set(),values={},rejected=[];
 for(const batch of bundle.batches){
  assert(Object.hasOwn(codes,batch.address),'ACCOUNT');assert.equal(batch.code,codes[batch.address],'COMPILED_RUNTIME');
  const allowed=batch.address===model.vault?fields:walletFields;
  assert(batch.fields.length>0&&batch.fields.length<=16);
  for(const field of batch.fields){assert.deepEqual(field,allowed.find(x=>x.label===field.label),'LAYOUT');const key=batch.address+':'+field.label;assert(!seen.has(key),'DUPLICATE_FIELD');seen.add(key);}
  assert.equal(batch.proof.storageProof.length,batch.fields.length,'PROOF_COUNT');
  for(const f of batch.fields){
   const supplied=batch.proof.storageProof.filter(x=>'0x'+W(BigInt(x.key))===f.slot);assert.equal(supplied.length,1,'SLOT_SET');
   let r;
   try{r=inspectHeaderBoundCode(JSON.stringify({header:bundle.header,proof:{...batch.proof,storageProof:supplied},code:batch.code}),JSON.stringify({schema:'caw-header-code-selection/1',profile:'shanghai-17',hash:manifest.finalHash,address:batch.address,storageKeys:[f.slot],expectedCodeHash:keccak256Hex(codes[batch.address])}));}
   catch(e){
    // Record the existing strict rejection. Never substitute an accepted value.
    assert.equal(e.code,'ETH_PROOF_STORAGE');assert.equal(supplied[0].value,'0x0');
    const leaf=inspectTrieProof(batch.proof.storageHash,keccak256Hex(f.slot),supplied[0].proof);assert.deepEqual(leaf,{exists:true,value:'0x80'});
    rejected.push({address:batch.address,label:f.label,slot:f.slot,code:e.code,leaf});continue;
   }
   assert(r.codeMatchesSelectedState&&r.state.selectedHeaderBindingVerified);
   const proven=r.state.proof.storage[0];const value=(BigInt(proven.value)>>BigInt(f.offset*8))&((1n<<BigInt(f.bytes*8))-1n);const key=batch.address+':'+f.label;values[key]=String(value);assert.equal(String(value),batch.address===model.vault?model.final[f.label]:model.wallets[f.label],'MODEL_STORAGE_MISMATCH');
  }
 }
 assert.equal(seen.size,fields.length+walletFields.length,'COMPLETE_FIELDS');assert.equal(values[model.token+':'+model.vault],model.final.balance);
 assert.deepEqual(rejected.map(x=>x.address+':'+x.label).sort(),[model.vault+':epoch3',model.token+':'+Object.keys(model.wallets).find(a=>a!==model.vault&&model.wallets[a]==='0')].sort(),'EXPECTED_REJECTION_BOUNDARY');
 return {values,rejected};
}
const {values,rejected}=verify(proofs),negatives=[];
function reject(name,mutate){const b=structuredClone(proofs);mutate(b);assert.throws(()=>verify(b),name);negatives.push(name);}
reject('changed_storage_claim',b=>b.batches[0].proof.storageProof[0].value='0xdead');
reject('changed_account_proof',b=>{const p=b.batches[0].proof.accountProof;p[0]=p[0].slice(0,-2)+(p[0].endsWith('00')?'01':'00');});
reject('missing_storage_proof',b=>b.batches[0].proof.storageProof.pop());
reject('wrong_account',b=>b.batches[0].address=model.token);
reject('wrong_selected_header',b=>b.header.hash='0x'+'11'.repeat(32));
reject('modified_runtime',b=>b.batches[0].code+='00');
reject('wrong_storage_layout',b=>b.batches[0].fields[0].slot='0x'+'11'.repeat(32));
reject('missing_wallet_proof_batch',b=>b.batches.pop());
reject('duplicate_field',b=>b.batches[0].fields[1]=structuredClone(b.batches[0].fields[0]));
const report={schema:'caw-final-proof-comparison/1',status:'INCOMPLETE_ZERO_STORAGE_REJECTED',transactions:history.length,finalHeader:last.hash,stateRoot:last.stateRoot,matchedSnapshotFields:Object.keys(expected).length,provedStorageFields:seenCount(values),requestedStorageFields:fields.length+walletFields.length,rejected,completeFinalStateProof:false,tokenWalletBalancesCompared:false,wallets:model.wallets,final:model.final,negativeControls:negatives,compiledRuntimeMatched:true,selectedHeaderBindingVerified:true,endpointAuthenticated:false,consensusVerified:false,evmExecutionReplayed:false,sourceRecompiledIndependently:false};
function seenCount(v){return Object.keys(v).length;}
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
// Diagnostic controls passed, but complete state verification did not.
process.exitCode=2;
