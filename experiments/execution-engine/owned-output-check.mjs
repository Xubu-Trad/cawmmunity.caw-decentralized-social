import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=pathToFileURL(resolve(process.argv[2])+'/');
const {inspectOwnedExecutorOutput}=await import(new URL('reference/executor-output.mjs',root));
const text=readFileSync(new URL('./retained-process-result.json',import.meta.url),'utf8');
const record=JSON.parse(text),p=record.result.provenance;
// Synthetic transport tests; earlier independent expected-identity checks remain separate.
const expected={inputSha256:record.inputSha256,sourceManifestSha256:record.result.sourceManifest.manifestSha256,executorManifestSha256:record.result.executorSelection.manifestSha256,sourceFiles:21,executorFiles:2};
for(const k of ['engineLockSha256','adapterSourceSha256','outcomeSourceSha256','bindingSourceSha256'])expected[k]=p[k];
const id='1234567890abcdef1234567890abcdef',completion={exitCode:0,signal:null};
const marker=JSON.stringify({schema:'caw-executor-output/1',requestId:id,resultSha256:createHash('sha256').update(text).digest('hex')});
let checks=0;
assert.equal(inspectOwnedExecutorOutput(text,marker,completion,id,expected).recordMatchesSelection,true);checks++;
for(const [t,s,c,q] of [
 [text,marker,completion,'0'.repeat(32)],
 [text+' ',marker,completion,id],
 [text.slice(0,-5),marker,completion,id],
 [text,'',completion,id],
 [text,marker+'\n'+marker,completion,id],
 [text,marker+'\n{}',completion,id],
 [text,marker,{exitCode:1,signal:null},id],
 [text,marker,{exitCode:0,signal:'SIGTERM'},id]
]){assert.throws(()=>inspectOwnedExecutorOutput(t,s,c,q,expected));checks++;}
console.log(JSON.stringify({checks,passed:checks,syntheticTransportCases:true,executionAuthenticated:false,productionAccepted:false}));
