import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { collectStatic } from '../scripts/build.mjs';
import { createStaticArchive } from '../scripts/package-static.mjs';

test('static archive is byte reproducible and contains exactly the build assets', async () => {
  const a = await createStaticArchive(), b = await createStaticArchive();
  assert.deepEqual(a.bytes, b.bytes); assert.equal(a.sha256,b.sha256);
  assert.equal(a.sha256,createHash('sha256').update(a.bytes).digest('hex'));
  const entries = await collectStatic(); let offset = 0;
  assert.equal(a.files,23); assert.equal(a.manifestSha256,entries.at(-1).sha256);
  for (const entry of entries) {
    const h = a.bytes.subarray(offset,offset+512);
    const string = (start,end) => h.subarray(start,end).toString('ascii').replace(/\0.*$/s,'');
    assert.equal(string(0,100),entry.name); assert.equal(string(257,263),'ustar');
    assert.equal(string(263,265),'00'); assert.equal(h[156],48);
    assert.equal(parseInt(string(100,108),8),0o644);
    for (const [start,end] of [[108,116],[116,124],[136,148]]) assert.equal(parseInt(string(start,end),8),0);
    assert.ok(h.subarray(157,257).every(x=>x===0));
    assert.ok(h.subarray(265,512).every(x=>x===0));
    const size=parseInt(string(124,136),8); assert.equal(size,entry.bytes.length);
    const declared=parseInt(string(148,156),8);
    assert.equal(declared,h.reduce((sum,x,i)=>sum+(i>=148&&i<156?32:x),0));
    offset+=512; assert.deepEqual(a.bytes.subarray(offset,offset+size),entry.bytes);
    const pad=(512-size%512)%512;assert.ok(a.bytes.subarray(offset+size,offset+size+pad).every(x=>x===0));offset+=size+pad;
  }
  assert.equal(a.bytes.length-offset,1024); assert.ok(a.bytes.subarray(offset).every(x=>x===0));
});
