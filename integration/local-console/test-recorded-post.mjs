import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {recordedLookup, exampleHash} from './published-post-reader.mjs';
import {createPublishedPostServer} from './server.mjs';

const example = new URL('../../evidence/published-post-reader-20261122/proof-reads.json', import.meta.url);

test('independent reader replays the selected post after the node is gone', async () => {
  const lookup = await recordedLookup();
  const result = await lookup(exampleHash);
  assert.equal(result.hash,exampleHash);
  assert.equal(result.status,'settled');
  assert.equal(result.source,'recorded');
  assert.equal(result.text,'reviewed through the local signing desk');
  assert.equal(result.block.number,'0x12');
  assert.equal(result.settlement.fee, '5000000000000000000000');
  await assert.rejects(lookup('0x'+'ff'.repeat(32)), /covers only the example/);
});

test('missing, conflicting or mislabelled recorded evidence cannot verify a post', async t => {
  const dir = await mkdtemp(path.join(tmpdir(),'caw-reader-'));
  t.after(() => rm(dir,{force:true,recursive:true}));
  const source = JSON.parse(await readFile(example,'utf8'));
  for (const [name,edit] of [
    ['missing',data => {data.calls = data.calls.filter(call => call.method !== 'eth_getRawTransactionByHash');}],
    ['duplicate',data => {data.calls.push(data.calls[0]);}],
    ['anchor',data => {data.blockHash = '0x'+'ab'.repeat(32);}],
    ['receipt',data => {data.calls.find(call => call.method === 'eth_getTransactionReceipt').result.logs = [];}]
  ]) {
    const copy = structuredClone(source);
    edit(copy);
    const file = path.join(dir,name+'.json');
    await writeFile(file,JSON.stringify(copy));
    await assert.rejects(async () => (await recordedLookup(file))(exampleHash),name);
  }
});

test('reader endpoint accepts one hash and serves only reading routes', async t => {
  const server = createPublishedPostServer(await recordedLookup());
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => {server.closeAllConnections();server.close(resolve);}));
  const origin = 'http://127.0.0.1:'+ server.address().port;
  const query = (route,body,headers={}) => fetch(origin+route,{method:'POST',
    headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const read = '/api/paid-post/read';
  assert.equal((await query(read,{hash:exampleHash,review:{}})).status,422);
  assert.equal((await query(read,{hash:exampleHash},{origin:'https://example.invalid'})).status,403);
  assert.equal((await query(read,{hash:exampleHash},{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await query('/api/paid-post/verify',{})).status,404);
  assert.equal((await fetch(origin+'/api/state')).status,404);
  assert.equal((await fetch(origin+'/app.mjs')).status,404);
  assert.equal((await fetch(origin+'/published-post.html')).status,200);
  assert.equal((await (await query(read,{hash:exampleHash})).json()).source,'recorded');
});
