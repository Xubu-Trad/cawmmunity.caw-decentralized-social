import test from 'node:test';
import assert from 'node:assert/strict';
import {JOURNAL_KEY,validateJournal,readJournal,beginWithdrawal,beginTransfer,rememberHash,finishWithdrawal} from './ui/withdrawal-journal.mjs';
import {withdrawalData} from './ui/withdrawal-plan.mjs';
import {transferData} from './ui/account-transfer-plan.mjs';

const a=n=>'0x'+n.repeat(40),h=n=>'0x'+n.repeat(64),id=n=>'0x'+n.repeat(32);
const state={chainId:'0x7a69',controller:a('a'),owner:a('b'),epoch:'1',credit:'2',genesisHash:h('1'),contracts:{wallet:a('b'),registry:a('c'),custody:a('d'),token:a('e')}};
const plan={chainId:'0x7a69',from:state.controller,to:state.contracts.wallet,data:withdrawalData(state.contracts.custody,'1','1'),value:'0x0',amount:'1',epoch:'1',blockNumber:'0xa',blockHash:h('2'),genesisHash:state.genesisHash,nonce:'0x3'};
const clone=value=>JSON.parse(JSON.stringify(value));
function record(){return {version:1,id:id('3'),phase:'awaiting-wallet',plan:clone(plan),contracts:clone(state.contracts),hash:null};}
function storage(raw=null){let value=raw;return {getItem(key){assert.equal(key,JOURNAL_KEY);return value;},setItem(key,next){assert.equal(key,JOURNAL_KEY);value=next;},removeItem(key){assert.equal(key,JOURNAL_KEY);value=null;},raw(){return value;}};}
function locks(){let held=false;const calls=[];return {calls,async request(name,options,action){calls.push({name,options});assert.equal(name,JOURNAL_KEY);assert.deepEqual(options,{mode:'exclusive',ifAvailable:true});if(held)return action(null);held=true;try{return await action({name});}finally{held=false;}}};}

test('begin persists and readback restores exact reviewed intent without transaction hash',async()=>{
 const s=storage(),l=locks();const r=await beginWithdrawal(s,l,state,plan,id('3'));
 assert.deepEqual(r,record());assert.deepEqual(readJournal(s,state),record());assert.equal(l.calls.length,1);
});
test('restores historical intent after credit, owner and epoch change',()=>{
 const changed={...state,credit:'0',epoch:'9',owner:a('f')};
 assert.deepEqual(readJournal(storage(JSON.stringify(record())),changed),record());
});
test('only frozen contract/controller/genesis context is used to restore historical intent',()=>{
 const r=record();r.plan.blockNumber='0x1';r.plan.blockHash=h('7');r.plan.epoch='0';r.plan.amount='2';r.plan.data=withdrawalData(state.contracts.custody,'0','2');
 assert.deepEqual(validateJournal(r,{...state,epoch:'99',credit:'0'}),r);
});
test('empty journal is absent rather than a restored pending request',()=>assert.equal(readJournal(storage(),state),null));
test('remembered hash preserves intent and permits idempotent same-hash retry',async()=>{
 const s=storage(),l=locks();await beginWithdrawal(s,l,state,plan,id('3'));
 const r=await rememberHash(s,l,state,id('3'),h('4'));assert.equal(r.phase,'submitted');assert.equal(r.hash,h('4'));assert.deepEqual(r.plan,plan);
 const again=await rememberHash(s,l,state,id('3'),h('4'));assert.deepEqual(again,r);
});
test('verified finish clears only its matching record',async()=>{
 const s=storage(JSON.stringify({...record(),phase:'submitted',hash:h('4')}));
 await finishWithdrawal(s,locks(),state,id('3'));assert.equal(s.raw(),null);
});

for(const [name,mutate]of [
 ['extra top-level field',r=>r.extra=true],
 ['missing top-level field',r=>delete r.hash],
 ['extra plan field',r=>r.plan.extra=true],
 ['missing plan field',r=>delete r.plan.nonce],
 ['extra contract field',r=>r.contracts.extra=a('f')],
 ['missing contract field',r=>delete r.contracts.token],
 ['wrong version',r=>r.version=2],
 ['invalid record id',r=>r.id='0x00'],
 ['unknown phase',r=>r.phase='confirmed'],
 ['awaiting phase with hash',r=>r.hash=h('4')],
 ['submitted phase without hash',r=>{r.phase='submitted';}],
 ['submitted phase with malformed hash',r=>{r.phase='submitted';r.hash='0x44';}],
 ['numeric amount',r=>r.plan.amount=1],
 ['numeric epoch',r=>r.plan.epoch=1],
 ['zero amount',r=>r.plan.amount='0'],
 ['negative amount',r=>r.plan.amount='-1'],
 ['noncanonical amount',r=>r.plan.amount='01'],
 ['noncanonical epoch',r=>r.plan.epoch='01'],
 ['uint256 amount overflow',r=>r.plan.amount=String(2n**256n)],
 ['uint256 epoch overflow',r=>r.plan.epoch=String(2n**256n)],
 ['changed inner amount with unchanged labels',r=>r.plan.data=withdrawalData(state.contracts.custody,'1','2')],
 ['changed inner epoch with unchanged labels',r=>r.plan.data=withdrawalData(state.contracts.custody,'2','1')],
 ['changed custody target with unchanged selection',r=>r.plan.data=withdrawalData(a('f'),'1','1')],
 ['changed transaction sender',r=>r.plan.from=a('f')],
 ['changed wallet target',r=>r.plan.to=a('f')],
 ['nonzero native value',r=>r.plan.value='0x1'],
 ['wrong chain id',r=>r.plan.chainId='0x1'],
 ['wrong genesis',r=>r.plan.genesisHash=h('9')],
 ['trailing calldata bytes',r=>r.plan.data+='00'],
 ['missing calldata',r=>r.plan.data='0x'],
 ['malformed selected block hash',r=>r.plan.blockHash='0x1'],
 ['noncanonical selected block number',r=>r.plan.blockNumber='latest'],
 ['numeric nonce',r=>r.plan.nonce=3],
 ['noncanonical nonce',r=>r.plan.nonce='0x03'],
 ['negative nonce',r=>r.plan.nonce='-0x1'],
 ['uint64 nonce overflow',r=>r.plan.nonce='0x10000000000000000'],
])test('rejects '+name,()=>{const r=record();mutate(r);assert.throws(()=>validateJournal(r,state));});

test('accepts explicitly bounded uint64 nonce endpoints',()=>{for(const nonce of ['0x0','0xffffffffffffffff']){const r=record();r.plan.nonce=nonce;assert.equal(validateJournal(r,state).plan.nonce,nonce);}});
for(const name of ['wallet','registry','custody','token'])test('rejects changed selected '+name,()=>assert.throws(()=>validateJournal(record(),{...state,contracts:{...state.contracts,[name]:a('f')}})));
test('rejects selected controller change',()=>assert.throws(()=>validateJournal(record(),{...state,controller:a('f')})));
test('rejects selected genesis change',()=>assert.throws(()=>validateJournal(record(),{...state,genesisHash:h('9')})));
test('rejects selected chain change',()=>assert.throws(()=>validateJournal(record(),{...state,chainId:'0x1'})));
test('rejects duplicate contract roles even when selection duplicates them',()=>{const r=record();r.contracts.token=r.contracts.registry;assert.throws(()=>validateJournal(r,{...state,contracts:r.contracts}));});
test('accepts hexadecimal address case differences without relaxing identity',()=>{const r=record();r.contracts.wallet='0x'+r.contracts.wallet.slice(2).toUpperCase();assert.equal(validateJournal(r,state),r);});

for(const [name,raw]of [['invalid JSON','{'],['oversized data',' '.repeat(8193)],['array','[]'],['null','null'],['scalar','1']])test('corrupt journal '+name+' is preserved and blocks a new intent',async()=>{
 const s=storage(raw);assert.throws(()=>readJournal(s,state));await assert.rejects(beginWithdrawal(s,locks(),state,plan,id('4')));assert.equal(s.raw(),raw);
});
test('wrong-selection journal blocks begin without erasing evidence',async()=>{
 const r=record();r.contracts.wallet=a('f');const raw=JSON.stringify(r),s=storage(raw);
 assert.throws(()=>readJournal(s,state));await assert.rejects(beginWithdrawal(s,locks(),state,plan,id('4')));assert.equal(s.raw(),raw);
});
test('unavailable storage fails before writes',async()=>{
 let writes=0;const s={getItem(){throw Error('storage unavailable');},setItem(){writes++;}};
 await assert.rejects(beginWithdrawal(s,locks(),state,plan,id('3')),/storage unavailable/);assert.equal(writes,0);
});
test('quota error prevents beginning and leaves storage empty',async()=>{
 const s=storage();s.setItem=()=>{throw Error('quota');};await assert.rejects(beginWithdrawal(s,locks(),state,plan,id('3')),/quota/);assert.equal(s.raw(),null);
});
test('unreliable save readback fails closed',async()=>{
 const s=storage();s.setItem=()=>{};await assert.rejects(beginWithdrawal(s,locks(),state,plan,id('3')),/not saved reliably/);assert.equal(s.raw(),null);
});
test('failed hash write preserves prior awaiting-wallet record',async()=>{
 const raw=JSON.stringify(record()),s=storage(raw);s.setItem=()=>{throw Error('quota');};await assert.rejects(rememberHash(s,locks(),state,id('3'),h('4')),/quota/);assert.equal(s.raw(),raw);
});
test('failed clear keeps the submitted record and rejects completion',async()=>{
 const raw=JSON.stringify({...record(),phase:'submitted',hash:h('4')}),s=storage(raw);s.removeItem=()=>{};
 await assert.rejects(finishWithdrawal(s,locks(),state,id('3')),/could not be cleared/);assert.equal(s.raw(),raw);
});
test('missing lock support fails before storage access',async()=>{
 let reads=0;const s={getItem(){reads++;return null;}};await assert.rejects(beginWithdrawal(s,null,state,plan,id('3')),/cannot safely coordinate/);assert.equal(reads,0);
});
test('busy lock fails before storage access',async()=>{
 let reads=0;const s={getItem(){reads++;return null;}};await assert.rejects(beginWithdrawal(s,{request:async(_,__,fn)=>fn(null)},state,plan,id('3')),/Another tab/);assert.equal(reads,0);
});
test('simultaneous begins persist exactly one intent',async()=>{
 const s=storage(),l=locks();const results=await Promise.allSettled([beginWithdrawal(s,l,state,plan,id('3')),beginWithdrawal(s,l,state,plan,id('4'))]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);assert.equal(readJournal(s,state).id,id('3'));
});
for(const operation of ['remember','finish'])test('late '+operation+' cannot overwrite or clear another intent',async()=>{
 const replacement={...record(),id:id('4')},raw=JSON.stringify(replacement),s=storage(raw);
 await assert.rejects(operation==='remember'?rememberHash(s,locks(),state,id('3'),h('5')):finishWithdrawal(s,locks(),state,id('3')),/changed/);assert.equal(s.raw(),raw);
});
test('submitted hash cannot be replaced by another hash',async()=>{
 const raw=JSON.stringify({...record(),phase:'submitted',hash:h('4')}),s=storage(raw);await assert.rejects(rememberHash(s,locks(),state,id('3'),h('5')),/different transaction/);assert.equal(s.raw(),raw);
});
test('missing record cannot be updated or cleared',async()=>{const s=storage(),l=locks();await assert.rejects(rememberHash(s,l,state,id('3'),h('4')),/changed/);await assert.rejects(finishWithdrawal(s,l,state,id('3')),/changed/);assert.equal(s.raw(),null);});

const recipient=a('f');
const transferPlan={chainId:plan.chainId,from:state.controller,to:state.contracts.wallet,data:transferData(state.contracts.registry,state.owner,recipient),value:'0x0',action:'transfer',owner:state.owner,registry:state.contracts.registry,recipient,epoch:plan.epoch,blockNumber:plan.blockNumber,blockHash:plan.blockHash,genesisHash:plan.genesisHash,nonce:plan.nonce};
function transferRecord(){return {...record(),version:2,plan:clone(transferPlan)};}
test('transfer journal preserves exact intent and restores after ownership changes',async()=>{
 const s=storage(),l=locks();await beginTransfer(s,l,state,transferPlan,id('3'));
 assert.deepEqual(readJournal(s,state),transferRecord());
 const changed={...state,owner:recipient,signer:recipient,ownerType:'eoa',epoch:'2',credit:'0'};
 assert.deepEqual(readJournal(s,changed),transferRecord());
 await rememberHash(s,l,changed,id('3'),h('4'));
 await finishWithdrawal(s,l,changed,id('3'));assert.equal(s.raw(),null);
});
test('withdrawals and transfers share one exclusive journal and cannot overwrite one another',async()=>{
 for(const [first,second,firstPlan,secondPlan]of [[beginWithdrawal,beginTransfer,plan,transferPlan],[beginTransfer,beginWithdrawal,transferPlan,plan]]){
  const s=storage(),l=locks();await first(s,l,state,firstPlan,id('3'));const raw=s.raw();
  await assert.rejects(second(s,l,state,secondPlan,id('4')));assert.equal(s.raw(),raw);
 }
 const s=storage(),l=locks();const r=await Promise.allSettled([beginWithdrawal(s,l,state,plan,id('3')),beginTransfer(s,l,state,transferPlan,id('4'))]);
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);
});
test('direct new-owner withdrawal stays v1 and restores without treating original controller as owner',async()=>{
 const current={...state,owner:recipient,signer:recipient,ownerType:'eoa',epoch:'2'};
 const p={...plan,from:recipient,to:state.contracts.custody,epoch:'2',data:withdrawalData(state.contracts.custody,'2','1','eoa')};
 const s=storage();await beginWithdrawal(s,locks(),current,p,id('3'));
 const saved=readJournal(s,{...current,owner:a('9'),signer:a('9'),epoch:'3',credit:'0'});
 assert.equal(saved.version,1);assert.equal(saved.plan.from,recipient);
 assert.throws(()=>validateJournal({...saved,plan:{...saved.plan,to:state.contracts.wallet}},current));
});
test('direct-owner transfer restores against historical owner, not the current owner',async()=>{
 const current={...state,owner:a('9'),signer:a('9'),ownerType:'eoa',epoch:'2'};
 const p={...transferPlan,owner:current.owner,from:current.signer,to:state.contracts.registry,epoch:'2',data:transferData(state.contracts.registry,current.owner,recipient,'eoa')};
 const s=storage();await beginTransfer(s,locks(),current,p,id('3'));
 assert.equal(readJournal(s,{...current,owner:recipient,signer:recipient,epoch:'3'}).plan.owner,current.owner);
});
for(const [name,mutate]of [['action',r=>r.plan.action='withdrawal'],['amount present',r=>r.plan.amount='1'],['registry',r=>r.plan.registry=a('9')],['owner',r=>r.plan.owner=a('9')],['recipient label',r=>r.plan.recipient=a('9')],['nonce missing',r=>delete r.plan.nonce],['version downgrade',r=>r.version=1]])test('rejects malformed transfer journal '+name,()=>{const r=transferRecord();mutate(r);assert.throws(()=>validateJournal(r,state));});
test('starting action requires current authority even though recovery accepts historical authority',async()=>{
 const s=storage(),changed={...state,owner:recipient,signer:recipient,ownerType:'eoa',epoch:'2'};
 await assert.rejects(beginTransfer(s,locks(),changed,transferPlan,id('3')));
 await assert.rejects(beginWithdrawal(s,locks(),changed,plan,id('3')));assert.equal(s.raw(),null);
});
