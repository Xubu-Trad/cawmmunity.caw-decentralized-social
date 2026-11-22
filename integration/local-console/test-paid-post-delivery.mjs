import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {Interface, Wallet, toBeHex, toUtf8Bytes} from 'ethers';
import {fixture} from './paid-post-fixture.mjs';
import {previewPaidPost} from './paid-post-preview.mjs';
import {paidPostTransaction,submitPaidPost,readPaidDelivery,checkPaidDelivery} from './ui/paid-post-delivery.mjs';

const sample = JSON.parse(readFileSync(new URL('./paid-post-example.json',import.meta.url)));
const wallet = new Wallet(toBeHex(1,32)); // Public fixture controller.
const owner = Object.keys(fixture.wallets).find(k => fixture.wallets[k].controller === wallet.address.toLowerCase());
const hash = '0x'+'13'.repeat(32);
const block = {number:'0x11',hash:'0xe9aeb5afbfbf5e54e0c8f40acc59281c1eb6f6235ded92bffa4f284ef47fbb3f'};
const abi = new Interface(['function settleFixedPool1((uint256,uint256,uint256,uint256,uint256,bytes32,bytes32),bytes,bytes)']);
async function setup(text = sample.text) {
  const preview = previewPaidPost({...sample,text});
  const {types,domain,message} = preview.typedData;
  const signature = await wallet.signTypedData(domain,{Post:types.Post},message);
  const review = {version:1,scope:'LOCAL_C007_STATE_REVIEW',owner,controller:wallet.address.toLowerCase(),
    intent:{text,validAfter:sample.validAfter,deadline:sample.deadline},preview,block,settlement:{dust:'1',share2:'10',share3:'11'}};
  const store = new Map();
  let queue = Promise.resolve();
  const context = {storage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    locks:{request:(_key,fn)=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;}}};
  const env = {chain:'0x7a69',account:wallet.address,genesis:fixture.genesisHash,head:block.hash, sends:0, store, context};
  const provider = {request:async ({method,params})=>{
    if (method === 'eth_chainId') return env.chain;
    if (method === 'eth_accounts') return [env.account];
    if (method === 'eth_getBlockByNumber') return {hash:params[0]==='0x0'?env.genesis:env.head};
    assert.equal(method,'eth_sendTransaction');
    assert.equal(readPaidDelivery(context.storage).status,'pending');
    env.sends++;
    if (env.send) return env.send(params[0]);
    return hash;
  }};
  env.args={authorization:{review,signature}, provider,context, recheck:async saved=>structuredClone(saved),
    verifySignature:async()=>({digest:preview.digest,signer:review.controller}), isCurrent:()=>true};
  return env;
}

for (const text of ['abcdefgh','🐦'.repeat(420),'line one\nline two','1234567890'.repeat(9)]) {
  test('wallet calldata matches independent ethers encoding for '+[...text].length+' characters', async () => {
    const env = await setup(text);
    const {review,signature} = env.args.authorization;
    const {message:m} = review.preview.typedData;
    const tx = paidPostTransaction(review,signature);
    assert.deepEqual(tx,{from:review.controller,to:fixture.vault,value:'0x0',chainId:'0x7a69',
      data:abi.encodeFunctionData('settleFixedPool1',[[m.accountId,m.epoch,m.nonce,m.validAfter,m.deadline,m.stakeRoot,m.textHash],signature,toUtf8Bytes(text)])});
  });
}

test('durable reservation precedes sending and has no raw signature; prevents duplicate across callers', async () => {
  const env=await setup();
  const results=await Promise.allSettled([submitPaidPost(env.args),submitPaidPost(env.args)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(env.sends,1);
  assert.equal(readPaidDelivery(env.context.storage).hash,hash);
  assert.ok(!JSON.stringify([...env.store.values()]).includes(env.args.authorization.signature));
});

test('uncertain transport survives reload; pending guessed hash cannot overwrite stored review',async () => {
  const env=await setup(); env.send=()=>{throw Error('unavailable');};
  await assert.rejects(submitPaidPost(env.args),/outcome unknown/);
  const old=readPaidDelivery(env.context.storage);
  assert.equal(old.hash,null);
  assert.equal((await checkPaidDelivery(env.context,hash,async ({hash})=>({status:'pending',hash}))).status,'pending');
  assert.deepEqual(readPaidDelivery(env.context.storage),old);
  await assert.rejects(submitPaidPost(env.args),/still needs/);
  assert.equal(env.sends,1);
});

test('explicit wallet rejection clears the reservation; a subsequent deliberate click is allowed',async()=>{
  const env=await setup(); env.send=()=>{throw Object.assign(Error('denied'),{code:4001});};
  await assert.rejects(submitPaidPost(env.args),/declined/);
  assert.equal(readPaidDelivery(env.context.storage),null);
  delete env.send;
  assert.equal((await submitPaidPost(env.args)).hash,hash);
});

test('non-hash return retains the reservation for recovery', async()=>{
  const env=await setup();env.send=()=>null;
  await assert.rejects(submitPaidPost(env.args),/usable hash/);
  assert.equal(readPaidDelivery(env.context.storage).hash,null);
});

for (const reason of ['different controller','state change','wallet identity','storage unavailable']) {
  test('aborts before sending for '+reason,async ()=>{
    const env=await setup();
    if(reason==='different controller') env.args.verifySignature=async()=>({digest:env.args.authorization.review.preview.digest,signer:owner});
    if(reason==='state change') env.args.recheck=async saved=>({...saved,settlement:{dust:'2'}});
    if(reason==='wallet identity') env.args.verifySignature=async()=>{env.account=owner;return {digest:env.args.authorization.review.preview.digest,signer:env.args.authorization.review.controller};};
    if(reason==='storage unavailable') env.context.storage.setItem=()=>{throw Error('storage full');};
    await assert.rejects(submitPaidPost(env.args));
    assert.equal(env.sends,0);
  });
}

test('a silent context change during the storage lock prevents the wallet request',async()=>{
  const env=await setup(), persist=env.context.storage.setItem;
  env.context.storage.setItem=(k,v)=>{persist(k,v);env.chain='0x1';};
  await assert.rejects(submitPaidPost(env.args),/changed before submission/);
  assert.equal(env.sends,0);
  assert.equal(readPaidDelivery(env.context.storage),null);
});

test('receipt recovery never needs a second send or a raw authorization',async()=>{
  const env=await setup();env.send=()=>{throw Error('lost response');};
  await assert.rejects(submitPaidPost(env.args));
  await assert.rejects(checkPaidDelivery(env.context,hash,async()=>{throw Error('different transaction');}));
  assert.equal(readPaidDelivery(env.context.storage).status,'pending');
  await checkPaidDelivery(env.context,hash,async request=>{
    assert.deepEqual(request,{hash,review:env.args.authorization.review,calldataHash:readPaidDelivery(env.context.storage).calldataHash});
    const {review} = request;
    return {hash,status:'settled',calldataHash:request.calldataHash,block:{number:'0x12',hash},digest:review.preview.digest,
      signer:review.controller,text:review.intent.text,settlement:{fee:review.preview.typedData.message.fee,...review.settlement}};
  });
  assert.equal(readPaidDelivery(env.context.storage).status,'settled');
  await checkPaidDelivery(env.context,hash,async()=>({hash,status:'pending'}));
  assert.equal(readPaidDelivery(env.context.storage).status,'pending');
  assert.equal(env.sends,1);
});

test('conflicting settlement leaves the submission pending and retryable for read-only checking', async () => {
  const env=await setup();
  await submitPaidPost(env.args);
  const {review} = env.args.authorization;
  const receipt = {hash,status:'settled',calldataHash:readPaidDelivery(env.context.storage).calldataHash,block:{number:'0x12',hash},signer:review.controller,text:review.intent.text,
    digest:review.preview.digest,settlement:{...review.settlement,fee:'1'}};
  await assert.rejects(checkPaidDelivery(env.context,hash,async()=>receipt),/settlement differs/);
  assert.equal(readPaidDelivery(env.context.storage).status,'pending');
});
