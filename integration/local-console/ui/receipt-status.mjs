import {verifyWalletProviderContext} from './wallet-provider.mjs';
import {transferData} from './account-transfer-plan.mjs';
import {postData,postText,POST_PROFILE,POST_EVENT_TOPIC} from './post-plan.mjs';

const hash=/^0x[0-9a-fA-F]{64}$/,address=/^0x[0-9a-fA-F]{40}$/;
const quantity=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/,bytes=/^0x(?:[0-9a-fA-F]{2})+$/;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const isQuantity=x=>typeof x==='string'&&quantity.test(x);
const equalQuantity=(a,b)=>isQuantity(a)&&isQuantity(b)&&BigInt(a)===BigInt(b);
const isNonce=x=>isQuantity(x)&&BigInt(x)<2n**64n;
function validSelection(txHash,plan,requireNonce=false){
 if(!hash.test(txHash)||!plan||!address.test(plan.from)||!address.test(plan.to)||!bytes.test(plan.data)||plan.value!=='0x0'||((requireNonce||Object.hasOwn(plan,'nonce'))&&!isNonce(plan.nonce)))throw Error('Invalid withdrawal receipt selection.');
 if(Object.hasOwn(plan,'action')){
  if(plan.action==='post'){
   if(!isNonce(plan.nonce)||![plan.owner,plan.posting].every(x=>address.test(x))||!same(plan.profile,POST_PROFILE)||Object.hasOwn(plan,'amount')||Object.hasOwn(plan,'recipient'))throw Error('Invalid post receipt selection.');
   const direct=same(plan.to,plan.posting),encoded=postText(plan.text);
   if((direct?!same(plan.from,plan.owner)||BigInt(plan.owner)<=0xffffn:!same(plan.to,plan.owner))||!same(plan.textHash,encoded.textHash)||!same(plan.data,postData(plan.posting,plan.epoch,plan.postNonce,plan.text,direct?'eoa':'fixture-wallet')))throw Error('Post receipt selection does not encode the reviewed text and account.');
   return;
  }
  if(plan.action!=='transfer'||!isNonce(plan.nonce)||![plan.owner,plan.registry,plan.recipient].every(x=>address.test(x))||BigInt(plan.recipient)<=0xffffn||same(plan.recipient,plan.owner)||Object.hasOwn(plan,'amount'))throw Error('Invalid transfer receipt selection.');
  const direct=same(plan.to,plan.registry);
  if((direct?!same(plan.from,plan.owner):!same(plan.to,plan.owner))||!same(plan.data,transferData(plan.registry,plan.owner,plan.recipient,direct?'eoa':'fixture-wallet')))throw Error('Transfer receipt selection does not encode the reviewed handoff.');
 }
}
const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const addressTopic=a=>'0x'+a.slice(2).toLowerCase().padStart(64,'0');
const ACCOUNT_TOPIC='0x'+('2'.padStart(64,'0'));
function verifyTransferEvent(receipt,plan){
 if(!Array.isArray(receipt.logs))throw Error('Transfer receipt is missing its registry event.');
 const transfers=receipt.logs.filter(log=>log&&same(log.address,plan.registry)&&Array.isArray(log.topics)&&same(log.topics[0],TRANSFER_TOPIC)&&same(log.topics[3],ACCOUNT_TOPIC));
 if(transfers.length!==1)throw Error('Transfer receipt must contain exactly one account 2 handoff.');
 const log=transfers[0];
 if(log.topics.length!==4||!same(log.topics[1],addressTopic(plan.owner))||!same(log.topics[2],addressTopic(plan.recipient))||log.data!=='0x'||log.removed===true||
    (log.transactionHash!==undefined&&!same(log.transactionHash,receipt.transactionHash))||(log.blockHash!==undefined&&!same(log.blockHash,receipt.blockHash))||(log.blockNumber!==undefined&&!equalQuantity(log.blockNumber,receipt.blockNumber)))throw Error('Registry transfer event does not match the reviewed handoff.');
}
const uintWord=n=>BigInt(n).toString(16).padStart(64,'0');
function verifyPostEvent(receipt,plan){
 if(!Array.isArray(receipt.logs))throw Error('Post receipt is missing its publication event.');
 const nonceTopic='0x'+uintWord(plan.postNonce);
 // Count all publishing-contract events at the selected nonce. A second event,
 // including one with a different account/epoch, must not establish success.
 const posts=receipt.logs.filter(log=>log&&same(log.address,plan.posting)&&Array.isArray(log.topics)&&same(log.topics[0],POST_EVENT_TOPIC)&&same(log.topics[3],nonceTopic));
 if(posts.length!==1)throw Error('Post receipt must contain exactly one publication at the selected nonce.');
 const log=posts[0],encoded=postText(plan.text);
 // Canonical ABI decoding by comparison with the independently encoded fields:
 // author, hash, bytes offset=96, byte length, exact bytes and zero padding.
 const expected='0x'+plan.owner.slice(2).toLowerCase().padStart(64,'0')+encoded.textHash.slice(2)+uintWord(96)+uintWord(encoded.byteLength)+encoded.bytesHex.slice(2).padEnd(Math.ceil(encoded.byteLength/32)*64,'0');
 if(log.topics.length!==4||!same(log.topics[1],ACCOUNT_TOPIC)||!same(log.topics[2],'0x'+uintWord(plan.epoch))||!same(log.data,expected)||log.removed===true||
    (log.transactionHash!==undefined&&!same(log.transactionHash,receipt.transactionHash))||(log.blockHash!==undefined&&!same(log.blockHash,receipt.blockHash))||(log.blockNumber!==undefined&&!equalQuantity(log.blockNumber,receipt.blockNumber)))throw Error('Publication event does not match the reviewed author, text and nonce.');
}
function matchesTransaction(transaction,txHash,plan){
 return transaction&&typeof transaction==='object'&&same(transaction.hash,txHash)&&same(transaction.from,plan.from)&&same(transaction.to,plan.to)&&same(transaction.input,plan.data)&&equalQuantity(transaction.value,plan.value)&&(transaction.chainId===undefined||equalQuantity(transaction.chainId,plan.chainId))&&(!Object.hasOwn(plan,'nonce')||(isNonce(transaction.nonce)&&equalQuantity(transaction.nonce,plan.nonce)));
}

// An explicitly supplied hash may recover the submitted transaction identity.
// This matches the recorded request only; it does not establish execution.
export async function verifyRecoveryTransaction(provider,txHash,plan){
 validSelection(txHash,plan,true);
 await verifyWalletProviderContext(provider,plan);
 const transaction=await provider.request({method:'eth_getTransactionByHash',params:[txHash]});
 if(!matchesTransaction(transaction,txHash,plan))throw Error('Recovery transaction does not match the reviewed withdrawal and nonce.');
 await verifyWalletProviderContext(provider,plan);
 return {status:'matched',transactionHash:txHash};
}

// This checks the selected local RPC's coherent view, not public-chain finality
// or cryptographic receipt inclusion. The provider and its RPC remain trusted.
export async function verifyWithdrawalReceipt(provider,txHash,plan){
 validSelection(txHash,plan);
 await verifyWalletProviderContext(provider,plan);
 const receipt=await provider.request({method:'eth_getTransactionReceipt',params:[txHash]});
 if(receipt===null)return {status:'pending',blockNumber:null,blockHash:null};
 if(!receipt||typeof receipt!=='object'||!same(receipt.transactionHash,txHash)||!same(receipt.from,plan.from)||!same(receipt.to,plan.to)||!['0x0','0x1'].includes(receipt.status)||!isQuantity(receipt.blockNumber)||!hash.test(receipt.blockHash)||BigInt(receipt.blockNumber)<BigInt(plan.blockNumber))throw Error('Malformed or mismatched withdrawal receipt.');
 const transaction=await provider.request({method:'eth_getTransactionByHash',params:[txHash]});
 if(!matchesTransaction(transaction,txHash,plan)||!same(transaction.blockHash,receipt.blockHash)||!equalQuantity(transaction.blockNumber,receipt.blockNumber))throw Error('Mined transaction does not match the reviewed withdrawal.');
 await verifyWalletProviderContext(provider,plan);
 const block=await provider.request({method:'eth_getBlockByNumber',params:[receipt.blockNumber,false]});
 if(!block||!same(block.hash,receipt.blockHash)||!equalQuantity(block.number,receipt.blockNumber))throw Error('Withdrawal receipt is not in the selected canonical local block.');
 if(plan.action==='transfer'&&receipt.status==='0x1')verifyTransferEvent(receipt,plan);
 if(plan.action==='post'&&receipt.status==='0x1')verifyPostEvent(receipt,plan);
 return {status:receipt.status==='0x1'?'confirmed':'reverted',blockNumber:receipt.blockNumber,blockHash:receipt.blockHash};
}
export async function verifyTransferReceipt(provider,txHash,plan){
 if(plan?.action!=='transfer')throw Error('An account transfer plan is required.');
 return verifyWithdrawalReceipt(provider,txHash,plan);
}
export async function verifyPostReceipt(provider,txHash,plan){
 if(plan?.action!=='post')throw Error('A post plan is required.');
 return verifyWithdrawalReceipt(provider,txHash,plan);
}
