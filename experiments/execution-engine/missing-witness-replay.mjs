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
function environment(selectedInput=input) {
  const session = createReplayReadSession(JSON.stringify(selectedInput)), overlay=createReplayStorageOverlay(JSON.stringify(selectedInput));
  let failed=false,writes=0,reverts=0;
  function healthy(){assert.equal(failed,false,'ACCOUNT_ADAPTER_FAILED');session.assertUsable();overlay.assertUsable();}
  const bytes=q=>{const n=BigInt(q);if(n===0n)return new Uint8Array();const h=n.toString(16);return hexToBytes('0x'+(h.length%2?'0':'')+h);};
  class Reads extends SimpleStateManager {
    constructor(){super();this.originalStorageCache={get:async(a,k)=>bytes(overlay.originalStorage(a.toString(),bytesToHex(k))),clear:()=>{}};}
    async checkpoint(){overlay.checkpoint();await super.checkpoint();}
    async commit(){overlay.commit();await super.commit();}
    async revert(){overlay.revert();await super.revert();reverts++;}
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
  return {session,overlay,stateManager:new Reads(),healthy,writes:()=>writes,reverts:()=>reverts};
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

const missingResults=[];
for(const index of [0,1,2]){
 const partial=structuredClone(input),address=f.accounts[index];
 partial.dependencies.selection.dependencies=partial.dependencies.selection.dependencies.filter(d=>d.address!==address);
 partial.dependencies.witnesses=partial.dependencies.witnesses.filter(w=>w.proof.address!==address);
 const bad=environment(partial);
 await assert.rejects(execute(bad),{code:'WITNESS_STATE_MISSING_ACCOUNT'});
 assert.ok(bad.reverts()>0,'Transaction rollback must run');
 if(index===2)assert.ok(bad.writes()>0,'Fee-recipient miss must follow account writes');
 assert.throws(()=>bad.healthy());
 await assert.rejects(bad.stateManager.getAccount(createAddressFromString(f.accounts[index===0?1:0])));
 const writes=bad.writes();
 await assert.rejects(execute(bad));assert.equal(bad.writes(),writes,'Failed attempt must not resume writes');
 bad.overlay.discard();assert.throws(()=>bad.healthy());
 missingResults.push({missing:index===0?'sender':index===1?'recipient':'feeRecipient',writesBeforeFailure:writes,completedReverts:bad.reverts()});
}
// A fresh attempt with the complete verified package must still reproduce the transfer.
const fresh=environment();await execute(fresh);fresh.healthy();
for(const d of expected.dependencies){const a=fresh.overlay.account(d.state.proof.address);assert.equal(BigInt(a.balance),BigInt(d.state.proof.balance));assert.equal(BigInt(a.nonce),BigInt(d.state.proof.nonce));}
console.log(JSON.stringify({checks:7,passed:7,missingResults,scope:'prior three replay cases, three missing account witnesses, fresh complete retry',failedAttemptReusable:false,stateRootRecomputed:false,publicChainAuthenticated:false,productionAccepted:false}));
