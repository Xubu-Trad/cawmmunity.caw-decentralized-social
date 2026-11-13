import {verifyWalletProviderContext} from './wallet-provider.mjs';

const hash=/^0x[0-9a-fA-F]{64}$/,address=/^0x[0-9a-fA-F]{40}$/;
const quantity=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/,bytes=/^0x(?:[0-9a-fA-F]{2})+$/;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const isQuantity=x=>typeof x==='string'&&quantity.test(x);
const equalQuantity=(a,b)=>isQuantity(a)&&isQuantity(b)&&BigInt(a)===BigInt(b);

// This checks the selected local RPC's coherent view, not public-chain finality
// or cryptographic receipt inclusion. The provider and its RPC remain trusted.
export async function verifyWithdrawalReceipt(provider,txHash,plan){
 if(!hash.test(txHash)||!plan||!address.test(plan.from)||!address.test(plan.to)||!bytes.test(plan.data)||plan.value!=='0x0')throw Error('Invalid withdrawal receipt selection.');
 await verifyWalletProviderContext(provider,plan);
 const receipt=await provider.request({method:'eth_getTransactionReceipt',params:[txHash]});
 if(receipt===null)return {status:'pending',blockNumber:null,blockHash:null};
 if(!receipt||typeof receipt!=='object'||!same(receipt.transactionHash,txHash)||!same(receipt.from,plan.from)||!same(receipt.to,plan.to)||!['0x0','0x1'].includes(receipt.status)||!isQuantity(receipt.blockNumber)||!hash.test(receipt.blockHash)||BigInt(receipt.blockNumber)<BigInt(plan.blockNumber))throw Error('Malformed or mismatched withdrawal receipt.');
 const transaction=await provider.request({method:'eth_getTransactionByHash',params:[txHash]});
 if(!transaction||typeof transaction!=='object'||!same(transaction.hash,txHash)||!same(transaction.from,plan.from)||!same(transaction.to,plan.to)||!same(transaction.input,plan.data)||!equalQuantity(transaction.value,plan.value)||!same(transaction.blockHash,receipt.blockHash)||!equalQuantity(transaction.blockNumber,receipt.blockNumber)||(transaction.chainId!==undefined&&!equalQuantity(transaction.chainId,plan.chainId)))throw Error('Mined transaction does not match the reviewed withdrawal.');
 await verifyWalletProviderContext(provider,plan);
 const block=await provider.request({method:'eth_getBlockByNumber',params:[receipt.blockNumber,false]});
 if(!block||!same(block.hash,receipt.blockHash)||!equalQuantity(block.number,receipt.blockNumber))throw Error('Withdrawal receipt is not in the selected canonical local block.');
 return {status:receipt.status==='0x1'?'confirmed':'reverted',blockNumber:receipt.blockNumber,blockHash:receipt.blockHash};
}
