import assert from 'node:assert/strict';
import {createLocalRpc} from './local-rpc.mjs';
import {fixture} from './paid-post-fixture.mjs';
import {readPublishedPost} from './paid-post-settlement.mjs';

const unknown = '0x' + 'ab'.repeat(32);
const offline = (method,params) => {
  if (method === 'eth_chainId') return '0x7a69';
  if (method === 'eth_getBlockByNumber' && params[0] === '0x0') return {hash:fixture.genesisHash};
  if (method === 'eth_getTransactionReceipt' && params[0] === unknown) return null;
  throw Error('Unexpected call: ' + method);
};
assert.deepEqual(await readPublishedPost(offline,'0x' + 'AB'.repeat(32)), {status:'pending',hash:unknown});
for (const input of ['', '0x1234', {hash:unknown}]) {
  await assert.rejects(readPublishedPost(() => assert.fail('read on invalid input'),input), /32-byte transaction hash/);
}
await assert.rejects(readPublishedPost(() => '0x1',unknown), /Wrong fixture chain/);
await assert.rejects(readPublishedPost((method,params) =>
  method === 'eth_getBlockByNumber' ? {hash:unknown} : offline(method,params),unknown), /Wrong fixture genesis/);
console.log('Checked unknown hash, case normalization, three malformed inputs, wrong chain and wrong genesis.');

async function historical(rpc) {
  const relayer = '0x6813eb9362372eef6200f3b1dbc3f819671cba69';
  const cases = [
    ['0x701c778a569a6696389f2273e6ed8ce57bc795f85b5a057ea51a31822f36e04d', '0x12', fixture.wallets['0x19a827174f66b3c66ad7063951d7b4f94f996e77'].controller],
    ['0xfb8f55e4ab8d4b4f6daeb5f2ed62e2318e50b0d27fabff443e04d4469d151246', '0x20', fixture.wallets['0x985d0ce92f2af930e309f5ff89139490ac2d9e94'].controller],
  ];
  for (const [hash,height,signer] of cases) {
    const post = await readPublishedPost(rpc,hash);
    assert.equal(post.status,'settled');
    assert.equal(post.block.number,height);
    assert.equal(post.signer,signer);
    assert.equal(post.submitter,relayer);
    assert.notEqual(post.signer,post.submitter);
    console.log('Verified relayed post',hash,'author',signer,'sender',relayer);
  }
  const reverted = '0xe33da2711cede4cc7317a5546686aaa6a083ecca278bdcbd0e8c0f807fea67d6';
  const result = await readPublishedPost(rpc,reverted);
  assert.deepEqual(result,{status:'reverted',hash:reverted,block:{number:'0x11',hash:'0xe9aeb5afbfbf5e54e0c8f40acc59281c1eb6f6235ded92bffa4f284ef47fbb3f'}});
  console.log('Verified reverted attempt at block 17 with no published body.');
}

if (process.argv.length === 4 && process.argv[3] === '--historical') {
  await historical(createLocalRpc(process.argv[2],{limit:262144,timeout:5000}));
} else if (process.argv.length > 2) {
  const [endpoint,hash] = process.argv.slice(2);
  assert(endpoint && hash && process.argv.length === 4,
    'Usage: node test-paid-post-by-hash.mjs [http://127.0.0.1:PORT transaction-hash|--historical]');
  const rpc = createLocalRpc(endpoint,{limit:262144,timeout:5000});
  const replies = new Map();
  const key = (method,params) => JSON.stringify([method,params]);
  const record = async (method,params) => {
    const response = await rpc(method,params);
    replies.set(key(method,params),structuredClone(response));
    return response;
  };
  const result = await readPublishedPost(record,hash);
  assert.equal(result.status,'settled');
  assert.equal(result.hash,hash.toLowerCase());
  assert(result.text.length > 0);
  assert.match(result.signer,/^0x[0-9a-f]{40}$/);
  const {fee,share2,share3,dust} = result.settlement;
  assert.equal(BigInt(fee),BigInt(share2)+BigInt(share3)+BigInt(dust));
  assert.equal(fee,'5000000000000000000000');

  const hashRead = (method,params) => {
    assert(replies.has(key(method,params)), 'Unrecorded read: '+method);
    return structuredClone(replies.get(key(method,params)));
  };
  assert.deepEqual(await readPublishedPost(hashRead,hash),result);
  const childHash = result.block.hash;
  const parentHash = hashRead('eth_getBlockByHash',[childHash,false]).parentHash;
  async function rejectAltered(label, selectedMethod, select, alter) {
    let changed = false;
    await assert.rejects(readPublishedPost((method,params) => {
      const value = hashRead(method,params);
      if (method !== selectedMethod || !select(params)) return value;
      changed = true;
      return alter(value);
    },hash));
    assert(changed,label+' was exercised');
    console.log('Rejected:',label);
  }
  const any = () => true;
  await rejectAltered('receipt points to another transaction','eth_getTransactionReceipt',any,
    value => ({...value,transactionHash:unknown}));
  await rejectAltered('conflicting raw transaction bytes','eth_getRawTransactionByHash',any,
    value => value.slice(0,-2) + (value.endsWith('ab')?'cd':'ab'));
  await rejectAltered('unexpected second transaction','eth_getBlockByHash',p => p[0] === childHash,
    value => ({...value,transactions:[...value.transactions,unknown]}));
  await rejectAltered('unavailable parent header','eth_getBlockByHash',p => p[0] === parentHash,() => null);
  await rejectAltered('changed publication event','eth_getTransactionReceipt',any,value => {
    value.logs[1].data += '00';
    return value;
  });
  await rejectAltered('conflicting receipt status','eth_getTransactionReceipt',any,
    value => ({...value,status:'0x0'}));
  for (const [label,block] of [['parent',parentHash],['mined',childHash]]) {
    await rejectAltered(label+' custody proof','eth_getProof',p => p[0] === fixture.vault && p[2].blockHash === block,
      value => {
        const entry = value.storageProof[0];
        entry.value = entry.value === '0x1'?'0x0':'0x1';
        return value;
      });
  }
  await rejectAltered('reorganized block','eth_getBlockByNumber',p => p[0] === result.block.number,
    value => ({...value,hash:unknown}));
  console.log('Verified the selected post from its transaction hash and rejected nine conflicting reads.');
}
