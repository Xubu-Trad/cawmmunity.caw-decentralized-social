import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inspectCandidateReceiptEvents as inspect} from './c007-receipt-events.mjs';
const fixture=JSON.parse(fs.readFileSync(process.argv[2]));assert.equal(fixture.synthetic,true);
const find=n=>fixture.cases.find(x=>x.name===n),context=fixture.selectionContext;
const run=x=>inspect(x.header,x.receipts,x.selection,context);
const good=find('valid'),result=run(good);
assert.equal(result.events.length,2);assert.deepEqual(result.events.map(x=>x.transactionIndex),[0,2]);
assert.deepEqual(result.events.map(x=>x.event.kind),['admission','claim']);
assert.equal(result.events[0].event.fee,'5');assert.equal(result.events[1].event.amount,'4');
assert(Object.isFrozen(result) && Object.isFrozen(result.events));
for(const row of result.events)assert(Object.isFrozen(row) && Object.isFrozen(row.event));
assert.throws(()=>{result.events[1].event.amount='999';},TypeError);
assert.equal(result.receiptCommitmentVerified,true);
for(const field of ['transactionAssociationVerified','executionVerified','signatureVerified','feeBackingVerified','chainAuthenticated','consensusVerified','finalityVerified'])assert.equal(result[field],false);
assert.equal(run(find('foreign-emitter')).events.length,0);
const rejected=[];
for(const [name,code]of [['failed-with-log','FAILED_RECEIPT_LOGS'],['wrong-record-fee','RECORD_COMMITMENT']]){
 assert.throws(()=>run(find(name)),new RegExp(code));rejected.push(name);
}
for(const [name,mutate]of [
 ['missing receipt',x=>x.receipts.splice(1,1)],
 ['duplicate receipt',x=>x.receipts.push(structuredClone(x.receipts[2]))],
 ['receipt order',x=>x.receipts.reverse()],
 ['changed payload',x=>x.receipts[0].logs[0].data=x.receipts[0].logs[0].data.slice(0,-2)+'00'],
 ['changed status',x=>x.receipts[0].status='0x0'],
 ['wrong selected header',x=>x.selection.hash='0x'+'00'.repeat(32)],
 ['removed log',x=>x.receipts[0].logs[0].removed=true]
]){
 const x=structuredClone(good);mutate(x);assert.throws(()=>run(x));rejected.push(name);
}
assert.throws(()=>inspect(good.header,good.receipts,good.selection,{...context,verified:true}));rejected.push('caller verified flag');
console.log(JSON.stringify({status:'SYNTHETIC_RECEIPT_COMMITMENT_TEST',selectedHeader:result.blockHash,
 extractedEvents:result.events.length,positions:result.events.map(x=>[x.transactionIndex,x.receiptLogIndex]),
 foreignEmitterIgnored:true,rejected,executionVerified:false,signatureVerified:false,feeBackingVerified:false,
 limits:'Real existing receipt reader, synthetic committed headers/receipts. No transactions or EVM execution, canonical chain or actual claim producer.'},null,2));
