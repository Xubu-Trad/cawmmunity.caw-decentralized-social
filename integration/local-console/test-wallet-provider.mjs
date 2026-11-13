import test from 'node:test';import assert from 'node:assert/strict';import {verifyWalletProviderContext} from './ui/wallet-provider.mjs';
const plan={chainId:'0x7a69',from:'0x'+'11'.repeat(20),genesisHash:'0x'+'22'.repeat(32),blockHash:'0x'+'33'.repeat(32),blockNumber:'0xa'};
function provider(change){let call=0;const methods=[];return {methods,async request(req){const n=++call;methods.push(req.method);let value=req.method==='eth_chainId'?'0x7a69':req.method==='eth_accounts'?[plan.from]:{hash:req.params[0]==='0x0'?plan.genesisHash:plan.blockHash};return change?change(req,n,value):value;}};}
test('accepts selected genesis and block while checking identity twice',async()=>{const p=provider();assert.equal(await verifyWalletProviderContext(p,plan),true);assert.deepEqual(p.methods,['eth_chainId','eth_accounts','eth_getBlockByNumber','eth_getBlockByNumber','eth_chainId','eth_accounts']);});
for(const [name,change]of [
 ['another genesis',(req,n,v)=>n===3?{hash:'0x'+'44'.repeat(32)}:v],
 ['another selected block',(req,n,v)=>n===4?{hash:'0x'+'44'.repeat(32)}:v],
 ['missing selected block',(req,n,v)=>n===4?null:v],
 ['changed final chain',(req,n,v)=>n===5?'0x1':v],
 ['changed final account',(req,n,v)=>n===6?['0x'+'55'.repeat(20)]:v],
 ['wrong initial chain',(req,n,v)=>n===1?'0x1':v],
 ['wrong initial account',(req,n,v)=>n===2?[]:v]
])test('rejects '+name,async()=>{await assert.rejects(verifyWalletProviderContext(provider(change),plan));});
test('rejects malformed block selection before asking provider',async()=>{const p=provider();await assert.rejects(verifyWalletProviderContext(p,{...plan,blockNumber:'latest'}));assert.equal(p.methods.length,0);});
