import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLocalRpc} from './local-rpc.mjs';
import {fixture} from './paid-post-fixture.mjs';
import {verifyPaidPostReceipt} from './paid-post-settlement.mjs';

const [endpoint,requestFile] = process.argv.slice(2);
const referenceHash = '0x' + '12'.repeat(32);
const reference = {review:{block:{number:'0x11',hash:referenceHash}},hash:referenceHash,calldataHash:referenceHash};

function pendingRpc(method) {
  if (method === 'eth_chainId') return '0x7a69';
  if (method === 'eth_getBlockByNumber') return {hash:fixture.genesisHash};
  if (method === 'eth_getTransactionReceipt') return null;
  throw Error('Unexpected RPC: ' + method);
}
assert.deepEqual(await verifyPaidPostReceipt(pendingRpc,reference),{status:'pending',hash:referenceHash});
await assert.rejects(verifyPaidPostReceipt(pendingRpc,{...reference,signature:'unexpected'}),/Expected a review/);
await assert.rejects(verifyPaidPostReceipt(pendingRpc,{...reference,hash:'0x11'}),/transaction hash/);
await assert.rejects(verifyPaidPostReceipt(pendingRpc,{...reference,review:{block:{hash:referenceHash,number:'17'}}}),/review header/);
await assert.rejects(verifyPaidPostReceipt(() => '0x1',reference),/Wrong fixture chain ID/);
await assert.rejects(verifyPaidPostReceipt(method => method === 'eth_getTransactionReceipt'
  ? {blockHash:referenceHash,transactionHash:fixture.genesisHash} : pendingRpc(method),reference), /Receipt locator mismatch/);
console.log('Pending receipt and five malformed, wrong-chain or mismatched inputs checked.');

if (process.argv.length > 2) {
  assert(endpoint && requestFile && process.argv.length === 4,
    'Usage: node test-paid-post-settlement.mjs [http://127.0.0.1:PORT receipt-request.json]');
  const rpc = createLocalRpc(endpoint,{limit:262144,timeout:5000});
  const input = JSON.parse(await readFile(requestFile,'utf8'));
  const {review,hash:transactionHash,calldataHash} = input;
  // Freeze the exact live responses so each negative control starts from an identical history.
  const replies = new Map();
  const key = (method,params) => JSON.stringify([method,params]);
  const record = async (method,params) => {
    const value = await rpc(method,params);
    replies.set(key(method,params),structuredClone(value));
    return value;
  };
  const result = await verifyPaidPostReceipt(record,input);
  assert.equal(result.status,'settled');
  assert.equal(result.hash,transactionHash);
  assert.equal(result.text,review.intent.text);
  assert.equal(result.digest,review.preview.digest);
  assert.equal(result.signer,review.controller);
  assert.deepEqual(result.settlement,{
    fee:review.preview.typedData.message.fee,share2:review.settlement.share2,
    share3:review.settlement.share3,dust:review.settlement.dust
  });
  assert.equal(result.calldataHash,calldataHash);
  const frozen = (method,params) => {
    assert(replies.has(key(method,params)), 'Uncaptured control read: '+method);
    return structuredClone(replies.get(key(method,params)));
  };
  await assert.rejects(verifyPaidPostReceipt(frozen,{...input,calldataHash:referenceHash}),/Mined calldata differs/);
  await assert.rejects(verifyPaidPostReceipt(frozen,{
    ...input,review:{...review,settlement:{...review.settlement,dust:String(BigInt(review.settlement.dust)+1n)}}
  }),/Saved review differs/);
  for (const mutation of ['extraTransaction','rawTransaction','editedTextLog','receiptStatus','postProof','reorg']) {
    let applied = false;
    function changed(method,params) {
      const value = frozen(method,params);
      if (mutation === 'extraTransaction' && method === 'eth_getBlockByHash' && value.hash === result.block.hash) {
        value.transactions.push(referenceHash); applied = true;
      }
      if (mutation === 'rawTransaction' && method === 'eth_getRawTransactionByHash') {
        applied = true; return value.slice(0,-2)+(value.endsWith('aa')?'bb':'aa');
      }
      if (method === 'eth_getTransactionReceipt') {
        if (mutation === 'editedTextLog') {value.logs[1].data += '00'; applied = true;}
        if (mutation === 'receiptStatus') {value.status = '0x0'; applied = true;}
      }
      if (mutation === 'postProof' && method === 'eth_getProof' && params[0] === fixture.vault &&
          params[2].blockHash === result.block.hash) {
        const item = value.storageProof[0]; item.value = item.value === '0x0' ? '0x1' : '0x0'; applied = true;
      }
      if (mutation === 'reorg' && method === 'eth_getBlockByNumber' && params[0] === result.block.number) {
        value.hash = referenceHash; applied = true;
      }
      return value;
    }
    await assert.rejects(verifyPaidPostReceipt(changed,input));
    assert(applied,mutation+' was exercised');
  }
  console.log('Live signed post, exact fee and text, verified balance changes and eight conflicting-evidence controls passed.');
}
