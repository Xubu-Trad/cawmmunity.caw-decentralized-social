import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createVM, runTx} from '@ethereumjs/vm';
import {createRequire} from 'node:module';
import {createCustomCommon} from '@ethereumjs/common';
import {Common, Mainnet, Hardfork} from '@ethereumjs/common';
import {SimpleStateManager} from '@ethereumjs/statemanager';
import {Account, createAddressFromString, hexToBytes, bytesToHex} from '@ethereumjs/util';

// Signed call to locally seeded runtime; no deployment or full root proof.
assert.equal(process.argv.length, 3, 'Supply the repository root');
const root = pathToFileURL(resolve(process.argv[2]) + '/');
const {createReplayReadSession} = await import(new URL('reference/replay-read-session.mjs', root));
const {createReplayStorageOverlay} = await import(new URL('reference/replay-storage-overlay.mjs',root));
await import('./shared-adapter-check.mjs');
const {runBoundWitnessAttempt}=await import('./bound-replay.mjs');
const {createHash}=await import('node:crypto');
async function scenario(fixture,mode,suffix=""){
const f=JSON.parse(readFileSync(new URL('experiments/'+fixture+'/fixture.json',root)));
const {inspectReplayDependencies}=await import(new URL('reference/replay-dependencies.mjs',root));
function deps(state){return {schema:'caw-replay-dependencies/1',header:state.header,selection:{profile:'london-16',parentHash:state.header.hash,dependencies:state.witnesses.map(w=>({address:w.proof.address,storageKeys:w.proof.storageProof.map(p=>'0x'+BigInt(p.key).toString(16).padStart(64,'0')),expectedCodeHash:w.proof.codeHash}))},witnesses:state.witnesses};}
const input={schema:'caw-replay-input-binding/1',anchor:{schema:'caw-first-transaction-anchor/1',parentHeader:f.parent.header,header:f.child.header,rawTransactions:[f.rawTransaction],selection:{profile:'london-16',parentHash:f.parent.header.hash,blockHash:f.child.header.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:f.transactionHash}},dependencies:deps(f.parent)};
const expected=inspectReplayDependencies(JSON.stringify(deps(f.child)));
const {inspectBlockReceipts}=await import(new URL('reference/ethereum-block-receipts.mjs',root));
inspectBlockReceipts(f.child.header,[f.receipt],{schema:'caw-block-receipts-selection/1',profile:'london-16',hash:f.child.header.hash});
const {loadWitnessAdapter}=await import('./witness-adapter.mjs');
const factory=await loadWitnessAdapter(root);
const environment=(selected=input)=>factory(selected);

const require=createRequire(import.meta.url),vmRequire=createRequire(require.resolve('@ethereumjs/vm'));
const {createTxFromRLP}=await import(pathToFileURL(vmRequire.resolve('@ethereumjs/tx')));
const {createBlockFromRPC}=await import(pathToFileURL(vmRequire.resolve('@ethereumjs/block')));
const common=createCustomCommon({chainId:31337},Mainnet,{hardfork:Hardfork.London});
const tx=createTxFromRLP(hexToBytes(f.rawTransaction),{common});
assert.equal(tx.verifySignature(),true);assert.equal(bytesToHex(tx.hash()),f.transactionHash);
const block=createBlockFromRPC({...f.child.header,transactions:[]},[],{common});
assert.equal(bytesToHex(block.hash()),f.child.header.hash);
async function execute(e){const vm=await createVM({common,stateManager:e.stateManager});return runTx(vm,{tx,block,blockGasUsed:0n});}

const selected=structuredClone(input);
if(mode==='missing'||mode==='swallowed'){selected.dependencies.selection.dependencies[1].storageKeys=[];selected.dependencies.witnesses[1].proof.storageProof=[];}
const raw=JSON.stringify(selected)+suffix;let e;
const outcome=await runBoundWitnessAttempt(root,raw,async(adapter)=>{e=adapter;
 if(mode==='unsupported')return e.stateManager.putCode();
 if(mode==='limit'){for(let i=0;i<4097;i++)await e.stateManager.getAccount(createAddressFromString(f.accounts[0]));}
 if(mode==='unknown')throw new Error('private local path must not appear in output');
 if(mode==='malformed')return {};
 if(mode==='swallowed'){try{await execute(e);}catch{}return {execResult:{},receipt:{status:1},totalGasSpent:1n};}
 return execute(e);
});
assert.throws(()=>e.healthy());assert.ok(Object.isFrozen(outcome));assert.equal(outcome.productionAccepted,false);
assert.equal(outcome.stateComparisonVerified,false);assert.equal(JSON.stringify(outcome).includes('private local path'),false);
assert.equal(outcome.provenance.inputSha256,createHash('sha256').update(raw).digest('hex'));
assert.equal(outcome.provenance.installedEngineAttested,false);assert.ok(Object.isFrozen(outcome.provenance));
return outcome;
}
const completed=await scenario('signed-contract-fixture','normal');assert.equal(completed.kind,'execution-completed');assert.equal(completed.gasUsed,'26012');
const reverted=await scenario('signed-revert-fixture','normal');assert.equal(reverted.kind,'execution-reverted');assert.equal(reverted.gasUsed,'26018');
for(const [mode,kind] of [['missing','missing-evidence'],['unsupported','unsupported-operation'],['limit','local-resource-limit'],['unknown','unclassified-failure'],['malformed','unclassified-failure'],['swallowed','unclassified-failure']]){
 const result=await scenario('signed-contract-fixture',mode);assert.equal(result.kind,kind);assert.equal(Object.hasOwn(result,'gasUsed'),false);
}

const repeat=await scenario('signed-contract-fixture','normal');assert.deepEqual(repeat.provenance,completed.provenance);
const whitespace=await scenario('signed-contract-fixture','normal',' ');assert.equal(whitespace.gasUsed,completed.gasUsed);
assert.notEqual(whitespace.provenance.inputSha256,completed.provenance.inputSha256);
assert.equal(whitespace.provenance.engineLockSha256,completed.provenance.engineLockSha256);
let invoked=false;
await assert.rejects(runBoundWitnessAttempt(root,' '.repeat(1048577),()=>{invoked=true;}),/PROVENANCE_INPUT_LIMIT/);assert.equal(invoked,false);
await assert.rejects(runBoundWitnessAttempt(root,'{bad',()=>{invoked=true;}));assert.equal(invoked,false);
console.log(JSON.stringify({checks:63,passed:63,scope:'59 previous groups through provenance binding plus identical/whitespace input identity and oversize/malformed refusal',provenance:completed.provenance,productionAccepted:false}));
