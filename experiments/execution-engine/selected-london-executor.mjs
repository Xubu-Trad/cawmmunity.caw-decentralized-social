import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createVM,runTx} from '@ethereumjs/vm';
import {createCustomCommon,Mainnet,Hardfork} from '@ethereumjs/common';
import {hexToBytes,bytesToHex} from '@ethereumjs/util';
import {esmPackageEntry} from './esm-package-entry.mjs';
const require=createRequire(import.meta.url);
const vmRequire=createRequire(require.resolve('@ethereumjs/vm'));
const {createTxFromRLP}=await import(esmPackageEntry(vmRequire,'@ethereumjs/tx'));
const {createBlockFromRPC}=await import(esmPackageEntry(vmRequire,'@ethereumjs/block'));

// Narrow local London executor. Input validation and witness creation precede invocation.
export async function executeSelectedLondon(adapter,input) {
  const a=input.anchor;
  assert.equal(a.selection.profile,'london-16');
  assert.equal(a.selection.chainId,'0x7a69');
  assert.equal(a.selection.transactionIndex,'0x0');
  const common=createCustomCommon({chainId:31337},Mainnet,{hardfork:Hardfork.London});
  const tx=createTxFromRLP(hexToBytes(a.rawTransactions[0]),{common});
  assert.equal(tx.verifySignature(),true);
  assert.equal(bytesToHex(tx.hash()),a.selection.transactionHash);
  const block=createBlockFromRPC({...a.header,transactions:[]},[],{common});
  assert.equal(bytesToHex(block.hash()),a.selection.blockHash);
  const vm=await createVM({common,stateManager:adapter.stateManager});
  return runTx(vm,{tx,block,blockGasUsed:0n});
}
