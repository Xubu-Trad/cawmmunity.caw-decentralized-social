import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {verifyWithdrawalReceipt,verifyTransferReceipt,verifyPostReceipt,verifyRecoveryTransaction} from './ui/receipt-status.mjs';
import {postData,postText,POST_PROFILE,POST_EVENT_TOPIC} from './ui/post-plan.mjs';
import {transferData} from './ui/account-transfer-plan.mjs';

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

const transferPlan={...plan,action:'transfer',owner:plan.to,registry:a('7'),recipient:a('8'),nonce:'0x7',epoch:'1',data:transferData(a('7'),plan.to,a('8'))};
const topicAddress=x=>'0x'+x.slice(2).padStart(64,'0');
const transferLog={address:transferPlan.registry,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',topicAddress(transferPlan.owner),topicAddress(transferPlan.recipient),'0x'+('2'.padStart(64,'0'))],data:'0x',removed:false,transactionHash:txHash,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber};
function transferProvider(mutate){return provider((req,value)=>{
 if(req.method==='eth_getTransactionReceipt')value={...value,logs:[structuredClone(transferLog)]};
 if(req.method==='eth_getTransactionByHash')value={...value,nonce:transferPlan.nonce,input:transferPlan.data};
 return mutate?mutate(req,value):value;
});}
test('transfer receipt requires exact matching account2 registry event',async()=>{
 assert.equal((await verifyTransferReceipt(transferProvider(),txHash,transferPlan)).status,'confirmed');
 assert.equal((await verifyWithdrawalReceipt(transferProvider(),txHash,transferPlan)).status,'confirmed');
 assert.equal((await verifyRecoveryTransaction(transferProvider(),txHash,transferPlan)).status,'matched');
});
for(const [name,mutate]of [
 ['missing logs',r=>delete r.logs],['no event',r=>r.logs=[]],['duplicate handoff',r=>r.logs.push(structuredClone(transferLog))],
 ['foreign registry',r=>r.logs[0].address=a('9')],['old owner',r=>r.logs[0].topics[1]=topicAddress(a('9'))],
 ['different recipient',r=>r.logs[0].topics[2]=topicAddress(a('9'))],['different account',r=>r.logs[0].topics[3]='0x'+('3'.padStart(64,'0'))],
 ['extra topic',r=>r.logs[0].topics.push(h('9'))],['removed event',r=>r.logs[0].removed=true],['data payload',r=>r.logs[0].data='0x00'],
 ['event transaction hash',r=>r.logs[0].transactionHash=h('9')],['event block hash',r=>r.logs[0].blockHash=h('9')],['event block number',r=>r.logs[0].blockNumber='0xc'],
])test('transfer success rejects '+name,async()=>{
 await assert.rejects(verifyTransferReceipt(transferProvider((req,v)=>{if(req.method==='eth_getTransactionReceipt')mutate(v);return v;}),txHash,transferPlan));
});
test('reverted transfer is a known failure without requiring a successful Transfer event',async()=>{
 assert.equal((await verifyTransferReceipt(transferProvider((req,v)=>req.method==='eth_getTransactionReceipt'?{...v,status:'0x0',logs:[]}:v),txHash,transferPlan)).status,'reverted');
});
for(const [name,patch]of [['missing nonce',{nonce:undefined}],['wrong encoded recipient',{recipient:a('9')}],['amount',{amount:'1'}],['unknown action',{action:'other'}],['changed route',{to:a('9')}],['direct owner mismatch',{to:a('7'),data:transferData(a('7'),plan.to,a('8'),'eoa')}]])test('rejects invalid transfer receipt selection '+name+' before RPC',async()=>{
 const p=transferProvider();await assert.rejects(verifyTransferReceipt(p,txHash,{...transferPlan,...patch}));assert.equal(p.requests.length,0);
});
test('rejects reserved-address transfer recovery before requesting provider data',async()=>{
 for(const n of [0n,...Array.from({length:17},(_,i)=>BigInt(i+1)),0xffffn]){
  const recipient='0x'+n.toString(16).padStart(40,'0');
  const selected={...transferPlan,recipient,data:transferData(transferPlan.registry,transferPlan.owner,recipient)};
  for(const verify of [verifyTransferReceipt,verifyRecoveryTransaction]){
   const p=transferProvider();await assert.rejects(verify(p,txHash,selected));assert.equal(p.requests.length,0);
  }
 }
});

const {Interface}=createRequire(import.meta.url)('ethers');
const postABI=new Interface(['event LocalPostPublished(uint256 indexed accountId,uint256 indexed epoch,uint256 indexed nonce,address author,bytes32 textHash,bytes text)']);
const postPlan={...plan,nonce:'0x3',action:'post',owner:plan.to,posting:a('6'),epoch:'1',postNonce:'7',text:'caw 🌒\n日本語',profile:POST_PROFILE};
postPlan.textHash=postText(postPlan.text).textHash;postPlan.data=postData(postPlan.posting,postPlan.epoch,postPlan.postNonce,postPlan.text);
function publication(selected=postPlan){return {address:selected.posting,...postABI.encodeEventLog(postABI.getEvent('LocalPostPublished'),[2,selected.epoch,selected.postNonce,selected.owner,selected.textHash,postText(selected.text).bytesHex]),transactionHash:txHash,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,removed:false};}
function postProvider(change,selected=postPlan){return provider((req,v,calls)=>{
 if(req.method==='eth_accounts')v=[selected.from];
 if(req.method==='eth_getTransactionReceipt')v={...v,from:selected.from,to:selected.to,logs:[publication(selected)]};
 if(req.method==='eth_getTransactionByHash')v={...v,from:selected.from,to:selected.to,input:selected.data,nonce:selected.nonce};
 return change?change(req,v,calls):v;
});}
test('post confirms only exact independent-ABI publication bytes and hash',async()=>{
 assert.equal(publication().topics[0],POST_EVENT_TOPIC);
 assert.equal((await verifyPostReceipt(postProvider(),txHash,postPlan)).status,'confirmed');
});
test('direct EOA post confirms its owner as event author',async()=>{
 const selected={...postPlan,owner:plan.from,to:postPlan.posting,data:postData(postPlan.posting,'1','7',postPlan.text,'eoa')};
 assert.equal((await verifyPostReceipt(postProvider(undefined,selected),txHash,selected)).status,'confirmed');
});
test('pending post has no success and reverted post needs no publication',async()=>{
 assert.equal((await verifyPostReceipt(postProvider((req,v)=>req.method==='eth_getTransactionReceipt'?null:v),txHash,postPlan)).status,'pending');
 assert.equal((await verifyPostReceipt(postProvider((req,v)=>req.method==='eth_getTransactionReceipt'?{...v,status:'0x0',logs:[]}:v),txHash,postPlan)).status,'reverted');
});
for(const [name,mutate]of [
 ['missing logs',r=>delete r.logs],['no event',r=>r.logs=[]],['duplicate publication',r=>r.logs.push({...r.logs[0]})],
 ['wrong contract',r=>r.logs[0].address=a('8')],['wrong topic',r=>r.logs[0].topics[0]=h('0')],['wrong account',r=>r.logs[0].topics[1]=h('0')],
 ['wrong epoch',r=>r.logs[0].topics[2]=h('0')],['wrong post nonce',r=>r.logs[0].topics[3]=h('0')],['extra topic',r=>r.logs[0].topics.push(h('0'))],
 ['wrong author',r=>r.logs[0].data='0x'+a('9').slice(2).padStart(64,'0')+r.logs[0].data.slice(66)],
 ['wrong text hash',r=>r.logs[0].data=r.logs[0].data.slice(0,66)+h('0').slice(2)+r.logs[0].data.slice(130)],
 ['wrong dynamic offset',r=>r.logs[0].data=r.logs[0].data.slice(0,130)+'0'.repeat(64)+r.logs[0].data.slice(194)],
 ['wrong byte length',r=>r.logs[0].data=r.logs[0].data.slice(0,194)+'0'.repeat(64)+r.logs[0].data.slice(258)],
 ['altered raw text',r=>r.logs[0].data=r.logs[0].data.slice(0,258)+'ff'+r.logs[0].data.slice(260)],
 ['nonzero padding',r=>r.logs[0].data=r.logs[0].data.slice(0,-2)+'ff'],['trailing data',r=>r.logs[0].data+='00'],
 ['removed event',r=>r.logs[0].removed=true],['event transaction mismatch',r=>r.logs[0].transactionHash=h('0')],
 ['event block mismatch',r=>r.logs[0].blockHash=h('0')],['event block number mismatch',r=>r.logs[0].blockNumber='0xc'],
 ['same nonce duplicate at different account',r=>r.logs.push({...r.logs[0],topics:[...r.logs[0].topics.slice(0,1),h('0'),...r.logs[0].topics.slice(2)]})]
])test('rejects publication '+name,async()=>{
 await assert.rejects(verifyPostReceipt(postProvider((req,v)=>{if(req.method==='eth_getTransactionReceipt')mutate(v);return v;}),txHash,postPlan));
});
for(const [name,mutate]of [['transaction nonce missing',p=>delete p.nonce],['transaction nonce overflow',p=>p.nonce='0x10000000000000000'],['text hash',p=>p.textHash=h('0')],['profile',p=>p.profile=h('0')],['text changed',p=>p.text+=' '],['lone surrogate',p=>p.text='\ud800'],['post nonce',p=>p.postNonce='8'],['epoch overflow',p=>p.epoch=(2n**256n).toString()]])test('rejects post selection '+name+' before provider reads',async()=>{
 const selected={...postPlan};mutate(selected);const p=postProvider();await assert.rejects(verifyPostReceipt(p,txHash,selected));assert.equal(p.requests.length,0);
});
test('manual post recovery matches exact reviewed transaction and nonce without confirming publication',async()=>{
 const p=postProvider((req,v)=>req.method==='eth_getTransactionByHash'?{...v,blockHash:null,blockNumber:null}:v);
 assert.deepEqual(await verifyRecoveryTransaction(p,txHash,postPlan),{status:'matched',transactionHash:txHash});assert.equal(p.requests.some(r=>r.method==='eth_getTransactionReceipt'),false);
 await assert.rejects(verifyRecoveryTransaction(postProvider((req,v)=>req.method==='eth_getTransactionByHash'?{...v,input:postData(postPlan.posting,'1','7',postPlan.text+' ')}:v),txHash,postPlan));
});
