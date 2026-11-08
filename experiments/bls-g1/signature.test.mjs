import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bls12_381} from '@noble/curves/bls12-381';
import {inspectG2Encoding, inspectPopSignature} from './signature.mjs';
const read = p => readFileSync(new URL('../../'+p,import.meta.url));
const inventory = JSON.parse(read('evidence/bls-signatures-20261107/vector-inventory.json'));
assert.equal(inventory.length,44);
const decode = text => {
  assert.match(text,/^(0x)?[0-9a-f]+$/);
  const hex = text.startsWith('0x') ? text.slice(2) : text;
  assert.equal(hex.length%2,0); return Buffer.from(hex,'hex');
};
const cases = inventory.map(a => {
  const b=read(a.path); assert.equal(b.length,a.size);
  assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);
  return {...JSON.parse(b),name:a.archivePath};
});
const verifyCases=cases.filter(v=>v.name.startsWith('./verify/'));
assert.equal(verifyCases.length,29);
const argumentsFor=v=>[decode(v.input.pubkey),decode(v.input.message),decode(v.input.signature)];
for(const v of cases) {
  test('external '+v.name,()=>{
    let actual=false;
    try {
      if(v.name.startsWith('./deserialization_G2/')) inspectG2Encoding(decode(v.input.signature));
      else {
        const result=inspectPopSignature(...argumentsFor(v));
        assert.equal(result.signatureVerifiedUnderSuppliedKey,true);
        for(const [key,value] of Object.entries(result)) {
          if(typeof value==='boolean'&&key!=='signatureVerifiedUnderSuppliedKey') assert.equal(value,false,key);
        }
        assert.ok(Object.isFrozen(result));
      }
      actual=true;
    } catch(error) {
      // Assertions must not be mistaken for an expected verifier rejection.
      if(error.code!=='BLS_POP_SIGNATURE_REJECTED') throw error;
    }
    assert.equal(actual,v.output);
  });
}
const positive=verifyCases.find(v=>v.output);
test('explicit POP succeeds while pinned default NUL fails on identical vector',()=>{
  const [key,msg,sig]=argumentsFor(positive);
  assert.equal(bls12_381.verify(sig,msg,key),false);
  assert.equal(bls12_381.verify(sig,msg,key,{DST:'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_'}),true);
});
test('one message-bit mutation rejects the same key and signature',()=>{
  const a=argumentsFor(positive); a[1][0]^=1;
  assert.throws(()=>inspectPopSignature(...a),{code:'BLS_POP_SIGNATURE_REJECTED'});
});
test('unsupported input shapes lengths and ciphersuite override reject',()=>{
  const a=argumentsFor(positive);
  for(const value of [null,new Uint8Array(32),Buffer.alloc(31),Buffer.alloc(33)]) {
    assert.throws(()=>inspectPopSignature(a[0],value,a[2]),{code:'BLS_POP_SIGNATURE_REJECTED'});
  }
  assert.throws(()=>inspectPopSignature(...a,{DST:'other'}),{code:'BLS_POP_SIGNATURE_REJECTED'});
  assert.throws(()=>inspectG2Encoding(Buffer.alloc(92)),{code:'BLS_POP_SIGNATURE_REJECTED'});
});
test('canonical G2 infinity deserializes but cannot be a single signature',()=>{
  const zero=Buffer.alloc(96);zero[0]=0xc0;
  assert.equal(inspectG2Encoding(zero).isInfinity,true);
  const a=argumentsFor(positive);
  assert.throws(()=>inspectPopSignature(a[0],a[1],zero),{code:'BLS_POP_SIGNATURE_REJECTED'});
});
