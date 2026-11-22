import {Interface, recoverAddress} from 'ethers';
import {createLocalRpc} from './local-rpc.mjs';
import {preparePaidPost, recheckPaidPost} from './paid-post-state.mjs';

const validator = new Interface(['function isValidSignature(bytes32,bytes) view returns(bytes4)']);
const validSignature = '0x1626ba7e';

export const paidPostPaths = new Set([
  '/api/paid-post/prepare', '/api/paid-post/recheck', '/api/paid-post/verify'
]);

export function createPaidPostApi(endpoint) {
  const rpc = createLocalRpc(endpoint, {limit: 262144, timeout: 5000});
  return async function handle(route, body, signal) {
    const read = (method, params) => rpc(method, params, signal);
    if (route === '/api/paid-post/prepare') return preparePaidPost(read, body);
    if (route === '/api/paid-post/recheck') return recheckPaidPost(read, body);
    if (route !== '/api/paid-post/verify') throw Error('Unknown paid-post operation');

    if (!body || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'review') ||
        !Object.hasOwn(body, 'signature') || typeof body.signature !== 'string' ||
        !/^0x[0-9a-fA-F]{128}1[bBcC]$/.test(body.signature)) {
      throw Error('Expected a 65-byte fixture signature with recovery byte 27 or 28');
    }
    const reviewed = await recheckPaidPost(read, body.review);
    if (reviewed.block.hash !== body.review.block.hash) {
      throw Error('The node advanced after the wallet check. Review again.');
    }
    const digest = reviewed.preview.digest;
    let signer;
    try {
      signer = recoverAddress(digest, body.signature).toLowerCase();
    } catch {
      throw Error('Invalid signature for the reviewed digest');
    }
    if (signer !== reviewed.controller) throw Error('Signature belongs to a different controller');
    // Use the original signature bytes, including v, exactly as the fixture will receive them.
    const data = validator.encodeFunctionData('isValidSignature', [digest, body.signature]);
    const value = await read('eth_call', [{to: reviewed.owner, data},
      {blockHash: reviewed.block.hash, requireCanonical: true}]);
    if (value !== validator.encodeFunctionResult('isValidSignature', [validSignature])) {
      throw Error('The reviewed contract wallet rejected the signature');
    }
    if ((await read('eth_getBlockByNumber', ['latest', false]))?.hash !== reviewed.block.hash) {
      throw Error('The head changed during signature verification. Review again.');
    }
    return {digest, signer};
  };
}
