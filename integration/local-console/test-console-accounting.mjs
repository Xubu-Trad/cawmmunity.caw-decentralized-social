import fs from 'node:fs';
import assert from 'node:assert/strict';
import {verifyConsoleAccounting,accountingSlots} from './verify-console-accounting.mjs';
const e=JSON.parse(fs.readFileSync(process.argv[2]));
const check=x=>verifyConsoleAccounting(x.header,x.proofs,x.config,x.observed);
assert.deepEqual(check(e),e.result);
assert.equal(e.observed.credit,'0');
const checks=['fresh zero-credit withdrawal state'];
for(const[name,mutate]of[
 ['contradictory credit',x=>x.observed.credit='1'],
 ['contradictory liability',x=>x.observed.unpaidLiability=String(BigInt(x.observed.unpaidLiability)+1n)],
 ...['wallet','owner','custody'].map(k=>['contradictory '+k+' balance',x=>x.observed.balances[k]=String(BigInt(x.observed.balances[k])+1n)]),
 ['header root',x=>x.header.stateRoot='0x'+'11'.repeat(32)],
 ['missing custody proof',x=>delete x.proofs.custody],
 ['missing token proof',x=>delete x.proofs.token],
 ['corrupted custody account node',x=>x.proofs.custody.accountProof[0]='0xc0'],
 ['corrupted token account node',x=>x.proofs.token.accountProof[0]='0xc0'],
 ['missing liability slot',x=>x.proofs.custody.storageProof.shift()],
 ['missing other account credit',x=>x.proofs.custody.storageProof.pop()],
 ['contradictory proof value',x=>x.proofs.token.storageProof[0].value='0xff'],
 ['wrong token code selection',x=>x.config.contracts.token.codeHash='0x'+'11'.repeat(32)],
 ['wrong custody code selection',x=>x.config.contracts.custody.codeHash='0x'+'11'.repeat(32)]
]){const c=structuredClone(e);mutate(c);assert.throws(()=>check(c),undefined,name);checks.push(name+' rejected');}
assert.equal(accountingSlots(e.config,e.config.contracts.wallet.address).token.length,2);
checks.push('wallet owner balance key deduplicated');
console.log(JSON.stringify({passed:checks.length,checks,scope:'Selected research fixture and local header only; not arbitrary tokens or public consensus.'},null,2));
