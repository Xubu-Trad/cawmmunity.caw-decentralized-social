import fs from 'node:fs';
import assert from 'node:assert/strict';
import {MerklePatriciaTrie,verifyMPTWithMerkleProof} from '@ethereumjs/mpt';
import {MerkleStateManager,getMerkleStateProof} from '@ethereumjs/statemanager';
import {RLP} from '@ethereumjs/rlp';
import {Account,createAddressFromString} from '@ethereumjs/util';
import {Transaction} from 'ethers';
import {inspectEthereumStateProof} from '../../reference/ethereum-state-proof.mjs';
import {inspectBlockTransactions} from '../../reference/ethereum-block-transactions.mjs';
const c=JSON.parse(fs.readFileSync(process.argv[2])),expected=JSON.parse(fs.readFileSync(process.argv[3]));
const bytes=h=>Uint8Array.from(Buffer.from(h.slice(2),'hex')),hex=b=>'0x'+Buffer.from(b).toString('hex'),slot=h=>bytes('0x'+BigInt(h).toString(16).padStart(64,'0'));
const trie=new MerklePatriciaTrie({useKeyHashing:true});
const account=await verifyMPTWithMerkleProof(trie,bytes(c.blocks.at(-1).block.stateRoot),bytes(c.proof.address),c.proof.accountProof.map(bytes));
assert(account);const decoded=RLP.decode(account);assert.equal(hex(decoded[2]),c.proof.storageHash);
const field=expected.storage.find(x=>x.label==='approved2'),p=c.proof.storageProof.find(x=>BigInt(x.key)===BigInt(field.key));assert(p);
const value=await verifyMPTWithMerkleProof(trie,decoded[2],slot(p.key),p.proof.map(bytes));assert.equal(hex(value),'0x80');assert.equal(BigInt(p.value),0n);assert.equal(field.expected,'0');
function strict(proof,root,address,key){return inspectEthereumStateProof(proof,{stateRoot:root,address,storageKeys:[hex(slot(key))]});}
assert.throws(()=>strict({...c.proof,storageProof:[p]},c.blocks.at(-1).block.stateRoot,c.proof.address,p.key),e=>e.code==='ETH_PROOF_STORAGE');
const controls=[];await assert.rejects(()=>verifyMPTWithMerkleProof(trie,new Uint8Array(32),slot(p.key),p.proof.map(bytes)));controls.push('wrong storage root rejects');
const changed=p.proof.map(bytes);changed[0][changed[0].length-1]^=1;await assert.rejects(()=>verifyMPTWithMerkleProof(trie,decoded[2],slot(p.key),changed));controls.push('changed proof node rejects');
const sm=new MerkleStateManager(),address=createAddressFromString('0x'+'11'.repeat(20)),key=slot(7);await sm.putAccount(address,new Account(1n,0n));await sm.putStorage(address,slot(8),new Uint8Array([2]));
async function state(wanted,exists){const root=hex(await sm.getStateRoot()),proof=await getMerkleStateProof(sm,address,[key]);proof.storageProof=proof.storageProof.map(x=>({...x,value:'0x'+BigInt(x.value).toString(16)}));const out=strict(proof,root,address.toString(),7);assert.equal(BigInt(out.storage[0].value),wanted);assert.equal(out.storage[0].exists,exists);return root;}
const initial=await state(0n,false);await sm.putStorage(address,key,new Uint8Array([1]));await state(1n,true);await sm.putStorage(address,key,new Uint8Array(32));assert.equal(await state(0n,false),initial);controls.push('canonical unwritten/nonzero/cleared storage and root restoration pass');
const transactions=[];
for(const index of [6,10]){
 const b=c.blocks[index+1],raw=b.rawTransactions[0],tx=Transaction.from(raw);assert(tx.signature&&tx.from);assert.equal(tx.from.toLowerCase(),'0x1eff47bc3a10a45d4b230b5d10e37751fe6aa718');assert.equal(tx.chainId,31337n);assert.equal(tx.serialized,raw);
 const t=new MerklePatriciaTrie();await t.put(RLP.encode(new Uint8Array()),bytes(raw));assert.equal(hex(t.root()),b.block.transactionsRoot);
 const altered=bytes(raw);altered[altered.length-1]^=1;const bad=new MerklePatriciaTrie();await bad.put(RLP.encode(new Uint8Array()),altered);assert.notEqual(hex(bad.root()),b.block.transactionsRoot);
 assert.throws(()=>inspectBlockTransactions(b.block,[raw],{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:b.block.hash}),e=>e.code==='BLOCK_TRANSACTIONS_TRANSACTION_ENCODED_LIMIT');
 transactions.push({index,encodedBytes:bytes(raw).length,dataBytes:bytes(tx.data).length,type:tx.type,from:tx.from,to:tx.to,independentTransactionRootMatches:true,signatureRecovered:true,encodedLimit:32768,dataLimit:24576});
}
const boundary=[];for(const size of [32767,32768,32769]){const b=c.blocks[1].block;let code;try{inspectBlockTransactions(b,['0x'+'00'.repeat(size)],{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:b.hash});assert.fail('malformed envelope accepted');}catch(e){code=e.code;assert(code);}assert.equal(code==='BLOCK_TRANSACTIONS_TRANSACTION_ENCODED_LIMIT',size>32768);boundary.push({size,code});}
const dataBoundary=[];for(const size of [24575,24576,24577]){const b=c.blocks[7].block,tx=Transaction.from(c.blocks[7].rawTransactions[0]);tx.data='0x'+'01'.repeat(size);let code;try{inspectBlockTransactions(b,[tx.serialized],{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:b.hash});assert.fail('changed bytes accepted');}catch(e){code=e.code;assert(code);}dataBoundary.push({size,code});}
assert.equal(dataBoundary[0].code,'BLOCK_TRANSACTIONS_ROOT_MISMATCH');assert.equal(dataBoundary[1].code,'BLOCK_TRANSACTIONS_ROOT_MISMATCH');assert.notEqual(dataBoundary[2].code,'BLOCK_TRANSACTIONS_ROOT_MISMATCH');
console.log(JSON.stringify({schema:'caw-contiguous-rejection-diagnosis/1',storage:{label:field.label,key:field.key,independentLeafValue:hex(value),canonicalZeroRequiresAbsence:true,strictRejectionPreserved:true},transactions,boundary,dataBoundary,controls,readerChanged:false,captureRepaired:false,completeHistoryVerified:false,chainAuthenticated:false,limits:'Independent library checks diagnose rejected input; they do not promote the bounded CAW reader result or prove consensus/finality. Boundary payloads are deliberately altered and not valid signed executions.'},null,2));
