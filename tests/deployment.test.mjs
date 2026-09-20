import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateEnvironment, loadEnvironment, loadFixtures } from '../public/deployment.mjs';

const seed = JSON.parse(await readFile(new URL('../public/deployment.json', import.meta.url), 'utf8'));
test('alpha configuration declares only the provisional synthetic environment', () => {
  const before = JSON.stringify(seed);
  const result = validateEnvironment(seed);
  assert.equal(result.mode, 'simulation');
  assert.equal(result.walletEnabled, false);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.contracts) && Object.isFrozen(result.rpcUrls));
  assert.notEqual(result.contracts, seed.contracts);
  assert.equal(JSON.stringify(seed), before);
});
test('alpha refuses chain, wallet, contract, upload and unsupported scenario settings', () => {
  for (const patch of [
    { mode: 'testnet' }, { mode: 'mainnet' }, { chainId: 1 }, { walletEnabled: true },
    { mediaUploadEnabled: true }, { rpcUrls: ['https://example.invalid'] },
    { contracts: { custody: '0x0000000000000000000000000000000000000001' } },
    { scenario: 'canonical' }, { release: '1.0' }
  ]) assert.throws(() => validateEnvironment({ ...seed, ...patch }), /simulation only/);
});
test('alpha refuses missing, unknown and malformed fields without changing input', () => {
  for (const value of [null, [], {}, { ...seed, extra: true }, { ...seed, contracts: [] }, { ...seed, rpcUrls: null }])
    assert.throws(() => validateEnvironment(value));
  for (const field of Object.keys(seed)) { const value = structuredClone(seed); delete value[field]; assert.throws(() => validateEnvironment(value)); }
});
test('configuration loader requests only the relative local manifest without credentials', async () => {
  let calls = 0;
  const result = await loadEnvironment(async (url, options) => {
    calls++;
    assert.equal(url.href, new URL('../public/deployment.json', import.meta.url).href);
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store'); assert.equal(options.referrerPolicy,'no-referrer'); assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify(seed));
  });
  assert.equal(calls, 1); assert.equal(result.mode, 'simulation');
});
test('configuration loader rejects errors, oversized bodies, invalid JSON and invalid UTF-8', async () => {
  for (const response of [new Response('missing', { status: 404 }), new Response(' '.repeat(4097)),
    new Response('{'), new Response(new Uint8Array([255]))])
    await assert.rejects(loadEnvironment(async () => response));
  let cancelled = false, released = false;
  await assert.rejects(loadEnvironment(async () => ({ ok: false, body: { async cancel() { cancelled = true; throw new Error('cancel failed'); } } })), /unavailable/);
  assert.equal(cancelled, true);
  await assert.rejects(loadEnvironment(async () => ({ ok: true, body: { getReader() { return {
    async read() { throw new Error('original stream failure'); },
    async cancel() { throw new Error('cancel failed'); },
    releaseLock() { released = true; }
  }; } } })), /original stream failure/);
  assert.equal(released, true);
});

test('configuration refuses shadowed fields before validating the simulation schema', async () => {
  const valid=JSON.stringify(seed);
  for(const prefix of ['"mode":"mainnet",','"walletEnabled":true,','"\\u006dode":"mainnet",']) {
    const text='{'+prefix+valid.slice(1);
    assert.deepEqual(JSON.parse(text),seed);
    await assert.rejects(loadEnvironment(async()=>new Response(text)),{code:'BOUNDED_JSON_DUPLICATE_KEY'});
  }
});

test('configuration rejects a UTF-8 BOM instead of silently removing bytes', async () => {
  await assert.rejects(loadEnvironment(async()=>new Response('\ufeff'+JSON.stringify(seed))),{code:'BOUNDED_JSON_SYNTAX'});
});

test('fixture loading uses only its bundled relative URL with bounded private request settings', async () => {
  const text=await readFile(new URL('../public/fixtures.json',import.meta.url),'utf8');
  let calls=0;
  const actual=await loadFixtures(async(url,options)=>{
    calls++;
    assert.equal(url.href,new URL('../public/fixtures.json',import.meta.url).href);
    assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(text);
  });
  assert.deepEqual(actual,JSON.parse(text));assert.equal(calls,1);
});

test('fixture loading refuses oversized, ambiguous, invalid UTF-8 and unavailable inputs', async () => {
  for(const make of [()=>new Response(' '.repeat(65537)),()=>new Response('{"seed":1,"seed":2}'),
    ()=>new Response(new Uint8Array([255])),()=>new Response('missing',{status:404})]){
    let calls=0;
    await assert.rejects(loadFixtures(async()=>{calls++;return make();}));
    assert.equal(calls,1);
  }
});

test('a fixture fetch failure propagates without a fallback or second endpoint', async () => {
  const original=new Error('request refused');let calls=0;
  await assert.rejects(loadFixtures(async()=>{calls++;throw original;}),error=>error===original);
  assert.equal(calls,1);
});
