import fs from 'node:fs';import assert from 'node:assert/strict';import {verifyConsoleAuthority} from './verify-console-authority.mjs';
const e=JSON.parse(fs.readFileSync(process.argv[2]));
const check=x=>verifyConsoleAuthority(x.header,x.proofs,x.config,x.observed);
assert.deepEqual(check(e),e.result);const checks=['valid fresh owner/epoch/nonce proof'];
for(const[name,mutate]of[
 ['contradictory owner',x=>x.observed.owner='0x'+'11'.repeat(20)],
 ['contradictory epoch',x=>x.observed.epoch=String(BigInt(x.observed.epoch)+1n)],
 ['contradictory nonce',x=>x.observed.nonce=String(BigInt(x.observed.nonce)+1n)],
 ['header root',x=>x.header.stateRoot='0x'+'11'.repeat(32)],
 ['missing registry proof',x=>delete x.proofs.registry],
 ['missing owner proof',x=>delete x.proofs.owner],
 ['registry account node',x=>x.proofs.registry.accountProof[0]='0xc0'],
 ['posting slot value',x=>x.proofs.posting.storageProof[0].value='0xff'],
 ['wrong registry code selection',x=>x.config.contracts.registry.codeHash='0x'+'11'.repeat(32)],
 ['wrong posting code selection',x=>x.config.contracts.posting.codeHash='0x'+'11'.repeat(32)],
 ['wrong owner address',x=>x.proofs.owner.address='0x'+'11'.repeat(20)]
]){const c=structuredClone(e);mutate(c);assert.throws(()=>check(c),undefined,name);checks.push(name+' rejected');}
console.log(JSON.stringify({passed:checks.length,checks,scope:'Fresh state-proof fixture and mutations; selected local header, not public consensus.'},null,2));
