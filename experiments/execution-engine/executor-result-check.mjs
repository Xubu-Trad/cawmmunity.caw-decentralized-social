import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=pathToFileURL(resolve(process.argv[2])+'/');
const {inspectExecutorResult}=await import(new URL('reference/executor-result.mjs',root));
const text=readFileSync(new URL('./retained-process-result.json',import.meta.url),'utf8');
const file=JSON.parse(text),completion={exitCode:0,signal:null};
const manifest=JSON.parse(readFileSync(new URL('./source-manifest.json',import.meta.url),'utf8'));
const expected={inputSha256:'56bc79c960e439f48a575109c2887ac5412540ec6648fd4bdb7b0a4414d7debd',sourceManifestSha256:'81c71fc5cbeda8eebe8207a3a4a83320a796df5946d2d6017c8f06114a65ec0f',executorManifestSha256:'73f50a25dced2047c87c30a4337bcdd6a9730c1352c2164ee998ae36df55fc50',sourceFiles:21,executorFiles:2};
for(const [field,path] of [['engineLockSha256','pnpm-lock.yaml'],['adapterSourceSha256','witness-adapter.mjs'],['outcomeSourceSha256','replay-outcome.mjs'],['bindingSourceSha256','bound-replay.mjs']])expected[field]=manifest.files.find(e=>e.root==='engine'&&e.path===path).sha256;
let checks=0;
const good=inspectExecutorResult(text,completion,expected);assert.equal(good.gasUsed,'26012');assert(Object.isFrozen(good));checks++;
for(const c of [{exitCode:1,signal:null},{exitCode:null,signal:null},{exitCode:0,signal:'SIGTERM'},{}]){assert.throws(()=>inspectExecutorResult(text,c,expected));checks++;}
for(const k of Object.keys(expected)){
 const wrong={...expected,[k]:typeof expected[k]==='number'?expected[k]+1:'0'.repeat(64)};
 assert.throws(()=>inspectExecutorResult(text,completion,wrong));checks++;
}
for(const mutate of [x=>x.extra=true,x=>x.result.productionAccepted=true,x=>x.result.provenance.installedEngineAttested=true,x=>x.result.gasUsed='026012',x=>x.result.gasUsed=(1n<<256n).toString(),x=>x.result.kind='unknown',x=>delete x.result.provenance,x=>x.result.sourceManifest.filesChecked=20]){
 const changed=structuredClone(file);mutate(changed);assert.throws(()=>inspectExecutorResult(JSON.stringify(changed),completion,expected));checks++;
}
for(const invalid of [text.slice(0,-5),' '.repeat(16385),text.replace('"schema":','"schema":"duplicate","schema":')]){assert.throws(()=>inspectExecutorResult(invalid,completion,expected));checks++;}
const missing=structuredClone(file);missing.result.kind='missing-evidence';delete missing.result.gasUsed;
assert.equal(inspectExecutorResult(JSON.stringify(missing),completion,expected).kind,'missing-evidence');checks++;
missing.result.gasUsed='1';assert.throws(()=>inspectExecutorResult(JSON.stringify(missing),completion,expected));checks++;
const forged=structuredClone(file);forged.result.gasUsed='26013';assert.equal(inspectExecutorResult(JSON.stringify(forged),completion,expected).executionAuthenticated,false);checks++;
console.log(JSON.stringify({schema:'caw-executor-result-check/1',checks,passed:checks,retainedProcessResult:true,negativeVariantsSynthetic:true,executionAuthenticated:false,productionAccepted:false}));

