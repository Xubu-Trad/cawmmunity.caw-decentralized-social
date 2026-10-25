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
function environment() {
  const session = createReplayReadSession(JSON.stringify(input));
  class Reads extends SimpleStateManager {
    async getAccount(a) {
      const p = session.account(a.toString());
      return new Account(BigInt(p.nonce), BigInt(p.balance), hexToBytes(p.storageHash), hexToBytes(p.codeHash));
    }
    async getCode(a) { return hexToBytes(session.code(a.toString())); }
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
async function run(e,k,to=address) {
  const evm = await createEVM({common:new Common({chain:Mainnet,hardfork:Hardfork.London}),stateManager:e.stateManager});
  // PUSH32 slot; SLOAD; PUSH1 0; MSTORE; PUSH1 32; PUSH1 0; RETURN
  return evm.runCode({code:hexToBytes('0x7f'+k.slice(2)+'5460005260206000f3'),gasLimit:100000n,to:createAddressFromString(to)});
}
const good=environment(), result=await run(good,key);
assert.equal(result.exceptionError,undefined);good.session.assertUsable();
assert.equal(BigInt(bytesToHex(result.returnValue)),BigInt(good.session.storage(address,key)));
for (const [label,k,to,code] of [
 ['missing-slot','0x'+'ff'.repeat(32),address,'WITNESS_STATE_MISSING_SLOT'],
 ['missing-account',key,'0x'+'ff'.repeat(20),'WITNESS_STATE_MISSING_ACCOUNT']]) {
 const e=environment();await assert.rejects(run(e,k,to),{code});
 assert.throws(()=>e.session.assertUsable(),{code:'REPLAY_READ_FAILED'});
}
console.log(JSON.stringify({checks:3,passed:3,profile:'London',scope:'injected SLOAD bytecode with verified witness reads; missing errors propagated',signedTransactionReplay:false,nestedCallRollbackVerified:false,executionVerified:false,productionAccepted:false}));
