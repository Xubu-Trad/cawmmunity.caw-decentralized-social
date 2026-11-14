import fs from 'node:fs';
import assert from 'node:assert/strict';
import {verifyWalletCapture} from './verify-wallet-capture.mjs';
const input=process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p)));
assert.equal(input.length,4);const result=verifyWalletCapture(...input),cases=[];
assert.equal(result.status,'INCOMPLETE');assert.equal(result.strictlyVerifiedTransactions,19);assert.deepEqual(result.blocked.map(x=>[x.block,x.encodedBytes]),[[8,33230],[9,33231]]);assert.equal(result.allRecordedCommitmentsVerified,false);
for(const [name,mutate]of[
 ['omitted block',x=>x[0].blocks.splice(4,1)],
 ['reordered blocks',x=>[x[0].blocks[4],x[0].blocks[5]]=[x[0].blocks[5],x[0].blocks[4]]],
 ['altered signed input',x=>x[0].blocks[1].rawTransactions[0]+='00'],
 ['receipt status change',x=>x[0].blocks[1].receipts[0].status='0x0'],
 ['state-root change',x=>x[0].blocks[1].block.stateRoot='0x'+'11'.repeat(32)],
 ['different proof endpoint',x=>x[2].header.hash='0x'+'11'.repeat(32)],
 ['missing proof field',x=>x[2].proof.storageProof.pop()],
 ['changed expected storage',x=>x[3].storage[0].expected='999']
]){const copy=structuredClone(input);mutate(copy);assert.throws(()=>verifyWalletCapture(...copy),undefined,name);cases.push(name);}
console.log(JSON.stringify({result,negativeControls:cases,passed:cases.length},null,2));
