import {verifyOwnerPostBlock} from './post-authority-sequence.mjs';
import assert from 'node:assert/strict';import {Interface,keccak256,AbiCoder} from 'ethers';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
import {inspectExecutionHeader} from '../../reference/ethereum-execution-header.mjs';
import {postText,postData,POST_EVENT_TOPIC} from './ui/post-plan.mjs';
import {requirePostBlockSize,requirePostOnlyBatch} from './post-block-scope.mjs';
const OWNER='0xabbb5caa7dda850e60932de0934eb1f9d0f59695050f761dc64e443e5030a569',EPOCH='0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7';
export const POST_NONCE=keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','uint256'],[2,0]));
const abi=new Interface(['event LocalPostPublished(uint256 indexed accountId,uint256 indexed epoch,uint256 indexed nonce,address author,bytes32 textHash,bytes text)']);
const empty=keccak256('0x');const low=x=>x.toLowerCase();
export function verifyPostingHistory(bundle,selection){
 for(const k of ['startHash','endHash'])assert.match(selection[k],/^0x[0-9a-f]{64}$/);
 assert.match(selection.controller,/^0x[0-9a-f]{40}$/);
 for(const k of ['registry','posting','wallet']){assert.match(selection.contracts[k].address,/^0x[0-9a-f]{40}$/);assert.match(selection.contracts[k].codeHash,/^0x[0-9a-f]{64}$/);}
 assert.equal(bundle.schema,'local-posting-history/1');assert(bundle.blocks.length>0&&bundle.blocks.length<=128);assert.equal(bundle.anchor.hash,selection.startHash);assert.equal(bundle.blocks.at(-1).header.hash,selection.endHash);
 const header=h=>inspectExecutionHeader(h,{schema:'caw-execution-header-selection/1',profile:'shanghai-17',hash:h.hash});header(bundle.anchor);
 const proof=(h,p,address,keys,codeHash)=>{const r=inspectHeaderBoundStateProof(JSON.stringify({header:h,proof:p}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'shanghai-17',hash:h.hash,address,storageKeys:keys}));if(codeHash)assert.equal(r.proof.codeHash,codeHash);return r.proof;};
 const val=(p,k)=>{const v=p.storage.find(x=>x.key===k);assert(v);return BigInt(v.value);};
 let prior=bundle.anchor,nonce=0n;const posts=[],transfers=[];let usedOwnership=false;
 for(const row of bundle.blocks){
  const h=row.header;header(h);assert.equal(h.parentHash,prior.hash);assert.equal(BigInt(h.number),BigInt(prior.number)+1n);requirePostBlockSize(row.rawTransactions);
  const reg=proof(prior,row.parent.registry,selection.contracts.registry.address,[OWNER,EPOCH],selection.contracts.registry.codeHash);
  const post=proof(prior,row.parent.posting,selection.contracts.posting.address,[POST_NONCE],selection.contracts.posting.codeHash);assert.equal(val(post,POST_NONCE),nonce,'POST_NONCE_HISTORY');
  const checked=inspectBlockTransactionReceipts(h,row.rawTransactions,row.receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:h.hash});
  const signed=inspectBlockSenders(h,row.rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:h.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});
  if(row.ownerTransition){
   assert(row.rawTransactions.length>1,'OWNER_TRANSITION_BLOCK_SCOPE');
   const result=verifyOwnerPostBlock({schema:'local-owner-post-block/1',parent:prior,header:h,rawTransactions:row.rawTransactions,receipts:row.receipts,initialRegistry:row.parent.registry,initialPosting:row.parent.posting,ownerProofs:row.ownerTransition.ownerProofs,finalRegistry:row.ownerTransition.finalRegistry,finalPosting:row.ownerTransition.finalPosting},{...selection,startHash:prior.hash,endHash:h.hash,expectedNonce:String(nonce)});
   assert(result.transfers.length>0,'OWNER_TRANSITION_REQUIRED');
   for(const p of result.posts)posts.push({...p,accountId:'2',signer:p.author===selection.contracts.wallet.address?selection.controller:p.author,textHash:postText(p.text).textHash,blockHash:h.hash,blockNumber:h.number});
   transfers.push(...result.transfers.map(x=>({...x,blockHash:h.hash,blockNumber:h.number})));
   nonce=BigInt(result.nonce);usedOwnership=true;prior=h;continue;
  }
  requirePostOnlyBatch(checked.receipts,selection.contracts.posting.address,POST_EVENT_TOPIC);
  const owner='0x'+val(reg,OWNER).toString(16).padStart(40,'0');const epoch=val(reg,EPOCH);
  for(let i=0;i<checked.receipts.length;i++)for(const log of checked.receipts[i].logs){
   if(log.address!==selection.contracts.posting.address)continue;
   assert.equal(log.topics[0],POST_EVENT_TOPIC);assert.equal(checked.receipts[i].status,'0x1');
   const args=abi.parseLog(log).args;assert.equal(args.accountId,2n);assert.equal(args.epoch,epoch,'POST_EPOCH');assert.equal(args.nonce,nonce,'POST_NONCE');assert.equal(low(args.author),owner);
   const canonical=abi.encodeEventLog(abi.getEvent('LocalPostPublished'),Array.from(args));assert.deepEqual(log.topics,canonical.topics);assert.equal(log.data,canonical.data);
   const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(args.text.slice(2),'hex'));assert.equal(postText(text).textHash,args.textHash);
   const tx=signed.transactions[i],wallet=owner===selection.contracts.wallet.address;
   if(wallet){proof(prior,row.parent.owner,owner,[],selection.contracts.wallet.codeHash);assert.equal(tx.from,selection.controller,'POST_SIGNER');}
   else{proof(prior,row.parent.owner,owner,[],empty);assert.equal(tx.from,owner,'POST_SIGNER');}
   assert.equal(tx.to,wallet?owner:selection.contracts.posting.address,'POST_TARGET');assert.equal(BigInt(tx.value),0n);
   assert.equal(tx.data,postData(selection.contracts.posting.address,String(epoch),String(nonce),text,wallet?'fixture-wallet':'eoa'),'POST_CALLDATA');
   posts.push({accountId:'2',epoch:String(epoch),nonce:String(nonce),author:owner,signer:tx.from,text,textHash:args.textHash,transactionHash:tx.hash,blockHash:h.hash,blockNumber:h.number});nonce++;
  }
  prior=h;
 }
 const final=proof(prior,bundle.finalPosting,selection.contracts.posting.address,[POST_NONCE],selection.contracts.posting.codeHash);assert.equal(val(final,POST_NONCE),nonce);
 return {posts,...(usedOwnership?{transfers,intraBlockOwnershipVerified:true}:{}),blocks:bundle.blocks.length,transactionAndReceiptCommitmentsVerified:true,signaturesVerified:true,parentOwnershipProofsVerified:true,postNonceComplete:true,selectedEndpointsTrusted:true,publicChainAuthenticated:false,consensusVerified:false,executionReplayed:false};
}
