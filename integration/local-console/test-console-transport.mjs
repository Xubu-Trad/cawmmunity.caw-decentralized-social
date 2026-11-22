import assert from 'node:assert/strict';
import http from 'node:http';
import {test} from 'node:test';
import {createConsole} from './server.mjs';

test('console only consumes unambiguous UTF-8 JSON at both HTTP boundaries', async t => {
  const chain = '0x7a69';
  const hash = '0x' + '00'.repeat(32);
  let reply = id => JSON.stringify({jsonrpc:'2.0', id, result:'0x0'});
  let reads = 0;
  const upstream = http.createServer(async (req, res) => {
    const parts = [];
    for await (const part of req) parts.push(part);
    const {id, method} = JSON.parse(Buffer.concat(parts));
    reads++;
    assert.equal(method, 'eth_chainId');
    res.end(reply(id));
  });
  async function listen(server) {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      server.closeAllConnections();
      return new Promise(resolve => server.close(resolve));
    });
    return 'http://127.0.0.1:' + server.address().port;
  }
  const rpcUrl = await listen(upstream);
  const contracts = Object.fromEntries(['wallet','registry','custody','token','posting'].map((key,i) =>
    [key, {address:'0x' + String(i+1).repeat(40), codeHash:hash}]));
  const {server} = createConsole({rpcUrl, contracts, genesisHash:hash, controller:contracts.wallet.address,
    postingDeployment:{blockNumber:'0x0',blockHash:hash,transactionHash:hash}});
  const base = await listen(server);
  async function rejects(body, expected) {
    const response = await fetch(base + '/api/post-plan', {
      method:'POST', headers:{'Content-Type':'application/json'}, body
    });
    assert.equal(response.status, 422);
    assert.match((await response.json()).error, expected);
  }
  const invalidText = Buffer.concat([Buffer.from('{"text":"'), Buffer.from([0xff]), Buffer.from('"}')]);
  await rejects('{"text":"a","te\\u0078t":"b"}', /DUPLICATE_KEY/);
  await rejects(invalidText, /utf-8/i);
  assert.equal(reads, 0);

  const request = JSON.stringify({text:'ordinary non-ASCII input 🌙'});
  reply = id => `{"jsonrpc":"2.0","id":${id},"result":"${chain}","result":"0x0"}`;
  await rejects(request, /DUPLICATE_KEY/);
  reply = id => Buffer.concat([Buffer.from(`{"jsonrpc":"2.0","id":${id},"result":"0x0","label":"`),
    Buffer.from([0xff]), Buffer.from('"}')]);
  await rejects(request, /utf-8/i);
  reply = id => JSON.stringify({jsonrpc:'2.0', id, result:'0x0'});
  await rejects(request, /WRONG_CHAIN/);
  assert.equal(reads, 3);
});

test('browser API traffic is same-origin and static links can open the console', async t => {
  const hash = '0x' + '00'.repeat(32);
  const contracts = Object.fromEntries(['wallet','registry','custody','token','posting'].map((key, i) =>
    [key, {address:'0x' + String(i+1).repeat(40), codeHash:hash}]));
  let rpcCalls = 0;
  const node = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const {id} = JSON.parse(Buffer.concat(chunks));
    rpcCalls++;
    res.end(JSON.stringify({jsonrpc:'2.0', id, result:'0x1'}));
  });
  async function start(server) {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      server.closeAllConnections();
      return new Promise(resolve => server.close(resolve));
    });
    return 'http://127.0.0.1:' + server.address().port;
  }
  const rpcUrl = await start(node);
  const {server} = createConsole({rpcUrl, contracts, genesisHash:hash, controller:contracts.wallet.address,
    postingDeployment:{blockNumber:'0x0',blockHash:hash,transactionHash:hash}});
  const base = await start(server);
  for (const site of ['same-site','cross-site','unexpected']) {
    const response = await fetch(base + '/api/state', {headers:{'Sec-Fetch-Site':site}});
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'LOCAL_ORIGIN_REQUIRED');
  }
  assert.equal(rpcCalls, 0);
  const landing = await fetch(base, {headers:{'Sec-Fetch-Site':'cross-site'}});
  assert.equal(landing.status, 200);
  await landing.text();
  for (const headers of [{}, {'Sec-Fetch-Site':'same-origin'}, {'Sec-Fetch-Site':'none'}]) {
    const response = await fetch(base + '/api/state', {headers});
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error, 'WRONG_CHAIN');
  }
  assert.equal(rpcCalls, 3);
});
test('an ordinary account refresh leaves the separate signing desk usable', async t => {
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let first = true;
  const node = http.createServer(async (req, res) => {
    const parts = [];
    for await (const part of req) parts.push(part);
    const {id} = JSON.parse(Buffer.concat(parts));
    if (first) { first = false; enter(); await gate; }
    res.end(JSON.stringify({jsonrpc:'2.0',id,result:'0x0'}));
  });
  async function start(server) {
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    return 'http://127.0.0.1:' + server.address().port;
  }
  const endpoint = await start(node);
  const hash = '0x' + '00'.repeat(32);
  const contracts = Object.fromEntries(['wallet','registry','custody','token','posting'].map((name,i) =>
    [name,{address:'0x'+String(i+1).repeat(40),codeHash:hash}]));
  const {server} = createConsole({rpcUrl:endpoint,paidPostRpcUrl:endpoint,controller:contracts.wallet.address,
    genesisHash:hash, contracts, postingDeployment:{blockNumber:'0x0',blockHash:hash,transactionHash:hash}});
  const base = await start(server);
  const refresh = fetch(base+'/api/state');
  try {
    await entered;
    assert.equal((await fetch(base+'/api/state')).status,429);
    const response = await fetch(base+'/api/paid-post/prepare', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'
    });
    assert.equal(response.status,422);
    assert.match((await response.json()).error,/Wrong fixture chain ID/);
  } finally {
    release();
    await refresh;
  }
});
