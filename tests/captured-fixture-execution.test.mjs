import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {captureFixture} from '../experiments/captured-fixture/capture-fixture.mjs';
import {executeReviewedGraph} from '../experiments/captured-fixture/graph-engine.mjs';
import {inspectPinnedFixtureOperatorPolicy} from '../reference/pinned-fixture-operator-policy.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const inventory = JSON.parse(read('evidence/dependency-substitution-20261107/retained-source-inventory.json'));
const sources = () => new Map(inventory.files.map(f => [f.path, read(f.path)]));
const dependency = 'reference/operator-genesis-reference.mjs';
function args() {
  const config = read('evidence/consensus-capella-bootstrap/config.yaml');
  const meta = read('evidence/consensus-capella-bootstrap/meta.yaml');
  const operator = read('evidence/bootstrap-operator-reference-20261107/operator_reference.json');
  const beacon = '0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264';
  return [{schema:'caw-bootstrap-selection/1', network:'ethereum-minimal-capella-fixture',
    profile:'minimal-capella-32-structural-only', selectedBeaconRoot:beacon,
    anchor:{source:'externally-retained-fixture-metadata', beaconRoot:beacon, sha256:sha(meta)}},
  config, meta, sha(config), sha(meta), operator];
}
const fixtureReject = fn => assert.throws(fn, {code:'CAPTURED_FIXTURE_REJECTED'});
const control = (source, edges = {}) => executeReviewedGraph(
  new Map([['control.mjs', source]]), {'control.mjs':edges}, 'control.mjs', 'run', []);

test('EX-01 retained captured graph matches direct fixture result', async () => {
  const result = await captureFixture(sources()).run(...args());
  assert.deepEqual(result.fixtureResult, inspectPinnedFixtureOperatorPolicy(...args()));
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'boolean' && key !== 'capturedLocalSourcesMatched') assert.equal(value, false, key);
  }
  assert.ok(Object.isFrozen(result));
});

test('EX-02 changed dependency rejects before graph execution', () => {
  const input = sources();
  input.get(dependency)[0] ^= 1;
  fixtureReject(() => captureFixture(input));
});

test('EX-03 deleted acquisition tree cannot alter captured evaluation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'caw-captured-input-'));
  try {
    mkdirSync(join(dir, 'reference'));
    for (const [path, bytes] of sources()) writeFileSync(join(dir, path), bytes);
    const captured = captureFixture(new Map(inventory.files.map(f => [f.path, readFileSync(join(dir, f.path))])));
    rmSync(dir, {recursive:true});
    assert.deepEqual((await captured.run(...args())).fixtureResult, inspectPinnedFixtureOperatorPolicy(...args()));
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('EX-04 missing extra renamed and malformed modules reject', () => {
  const missing = sources(); missing.delete(dependency); fixtureReject(() => captureFixture(missing));
  const extra = sources(); extra.set('unreviewed.mjs', Buffer.from('')); fixtureReject(() => captureFixture(extra));
  const renamed = sources(); renamed.set('alias.mjs', renamed.get(dependency)); renamed.delete(dependency);
  fixtureReject(() => captureFixture(renamed));
  const malformed = sources(); malformed.set(dependency, 'not bytes'); fixtureReject(() => captureFixture(malformed));
  const oversized = sources(); oversized.set(dependency, Buffer.alloc(65537)); fixtureReject(() => captureFixture(oversized));
  fixtureReject(() => captureFixture(sources(), 'replacement-pin'));
});

test('EX-05 authored controls reject unlisted static imports and path aliases', async () => {
  for (const specifier of ['node:fs', 'crypto', './alias.mjs', '../reference/operator-genesis-reference.mjs']) {
    await assert.rejects(control(`import x from ${JSON.stringify(specifier)}; export function run(){return x;}`),
      {code:'CAPTURED_GRAPH_REJECTED'});
  }
  // This passes specifier comparison and reaches link resolution, without an admitted target.
  await assert.rejects(control('import x from "missing"; export function run(){return x;}',
    {missing:'absent.mjs'}), {code:'CAPTURED_GRAPH_REJECTED'});
});

test('EX-06 dynamic import reaches rejecting callback without default fallback', async () => {
  await assert.rejects(control('export async function run(){return import("node:fs");}'),
    {code:'CAPTURED_DYNAMIC_IMPORT_REJECTED'});
});

test('EX-07 caller buffer mutation after capture cannot change private source strings', async () => {
  const input = sources(); const captured = captureFixture(input);
  for (const bytes of input.values()) bytes.fill(0);
  input.clear();
  assert.deepEqual((await captured.run(...args())).fixtureResult, inspectPinnedFixtureOperatorPolicy(...args()));
});

test('EX-08 parse evaluation and invocation failure return no partial result', async () => {
  for (const code of ['not valid syntax !', 'throw new Error("top level"); export function run(){}',
    'export function run(){throw new Error("call");}']) {
    await assert.rejects(control(code), {code:'CAPTURED_GRAPH_REJECTED'});
  }
  await assert.rejects(captureFixture(sources()).run(...args().slice(1)), {code:'CAPTURED_FIXTURE_REJECTED'});
});

test('EX-09 separate executions have fresh module state', async () => {
  const code = 'let calls=0; export function run(){return ++calls;}';
  assert.equal(await control(code), 1); assert.equal(await control(code), 1);
  const captured = captureFixture(sources());
  assert.deepEqual(await captured.run(...args()), await captured.run(...args()));
});

test('EX-10 no explicit filesystem process require or fetch capabilities supplied', async () => {
  const result = await control('export function run(){return [typeof process,typeof require,typeof fetch];}');
  assert.deepEqual(result, ['undefined','undefined','undefined']);
  await assert.rejects(control('import {readFileSync} from "node:fs"; export function run(){return readFileSync("x");}'),
    {code:'CAPTURED_GRAPH_REJECTED'});
  // Host Buffer/createHash and function bridges remain trusted, not a sandbox claim.
});

test('EX-11 missing experimental flag rejects in a fresh process', () => {
  const url = new URL('../experiments/captured-fixture/graph-engine.mjs', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {requireResearchRuntime} from ${JSON.stringify(url)};
     try { requireResearchRuntime(); process.exitCode=2; }
     catch(e) { if(e.code!=='CAPTURED_RUNTIME_UNSUPPORTED') throw e; console.log(e.code); }`],
  {encoding:'utf8',timeout:5000,env:{...process.env,NODE_OPTIONS:''}});
  assert.equal(child.status, 0); assert.match(child.stdout, /CAPTURED_RUNTIME_UNSUPPORTED/);
});

test('EX-11 unsupported version label rejects, without claiming another runtime run', () => {
  const url = new URL('../experiments/captured-fixture/graph-engine.mjs', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--experimental-vm-modules','--input-type=module','-e',
    `import {requireResearchRuntime} from ${JSON.stringify(url)};
     Object.defineProperty(process,'version',{value:'v0.0.0'});
     try { requireResearchRuntime(); process.exitCode=2; }
     catch(e) { if(e.code!=='CAPTURED_RUNTIME_UNSUPPORTED') throw e; console.log(e.code); }`],
  {encoding:'utf8',timeout:5000,env:{...process.env,NODE_OPTIONS:''}});
  assert.equal(child.status, 0); assert.match(child.stdout, /CAPTURED_RUNTIME_UNSUPPORTED/);
});

test('EX-12 raw engine can report an invented authority claim without establishing it', async () => {
  assert.deepEqual(await control('export function run(){return {networkAuthenticated:true};}'),
    {networkAuthenticated:true});
  // This authored engine control bypasses fixed-fixture admission on purpose.
  const replacement = sources(); replacement.set(dependency, Buffer.from('export const invented=true;'));
  fixtureReject(() => captureFixture(replacement));
});

test('engine controls reject oversized source and excessive module count', async () => {
  await assert.rejects(control(' '.repeat(65537)), {code:'CAPTURED_GRAPH_REJECTED'});
  const modules = new Map(Array.from({length:6}, (_, i) => [`${i}.mjs`, 'export function run(){}']));
  await assert.rejects(executeReviewedGraph(modules,
    Object.fromEntries([...modules.keys()].map(k => [k, {}])), '0.mjs', 'run', []),
  {code:'CAPTURED_GRAPH_REJECTED'});
});

test('import attributes reject on an otherwise admitted crypto edge', async () => {
  await assert.rejects(control('import {createHash} from "node:crypto" with {type:"json"}; export function run(){return createHash;}',
    {'node:crypto':'HOST:createHash'}), {code:'CAPTURED_GRAPH_REJECTED'});
});

test('host crypto bridge refuses algorithms outside fixture SHA256', async () => {
  await assert.rejects(control('import {createHash} from "node:crypto"; export function run(){return createHash("sha1").digest("hex");}',
    {'node:crypto':'HOST:createHash'}), {code:'CAPTURED_GRAPH_REJECTED'});
});

test('synchronous infinite invocation is stopped by the VM deadline', async () => {
  await assert.rejects(control('export function run(){while(true){}}'), {code:'CAPTURED_GRAPH_REJECTED'});
});
