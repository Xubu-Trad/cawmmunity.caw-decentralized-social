import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Interface, Transaction, recoverAddress, toUtf8String} from 'ethers';
import {previewPaidPost} from './paid-post-preview.mjs';

const load = name => JSON.parse(readFileSync(new URL('../../evidence/'+name,import.meta.url)));
const {blocks} = load('c007-new-owner-replay-20261108/acquired-history.json');
const {vault,wallet,controllers} = load('c007-new-owner-post-20261108/accounting-summary.json');
const owners = [wallet,'0x985d0ce92f2af930e309f5ff89139490ac2d9e94'];
const abi = new Interface(['function settleFixedPool1((uint256,uint256,uint256,uint256,uint256,bytes32,bytes32),bytes,bytes)']);
const seen = [];
for (const {rawTransactions,receipts} of blocks) {
  for (const [i,raw] of rawTransactions.entries()) {
    const tx = Transaction.from(raw);
    if (tx.to?.toLowerCase() !== vault || !tx.data.startsWith(abi.getFunction('settleFixedPool1').selector) || BigInt(receipts[i].status) !== 1n) continue;
    const [req,signature,body] = abi.decodeFunctionData('settleFixedPool1', tx.data);
    const [accountId,epoch,nonce,validAfter,deadline] = req.slice(0,5).map(String);
    const input = {accountId,epoch,nonce,validAfter,deadline,stakeRoot:req[5],text:toUtf8String(body)};
    const review = previewPaidPost(input);
    assert.equal(review.typedData.message.textHash,req[6]);
    assert.equal(recoverAddress(review.digest,signature).toLowerCase(),controllers[owners[seen.length]]);
    assert.equal(review.typedData.domain.verifyingContract,vault);
    assert.equal(BigInt(review.typedData.domain.chainId),tx.chainId);
    assert.equal(BigInt(review.typedData.message.fee),5000n*10n**18n);
    for (const change of [{accountId:'2'},{nonce:1},{epoch:'-1'},{deadline:validAfter},{stakeRoot:'0x00'},
      {text:'x'.repeat(421)},{text:String.fromCharCode(0xd800)},{fee:'0'},{verifyingContract:vault}])
      assert.throws(() => previewPaidPost({...input,...change}));
    for (const change of [{nonce:String(BigInt(nonce)+1n)},{text:input.text+'!'},{stakeRoot:'0x'+'00'.repeat(32)}])
      assert.notEqual(previewPaidPost({...input,...change}).digest,review.digest);
    seen.push([epoch,nonce]);
    console.log(JSON.stringify({epoch,nonce,transaction:tx.hash,digest:review.digest}));
  }
}
assert.deepEqual(seen,[['0','0'],['1','1']]);
