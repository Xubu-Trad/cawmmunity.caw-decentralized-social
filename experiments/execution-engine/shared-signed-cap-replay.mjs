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
const f=JSON.parse(readFileSync(new URL('experiments/signed-cap-fixture/fixture.json',root)));
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
const e=environment(),result=await execute(e);e.healthy();
assert.equal(result.execResult.exceptionError,undefined);
assert.equal(result.totalGasSpent,BigInt(f.receipt.gasUsed));
assert.equal(result.receipt.status,1);assert.deepEqual(result.receipt.logs,[]);
assert.equal(result.receipt.cumulativeBlockGasUsed,BigInt(f.receipt.cumulativeGasUsed));
assert.equal(bytesToHex(result.receipt.bitvector),f.receipt.logsBloom);
for(const d of expected.dependencies){const actual=e.overlay.account(d.state.proof.address);
 assert.equal(BigInt(actual.nonce),BigInt(d.state.proof.nonce));
 assert.equal(BigInt(actual.balance),BigInt(d.state.proof.balance));}
// One-variable negative experiments deliberately mutate the already-proven overlay.
// They test transaction validity enforcement, not an alternative authenticated state.
for(const kind of ['nonce','balance']){
 const bad=environment(),a=bad.overlay.account(f.accounts[0]);
 const changed=await bad.stateManager.getAccount(createAddressFromString(f.accounts[0]));
 changed.nonce=BigInt(kind==='nonce'?'0x1':a.nonce);changed.balance=BigInt(kind==='balance'?'0x0':a.balance);
 await bad.stateManager.putAccount(createAddressFromString(f.accounts[0]),changed);
 const before=bad.overlay.account(f.accounts[0]);
 await assert.rejects(execute(bad),kind==='nonce'?/nonce/i:/funds|balance/i);
 assert.deepEqual(bad.overlay.account(f.accounts[0]),before);bad.healthy();
}

const slot='0x'+'00'.repeat(32),contract=f.accounts[1];
assert.equal(e.overlay.originalStorage(contract,slot),'0x7');
assert.equal(e.overlay.storage(contract,slot),'0x0');
assert.equal(result.execResult.gasRefund,9600n);
assert.equal(result.execResult.executionGasUsed,10012n);
assert.equal(result.totalGasSpent,31012n-31012n/5n);
const slot1='0x'+'00'.repeat(31)+'01';
assert.equal(e.overlay.originalStorage(contract,slot1),'0x7');assert.equal(e.overlay.storage(contract,slot1),'0x0');
assert.equal(BigInt(f.child.witnesses[1].proof.storageProof[1].value),0n);
assert.ok(result.execResult.gasRefund>31012n/5n);
const prior=e.overlay.originalAccount(f.accounts[0]),post=e.overlay.account(f.accounts[0]);
assert.equal(BigInt(post.nonce),BigInt(prior.nonce)+1n);
assert.equal(BigInt(prior.balance)-BigInt(post.balance),result.totalGasSpent*100000000000n);
assert.equal(BigInt(f.child.witnesses[1].proof.storageProof[0].value),0n);
// Remove just the selected slot and its proof; retain the account/code proof.
const partial=structuredClone(input);
partial.dependencies.selection.dependencies[1].storageKeys=[slot];
partial.dependencies.witnesses[1].proof.storageProof=partial.dependencies.witnesses[1].proof.storageProof.slice(0,1);
const missing=environment(partial);
await assert.rejects(execute(missing),{code:'WITNESS_STATE_MISSING_SLOT'});
assert.ok(missing.writes()>0);assert.throws(()=>missing.healthy());
assert.equal(missing.storageWrites.length,1,'First slot written before second-slot failure');
const writes=missing.writes();await assert.rejects(execute(missing));assert.equal(missing.writes(),writes);
missing.overlay.discard();assert.throws(()=>missing.healthy());
console.log(JSON.stringify({checks:4,passed:4,gas:result.totalGasSpent.toString(),slotBefore:'7',slotAfter:'0',refundCounter:'9600',refundApplied:'6202',writesBeforeMissingSlot: writes,scope:'signed two-slot clear, binding refund cap and acquired account/receipt/storage comparison, nonce/balance refusal, missing slot permanent failure',stateRootRecomputed:false,deploymentVerified:false,publicChainAuthenticated:false,productionAccepted:false}));
