import assert from 'node:assert/strict';
import { keccak256 } from 'ethers';
import { inventory } from './inventory.mjs';
let checks=0;
function record(code='0x00') { return { chainId:'1',blockNumber:'100',blockHash:'0x'+'11'.repeat(32),address:'0x'+'22'.repeat(20),codeHash:keccak256(code),code }; }
function ok(code,kinds) { const r=record(code),x=inventory(r,r);assert.deepEqual(x.flags.map(f=>f.kind),kinds);assert.equal(x.productionAccepted,false);assert.equal(x.status,'REVIEW_REQUIRED');checks++;return x; }
ok('0x00',[]);
ok('0x60f460ff00',[]); // Embedded DELEGATECALL/SELFDESTRUCT bytes are PUSH data.
ok('0xf1f2f4faff',['call','callcode','delegatecall','staticcall','selfdestruct']);
ok('0x61ff',['truncated-push']);
assert.equal(ok('0xef0100'+'33'.repeat(20),['delegation-designator']).flags[0].target,'0x'+'33'.repeat(20));
assert.equal(ok('0xef0000',[]).format,'unsupported-prefixed-code');
for(const key of ['chainId','blockNumber','blockHash','address','codeHash']) {
 const r=record(),e={...r}; e[key]=key==='chainId'?'2':key==='blockNumber'?'101':r[key].replace(/1|2|b/, '3');
 if(e[key]===r[key]) e[key]='0x'+'44'.repeat(32);
 assert.throws(()=>inventory(r,e),new RegExp('BINDING_'+key));checks++;
}
for(const code of ['0x','0x0','0xgg','00']) {const r={...record(),code};assert.throws(()=>inventory(r,r),/CODE/);checks++;}
let r={...record(),code:'0x01'};assert.throws(()=>inventory(r,r),/CODE_HASH/);checks++;
r={...record(),code:'0x'+'00'.repeat(1024*1024+1)};assert.throws(()=>inventory(r,r),/CODE_LIMIT/);checks++;
for(const patch of [{chainId:1},{blockNumber:'01'},{address:'0x12'},{blockHash:'pending'}]) {r={...record(),...patch};assert.throws(()=>inventory(r,r),/CONTEXT/);checks++;}
console.log(JSON.stringify({checks,syntheticInputs:true,actualTokenReviewed:false,productionAccepted:false}));
