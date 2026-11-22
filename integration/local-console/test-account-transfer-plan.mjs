import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {transferData,verifyTransferPlan} from './ui/account-transfer-plan.mjs';
const {Interface}=createRequire(import.meta.url)('ethers');
const registry=new Interface(['function safeTransferFrom(address,address,uint256)']);
const wallet=new Interface(['function execute(address,bytes) returns(bytes)']);
const a=n=>'0x'+n.repeat(40),h=n=>'0x'+n.repeat(64);
const s={chainId:'0x7a69',controller:a('1'),signer:a('1'),ownerType:'fixture-wallet',owner:a('2'),epoch:'1',genesisHash:h('1'),contracts:{wallet:a('2'),registry:a('3'),custody:a('4'),token:a('5')}};
const recipient=a('6');
function plan(state=s){return {action:'transfer',chainId:'0x7a69',from:state.signer,to:state.ownerType==='eoa'?state.contracts.registry:state.contracts.wallet,owner:state.owner,registry:state.contracts.registry,recipient,value:'0x0',epoch:state.epoch,genesisHash:state.genesisHash,blockHash:h('2'),blockNumber:'0xa',data:transferData(state.contracts.registry,state.owner,recipient,state.ownerType)};}
test('manual wallet and EOA transfer encodings agree with ethers',()=>{
 const inner=registry.encodeFunctionData('safeTransferFrom',[s.owner,recipient,2]);
 assert.equal(transferData(s.contracts.registry,s.owner,recipient,'fixture-wallet'),wallet.encodeFunctionData('execute',[s.contracts.registry,inner]));
 assert.equal(transferData(s.contracts.registry,s.owner,recipient,'eoa'),inner);
 assert.equal(verifyTransferPlan(plan(),s,s.signer,recipient),true);
 const eoa={...s,ownerType:'eoa',owner:a('7'),signer:a('7')};
 assert.equal(verifyTransferPlan(plan(eoa),eoa,eoa.signer,recipient),true);
});
for(const [field,value]of [['action','withdrawal'],['owner',a('7')],['registry',a('7')],['recipient',a('7')],['from',a('7')],['to',a('7')],['epoch','2'],['chainId','0x1'],['value','0x1'],['genesisHash',h('7')],['blockHash','0x1'],['blockNumber','latest'],['amount','1']])test('rejects changed transfer '+field,()=>assert.throws(()=>verifyTransferPlan({...plan(),[field]:value},s,s.signer,recipient)));
for(const target of [a('0'),s.owner,...Object.values(s.contracts)])test('rejects zero, self or selected contract recipient '+target,()=>{
 const p={...plan(),recipient:target,data:transferData(s.contracts.registry,s.owner,target,'fixture-wallet')};assert.throws(()=>verifyTransferPlan(p,s,s.signer,target));
});
test('rejects alternate account token, trailing bytes and wrong selector',()=>{
 for(const data of [wallet.encodeFunctionData('execute',[s.contracts.registry,registry.encodeFunctionData('safeTransferFrom',[s.owner,recipient,3])]),plan().data+'00','0xffffffff'+plan().data.slice(10)])assert.throws(()=>verifyTransferPlan({...plan(),data},s,s.signer,recipient));
});
test('rejects unsupported current owner and controller mismatch',()=>{
 assert.throws(()=>verifyTransferPlan(plan(),{...s,ownerType:'unsupported'},s.signer,recipient));
 assert.throws(()=>verifyTransferPlan(plan(),{...s,signer:a('8')},s.signer,recipient));
 assert.throws(()=>transferData(s.contracts.registry,s.owner,recipient,'unsupported'));
});
test('epoch is review metadata rather than calldata authorization',()=>{
 const changed={...s,epoch:'9'};const p=plan(changed);
 assert.equal(p.data,plan().data);assert.equal(verifyTransferPlan(p,changed,changed.signer,recipient),true);
 assert.throws(()=>verifyTransferPlan(p,s,s.signer,recipient));
});
test('rejects the entire local reserved low-address recipient range including precompiles',()=>{
 for(const n of [0n,...Array.from({length:17},(_,i)=>BigInt(i+1)),0xffffn]){
  const recipient='0x'+n.toString(16).padStart(40,'0');
  const p={...plan(),recipient,data:transferData(s.contracts.registry,s.owner,recipient,'fixture-wallet')};
  assert.throws(()=>verifyTransferPlan(p,s,s.signer,recipient));
 }
});
test('allows the first address above the local reserved range when other constraints hold',()=>{
 const recipient='0x'+(0x10000n).toString(16).padStart(40,'0');
 const p={...plan(),recipient,data:transferData(s.contracts.registry,s.owner,recipient,'fixture-wallet')};
 assert.equal(verifyTransferPlan(p,s,s.signer,recipient),true);
});
