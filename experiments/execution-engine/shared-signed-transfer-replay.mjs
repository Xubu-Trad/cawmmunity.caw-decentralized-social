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

// Bounded signed local EOA transfer; no full state-root reconstruction.
assert.equal(process.argv.length, 3, 'Supply the repository root');
const root = pathToFileURL(resolve(process.argv[2]) + '/');
const {createReplayReadSession} = await import(new URL('reference/replay-read-session.mjs', root));
const {createReplayStorageOverlay} = await import(new URL('reference/replay-storage-overlay.mjs',root));
const f=JSON.parse(readFileSync(new URL('experiments/signed-transfer-fixture/fixture.json',root)));
const {inspectReplayDependencies}=await import(new URL('reference/replay-dependencies.mjs',root));
function deps(state){return {schema:'caw-replay-dependencies/1',header:state.header,selection:{profile:'london-16',parentHash:state.header.hash,dependencies:state.witnesses.map(w=>({address:w.proof.address,storageKeys:[],expectedCodeHash:w.proof.codeHash}))},witnesses:state.witnesses};}
const input={schema:'caw-replay-input-binding/1',anchor:{schema:'caw-first-transaction-anchor/1',parentHeader:f.parent.header,header:f.child.header,rawTransactions:[f.rawTransaction],selection:{profile:'london-16',parentHash:f.parent.header.hash,blockHash:f.child.header.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:f.transactionHash}},dependencies:deps(f.parent)};
const expected=inspectReplayDependencies(JSON.stringify(deps(f.child)));
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
console.log(JSON.stringify({checks:3,passed:3,scope:'signed local EOA transfer runTx, acquired account and receipt comparison, nonce and balance refusal',localTransactionReplay:true,stateRootRecomputed:false,publicChainAuthenticated:false,productionAccepted:false}));
