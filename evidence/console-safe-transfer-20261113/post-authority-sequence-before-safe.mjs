import assert from 'node:assert/strict';
import {Interface,keccak256,AbiCoder} from 'ethers';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
import {inspectExecutionHeader} from '../../reference/ethereum-execution-header.mjs';
import {postData,postText} from './ui/post-plan.mjs';
import {requirePostBlockSize} from './post-block-scope.mjs';
const OWNER='0xabbb5caa7dda850e60932de0934eb1f9d0f59695050f761dc64e443e5030a569',EPOCH='0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7';
const NONCE=keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','uint256'],[2,0]));
const ZERO='0x'+'00'.repeat(20),EMPTY=keccak256('0x'),MAX=(1n<<256n)-1n;
const abi=new Interface(['function transferFrom(address,address,uint256)','function execute(address,bytes)','event Approval(address indexed owner,address indexed approved,uint256 indexed tokenId)','event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)','event LocalPostPublished(uint256 indexed accountId,uint256 indexed epoch,uint256 indexed nonce,address author,bytes32 textHash,bytes text)']);
const low=x=>x.toLowerCase();
const event=(address,name,args)=>({address,...abi.encodeEventLog(abi.getEvent(name),args)});

// Semantic reducer only. Call the proof-verifying entry point below for evidence.
// No approved-operator transfer, arbitrary wallet, reverts or unknown calls.
export function reconstructOwnerPostSequence(transactions,receipts,start,selection,checkOwner){
 assert.equal(transactions.length,receipts.length,'SEQUENCE_COUNT');
 requirePostBlockSize(transactions);assert(transactions.length>0,'EMPTY_SEQUENCE');
 let owner=start.owner,epoch=BigInt(start.epoch),nonce=BigInt(start.nonce);const posts=[],transfers=[];
 assert(epoch>=0n&&epoch<=MAX&&nonce>=0n&&nonce<=MAX,'STATE_RANGE');
 for(let i=0;i<transactions.length;i++){
  const tx=transactions[i],r=receipts[i];assert.equal(r.status,'0x1','SUCCESS_ONLY');assert.equal(BigInt(tx.value),0n,'ZERO_VALUE');
  checkOwner(owner);
  const wallet=owner===selection.contracts.wallet.address;
  assert.equal(tx.from,wallet?selection.controller:owner,'CURRENT_OWNER_SIGNER');
  const logs=r.logs.map(({address,topics,data})=>({address,topics,data}));
  if(logs.length===2&&logs.every(l=>l.address===selection.contracts.registry.address)){
   const moved=abi.parseLog(logs[1]);assert.equal(moved.name,'Transfer','TRANSFER_EVENT');
   const [from,to,id]=moved.args;const next=low(to);
   assert.equal(low(from),owner,'TRANSFER_FROM');assert.equal(id,2n,'ACCOUNT_ID');assert(next!==ZERO,'ZERO_RECIPIENT');
   checkOwner(next);assert(epoch<MAX,'EPOCH_OVERFLOW');
   assert.deepEqual(logs,[event(selection.contracts.registry.address,'Approval',[owner,ZERO,2]),event(selection.contracts.registry.address,'Transfer',[owner,next,2])],'TRANSFER_LOGS');
   const inner=abi.encodeFunctionData('transferFrom',[owner,next,2]);
   assert.equal(tx.to,wallet?owner:selection.contracts.registry.address,'TRANSFER_TARGET');
   assert.equal(tx.data,wallet?abi.encodeFunctionData('execute',[selection.contracts.registry.address,inner]):inner,'TRANSFER_CALLDATA');
   transfers.push({transactionIndex:i,from:owner,to:next,priorEpoch:String(epoch),epoch:String(epoch+1n)});owner=next;epoch++;
  }else{
   assert.equal(logs.length,1,'SUPPORTED_ACTION_ONLY');assert.equal(logs[0].address,selection.contracts.posting.address,'POST_ADDRESS');
   const parsed=abi.parseLog(logs[0]);assert.equal(parsed.name,'LocalPostPublished','POST_EVENT');const a=parsed.args;
   assert.equal(a.accountId,2n,'ACCOUNT_ID');assert.equal(a.epoch,epoch,'CURRENT_EPOCH');assert.equal(a.nonce,nonce,'POST_NONCE');assert.equal(low(a.author),owner,'CURRENT_AUTHOR');
   assert.deepEqual(logs,[event(selection.contracts.posting.address,'LocalPostPublished',Array.from(a))],'POST_LOGS');
   const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.from(a.text.slice(2),'hex'));assert.equal(postText(text).textHash,a.textHash,'TEXT_HASH');
   assert.equal(tx.to,wallet?owner:selection.contracts.posting.address,'POST_TARGET');assert.equal(tx.data,postData(selection.contracts.posting.address,String(epoch),String(nonce),text,wallet?'fixture-wallet':'eoa'),'POST_CALLDATA');
   assert(nonce<MAX,'NONCE_OVERFLOW');posts.push({transactionIndex:i,author:owner,epoch:String(epoch),nonce:String(nonce),text,transactionHash:tx.hash});nonce++;
  }
 }
 return {owner,epoch:String(epoch),nonce:String(nonce),posts,transfers};
}

// Proof-verifying entry point used by the console for supported mixed owner/post blocks.
export function verifyOwnerPostBlock(bundle,selection){
 assert.equal(bundle.schema,'local-owner-post-block/1');
 const {parent,header,rawTransactions,receipts}=bundle;
 for(const k of ['startHash','endHash'])assert.match(selection[k],/^0x[0-9a-f]{64}$/);
 assert.match(selection.controller,/^0x[0-9a-f]{40}$/);
 for(const k of ['registry','posting','wallet']){assert.match(selection.contracts[k].address,/^0x[0-9a-f]{40}$/);assert.match(selection.contracts[k].codeHash,/^0x[0-9a-f]{64}$/);}
 assert.equal(parent.hash,selection.startHash);assert.equal(header.hash,selection.endHash);
 for(const h of [parent,header])inspectExecutionHeader(h,{schema:'caw-execution-header-selection/1',profile:'shanghai-17',hash:h.hash});
 assert.equal(header.parentHash,parent.hash);assert.equal(BigInt(header.number),BigInt(parent.number)+1n);
 requirePostBlockSize(rawTransactions);
 const proof=(h,p,address,keys,codeHash)=>{const r=inspectHeaderBoundStateProof(JSON.stringify({header:h,proof:p}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'shanghai-17',hash:h.hash,address,storageKeys:keys})).proof;assert.equal(r.codeHash,codeHash,'CODE_HASH');return r;};
 const value=(p,k)=>{const field=p.storage.find(s=>s.key===k);assert(field,'MISSING_SLOT');return BigInt(field.value);};
 const registry=(h,p)=>proof(h,p,selection.contracts.registry.address,[OWNER,EPOCH],selection.contracts.registry.codeHash);
 const posting=(h,p)=>proof(h,p,selection.contracts.posting.address,[NONCE],selection.contracts.posting.codeHash);
 const initial=registry(parent,bundle.initialRegistry),initialPost=posting(parent,bundle.initialPosting);
 const owner='0x'+value(initial,OWNER).toString(16).padStart(40,'0');assert(owner.length===42,'OWNER_RANGE');
 const checked=inspectBlockTransactionReceipts(header,rawTransactions,receipts,{schema:'caw-block-transactions-selection/1',profile:'shanghai-17',hash:header.hash});
 const signed=inspectBlockSenders(header,rawTransactions,{schema:'caw-block-senders-selection/1',profile:'shanghai-17',hash:header.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});
 const checkOwner=a=>{assert.match(a,/^0x[0-9a-f]{40}$/);assert(BigInt(a)>0xffffn,'UNSUPPORTED_OWNER');assert(!['registry','posting'].some(k=>selection.contracts[k].address===a),'UNSUPPORTED_OWNER');proof(parent,bundle.ownerProofs[a],a,[],a===selection.contracts.wallet.address?selection.contracts.wallet.codeHash:EMPTY);};
 const initialNonce=value(initialPost,NONCE);
 if(selection.expectedNonce!==undefined)assert.equal(initialNonce,BigInt(selection.expectedNonce),'INITIAL_HISTORY_NONCE');
 const result=reconstructOwnerPostSequence(signed.transactions,checked.receipts,{owner,epoch:value(initial,EPOCH),nonce:initialNonce},selection,checkOwner);
 const final=registry(header,bundle.finalRegistry),finalPost=posting(header,bundle.finalPosting);
 assert.equal(value(final,OWNER),BigInt(result.owner),'FINAL_OWNER');assert.equal(value(final,EPOCH),BigInt(result.epoch),'FINAL_EPOCH');assert.equal(value(finalPost,NONCE),BigInt(result.nonce),'FINAL_NONCE');
 return {...result,transactionAndReceiptCommitmentsVerified:true,signaturesVerified:true,boundaryStateProofsVerified:true,selectedCodeAndControllerTrusted:true,publicChainAuthenticated:false,executionReplayed:false};
}
