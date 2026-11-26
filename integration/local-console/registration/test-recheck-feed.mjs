import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {decodeRlp, encodeRlp, keccak256, toBeHex} from 'ethers';
import {recheckFeed} from './recheck-feed.mjs';
const sample = file => JSON.parse(readFileSync(new URL('./samples/'+file,import.meta.url)));
const packet = sample('peer-check/located.json');
const original = {block:packet.originalBlockHash, tx:packet.transactionHash, archive:sample('branch-check/archive.json'), packet};
test('rebuild substitutes the current receipt, is repeatable, and retains an unresolved record',()=>{
  const check=entries=>recheckFeed(packet.checkpointHash,entries);
  const rebuilt=check([original]);
  assert.deepEqual(check([original]),rebuilt);
  assert.deepEqual(rebuilt.posts[0].post.credits.map(c=>c.amount),['2000.0','3000.0']);
  const missing=check([{...original,packet:{...packet,observed:null}}]);
  assert.equal(missing.posts.length,0); assert.equal(missing.unresolved[0].tx,original.tx);
  assert.throws(()=>check([original,original]),/Duplicate/);
});
test('two genuine posts sharing a block remain ordered and a conflicting pin rejects the entire feed',()=>{
  const archive=sample('mixed-paid-post.json');
  const block=keccak256(archive.header);
  const header=decodeRlp(archive.header);
  header[0]=block; header[8]=toBeHex(BigInt(header[8])+1n); header[11]=toBeHex(BigInt(header[11])+1n);
  const child=encodeRlp(header), pin=keccak256(child);
  const entries=[1,2].map(index=>{
    const tx=keccak256(archive.transactions[index]);
    return {block,tx,archive,packet:{originalBlockHash:block,transactionHash:tx,checkpointHash:pin,
      checkpointHeight:'0x'+BigInt(header[8]).toString(16),originalEvidence:{headers:[child,archive.header]},observed:null}};
  });
  assert.deepEqual(recheckFeed(pin,entries).posts.map(p=>p.position),[2,1]);
  assert.throws(()=>recheckFeed(pin,[entries[0],original]),/selection/);
});
