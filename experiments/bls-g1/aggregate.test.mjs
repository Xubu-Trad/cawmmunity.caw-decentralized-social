import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bls12_381} from '@noble/curves/bls12-381';
import {inspectPopAggregateEquation as inspect} from './aggregate.mjs';
const read = p => readFileSync(new URL('../../'+p,import.meta.url));
const inv=JSON.parse(read('evidence/bls-aggregate-20261108/vector-inventory.json'));
assert.equal(inv.length,12);
const decode=h=>{assert.match(h,/^0x(?:[0-9a-f]{2})*$/);return Buffer.from(h.slice(2),'hex');};
const cases=inv.map(a=>{
 const b=read(a.path);assert.equal(b.length,a.size);
 assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);
 return {...JSON.parse(b),name:a.archivePath};
});
const args=v=>[v.input.pubkeys.map(decode),decode(v.input.message),decode(v.input.signature)];
const check=r=>{
 assert.equal(r.aggregateEquationVerified,true);assert.equal(r.publicKeysValidated,true);
 for(const [k,v] of Object.entries(r)) if(typeof v==='boolean'&&!['aggregateEquationVerified','publicKeysValidated'].includes(k))assert.equal(v,false,k);
 assert.ok(Object.isFrozen(r));
};
const rejected=f=>assert.throws(f,{code:'BLS_AGGREGATE_EQUATION_REJECTED'});
for(const v of cases)test('external '+v.name,()=>{
 let actual=false;
 try{check(inspect(...args(v)));actual=true;}
 catch(e){if(e.code!=='BLS_AGGREGATE_EQUATION_REJECTED')throw e;}
 assert.equal(actual,v.output);
});
const one=cases.find(v=>v.output&&v.input.pubkeys.length===1);
const two=cases.find(v=>v.output&&v.input.pubkeys.length===2);
const G1=bls12_381.G1.ProjectivePoint,G2=bls12_381.G2.ProjectivePoint;
const enc=p=>Buffer.from(p.toRawBytes(true));
test('key permutation leaves same equation without asserting ordered committee membership',()=>{
 const a=args(two);a[0].reverse();check(inspect(...a));
});
test('one omitted participant rejects original aggregate signature',()=>{
 const a=args(two);a[0].pop();rejected(()=>inspect(...a));
});
test('one appended duplicate rejects original signature',()=>{
 const a=args(two);a[0].push(Buffer.from(a[0][0]));rejected(()=>inspect(...a));
});
test('same-key multiplicity with doubled signature succeeds, deduplication rejects',()=>{
 const [keys,msg,sig]=args(one);const doubled=enc(G2.fromHex(sig).multiply(2n));
 const r=inspect([keys[0],keys[0]],msg,doubled);check(r);assert.equal(r.suppliedKeyCount,2);
 rejected(()=>inspect(keys,msg,doubled));
});
test('one message-bit mutation rejects unchanged keys and signature',()=>{
 const a=args(two);a[1][0]^=1;rejected(()=>inspect(...a));
});
test('zero-sum public keys reject even with canonical infinity signature',()=>{
 const [keys,msg]=args(one);const p=G1.fromHex(keys[0]);
 rejected(()=>inspect([keys[0],enc(p.negate())],msg,enc(G2.ZERO)));
});
test('unsupported shapes count lengths sparse arrays and overrides reject',()=>{
 const [keys,msg,sig]=args(one);
 for(const value of [null,{},[],Array(1),Array(33).fill(keys[0]),[new Uint8Array(keys[0])],[Buffer.alloc(47)]])rejected(()=>inspect(value,msg,sig));
 rejected(()=>inspect(keys,Buffer.alloc(31),sig));
 rejected(()=>inspect(keys,msg,Buffer.alloc(95)));
 rejected(()=>inspect(keys,msg,sig,{trust:true}));
});
test('32 supplied occurrences supported without claiming mainnet committee support',()=>{
 const [keys,msg,sig]=args(one);
 const r=inspect(Array(32).fill(keys[0]),msg,enc(G2.fromHex(sig).multiply(32n)));
 check(r);assert.equal(r.suppliedKeyCount,32);
});
test('compensating key construction passes equation but proves no participant possession',()=>{
 const [keys,msg,sig]=args(one);const A=G1.fromHex(keys[0]);
 const B=G1.BASE;const C=A.subtract(B);
 assert.ok(!C.equals(G1.ZERO));assert.ok(!B.equals(A));
 // B + C = A. No private keys, signatures or possession proofs for B/C are used.
 const r=inspect([enc(B),enc(C)],msg,sig);check(r);
 assert.equal(r.proofOfPossessionVerified,false);
 assert.equal(r.signerAuthorizationVerified,false);
});
