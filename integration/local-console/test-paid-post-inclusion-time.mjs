import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Interface, Wallet, hexlify, toBeHex, toUtf8Bytes} from 'ethers';
import {createLocalRpc} from './local-rpc.mjs';
import {fixture} from './paid-post-fixture.mjs';
import {preparePaidPost} from './paid-post-state.mjs';
import {previewPaidPost} from './paid-post-preview.mjs';
import {readPublishedPost} from './paid-post-settlement.mjs';

const custody = process.argv.includes('--custody');
const mixed = custody || process.argv.includes('--mixed');
const [mode, endpoint, hash] = process.argv.slice(2).filter(arg => arg !== '--mixed' && arg !== '--custody');
assert((mode === 'send' && process.argv.length === 4 + Number(mixed)) || (mode === 'verify' && process.argv.length === 5 + Number(mixed)),
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
  async function sendSibling(nonce) {
    if (custody) {
      const vault = new Interface(['function withdraw(uint256,uint256,uint256)']);
      const amount = nonce === senderNonce ? 10n**18n : 2n*10n**18n;
      const withdrawal = await wallet.signTransaction({chainId:31337,type:2,to:fixture.vault,nonce,
        data:vault.encodeFunctionData('withdraw',[2,0,amount]),gasLimit:300000,
        maxPriorityFeePerGas:1000000000n,maxFeePerGas:5000000000n});
      await read('eth_sendRawTransaction',[withdrawal]);
      return;
    }
    const transfer = await wallet.signTransaction({chainId:31337,type:2,to:wallet.address,nonce,
      value:1n,gasLimit:21000,maxPriorityFeePerGas:1000000000n,maxFeePerGas:5000000000n});
    await read('eth_sendRawTransaction',[transfer]);
  }
  if (mixed) await sendSibling(senderNonce);
  const raw = await wallet.signTransaction({chainId:31337,type:2,to:fixture.vault,nonce:senderNonce+Number(mixed),data,
    value:0,gasLimit:900000,maxPriorityFeePerGas:1000000000n,maxFeePerGas:5000000000n});
  const selected = await read('eth_sendRawTransaction',[raw]);
  if (mixed) await sendSibling(senderNonce+2);
  console.log(selected);
} else {
  const calls = new Map();
  const result = await readPublishedPost(async (method,params) => {
    const value = await read(method,params);
    if (mixed) calls.set(JSON.stringify([method,params]),{method,params,result:value});
    return value;
  },hash);
  if (mixed) await writeFile('mixed-post-reads.json',JSON.stringify([...calls.values()])+'\n',{flag:'wx'});
  assert.equal(result.status,'settled');
  assert.equal(result.text,text);
  assert.equal(result.submitter,result.signer);
  const header = await read('eth_getBlockByHash',[result.block.hash,false]);
  if (mixed) {
    assert.equal(result.transactionIndex,1);
    assert.equal(result.transactionCount,3);
    assert.deepEqual(result.settlement,{fee:'5000000000000000000000',share2:'1363636363636363636363',
      share3:'3636363636363636363636',dust:'1'});
    if (custody) {
      assert.deepEqual(result.siblingWithdrawals.map(w => [w.index,w.account,w.amount]),[
        [0,'2',String(10n**18n)],[2,'2',String(2n*10n**18n)]]);
    }
    const selected = header.transactions[1];
    assert.equal(selected,hash);
    for (const other of [header.transactions[0],header.transactions[2]]) {
      await assert.rejects(readPublishedPost(read,other));
      await assert.rejects(readPublishedPost((method,params) =>
        method === 'eth_getRawTransactionByHash' && params[0] === other ?
          read(method,[selected]) : read(method,params),hash));
    }
    console.log(JSON.stringify({block:header.hash,transactions:header.transactions,selectedIndex:1,...result.settlement}));
  }
  assert.equal(header.parentHash,parentHash);
  assert.equal(BigInt(header.timestamp),20n);
  console.log(JSON.stringify({status:result.status,hash,block:header.hash,parentTime:19,validAfter:20,
    inclusionTime:20,signer:result.signer}));
}
