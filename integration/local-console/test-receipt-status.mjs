import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyWithdrawalReceipt,verifyRecoveryTransaction} from './ui/receipt-status.mjs';

const h=n=>'0x'+n.repeat(64),a=n=>'0x'+n.repeat(40);
const txHash=h('a');
const plan={chainId:'0x7a69',from:a('1'),to:a('2'),data:'0x1234abcd',value:'0x0',genesisHash:h('3'),blockHash:h('4'),blockNumber:'0xa'};
const receipt={transactionHash:txHash,from:plan.from,to:plan.to,status:'0x1',blockNumber:'0xb',blockHash:h('5')};
const transaction={hash:txHash,from:plan.from,to:plan.to,input:plan.data,value:'0x0',chainId:plan.chainId,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash};
function provider(change){
 const requests=[];
 return {requests,async request(req){
  requests.push(req);let value;
  if(req.method==='eth_chainId')value=plan.chainId;
  else if(req.method==='eth_accounts')value=[plan.from];
  else if(req.method==='eth_getTransactionReceipt')value=structuredClone(receipt);
  else if(req.method==='eth_getTransactionByHash')value=structuredClone(transaction);
  else if(req.method==='eth_getBlockByNumber'){
   const number=req.params[0];
   value={number,hash:number==='0x0'?plan.genesisHash:number===plan.blockNumber?plan.blockHash:receipt.blockHash};
  }else throw Error('Unexpected method '+req.method);
  return change?change(req,value,requests):value;
 }};
}
const changed=(method,modify)=>provider((req,value)=>req.method===method?modify(value):value);

test('confirms only the matching mined withdrawal on the selected local chain',async()=>{
 const p=provider();assert.deepEqual(await verifyWithdrawalReceipt(p,txHash,plan),{status:'confirmed',blockNumber:'0xb',blockHash:h('5')});
 assert.equal(p.requests.filter(r=>r.method==='eth_accounts').length,4);
 assert.equal(p.requests.at(-1).method,'eth_getBlockByNumber');
});
test('null receipt is pending and is never treated as success',async()=>{
 const p=changed('eth_getTransactionReceipt',()=>null);
 assert.deepEqual(await verifyWithdrawalReceipt(p,txHash,plan),{status:'pending',blockNumber:null,blockHash:null});
 assert.equal(p.requests.some(r=>r.method==='eth_getTransactionByHash'),false);
});
test('matching failed execution returns reverted rather than confirmed',async()=>{
 assert.equal((await verifyWithdrawalReceipt(changed('eth_getTransactionReceipt',r=>({...r,status:'0x0'})),txHash,plan)).status,'reverted');
});
for(const [field,value]of [['transactionHash',h('6')],['from',a('6')],['to',a('6')],['status','0x2'],['status','0x01'],['status',1],['blockHash','0x55'],['blockNumber','0x0b'],['blockNumber','0x9']]){
 test('rejects receipt '+field+' '+value,async()=>assert.rejects(verifyWithdrawalReceipt(changed('eth_getTransactionReceipt',r=>({...r,[field]:value})),txHash,plan)));
}
for(const value of [undefined,{}, {error:{code:-32000,message:'unavailable'}}]){
 test('rejects malformed receipt '+JSON.stringify(value),async()=>assert.rejects(verifyWithdrawalReceipt(changed('eth_getTransactionReceipt',()=>value),txHash,plan)));
}
for(const [field,value]of [['hash',h('6')],['from',a('6')],['to',a('6')],['input','0x5678'],['value','0x1'],['value','0x00'],['blockHash',h('6')],['blockNumber','0xc'],['chainId','0x1']]){
 test('rejects mined transaction '+field+' mismatch',async()=>assert.rejects(verifyWithdrawalReceipt(changed('eth_getTransactionByHash',r=>({...r,[field]:value})),txHash,plan)));
}
test('rejects a receipt whose mined transaction is missing',async()=>assert.rejects(verifyWithdrawalReceipt(changed('eth_getTransactionByHash',()=>null),txHash,plan)));
test('rejects an RPC receipt error without changing it into pending',async()=>{
 await assert.rejects(verifyWithdrawalReceipt(changed('eth_getTransactionReceipt',()=>{throw Error('RPC_UNAVAILABLE');}),txHash,plan),/RPC_UNAVAILABLE/);
});
test('rejects a reorg that changes the receipt block',async()=>{
 const p=provider((req,v)=>req.method==='eth_getBlockByNumber'&&req.params[0]===receipt.blockNumber?{...v,hash:h('6')}:v);
 await assert.rejects(verifyWithdrawalReceipt(p,txHash,plan),/canonical/);
});
test('rejects a missing canonical receipt block',async()=>{
 const p=provider((req,v)=>req.method==='eth_getBlockByNumber'&&req.params[0]===receipt.blockNumber?null:v);
 await assert.rejects(verifyWithdrawalReceipt(p,txHash,plan),/canonical/);
});
test('rejects a canonical lookup returning the wrong block number',async()=>{
 const p=provider((req,v)=>req.method==='eth_getBlockByNumber'&&req.params[0]===receipt.blockNumber?{...v,number:'0xc'}:v);
 await assert.rejects(verifyWithdrawalReceipt(p,txHash,plan),/canonical/);
});
test('rejects a provider whose selected history changed after the receipt lookup',async()=>{
 let selected=0;const p=provider((req,v)=>req.method==='eth_getBlockByNumber'&&req.params[0]===plan.blockNumber&&++selected===2?{...v,hash:h('6')}:v);
 await assert.rejects(verifyWithdrawalReceipt(p,txHash,plan),/selected local chain state/);
});
test('rejects invalid selection before requesting provider data',async()=>{
 const p=provider();await assert.rejects(verifyWithdrawalReceipt(p,'0x1',plan));assert.equal(p.requests.length,0);
});
test('rejects nonzero reviewed native value before requesting provider data',async()=>{
 const p=provider();await assert.rejects(verifyWithdrawalReceipt(p,txHash,{...plan,value:'0x1'}));assert.equal(p.requests.length,0);
});

const noncePlan={...plan,nonce:'0x7'};
const nonceProvider=()=>changed('eth_getTransactionByHash',t=>({...t,nonce:noncePlan.nonce}));
test('mined receipt binds the optional selected nonce',async()=>{
 assert.equal((await verifyWithdrawalReceipt(nonceProvider(),txHash,noncePlan)).status,'confirmed');
});
for(const nonce of ['0x8',undefined,'0x07','0x10000000000000000',7,null]){
 test('receipt rejects mismatched or malformed nonce '+String(nonce),async()=>{
  await assert.rejects(verifyWithdrawalReceipt(changed('eth_getTransactionByHash',t=>({...t,nonce})),txHash,noncePlan),/Mined transaction/);
 });
}
for(const nonce of ['0x00','0x10000000000000000',-1,0,null,undefined,'7','latest']){
 test('rejects invalid recorded nonce before any provider request '+String(nonce),async()=>{
  for(const verify of [verifyWithdrawalReceipt,verifyRecoveryTransaction]){
   const p=provider();await assert.rejects(verify(p,txHash,{...plan,nonce}));assert.equal(p.requests.length,0);
  }
 });
}
test('manual recovery requires a nonce rather than matching only identical calldata',async()=>{
 const p=provider();await assert.rejects(verifyRecoveryTransaction(p,txHash,plan));assert.equal(p.requests.length,0);
});
test('pending transaction identity can be recovered without claiming a receipt',async()=>{
 const p=changed('eth_getTransactionByHash',t=>({...t,nonce:noncePlan.nonce,blockHash:null,blockNumber:null}));
 assert.deepEqual(await verifyRecoveryTransaction(p,txHash,noncePlan),{status:'matched',transactionHash:txHash});
 assert.equal(p.requests.some(r=>r.method==='eth_getTransactionReceipt'),false);
 assert.equal(p.requests.filter(r=>r.method==='eth_accounts').length,4);
});
for(const nonce of ['0x0','0xffffffffffffffff']){
 test('manual recovery accepts boundary uint64 nonce '+nonce,async()=>{
  assert.equal((await verifyRecoveryTransaction(changed('eth_getTransactionByHash',t=>({...t,nonce})),txHash,{...plan,nonce})).status,'matched');
 });
}
for(const [field,value]of [['hash',h('6')],['from',a('6')],['to',a('6')],['input','0x5678'],['value','0x1'],['chainId','0x1'],['nonce','0x8'],['nonce',undefined]]){
 test('manual recovery rejects transaction '+field+' mismatch '+String(value),async()=>{
  await assert.rejects(verifyRecoveryTransaction(changed('eth_getTransactionByHash',t=>({...t,nonce:noncePlan.nonce,[field]:value})),txHash,noncePlan),/Recovery transaction/);
 });
}
for(const value of [null,undefined,{}, {error:{code:-32000,message:'missing'}}]){
 test('manual recovery rejects missing or malformed transaction '+JSON.stringify(value),async()=>{
  await assert.rejects(verifyRecoveryTransaction(changed('eth_getTransactionByHash',()=>value),txHash,noncePlan));
 });
}
test('manual recovery propagates transaction lookup error',async()=>{
 await assert.rejects(verifyRecoveryTransaction(changed('eth_getTransactionByHash',()=>{throw Error('RPC_UNAVAILABLE');}),txHash,noncePlan),/RPC_UNAVAILABLE/);
});
test('manual recovery rejects selected history changing during lookup',async()=>{
 let selected=0;const p=provider((req,v)=>{
  if(req.method==='eth_getTransactionByHash')return {...v,nonce:noncePlan.nonce};
  return req.method==='eth_getBlockByNumber'&&req.params[0]===plan.blockNumber&&++selected===2?{...v,hash:h('6')}:v;
 });
 await assert.rejects(verifyRecoveryTransaction(p,txHash,noncePlan),/selected local chain state/);
});
