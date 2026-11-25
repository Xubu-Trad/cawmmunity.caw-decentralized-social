import assert from 'node:assert/strict';
import test from 'node:test';
import {capsuleEnvelopeRoot} from './verify-post-capsule.mjs';

// Independent roots from Python rlp and Keccak over a 17-way branch.
// RLP(index) keys 0x80 and 0x01 select slots 8 and 0 with one nibble left.
test('framing a valid envelope can exceed the maximum envelope size',()=>{
  const adjacent='0x'+'42'.repeat(32);
  for(const [length,root] of [
    [65527,'c748ba9475af13fc901f8d727f9353a2a6416e0ad88951dd027ed959dadf027c'],
    [65532,'92fe9f192e81cbea0848c4bfabe2886d96026c63d3caa91e7006c42d1217201c'],
    [65536,'18d4cccdf53a44dd4d61941627868cd804a0e94644bc1b5d4eb8bd19e4afce37']
  ]){
    assert.equal(capsuleEnvelopeRoot(['0x'+'a5'.repeat(length),adjacent]),'0x'+root);
  }
  assert.throws(()=>capsuleEnvelopeRoot(['0x'+'a5'.repeat(65537),adjacent]),/oversized encoded bytes/);
});
