import fs from 'node:fs';import assert from 'node:assert/strict';
import {beginWithdrawal,beginTransfer,beginPost,readJournal,rememberHash,finishWithdrawal,JOURNAL_KEY} from './ui/withdrawal-journal.mjs';
import {fixturePlan} from './test-accounting-review-fixture.mjs';
import {postData,postText} from './ui/post-plan.mjs';
const state=JSON.parse(fs.readFileSync(process.argv[2])).before,checks=[];
const locks={request:async(_name,_opts,fn)=>fn({})},id='0x'+'12'.repeat(16),hash='0x'+'34'.repeat(32);
function storage(){let value=null;return {getItem:()=>value,setItem:(_k,v)=>{value=v;},removeItem:()=>{value=null;}};}
const run=async(name,fn)=>{await fn();checks.push(name);};
for(const [kind,begin]of [['withdrawal',beginWithdrawal],['transfer',beginTransfer],['post',beginPost]]){
 const plan={...fixturePlan(state,kind),nonce:'0x0'},s=storage();
 await run(kind+' saves review atomically with intent',async()=>{const r=await begin(s,locks,state,plan,id,state);assert.deepEqual(r.accountingReview.snapshot.balances,state.balances);assert.equal(r.phase,'awaiting-wallet');});
 const original=JSON.parse(s.getItem());
 await run(kind+' survives reload with changed current authority and accounting',()=>{const now={...state,epoch:'3',owner:'0x'+'22'.repeat(20),signer:'0x'+'22'.repeat(20),credit:'0',posting:{...state.posting,nonce:'99'}};assert.deepEqual(readJournal(s,now).accountingReview,original.accountingReview);});
 await run(kind+' hash recovery retains exact reviewed context',async()=>{await rememberHash(s,locks,state,id,hash);const r=readJournal(s,state);assert.equal(r.phase,'submitted');assert.deepEqual(r.accountingReview,original.accountingReview);});
 await run(kind+' rejects replacement transaction hash',async()=>assert.rejects(()=>rememberHash(s,locks,state,id,'0x'+'56'.repeat(32))));
 await run(kind+' clears context with resolved action',async()=>{await finishWithdrawal(s,locks,state,id);assert.equal(s.getItem(),null);});
 await run(kind+' legacy record remains recoverable without invented review',async()=>{await begin(s,locks,state,plan,id);assert.equal(readJournal(s,state).accountingReview,undefined);});
}
for(const[name,change]of[
 ['wrong review version',r=>r.accountingReview.version=2],
 ['wrong deployment',r=>r.accountingReview.snapshot.contracts.token='0x'+'44'.repeat(20)],
 ['wrong genesis',r=>r.accountingReview.snapshot.genesisHash='0x'+'44'.repeat(32)],
 ['wrong signer',r=>r.accountingReview.snapshot.signer='0x'+'44'.repeat(20)],
 ['wrong epoch',r=>r.accountingReview.snapshot.epoch='999'],
 ['missing balance',r=>delete r.accountingReview.snapshot.balances.owner],
 ['inconsistent accounting',r=>r.accountingReview.snapshot.credit='999'],
 ['unexpected stored projection',r=>r.accountingReview.after={credit:'0'}]
])await run(name+' rejects and retains raw record',async()=>{const s=storage();await beginWithdrawal(s,locks,state,{...fixturePlan(state),nonce:'0x0'},id,state);const r=JSON.parse(s.getItem());change(r);const raw=JSON.stringify(r);s.setItem(JOURNAL_KEY,raw);assert.throws(()=>readJournal(s,state));assert.equal(s.getItem(),raw);});
await run('storage write failure does not create an intent',async()=>{const s=storage();s.setItem=()=>{throw Error('quota');};await assert.rejects(()=>beginWithdrawal(s,locks,state,{...fixturePlan(state),nonce:'0x0'},id,state));assert.equal(s.getItem(),null);});
await run('lost write fails readback',async()=>{const s=storage();s.setItem=()=>{};await assert.rejects(()=>beginWithdrawal(s,locks,state,{...fixturePlan(state),nonce:'0x0'},id,state));});
await run('concurrent pending action is not overwritten',async()=>{const s=storage(),p={...fixturePlan(state),nonce:'0x0'};await beginWithdrawal(s,locks,state,p,id,state);const raw=s.getItem();await assert.rejects(()=>beginWithdrawal(s,locks,state,p,'0x'+'45'.repeat(16),state));assert.equal(s.getItem(),raw);});
let largestPostLength;
await run('maximum four-byte post review fits existing record limit',async()=>{const s=storage(),text='\u{1f426}'.repeat(420),p={...fixturePlan(state,'post'),nonce:'0x0',text,textHash:postText(text).textHash,data:postData(state.contracts.posting,state.epoch,state.posting.nonce,text,state.ownerType)};await beginPost(s,locks,state,p,id,state);largestPostLength=s.getItem().length;assert(largestPostLength<=8192);assert.equal(readJournal(s,state).plan.text,text);});
await run('local record is not cryptographic authentication',async()=>{const s=storage();await beginWithdrawal(s,locks,state,{...fixturePlan(state),nonce:'0x0'},id,state);const r=JSON.parse(s.getItem());r.accountingReview.snapshot.balances.owner='999';s.setItem(JOURNAL_KEY,JSON.stringify(r));assert.equal(readJournal(s,state).accountingReview.snapshot.balances.owner,'999');});
console.log(JSON.stringify({passed:checks.length,checks,largestPostLength,scope:'Local journal and editable review metadata; no historical proof authentication or new execution.'},null,2));
