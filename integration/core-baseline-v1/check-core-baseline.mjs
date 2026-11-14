import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import solc from 'solc';
const require=createRequire(import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const [manifestPath,inputPath]=process.argv.slice(2);
const m=JSON.parse(fs.readFileSync(manifestPath)),raw=fs.readFileSync(inputPath);
assert.equal(m.schema,'caw-core-research-baseline/1');
assert.equal(sha(raw),m.compilerInputSha256,'INPUT_PIN');
assert.equal(solc.version(),m.compilerVersion,'COMPILER_VERSION');
assert.equal(sha(fs.readFileSync(require.resolve('solc/soljson.js'))),m.soljsonSha256,'COMPILER_BYTES');
const input=JSON.parse(raw);
assert.deepEqual(Object.keys(input.sources).sort(),Object.keys(m.sources).sort(),'SOURCE_SET');
for(const [name,pin]of Object.entries(m.sources))assert.equal(sha(input.sources[name].content),pin,'SOURCE_PIN');
const output=JSON.parse(solc.compile(raw.toString()));
assert(!(output.errors??[]).some(x=>x.severity==='error'),'COMPILE');
for(const [source,contracts]of Object.entries(m.artifacts))for(const [name,expected]of Object.entries(contracts)){
 const a=output.contracts[source][name];
 assert.equal(sha(Buffer.from(a.evm.bytecode.object,'hex')),expected.creationSha256,'CREATION_BYTES');
 assert.equal(sha(Buffer.from(a.evm.deployedBytecode.object,'hex')),expected.runtimeTemplateSha256,'RUNTIME_TEMPLATE');
 assert.deepEqual(a.abi,expected.abi,'ABI');
 assert.deepEqual(a.evm.deployedBytecode.immutableReferences,expected.immutableReferences,'IMMUTABLE_LAYOUT');
}
if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(output),{flag:'wx'});
console.log(JSON.stringify({artifactCount:Object.values(m.artifacts).reduce((n,v)=>n+Object.keys(v).length,0),recompiledAgainstRetainedArtifacts:true,deployedRuntimeVerified:false,lifecycleRerun:false,productionAccepted:false}));
