import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Wallet, verifyTypedData} from 'ethers';
import {fixture} from './paid-post-fixture.mjs';
import {previewPaidPost} from './paid-post-preview.mjs';
import {signReviewedPaidPost} from './ui/paid-post-signing.mjs';

const intent = JSON.parse(readFileSync(new URL('./paid-post-example.json',import.meta.url)));
const owner = '0x19a827174f66b3c66ad7063951d7b4f94f996e77';
const controller = fixture.wallets[owner].controller;
// These public synthetic fixture scalars are only used to generate disposable test signatures.
const wallet = new Wallet('0x' + '1'.padStart(64,'0'));
const otherWallet = new Wallet('0x' + '2'.padStart(64,'0'));
const block = {number:'0x11',hash:'0xe9aeb5afbfbf5e54e0c8f40acc59281c1eb6f6235ded92bffa4f284ef47fbb3f'};
const review = {
  scope:'LOCAL_C007_STATE_REVIEW', version:1, block, owner, controller,
  intent:{text:intent.text,validAfter:intent.validAfter,deadline:intent.deadline},
  settlement:{payerCredit:'6000000000000000000000',payerStake:'1000000000000000000000',
    stake2:'3000000000000000000',stake3:'8000000000000000000',share2:'1363636363636363636363',
    share3:'3636363636363636363636',dust:'1'}, preview:previewPaidPost(intent)
};
const disposableSignature = (request, signer) => {
  const data = JSON.parse(request.params[1]);
  return signer.signTypedData(data.domain,{Post:data.types.Post},data.message);
};

function setup() {
  const requests = [], phases = [];
  const provider = new EventEmitter();
  const env = {
    provider, chain:'0x7a69', account:wallet.address, genesis:fixture.genesisHash, head:block.hash,
    signer:wallet, signatureCalls:0, proofCalls:0, acceptedCalls:0, current:true, requests, phases
  };
  provider.request = async request => {
    requests.push(request.method);
    switch (request.method) {
      case 'eth_chainId': return env.chain;
      case 'eth_accounts': return [env.account];
      case 'eth_getBlockByNumber':
        return {hash:request.params[0] === '0x0' ? env.genesis : env.head};
      case 'eth_signTypedData_v4':
        assert.equal(request.params[0],controller);
        env.signatureCalls++;
        if (env.atPrompt) return env.atPrompt(request);
        return disposableSignature(request,env.signer);
      default: throw Error('Unexpected wallet operation '+request.method);
    }
  };
  env.options = {
    provider, review:structuredClone(review), isCurrent:() => env.current, onPhase:p => phases.push(p),
    recheck:async saved => {
      env.proofCalls++;
      return structuredClone(saved);
    },
    verifySignature:async ({review:current,signature}) => {
      env.acceptedCalls++;
      const {typedData,digest} = current.preview;
      return {digest, signer:verifyTypedData(typedData.domain,{Post:typedData.types.Post},typedData.message,signature)};
    }
  };
  return env;
}

test('signs the exact reviewed typed data and verifies a real disposable controller signature',async () => {
  const env = setup();
  const result = await signReviewedPaidPost(env.options);
  assert.deepEqual(result,{signer:controller,digest:'0xe362f82314cbff5789cf89a332c8a215b179aa60e9716e7cdaba95cf5430b189',block});
  assert.equal(env.acceptedCalls,1);
  assert.equal(env.proofCalls,2);
  assert.equal(env.signatureCalls,1);
  assert.deepEqual(env.phases,['rechecking','awaiting-wallet','verifying']);
  assert.equal(env.requests.filter(method => method === 'eth_getBlockByNumber').length,4);
  assert.deepEqual(env.provider.eventNames(),[]);
});

const preflight = [
  ['wallet account', e => { e.account = otherWallet.address; }],
  ['wallet chain', e => { e.chain = '0x1'; }],
  ['same-ID different genesis', e => { e.genesis = block.hash; }],
  ['different wallet checkpoint', e => { e.head = fixture.genesisHash; }],
  ['edited visible text', e => { e.options.review.intent.text += ' '; }],
  ['wrong signing domain', e => { e.options.review.preview.typedData.domain.chainId = '0x1'; }],
  ['wrong signing contract', e => { e.options.review.preview.typedData.domain.verifyingContract = owner; }],
  ['altered typed schema', e => { e.options.review.preview.typedData.types.Post.reverse(); }],
  ['different signed fee', e => { e.options.review.preview.typedData.message.fee = '5000'; }],
  ['wrong signing digest', e => { e.options.review.preview.digest = block.hash; }],
  ['different latest allocation', e => { e.options.recheck = async s => ({...s,settlement:{...s.settlement,dust:'2'}}); }],
  ['retired wallet provider', e => { e.current = false; }]
];
for (const [name,change] of preflight) {
  test('declines before prompting: '+name,async () => {
    const env = setup();
    change(env);
    await assert.rejects(signReviewedPaidPost(env.options));
    assert.equal(env.signatureCalls,0);
    assert.equal(env.acceptedCalls,0);
    assert.deepEqual(env.provider.eventNames(),[]);
  });
}

for (const event of ['accountsChanged','chainChanged','disconnect']) {
  test('discards outstanding signature on '+event+', even when the wallet reads normally afterward',async () => {
    const env = setup();
    env.atPrompt = async request => {
      env.provider.emit(event);
      return disposableSignature(request,wallet);
    };
    await assert.rejects(signReviewedPaidPost(env.options),/changed/);
    assert.equal(env.signatureCalls,1);
    assert.equal(env.acceptedCalls,0);
    assert.deepEqual(env.provider.eventNames(),[]);
  });
}

test('declines a genuine signature from a different private key',async () => {
  const env = setup();
  env.signer = otherWallet;
  await assert.rejects(signReviewedPaidPost(env.options),/reviewed controller or digest/);
});

test('discards wallet decline and releases listeners for a fresh review',async () => {
  const env = setup();
  env.atPrompt = async () => {throw Object.assign(Error('denied'),{code:4001});};
  await assert.rejects(signReviewedPaidPost(env.options),/declined/);
  assert.deepEqual(env.provider.eventNames(),[]);
  delete env.atPrompt;
  assert.equal((await signReviewedPaidPost(env.options)).signer,controller);
});

test('checks wallet context again after a silent provider change during the prompt',async () => {
  const env = setup();
  env.atPrompt = request => {
    env.genesis = block.hash;
    return disposableSignature(request,wallet);
  };
  await assert.rejects(signReviewedPaidPost(env.options),/different local chain/);
  assert.equal(env.acceptedCalls,0);
});

test('requires the original review to pass its state recheck after the wallet answers',async () => {
  const env = setup();
  env.options.recheck = async saved => {
    if (++env.proofCalls === 2) throw Error('Reviewed owner changed.');
    return structuredClone(saved);
  };
  await assert.rejects(signReviewedPaidPost(env.options),/Reviewed owner/);
  assert.equal(env.acceptedCalls,0);
});

test('requires the verified digest to match the exact reviewed digest',async () => {
  const env = setup();
  env.options.verifySignature = async () => ({signer:controller,digest:block.hash});
  await assert.rejects(signReviewedPaidPost(env.options),/reviewed controller or digest/);
});

test('only one open prompt per provider and a late answer is discarded after UI changes',async () => {
  const env = setup();
  let open, answer;
  const opened = new Promise(resolve => {open = resolve;});
  env.atPrompt = request => new Promise(resolve => {
    open();
    answer = () => resolve(disposableSignature(request,wallet));
  });
  const first = signReviewedPaidPost(env.options);
  await opened;
  await assert.rejects(signReviewedPaidPost(env.options),/already open/);
  env.current = false;
  answer();
  await assert.rejects(first,/changed/);
  assert.equal(env.signatureCalls,1);
  assert.equal(env.acceptedCalls,0);
});
