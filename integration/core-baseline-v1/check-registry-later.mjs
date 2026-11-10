import {registryLaterFields} from './registry-later-fields.mjs';
import {inspectHeaderBoundCode} from '../../reference/header-bound-state-proof.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {getCreateAddress,Transaction} from 'ethers';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
const [manifestPath,manifestDigest,evidencePath,selectedHash,inputPath,modelPath,modelDigest]=process.argv.slice(2);
const b=fs.readFileSync(manifestPath);assert.equal(createHash('sha256').update(b).digest('hex'),manifestDigest,'MANIFEST');const m=JSON.parse(b),e=JSON.parse(fs.readFileSync(evidencePath));
const modelBytes=fs.readFileSync(modelPath);assert.equal(createHash('sha256').update(modelBytes).digest('hex'),modelDigest,'MODEL_PIN');const model=JSON.parse(modelBytes);assert.equal(model.transactions,28);
 const fields=registryLaterFields(fs.readFileSync(inputPath),m,model);
function verify(e,anchor){
 assert(/^0x[0-9a-f]{64}$/.test(anchor),'ANCHOR_REQUIRED');
 const joined=inspectBlockTransactionReceipts(e.header,e.rawTransactions,e.receipts,{schema:'caw-block-transactions-selection/1',profile:'london-16',hash:anchor});
 const senders=inspectBlockSenders(e.header,e.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'london-16',hash:anchor,chainId:"0x"+BigInt(m.chainId).toString(16),allowUnprotectedLegacy:false});
 const index=0;assert.equal(joined.associations.length,1);const row=joined.associations[0],sender=senders.transactions[0],receipt=joined.receipts[0];assert.equal(row.transactionHash,model.trace.at(-1).hash,'FINAL_TRANSACTION');assert.equal(sender.hash,row.transactionHash);assert.equal(receipt.status,'0x1');
 const proof=inspectHeaderBoundCode(JSON.stringify({header:e.header,proof:e.accountProof,code:e.code}),JSON.stringify({schema:'caw-header-code-selection/1',profile:'london-16',hash:anchor,address:m.address.toLowerCase(),storageKeys:fields.map(f=>f.key),expectedCodeHash:m.runtimeHash}));assert(proof.codeMatchesSelectedState&&proof.state.selectedHeaderBindingVerified);
 assert.equal(proof.state.proof.storage.length,fields.length);
 const storage=fields.map(f=>{const v=proof.state.proof.storage.find(x=>x.key===f.key);assert(v,'MISSING_FIELD');assert.equal(BigInt(v.value).toString(),f.expected,'HISTORY_STATE_MISMATCH');return {...f,value:v.value,exists:v.exists};});
 return {storage,status:'REGISTRY_LATER_STATE_RECONCILED',blockHash:anchor,index,address:m.address,transactionHash:row.transactionHash,transactionCommitmentVerified:true,receiptCommitmentVerified:true,signatureVerified:true,chainAuthenticated:false,accountCodeProofVerified:true,consensusVerified:false,finalityVerified:false};
}
const result=verify(e,selectedHash),controls=[];
for(const [name,mutate,anchor]of [
 ['wrong selected header',x=>{},'0x'+'11'.repeat(32)],
 ['changed signed transaction',x=>x.rawTransactions[0]='0x02c0'],
 ['missing transaction',x=>x.rawTransactions.pop()],
 ['changed receipt status',x=>x.receipts[0].status='0x0'],
 ['changed receipt logs',x=>x.receipts[0].logs=[]],
 ['wrong receipt index',x=>x.receipts[0].transactionIndex='0x1'],
 ['changed runtime',x=>x.code='0x00'],['wrong account',x=>x.accountProof.address='0x'+'22'.repeat(20)],['wrong code hash',x=>x.accountProof.codeHash='0x'+'11'.repeat(32)],['missing account proof',x=>x.accountProof.accountProof=[]],['changed owner value',x=>x.accountProof.storageProof[0].value='0x1'],['missing storage entry',x=>x.accountProof.storageProof.pop()],['duplicate storage entry',x=>x.accountProof.storageProof[1]=structuredClone(x.accountProof.storageProof[0])],['stale epoch claim',x=>x.accountProof.storageProof[4].value='0x0'],['revoked operator claim',x=>x.accountProof.storageProof[14].value='0x0'],['changed storage proof node',x=>x.accountProof.storageProof[0].proof[0]='0xc0']
]){const copy=structuredClone(e);mutate(copy);assert.throws(()=>verify(copy,anchor??selectedHash));controls.push(name);}
console.log(JSON.stringify({...result,controls,limits:'Synthetic header contains the retained Geth final state root. Account code and final withdrawal commitments verified under selected root; no public-chain anchor or finality. Sixteen final-state slots agree with pinned independently reconstructed history. Not all mapping keys, public chain authentication or finality.'},null,2));
