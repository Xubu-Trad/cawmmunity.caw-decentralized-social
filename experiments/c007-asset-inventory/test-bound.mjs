import fs from 'node:fs';
import assert from 'node:assert/strict';
import {boundInventory} from './bound-inventory.mjs';
import {keccak256} from 'ethers';
const b=JSON.parse(fs.readFileSync(process.argv[2]));
// Separate account-only projection; original rejected storage evidence is retained.
const batch=b.batches.at(-1);
const e={header:b.header,proof:{...batch.proof,storageProof:[]},code:batch.code};
const s={chainId:'31337',blockNumber:BigInt(b.header.number).toString(),blockHash:b.header.hash,address:batch.address,codeHash:keccak256(batch.code),profile:'shanghai-17'};
const run=(a=e,c=s)=>boundInventory(JSON.stringify(a),JSON.stringify(c));
const result=run();assert.equal(result.accountProofAgainstSelectedHeaderVerified,true);assert.equal(result.productionAccepted,false);assert.equal(result.chainIdAuthenticated,false);
const negatives=[];
function reject(name,mutate){let a=structuredClone(e),c=structuredClone(s);mutate(a,c);assert.throws(()=>run(a,c));negatives.push(name);}
reject('changed runtime',a=>a.code+='00');
reject('changed account proof',a=>{const p=a.proof.accountProof;p[0]=p[0].slice(0,-2)+(p[0].endsWith('00')?'01':'00');});
reject('wrong account',(_,c)=>c.address='0x'+'44'.repeat(20));
reject('wrong selected header',(_,c)=>c.blockHash='0x'+'44'.repeat(32));
reject('changed header state root',a=>a.header.stateRoot='0x'+'44'.repeat(32));
reject('wrong selected code hash',(_,c)=>c.codeHash='0x'+'44'.repeat(32));
reject('wrong block number',(_,c)=>c.blockNumber=String(BigInt(c.blockNumber)+1n));
reject('storage proof not silently ignored',a=>a.proof.storageProof=[{key:'0x0',value:'0x0',proof:[]}]);
reject('extra selection field',(_,c)=>c.approved=true);
assert.throws(()=>boundInventory(JSON.stringify(e),JSON.stringify(s).replace('{','{"chainId":"1",')));negatives.push('duplicate selection key');
console.log(JSON.stringify({syntheticCapturedAccount:true,actualCawTokenProof:false,result,negativeControls:negatives},null,2));
