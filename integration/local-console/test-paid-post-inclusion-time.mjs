import assert from 'node:assert/strict';
import {Interface, Wallet, hexlify, toBeHex, toUtf8Bytes} from 'ethers';
import {createLocalRpc} from './local-rpc.mjs';
import {fixture} from './paid-post-fixture.mjs';
import {preparePaidPost} from './paid-post-state.mjs';
import {previewPaidPost} from './paid-post-preview.mjs';
import {readPublishedPost} from './paid-post-settlement.mjs';

const [mode, endpoint, hash] = process.argv.slice(2);
assert((mode === 'send' && process.argv.length === 4) || (mode === 'verify' && process.argv.length === 5),
  'Usage: node test-paid-post-inclusion-time.mjs send|verify loopback-rpc [transaction-hash]');
const read = createLocalRpc(endpoint,{limit:262144,timeout:5000});
const text = 'signed for the inclusion block';
const parentHash = '0xe9aeb5afbfbf5e54e0c8f40acc59281c1eb6f6235ded92bffa4f284ef47fbb3f';

if (mode === 'send') {
  const parent = await read('eth_getBlockByNumber',['latest',false]);
  assert.equal(parent.hash,parentHash);
  assert.equal(BigInt(parent.timestamp),19n);
  const intent = {text,validAfter:'20',deadline:'1000'};
  await assert.rejects(preparePaidPost(read,intent),/Outside reviewed validity window/);
  const prior = await preparePaidPost(read,{...intent,validAfter:'0'});
  const {accountId,epoch,nonce,stakeRoot} = prior.preview.typedData.message;
  const preview = previewPaidPost({accountId,epoch,nonce,stakeRoot,...intent});
  const request = preview.typedData.message;
  const wallet = new Wallet(toBeHex(1,32)); // Public disposable controller in the pinned genesis.
  assert.equal(wallet.address.toLowerCase(),prior.controller);
  const call = new Interface([
    'function settleFixedPool1((uint256,uint256,uint256,uint256,uint256,bytes32,bytes32),bytes,bytes)'
  ]);
  const data = call.encodeFunctionData('settleFixedPool1',[
    [accountId,epoch,nonce,request.validAfter,request.deadline,stakeRoot,request.textHash],
    wallet.signingKey.sign(preview.digest).serialized,hexlify(toUtf8Bytes(text))
  ]);
  const senderNonce = Number(BigInt(await read('eth_getTransactionCount',[wallet.address,'pending'])));
  const raw = await wallet.signTransaction({chainId:31337,type:2,to:fixture.vault,nonce:senderNonce,data,
    value:0,gasLimit:900000,maxPriorityFeePerGas:1000000000n,maxFeePerGas:5000000000n});
  console.log(await read('eth_sendRawTransaction',[raw]));
} else {
  const result = await readPublishedPost(read,hash);
  assert.equal(result.status,'settled');
  assert.equal(result.text,text);
  assert.equal(result.submitter,result.signer);
  const header = await read('eth_getBlockByHash',[result.block.hash,false]);
  assert.equal(header.parentHash,parentHash);
  assert.equal(BigInt(header.timestamp),20n);
  console.log(JSON.stringify({status:result.status,hash,block:header.hash,parentTime:19,validAfter:20,
    inclusionTime:20,signer:result.signer}));
}
