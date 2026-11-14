import {containsOwnerTransfer,acquireOwnerPostHistory} from './acquire-owner-post-history.mjs';
import {verifyPostingHistory, POST_NONCE} from './verify-posting-history.mjs';
import {requirePostBlockSize} from './post-block-scope.mjs';

const OWNER = '0xabbb5caa7dda850e60932de0934eb1f9d0f59695050f761dc64e443e5030a569';
const EPOCH = '0x91da3fd0782e51c6b3986e9e672fd566868e71f3dbc2d6c2cd6fbb3e361af2a7';
const quantity = /^0x(?:0|[1-9a-f][0-9a-f]*)$/;

// The caller supplies the console's bounded, read-only RPC function. Selections
// are local observations, not consensus-authenticated public-chain anchors.
export async function acquireVerifiedPosts(rpc, config, signal) {
  const deadline = Date.now() + 30000;
  let requests = 0, bytes = 0;
  async function read(method, params) {
    signal?.throwIfAborted();
    if (Date.now() >= deadline || ++requests > 1024) throw Error('STRICT_HISTORY_BUDGET');
    const value = await rpc(method, params, signal);
    signal?.throwIfAborted();
    if (Date.now() >= deadline) throw Error('STRICT_HISTORY_TIMEOUT');
    bytes += Buffer.byteLength(JSON.stringify(value));
    if (bytes > 8 * 1024 * 1024) throw Error('STRICT_HISTORY_BYTES');
    return value;
  }
  if (await read('eth_chainId', []) !== '0x7a69') throw Error('WRONG_CHAIN');
  if ((await read('eth_getBlockByNumber', ['0x0', false]))?.hash !== config.genesisHash) throw Error('WRONG_GENESIS');
  const anchor = await read('eth_getBlockByNumber', [config.postingDeployment.blockNumber, false]);
  const tip = await read('eth_getBlockByNumber', ['latest', false]);
  if (!anchor || anchor.hash !== config.postingDeployment.blockHash || anchor.number !== config.postingDeployment.blockNumber || !quantity.test(tip?.number)) throw Error('STRICT_HISTORY_SELECTION');
  const count = BigInt(tip.number) - BigInt(anchor.number);
  // Empty histories are intentionally not accepted by this fixed-fixture reader.
  if (count < 1n || count > 128n) throw Error('STRICT_HISTORY_RANGE');
  const bundle = {schema: 'local-posting-history/1', anchor, blocks: []};
  let prior = anchor;
  for (let number = BigInt(anchor.number) + 1n; number <= BigInt(tip.number); number++) {
    const header = await read('eth_getBlockByNumber', ['0x' + number.toString(16), false]);
    if (!header) throw Error('STRICT_HISTORY_HEADER');
    requirePostBlockSize(header.transactions);
    // Block-hash selectors prevent proof acquisition from silently following a
    // different branch at the same height. The strict reader still checks roots.
    const at = {blockHash: prior.hash, requireCanonical: true};
    const registry = await read('eth_getProof', [config.contracts.registry.address, [OWNER, EPOCH], at]);
    const ownerValue = registry?.storageProof?.find(p => p.key === OWNER)?.value;
    if (!quantity.test(ownerValue) || BigInt(ownerValue) >= 2n ** 160n) throw Error('INVALID_OWNER_PROOF_VALUE');
    const owner = '0x' + BigInt(ownerValue).toString(16).padStart(40, '0');
    const parent = {
      registry,
      posting: await read('eth_getProof', [config.contracts.posting.address, [POST_NONCE], at]),
      owner: await read('eth_getProof', [owner, [], at])
    };
    const rawTransactions = [], receipts = [];
    for (const hash of header.transactions) {
      rawTransactions.push(await read('eth_getRawTransactionByHash', [hash]));
      receipts.push(await read('eth_getTransactionReceipt', [hash]));
    }
    bundle.blocks.push({header, rawTransactions, receipts, parent});
    prior = header;
  }
  bundle.finalPosting = await read('eth_getProof', [config.contracts.posting.address, [POST_NONCE], {blockHash: tip.hash, requireCanonical: true}]);
  const selection = {startHash: anchor.hash, endHash: tip.hash, contracts: config.contracts, controller: config.controller};
  if (containsOwnerTransfer(bundle, config.contracts.registry.address))
    await acquireOwnerPostHistory(read, bundle, selection);
  const result = verifyPostingHistory(bundle, selection);
  if ((await read('eth_getBlockByNumber', [tip.number, false]))?.hash !== tip.hash || (await read('eth_getBlockByNumber', [anchor.number, false]))?.hash !== anchor.hash) throw Error('STRICT_HISTORY_REORG');
  return {status: 'VERIFIED_LOCAL_HISTORY', genesisHash: config.genesisHash, posting: config.contracts.posting.address,
    startHash: anchor.hash, blockHash: tip.hash, blockNumber: tip.number, ...result,
    verificationLocation: 'local-console-server', acquisitionRequests: requests,
    scope: 'Selected local history; not public-chain consensus or finality. Fixture controller and code/layout selections remain trusted.'};
}
