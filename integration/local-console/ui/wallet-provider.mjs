const hash=/^0x[0-9a-fA-F]{64}$/,address=/^0x[0-9a-fA-F]{40}$/,quantity=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
// Verifies the injected wallet sees the server-selected local chain history.
// The injected provider and its underlying RPC are still explicitly trusted.
export async function verifyWalletProviderContext(provider,plan){
 if(!provider?.request||plan?.chainId!=='0x7a69'||!address.test(plan.from)||!hash.test(plan.genesisHash)||!hash.test(plan.blockHash)||!quantity.test(plan.blockNumber))throw Error('Invalid local chain selection. Refresh and prepare again.');
 async function identity(){const chain=await provider.request({method:'eth_chainId'});if(chain!==plan.chainId)throw Error('Wallet network changed. Select local chain 31337 and prepare again.');const accounts=await provider.request({method:'eth_accounts'});if(!Array.isArray(accounts)||!same(accounts[0],plan.from))throw Error('Wallet account changed. Reconnect and prepare again.');}
 await identity();
 const genesis=await provider.request({method:'eth_getBlockByNumber',params:['0x0',false]});if(!same(genesis?.hash,plan.genesisHash))throw Error('Your wallet is connected to a different local chain. Check its RPC connection.');
 const selected=await provider.request({method:'eth_getBlockByNumber',params:[plan.blockNumber,false]});if(!same(selected?.hash,plan.blockHash))throw Error('Your wallet does not match the selected local chain state. Refresh or check its RPC connection.');
 await identity();
 return true;
}
