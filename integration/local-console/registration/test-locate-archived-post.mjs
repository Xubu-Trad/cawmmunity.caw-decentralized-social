import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decodeRlp, id, keccak256, toQuantity } from 'ethers';
import { verifyPostCapsule } from './verify-post-capsule.mjs';
import { captureLocatedPost, verifyLocatedPost } from './locate-archived-post.mjs';

const original = '0x81473ce06a2add0ef448b70e2cbca60f0b557eebbde2345fb147ec04e69e2a0d';
const tx = '0xa7145ef7bbc6e88cf0db0824b8e3b635dba8d5834b2865570d5c625c130066d7';
function sample(path) {
  return JSON.parse(readFileSync(new URL('./samples/' + path, import.meta.url)));
}
const archive = sample('branch-check/archive.json');

test('both published PR 44 paths have non-increasing block timestamps', () => {
  for (const [file, checkpoint] of [
    ['included', '0x2dadeb7d3f612c522e71ec1e7936119aaef8eb90d97299b271de015a5d5ede0a'],
    ['different', '0xd538d60819b9cfd6311861f844f249de6da16cb3e918c04bd06d5991d616941b']
  ]) {
    const evidence = sample('branch-check/' + file + '.json');
    const packet = { originalBlockHash: original, transactionHash: tx, checkpointHash: checkpoint,
      checkpointHeight: '0x25', originalEvidence: evidence, observed: null };
    assert.throws(() => verifyLocatedPost(archive, original, tx, checkpoint, packet), /timestamp/);
  }
});

function receiverSample() {
  const packet = sample('peer-check/located.json');
  const { receiverCheckpoint } = sample('peer-check/result.json');
  return { packet, checkpoint: receiverCheckpoint.hash };
}

test('the retained receiver checkpoint locates the original signed post offline', () => {
  const { packet, checkpoint } = receiverSample();
  const { original: old, located, post } = verifyLocatedPost(archive, original, tx, checkpoint, packet);
  assert.equal(old.status, 'different-block');
  assert.equal(located.status, 'included');
  assert.equal(located.blockHash, old.observedBlockHash);
  assert.notEqual(located.blockHash, original);
  assert.equal(post.hash, tx);
  assert.equal(post.blockHash, located.blockHash);
  assert.equal(post.name, 'hunter01');
  assert.equal(post.body, 'post before branch replacement');
  assert.equal(post.fee, '5000.0');
  const firstStaker = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const oldPost = verifyPostCapsule(archive, original, tx);
  assert.equal(oldPost.author, post.author);
  assert.equal(oldPost.fee, post.fee);
  assert.deepEqual(oldPost.credits, [{ staker: firstStaker, weight: '100.0', amount: '5000.0' }]);
  assert.deepEqual(post.credits, [
    { staker: firstStaker, weight: '200.0', amount: '2000.0' },
    { staker: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', weight: '300.0', amount: '3000.0' }
  ]);
});

test('a post archived from the selected branch stays included without replacement evidence', () => {
  const { packet, checkpoint } = receiverSample();
  const { archive: retained, blockHash, evidence } = packet.observed;
  const included = { ...packet, originalBlockHash: blockHash, originalEvidence: evidence, observed: null };
  const result = verifyLocatedPost(retained, blockHash, tx, checkpoint, included);
  assert.equal(result.original.status, 'included');
  assert.deepEqual(result.located, result.original);
  assert.equal(result.post.hash, tx);
  assert.throws(() => verifyLocatedPost(retained, blockHash, tx, checkpoint,
    { ...included, observed: packet.observed }), /unexpected replacement/i);
});

test('a wrong checkpoint or corrupted replacement archive cannot locate the post', () => {
  const { packet, checkpoint } = receiverSample();
  assert.throws(() => verifyLocatedPost(archive, original, tx, id('other checkpoint'), packet), /selection/);
  packet.observed.archive.receipt = '0x01';
  assert.throws(() => verifyLocatedPost(archive, original, tx, checkpoint, packet), /root mismatch|archive fields/);
});

// Replay only header reads from the saved receiver path. The supplied receipt lookup
// lets each test exercise an unavailable result or a conflicting RPC answer.
function headerRpc(packet, receipt, afterReceipt = block => block) {
  const fields = ['parentHash','sha3Uncles','miner','stateRoot','transactionsRoot','receiptsRoot',
    'logsBloom','difficulty','number','gasLimit','gasUsed','timestamp','extraData','mixHash',
    'nonce','baseFeePerGas','withdrawalsRoot'];
  const blocks = new Map();
  for (const header of packet.originalEvidence.headers) {
    const values = decodeRlp(header);
    const block = Object.fromEntries(fields.map((name, i) => [name, values[i]]));
    for (const name of ['difficulty','number','gasLimit','gasUsed','timestamp','baseFeePerGas']) {
      block[name] = toQuantity(block[name] === '0x' ? 0n : BigInt(block[name]));
    }
    block.hash = keccak256(header);
    blocks.set(block.hash, block);
  }
  const tip = blocks.get(packet.checkpointHash);
  let receiptRead = false;
  return async (method, [key]) => {
    switch (method) {
      case 'eth_chainId': return '0x539';
      case 'eth_getBlockByHash': return blocks.get(key) ?? null;
      case 'eth_getBlockByNumber':
        assert.equal(key, tip.number);
        return receiptRead ? afterReceipt(tip) : tip;
      case 'eth_getTransactionReceipt':
        assert.equal(key, tx);
        receiptRead = true;
        return receipt;
      default: throw Error('Unexpected test RPC ' + method);
    }
  };
}

test('an unavailable receipt leaves the post location unknown', async () => {
  const { packet, checkpoint } = receiverSample();
  const captured = await captureLocatedPost(headerRpc(packet, null), archive, original, tx, packet.checkpointHeight);
  const result = verifyLocatedPost(archive, original, tx, checkpoint, captured);
  assert.equal(result.original.status, 'different-block');
  assert.equal(result.located, null);
  assert.equal(result.post, null);
});

test('a receipt for a different transaction is rejected', async () => {
  const { packet } = receiverSample();
  const rpc = headerRpc(packet, { transactionHash: id('another post') });
  await assert.rejects(captureLocatedPost(rpc, archive, original, tx, packet.checkpointHeight), /receipt transaction mismatch/i);
});

test('capture rejects a checkpoint missing at the start, changed or lost before saving', async () => {
  const { packet } = receiverSample();
  const capture = rpc => captureLocatedPost(rpc, archive, original, tx, packet.checkpointHeight);
  await assert.rejects(capture(async () => null), /checkpoint height unavailable/i);
  for (const change of [() => null, tip => ({ ...tip, hash: id('changed while locating') })]) {
    await assert.rejects(capture(headerRpc(packet, null, change)), /checkpoint changed/i);
  }
});
