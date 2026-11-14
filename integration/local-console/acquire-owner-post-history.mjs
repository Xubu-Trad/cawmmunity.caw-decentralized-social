import assert from 'node:assert/strict';
import {POST_NONCE} from './verify-posting-history.mjs';
export const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const OWNER='0xabbb5caa7dda850e60932de0934eb1f9d0f59695050f761dc64e443e5030a569',EPOCH='0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7';
const mixedTransfer=(row,registry)=>row.rawTransactions.length>1&&row.receipts.some(r=>r?.logs?.some(l=>l.address===registry&&l.topics?.[0]===TRANSFER_TOPIC));
export const containsOwnerTransfer=(bundle,registry)=>bundle.blocks.some(row=>mixedTransfer(row,registry));

// Log-derived addresses are bounded acquisition hints, never accepted authority.
// verifyOwnerPostBlock authenticates every hint, call, log and state transition.
export async function acquireOwnerPostHistory(read,bundle,selection){
 let prior=bundle.anchor;
 for(const row of bundle.blocks){
  const h=row.header;assert.equal(h.parentHash,prior.hash,'OWNER_HISTORY_LINK');
  if(!mixedTransfer(row,selection.contracts.registry.address)){prior=h;continue;}
  const initialOwnerValue=row.parent.registry.storageProof.find(s=>s.key===OWNER)?.value;
  assert.match(initialOwnerValue,/^0x(?:0|[1-9a-f][0-9a-f]*)$/);assert(BigInt(initialOwnerValue)<2n**160n,'OWNER_RANGE');
  const initialOwner='0x'+BigInt(initialOwnerValue).toString(16).padStart(40,'0');
  const ownerProofs={[initialOwner]:row.parent.owner};const targets=new Set();
  for(const receipt of row.receipts)for(const log of receipt?.logs??[]){
   if(log.address!==selection.contracts.registry.address||log.topics?.[0]!==TRANSFER_TOPIC)continue;
   assert.equal(log.topics.length,4,'TRANSFER_HINT_TOPICS');
   assert.match(log.topics[2],/^0x0{24}[0-9a-f]{40}$/,'TRANSFER_HINT_RECIPIENT');
   assert.equal(BigInt(log.topics[3]),2n,'TRANSFER_HINT_ACCOUNT');
   targets.add('0x'+log.topics[2].slice(-40));assert(targets.size<=16,'TRANSFER_HINT_LIMIT');
  }
  for(const target of targets)if(!Object.hasOwn(ownerProofs,target))ownerProofs[target]=await read('eth_getProof',[target,[],{blockHash:prior.hash,requireCanonical:true}]);
  const at={blockHash:h.hash,requireCanonical:true};
  const finalRegistry=await read('eth_getProof',[selection.contracts.registry.address,[OWNER,EPOCH],at]);
  const finalPosting=await read('eth_getProof',[selection.contracts.posting.address,[POST_NONCE],at]);
  row.ownerTransition={ownerProofs,finalRegistry,finalPosting};
  prior=h;
 }
 return bundle;
}
