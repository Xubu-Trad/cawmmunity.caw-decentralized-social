import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Transaction} from 'ethers';
import {verifyOwnerPostBlock,reconstructOwnerPostSequence} from './post-authority-sequence.mjs';
import {verifyPostingHistory} from './verify-posting-history.mjs';
const {ownerBundle:b,selection:s,before,result:expected}=JSON.parse(fs.readFileSync(process.argv[2]));
assert.deepEqual(verifyOwnerPostBlock(b,s),expected);let count=1;
const EPOCH='0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7';
for(const [name,mutate] of [
 ['reversed raw',b=>b.rawTransactions.reverse()],['missing receipt',b=>b.receipts.pop()],
 ['false status',b=>b.receipts[0].status='0x0'],['corrupt initial registry',b=>b.initialRegistry.accountProof[0]='0xc0'],
 ['corrupt final registry',b=>b.finalRegistry.accountProof[0]='0xc0'],
 ['false final epoch',b=>b.finalRegistry.storageProof.find(x=>x.key===EPOCH).value='0x1'],
 ['missing recipient proof',b=>delete b.ownerProofs[s.controller]],
 ['false final nonce',b=>b.finalPosting.storageProof[0].value='0x2']
]){const c=structuredClone(b);mutate(c);assert.throws(()=>verifyOwnerPostBlock(c,s),undefined,name);count++;}
const txs=b.rawTransactions.map(raw=>{const t=Transaction.from(raw);return {from:t.from.toLowerCase(),to:t.to.toLowerCase(),data:t.data,value:String(t.value),hash:t.hash};});
const initial={owner:before.owner,epoch:before.epoch,nonce:before.nonce};
for(const [name,mutate,error] of [
 ['stale signer',(t,r)=>t[1].from=s.contracts.wallet.address,'CURRENT_OWNER_SIGNER'],
 ['stale epoch',(t,r)=>r[1].logs[0].topics[2]='0x'+BigInt(before.epoch).toString(16).padStart(64,'0'),'CURRENT_EPOCH'],
 ['nonzero value',(t,r)=>t[1].value='1','ZERO_VALUE'],
 ['delegate unsupported',(t,r)=>t[0].from='0x'+'11'.repeat(20),'CURRENT_OWNER_SIGNER'],
 ['unknown action',(t,r)=>r[0].logs.push(r[0].logs[0]),'SUPPORTED_ACTION_ONLY'],
 ['reverted transfer',(t,r)=>r[0].status='0x0','SUCCESS_ONLY']
]){const t=structuredClone(txs),r=structuredClone(b.receipts);mutate(t,r);assert.throws(()=>reconstructOwnerPostSequence(t,r,initial,s,()=>{}),e=>e.message.includes(error),name);count++;}
// The current console's existing reader has NOT been widened by this module.
const old={schema:'local-posting-history/1',anchor:b.parent,blocks:[{header:b.header,rawTransactions:b.rawTransactions,receipts:b.receipts,parent:{registry:b.initialRegistry,posting:b.initialPosting,owner:b.ownerProofs[before.owner]}}],finalPosting:b.finalPosting};
assert.throws(()=>verifyPostingHistory(old,s),e=>e.message.includes('POST_ONLY_BATCH_REQUIRED'));count++;
console.log(JSON.stringify({checks:count,positive:1,proofControls:8,semanticControls:6,existingConsoleStillRejectsMixedBlocks:true}));
