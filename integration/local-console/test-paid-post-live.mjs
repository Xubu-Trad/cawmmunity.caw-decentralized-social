import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLocalRpc} from './local-rpc.mjs';
import {preparePaidPost,recheckPaidPost} from './paid-post-state.mjs';
import {fixture} from './paid-post-fixture.mjs';

const rpc = createLocalRpc(process.argv[2], {limit:262144, timeout:5000});
const intent = JSON.parse(readFileSync(new URL('./paid-post-intent.json',import.meta.url)));
// Replay past heads from the archive. All state proofs come from the real node.
// Only the symbolic "latest" tag is replaced for these historical checks.
const at = height => (method,params) => rpc(method,
  method === 'eth_getBlockByNumber' && params[0] === 'latest' ? [height,false] : params);
const old = at('0x11'), nextOwner = at('0x1f');
const review = await preparePaidPost(old,intent);
assert.equal(review.preview.digest,'0xe362f82314cbff5789cf89a332c8a215b179aa60e9716e7cdaba95cf5430b189');
assert.equal(review.settlement.dust,'1');
assert.deepEqual(await recheckPaidPost(old,review),review);
const next = await preparePaidPost(nextOwner,intent);
assert.equal(next.preview.digest,'0x41c37cf4d347658bb9b6bd53c73ebc6282edcc9647fa6796da9b836b2f2862bd');
assert.notEqual(next.controller,review.controller);
assert.deepEqual(await recheckPaidPost(nextOwner,next),next);
await assert.rejects(recheckPaidPost(nextOwner,review),/Reviewed owner changed/);
await assert.rejects(recheckPaidPost(at('0x12'),review),/Insufficient unstaked payer credit/);
await assert.rejects(preparePaidPost(old,{...intent,deadline:'19'}),/validity window/);
await assert.rejects(recheckPaidPost(old,{...review,settlement:{...review.settlement,dust:'0'}}),/Saved review/);
for (const alteration of ['wrongChain','wrongGenesis','wrongBlock','wrongProof','movedHead']) {
  let heads = 0;
  const altered = async (method,params) => {
    if (method === 'eth_chainId' && alteration === 'wrongChain') return '0x1';
    if (method === 'eth_getBlockByNumber') {
      if (params[0] === '0x0' && alteration === 'wrongGenesis') return {hash:review.block.hash};
      if (params[0] === '0x11' && alteration === 'wrongBlock') return rpc(method,['0x12',false]);
      if (params[0] === 'latest' && alteration === 'movedHead' && ++heads === 2) return rpc(method,['0x12',false]);
    }
    const result = await old(method,params);
    if (method === 'eth_getProof') {
      assert.equal(params[2].requireCanonical,true);
      if (params[0] === fixture.vault && alteration === 'wrongProof') result.storageProof[0].value='0x1';
    }
    return result;
  };
  await assert.rejects(recheckPaidPost(altered,review));
}
console.log('Verified both historical owner previews and fresh rechecks. Nine stale, altered or invalid cases rejected.');
