import {inspectHeaderBoundCode} from '../../reference/header-bound-state-proof.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {getCreateAddress,Transaction} from 'ethers';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
const [manifestPath,manifestDigest,evidencePath,selectedHash]=process.argv.slice(2);
const b=fs.readFileSync(manifestPath);assert.equal(createHash('sha256').update(b).digest('hex'),manifestDigest,'MANIFEST');const m=JSON.parse(b),e=JSON.parse(fs.readFileSync(evidencePath));
function verify(e,anchor){
 assert(/^0x[0-9a-f]{64}$/.test(anchor),'ANCHOR_REQUIRED');
 const joined=inspectBlockTransactionReceipts(e.header,e.rawTransactions,e.receipts,{schema:'caw-block-transactions-selection/1',profile:'london-16',hash:anchor});
 const senders=inspectBlockSenders(e.header,e.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'london-16',hash:anchor,chainId:"0x"+BigInt(m.chainId).toString(16),allowUnprotectedLegacy:false});
 const index=joined.associations.findIndex(a=>a.transactionHash===m.deploymentHash);assert(index>=0,'SELECTED_DEPLOYMENT_MISSING');
 const row=joined.associations[index],sender=senders.transactions[index],receipt=joined.receipts[index];
 assert.equal(row.transactionHash,sender.hash);assert.equal(row.transactionEncoded,sender.encoded);assert.equal(sender.to,'0x','NOT_CREATE');assert.equal(sender.from.toLowerCase(),m.deployer.toLowerCase());assert.equal(receipt.status,'0x1','DEPLOYMENT_FAILED');
 const tx=Transaction.from(row.transactionEncoded);assert.equal(tx.nonce,m.deploymentNonce);assert.equal(getCreateAddress({from:sender.from,nonce:tx.nonce}).toLowerCase(),m.address.toLowerCase(),'CREATE_ADDRESS');
 const proof=inspectHeaderBoundCode(JSON.stringify({header:e.header,proof:e.accountProof,code:e.code}),JSON.stringify({schema:'caw-header-code-selection/1',profile:'london-16',hash:anchor,address:m.address.toLowerCase(),storageKeys:[],expectedCodeHash:m.runtimeHash}));assert(proof.codeMatchesSelectedState&&proof.state.selectedHeaderBindingVerified);
 return {status:'DEPLOYMENT_AND_CODE_BOUND_TO_SELECTED_HEADER',blockHash:anchor,index,address:m.address,transactionHash:row.transactionHash,transactionCommitmentVerified:true,receiptCommitmentVerified:true,signatureVerified:true,chainAuthenticated:false,accountCodeProofVerified:true,consensusVerified:false,finalityVerified:false};
}
const result=verify(e,selectedHash),controls=[];
for(const [name,mutate,anchor]of [
 ['wrong selected header',x=>{},'0x'+'11'.repeat(32)],
 ['changed signed transaction',x=>x.rawTransactions[1]=x.rawTransactions[0]],
 ['missing transaction',x=>x.rawTransactions.pop()],
 ['changed receipt status',x=>x.receipts[1].status='0x0'],
 ['changed receipt logs',x=>x.receipts[1].logs=[]],
 ['wrong receipt index',x=>x.receipts[1].transactionIndex='0x0'],
 ['changed runtime',x=>x.code='0x00'],['wrong account',x=>x.accountProof.address='0x'+'22'.repeat(20)],['wrong code hash',x=>x.accountProof.codeHash='0x'+'11'.repeat(32)],['missing account proof',x=>x.accountProof.accountProof=[]]
]){const copy=structuredClone(e);mutate(copy);assert.throws(()=>verify(copy,anchor??selectedHash));controls.push(name);}
console.log(JSON.stringify({...result,controls,limits:'Synthetic header contains the retained Geth post-deployment state root. Account code and deployment commitments verified under selected root; no public-chain anchor or finality. No storage slots or ownership state authenticated by this account-only proof.'},null,2));
