import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {withdrawalData,verifyWithdrawalPlan} from './ui/withdrawal-plan.mjs';
const {Interface}=createRequire(import.meta.url)('ethers');
const walletABI=new Interface(['function execute(address,bytes) returns(bytes)']);
const custodyABI=new Interface(['function withdraw(uint256,uint256,uint256)']);
const a=n=>'0x'+n.repeat(40),h=n=>'0x'+n.repeat(64),maximum=2n**256n-1n;
const state={chainId:'0x7a69',controller:a('a'),owner:a('b'),epoch:'1',credit:'2',genesisHash:h('c'),contracts:{wallet:a('b'),custody:a('d')}};
function reference(custody=state.contracts.custody,epoch='1',amount='1',account='2'){
 return walletABI.encodeFunctionData('execute',[custody,custodyABI.encodeFunctionData('withdraw',[account,epoch,amount])]);
}
function plan(overrides={}){return {chainId:'0x7a69',from:state.controller,to:state.contracts.wallet,value:'0x0',amount:'1',epoch:state.epoch,genesisHash:state.genesisHash,blockHash:h('e'),blockNumber:'0xa',data:reference(),...overrides};}
function verify(p=plan(),s=state,account=s.controller,amount='1'){return verifyWithdrawalPlan(p,s,account,amount);}

test('manual fixed ABI matches independent ethers encoder',()=>{
 assert.equal(walletABI.getFunction('execute').selector,'0x1cff79cd');
 assert.equal(custodyABI.getFunction('withdraw').selector,'0xa41fe49f');
 assert.equal(withdrawalData(state.contracts.custody,'1','1'),reference());
 assert.equal(verify(),true);
});
for(const [name,data]of [
 ['inner amount',reference(undefined,'1','2')],
 ['inner epoch',reference(undefined,'2','1')],
 ['inner account number',reference(undefined,'1','1','3')],
 ['inner custody target',reference(a('f'))],
 ['outer selector','0xffffffff'+reference().slice(10)],
 ['inner selector',reference().replace('a41fe49f','ffffffff')],
 ['trailing bytes',reference()+'00'],
 ['truncated data',reference().slice(0,-2)]
])test('rejects '+name+' with unchanged displayed metadata',()=>{
 const p=plan({data});assert.equal(p.amount,'1');assert.equal(p.epoch,'1');assert.equal(p.to,state.contracts.wallet);
 assert.throws(()=>verify(p));
});
test('permits hexadecimal letter case without changing bytes',()=>{
 const uppercase=x=>'0x'+x.slice(2).toUpperCase();
 assert.equal(withdrawalData(uppercase(state.contracts.custody),'1','1'),reference());
 assert.equal(verify(plan({from:uppercase(state.controller),to:uppercase(state.contracts.wallet),data:uppercase(reference()),genesisHash:uppercase(state.genesisHash),blockHash:uppercase(h('e'))})),true);
});
test('zero epoch and maximum uint256 amount match the reference',()=>{
 const amount=maximum.toString(),s={...state,epoch:'0',credit:amount};
 assert.equal(withdrawalData(s.contracts.custody,s.epoch,amount),reference(s.contracts.custody,s.epoch,amount));
 assert.equal(verify(plan({amount,epoch:'0',data:reference(undefined,'0',amount)}),s,s.controller,amount),true);
});
test('maximum uint256 epoch matches the reference',()=>{
 assert.equal(withdrawalData(state.contracts.custody,maximum.toString(),'1'),reference(undefined,maximum.toString(),'1'));
});
for(const amount of ['0','-1','01','1.5','1e2',(maximum+1n).toString()]){
 test('rejects invalid or out-of-range amount '+amount,()=>assert.throws(()=>withdrawalData(state.contracts.custody,'1',amount)));
}
for(const epoch of ['-1','01','1.5',(maximum+1n).toString()]){
 test('rejects invalid or out-of-range epoch '+epoch,()=>assert.throws(()=>withdrawalData(state.contracts.custody,epoch,'1')));
}
for(const [field,value]of [['chainId','0x1'],['from',a('f')],['to',a('f')],['value','0x1'],['amount','2'],['epoch','2'],['genesisHash',h('f')],['blockHash','0xee'],['blockNumber','latest']]){
 test('rejects incorrect plan '+field,()=>assert.throws(()=>verify(plan({[field]:value}))));
}
test('rejects amount greater than displayed credit',()=>assert.throws(()=>verify(plan(),{...state,credit:'0'})));
test('rejects registry owner different from the selected wallet',()=>assert.throws(()=>verify(plan(),{...state,owner:a('f')})));
test('rejects another connected controller',()=>assert.throws(()=>verify(plan(),state,a('f'))));
test('EOA owner withdraws directly with independently encoded bytes',()=>{
 const s={...state,ownerType:'eoa',owner:a('f'),signer:a('f')};
 const data=custodyABI.encodeFunctionData('withdraw',[2,1,1]);
 assert.equal(withdrawalData(s.contracts.custody,'1','1','eoa'),data);
 assert.equal(verify(plan({from:s.signer,to:s.contracts.custody,data}),s,s.signer),true);
});
test('direct EOA path rejects old controller, wrapper and unsupported owner type',()=>{
 const s={...state,ownerType:'eoa',owner:a('f'),signer:a('f')};
 const p=plan({from:s.signer,to:s.contracts.custody,data:withdrawalData(s.contracts.custody,'1','1','eoa')});
 assert.throws(()=>verify(p,s,state.controller));
 assert.throws(()=>verify({...p,data:reference()},s,s.signer));
 assert.throws(()=>verify(p,{...s,ownerType:'unsupported'},s.signer));
 assert.throws(()=>verify({...p,action:'transfer'},s,s.signer));
 assert.throws(()=>withdrawalData(s.contracts.custody,'1','1','unsupported'));
});
