import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Transaction,version} from 'ethers';
import {inspectCandidateBlockEvents as inspect} from './c007-block-events.mjs';
assert.equal(version,'6.16.0');
const f=JSON.parse(fs.readFileSync(process.argv[2]));assert(f.synthetic);assert.equal(f.executionClaimed,false);
const selection={profile:'london-16',hash:f.header.hash,chainId:'0x7a69'};
const run=(x=f,s=selection)=>inspect(x.header,x.rawTransactions,x.receipts,s,x.context);
const result=run(),expected=Transaction.from(f.rawTransactions[0]);
assert.equal(result.events.length,2);assert.equal(expected.hash,f.transactionHash);
assert.deepEqual(result.events.map(x=>[x.transactionIndex,x.receiptLogIndex,x.event.kind]),[[0,0,'admission'],[0,1,'claim']]);
for(const row of result.events){assert.equal(row.transactionHash,expected.hash);assert.equal(row.transactionSender,expected.from.toLowerCase());assert(Object.isFrozen(row)&&Object.isFrozen(row.event));}
assert.equal(result.events[0].event.fee,'5');assert.equal(result.events[1].event.amount,'4');
for(const k of ['cawActionAuthorityVerified','executionVerified','feeBackingVerified','chainAuthenticated','consensusVerified','finalityVerified'])assert.equal(result[k],false);
const rejected=[];
for(const [name,mutate]of [
 ['changed raw signature',x=>{let r=x.rawTransactions[0];x.rawTransactions[0]=r.slice(0,-2)+(r.endsWith('00')?'01':'00');}],
 ['changed receipt event',x=>x.receipts[0].logs[1].data='0x'+'00'.repeat(32)],
 ['removed candidate log',x=>x.receipts[0].logs.pop()],
 ['reordered candidate logs',x=>x.receipts[0].logs.reverse()],
 ['duplicated candidate log',x=>x.receipts[0].logs.push(structuredClone(x.receipts[0].logs[0]))]
]){const x=structuredClone(f);mutate(x);assert.throws(()=>run(x));rejected.push(name);}
const spoof=structuredClone(f);spoof.receipts[0].transactionHash='0x'+'aa'.repeat(32);spoof.receipts[0].from='0x'+'bb'.repeat(20);
assert.deepEqual(run(spoof),result);
console.log(JSON.stringify({status:'SYNTHETIC_NOT_EXECUTED_EVENT_PROJECTION',events:2,
 transactionHash:expected.hash,recoveredSender:expected.from.toLowerCase(),ethersSenderAgrees:true,
 rejected,rpcLabelsIgnored:true,executionVerified:false,cawActionAuthorityVerified:false,feeBackingVerified:false,
 limits:'Positive projection over synthetic receipt/header commitments and retained signed bytes. Logs were not produced by that transaction. No execution or funding claim.'},null,2));
