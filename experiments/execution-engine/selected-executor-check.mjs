import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runSelectedExecutor,checkExecutorSelection} from './selected-executor-gate.mjs';
const root=pathToFileURL(resolve(process.argv[2])+'/');
const source='81c71fc5cbeda8eebe8207a3a4a83320a796df5946d2d6017c8f06114a65ec0f';
const executor='73f50a25dced2047c87c30a4337bcdd6a9730c1352c2164ee998ae36df55fc50';
const hash=s=>createHash('sha256').update(s).digest('hex');
let checks=0;const results=[];
function input(name){
 const f=JSON.parse(readFileSync(new URL('experiments/'+name+'/fixture.json',root)));
 const state=f.parent;
 return {schema:'caw-replay-input-binding/1',anchor:{schema:'caw-first-transaction-anchor/1',parentHeader:state.header,header:f.child.header,rawTransactions:[f.rawTransaction],selection:{profile:'london-16',parentHash:state.header.hash,blockHash:f.child.header.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:f.transactionHash}},dependencies:{schema:'caw-replay-dependencies/1',header:state.header,selection:{profile:'london-16',parentHash:state.header.hash,dependencies:state.witnesses.map(w=>({address:w.proof.address,storageKeys:w.proof.storageProof.map(p=>'0x'+BigInt(p.key).toString(16).padStart(64,'0')),expectedCodeHash:w.proof.codeHash}))},witnesses:state.witnesses}};
}
for(const [fixture,kind,gas] of [
 ['signed-transfer-fixture','execution-completed','21000'],
 ['signed-contract-fixture','execution-completed','26012'],
 ['signed-revert-fixture','execution-reverted','26018'],
 ['signed-clear-fixture','execution-completed','21206'],
 ['signed-cap-fixture','execution-completed','24810']]){
 const text=JSON.stringify(input(fixture));
 const result=await runSelectedExecutor(root,text,source,executor);
 assert.equal(result.kind,kind);assert.equal(result.gasUsed,gas);
 assert.equal(result.executorSelection.manifestSha256,executor);
 assert.equal(result.executorSelection.filesChecked,2);
 assert.equal(result.provenance.inputSha256,hash(text));
 assert.equal(result.productionAccepted,false);assert.equal(result.stateRootRecomputed,false);
 assert(Object.isFrozen(result)&&Object.isFrozen(result.executorSelection));
 results.push({fixture,kind:result.kind,gasUsed:result.gasUsed});checks++;
}
const missing=input('signed-contract-fixture');
missing.dependencies.selection.dependencies[1].storageKeys=[];
missing.dependencies.witnesses[1].proof.storageProof=[];
const refused=await runSelectedExecutor(root,JSON.stringify(missing),source,executor);
assert.equal(refused.kind,'missing-evidence');assert(!Object.hasOwn(refused,'gasUsed'));checks++;
const text=JSON.stringify(input('signed-contract-fixture'));
await assert.rejects(runSelectedExecutor(root,text,source,'0'.repeat(64)),/MANIFEST_IDENTITY/);checks++;
await assert.rejects(runSelectedExecutor(root,text,'0'.repeat(64),executor),/MANIFEST_IDENTITY/);checks++;
let invoked=false;
await assert.rejects(runSelectedExecutor(root,text,source,executor,()=>{invoked=true;}),/EXECUTOR_ARGUMENTS/);
assert.equal(invoked,false);checks++;
await assert.rejects(runSelectedExecutor(root,'{bad',source,executor),SyntaxError);checks++;
await assert.rejects(runSelectedExecutor(root,' '.repeat(1048577),source,executor),/PROVENANCE_INPUT_LIMIT/);checks++;
const selection=readFileSync(new URL('./executor-selection.json',import.meta.url),'utf8');
assert.throws(()=>checkExecutorSelection(selection,executor,()=>new Uint8Array()),/MANIFEST_SOURCE_MISMATCH/);checks++;
const omitted=JSON.parse(selection);omitted.files.pop();const short=JSON.stringify(omitted);
assert.throws(()=>checkExecutorSelection(short,hash(short),e=>readFileSync(new URL(e.path,import.meta.url))),/EXECUTOR_SELECTION_FILES/);checks++;
console.log(JSON.stringify({schema:'caw-selected-executor-check/1',checks,passed:checks,results,executorManifestSha256:executor,sourceManifestSha256:source,stateRootRecomputed:false,loadedModulesAttested:false,productionAccepted:false}));
