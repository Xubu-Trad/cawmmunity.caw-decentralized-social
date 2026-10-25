import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createEVM} from '@ethereumjs/evm';
import {Common, Mainnet, Hardfork} from '@ethereumjs/common';
import {SimpleStateManager} from '@ethereumjs/statemanager';
import {Account, createAddressFromString, hexToBytes, bytesToHex} from '@ethereumjs/util';

// Boundary probe only: injected bytecode, not signed-transaction replay.
assert.equal(process.argv.length, 3, 'Supply the repository root');
const root = pathToFileURL(resolve(process.argv[2]) + '/');
const {createReplayReadSession} = await import(new URL('reference/replay-read-session.mjs', root));
const input = JSON.parse(readFileSync(new URL('reference/fixtures/replay-input-binding.json', root))).input;
const address = input.dependencies.selection.dependencies[0].address;
const key = input.dependencies.selection.dependencies[0].storageKeys[0];
function environment(childCode) {
  const session = createReplayReadSession(JSON.stringify(input));
  class Reads extends SimpleStateManager {
    async getAccount(a) {
      const p = session.account(a.toString());
      return new Account(BigInt(p.nonce), BigInt(p.balance), hexToBytes(p.storageHash), hexToBytes(p.codeHash));
    }
    async getCode(a) { session.code(a.toString()); return hexToBytes(childCode); }
    async getStorage(a,k) {
      const n = BigInt(session.storage(a.toString(),bytesToHex(k)));
      if (n === 0n) return new Uint8Array();
      const h = n.toString(16);return hexToBytes('0x'+(h.length % 2 ? '0' : '')+h);
    }
    async putAccount() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async putCode() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async putStorage() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async deleteAccount() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
    async clearStorage() { throw new Error('READ_PROBE_WRITE_UNSUPPORTED'); }
  }
  return {session, stateManager:new Reads()};
}
async function run(e) {
  const evm = await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.London}),stateManager:e.stateManager});
  // Nested DELEGATECALL uses injected child code; return its success word.
  const outer='0x602060006000600073'+address.slice(2)+'61fffff460005260206000f3';
  return evm.runCode({code:hexToBytes(outer),gasLimit:200000n,to:createAddressFromString(address),caller:createAddressFromString(address)});
}
const load=k=>'0x7f'+k.slice(2)+'5460005260206000f3';
const good=environment(load(key)), success=await run(good);
assert.equal(success.exceptionError,undefined);
assert.equal(BigInt(bytesToHex(success.returnValue)),1n);good.session.assertUsable();
// An ordinary contract revert is catchable and is not missing evidence.
const reverted=environment('0x60006000fd'), caught=await run(reverted);
assert.equal(caught.exceptionError,undefined);
assert.equal(BigInt(bytesToHex(caught.returnValue)),0n);reverted.session.assertUsable();
const missing=environment(load('0x'+'ff'.repeat(32)));
await assert.rejects(run(missing),{code:'WITNESS_STATE_MISSING_SLOT'});
assert.throws(()=>missing.session.assertUsable(),{code:'REPLAY_READ_FAILED'});
// Rolling back the engine's reversible state must not clear the failure flag.
await missing.stateManager.revert();
assert.throws(()=>missing.session.assertUsable(),{code:'REPLAY_READ_FAILED'});
console.log(JSON.stringify({checks:3,passed:3,profile:'London',scope:'injected DELEGATECALL child; success, ordinary revert, missing-slot propagation',signedTransactionReplay:false,journaledWritesVerified:false,executionVerified:false,productionAccepted:false}));
