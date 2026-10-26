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
const f=JSON.parse(readFileSync(new URL('experiments/signed-clear-fixture/fixture.json',root)));
const {inspectReplayDependencies}=await import(new URL('reference/replay-dependencies.mjs',root));
function deps(state){return {schema:'caw-replay-dependencies/1',header:state.header,selection:{profile:'london-16',parentHash:state.header.hash,dependencies:state.witnesses.map(w=>({address:w.proof.address,storageKeys:w.proof.storageProof.map(p=>'0x'+BigInt(p.key).toString(16).padStart(64,'0')),expectedCodeHash:w.proof.codeHash}))},witnesses:state.witnesses};}
const input={schema:'caw-replay-input-binding/1',anchor:{schema:'caw-first-transaction-anchor/1',parentHeader:f.parent.header,header:f.child.header,rawTransactions:[f.rawTransaction],selection:{profile:'london-16',parentHash:f.parent.header.hash,blockHash:f.child.header.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:f.transactionHash}},dependencies:deps(f.parent)};
const expected=inspectReplayDependencies(JSON.stringify(deps(f.child)));
const {inspectBlockReceipts}=await import(new URL('reference/ethereum-block-receipts.mjs',root));
inspectBlockReceipts(f.child.header,[f.receipt],{schema:'caw-block-receipts-selection/1',profile:'london-16',hash:f.child.header.hash});
function environment(selectedInput=input) {
  const session = createReplayReadSession(JSON.stringify(selectedInput)), overlay=createReplayStorageOverlay(JSON.stringify(selectedInput));
  let failed=false,writes=0;
  function healthy(){assert.equal(failed,false,'ACCOUNT_ADAPTER_FAILED');session.assertUsable();overlay.assertUsable();}
  const bytes=q=>{const n=BigInt(q);if(n===0n)return new Uint8Array();const h=n.toString(16);return hexToBytes('0x'+(h.length%2?'0':'')+h);};
  class Reads extends SimpleStateManager {
    constructor(){super();this.originalStorageCache={get:async(a,k)=>bytes(overlay.originalStorage(a.toString(),bytesToHex(k))),clear:()=>{}};}
    async checkpoint(){overlay.checkpoint();await super.checkpoint();}
    async commit(){overlay.commit();await super.commit();}
    async revert(){overlay.revert();await super.revert();}
    async getAccount(a) {
      healthy();const p = overlay.account(a.toString());
      return new Account(BigInt(p.nonce), BigInt(p.balance), hexToBytes(p.storageHash), hexToBytes(p.codeHash));
    }
    async getCode(a) { healthy();return hexToBytes(session.code(a.toString())); }
    async getStorage(a,k) {
      const n = BigInt(overlay.storage(a.toString(),bytesToHex(k)));
      if (n === 0n) return new Uint8Array();
      const h = n.toString(16);return hexToBytes('0x'+(h.length % 2 ? '0' : '')+h);
    }
    async putAccount(a,value) {
      try {
        healthy();const original=overlay.originalAccount(a.toString());
        assert.ok(value instanceof Account,'ACCOUNT_REQUIRED');
        assert.equal(bytesToHex(value.codeHash),original.codeHash,'CODE_CHANGE');
        assert.equal(bytesToHex(value.storageRoot),original.storageHash,'ROOT_CHANGE');
        assert.equal(value.version,0,'VERSION_CHANGE');assert.equal(value.codeSize,0,'CODE_SIZE_CHANGE');
        overlay.putAccount(a.toString(),'0x'+value.nonce.toString(16),'0x'+value.balance.toString(16));writes++;
      } catch(error){failed=true;throw error;}
    }
    async putCode() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async putStorage(a,k,v) { overlay.putStorage(a.toString(),bytesToHex(k),'0x'+(v.length?BigInt(bytesToHex(v)):0n).toString(16)); }
    async deleteAccount() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async clearStorage() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
  }
  return {session,overlay,stateManager:new Reads(),healthy,writes:()=>writes};
}

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
 bad.overlay.putAccount(f.accounts[0],kind==='nonce'?'0x1':a.nonce,kind==='balance'?'0x0':a.balance);
 const before=bad.overlay.account(f.accounts[0]);
 await assert.rejects(execute(bad),kind==='nonce'?/nonce/i:/funds|balance/i);
 assert.deepEqual(bad.overlay.account(f.accounts[0]),before);bad.healthy();
}

const slot='0x'+'00'.repeat(32),contract=f.accounts[1];
assert.equal(e.overlay.originalStorage(contract,slot),'0x7');
assert.equal(e.overlay.storage(contract,slot),'0x0');
assert.equal(result.execResult.gasRefund,4800n);
assert.equal(result.execResult.executionGasUsed,5006n);
assert.equal(result.totalGasSpent,21000n+5006n-4800n);
const prior=e.overlay.originalAccount(f.accounts[0]),post=e.overlay.account(f.accounts[0]);
assert.equal(BigInt(post.nonce),BigInt(prior.nonce)+1n);
assert.equal(BigInt(prior.balance)-BigInt(post.balance),result.totalGasSpent*100000000000n);
assert.equal(BigInt(f.child.witnesses[1].proof.storageProof[0].value),0n);
// Remove just the selected slot and its proof; retain the account/code proof.
const partial=structuredClone(input);
partial.dependencies.selection.dependencies[1].storageKeys=[];
partial.dependencies.witnesses[1].proof.storageProof=[];
const missing=environment(partial);
await assert.rejects(execute(missing),{code:'WITNESS_STATE_MISSING_SLOT'});
assert.ok(missing.writes()>0);assert.throws(()=>missing.healthy());
const writes=missing.writes();await assert.rejects(execute(missing));assert.equal(missing.writes(),writes);
missing.overlay.discard();assert.throws(()=>missing.healthy());
console.log(JSON.stringify({checks:4,passed:4,gas:result.totalGasSpent.toString(),slotBefore:'7',slotAfter:'0',refund:'4800',writesBeforeMissingSlot: writes,scope:'signed seeded storage clear, refund and acquired account/receipt/storage comparison, nonce/balance refusal, missing slot permanent failure',stateRootRecomputed:false,deploymentVerified:false,publicChainAuthenticated:false,productionAccepted:false}));
