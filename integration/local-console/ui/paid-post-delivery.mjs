import {fixture} from '../paid-post-fixture.mjs';
import {keccak256Hex} from './keccak256.mjs';
import {postText} from './post-plan.mjs';
import {checkReacquired, checkWallet, validateReview} from './paid-post-signing.mjs';

export const deliveryStorageKey = 'caw.c007.paid-post.delivery.v1';
const key = deliveryStorageKey;
const txHash = value => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
const word = value => BigInt(value).toString(16).padStart(64,'0');
const selector = keccak256Hex(postText('settleFixedPool1((uint256,uint256,uint256,uint256,uint256,bytes32,bytes32),bytes,bytes)').bytesHex).slice(0,10);
const inProgress = record => record && record.status === 'pending';

function dynamicBytes(hex) {
  const n = hex.length / 2;
  return word(n) + hex.padEnd(Math.ceil(n/32)*64,'0');
}

// The browser encodes the seven static intent words and both length-prefixed byte
// arrays independently. The signature remains in memory only while it is needed.
export function paidPostTransaction(review, signature) {
  validateReview(review);
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{128}1[bBcC]$/.test(signature)) {
    throw Error('Invalid contract wallet signature.');
  }
  const m = review.preview.typedData.message;
  const headSize = 9 * 32;
  const signed = dynamicBytes(signature.slice(2));
  const text = dynamicBytes(postText(review.intent.text).bytesHex.slice(2));
  const words = [m.accountId,m.epoch,m.nonce,m.validAfter,m.deadline].map(word);
  const data = selector + words.join('') + m.stakeRoot.slice(2) + m.textHash.slice(2)
    + word(headSize) + word(headSize + signed.length / 2) + signed + text;
  return {from:review.controller, to:fixture.vault, data, value:'0x0', chainId:'0x7a69'};
}

export function readPaidDelivery(storage) {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  if (raw.length > 16384) throw Error('Saved paid post exceeds the review limit.');
  const record = JSON.parse(raw);
  if (record?.version !== 1 || !txHash(record.calldataHash) || typeof record.id !== 'string' || !record.id ||
      !['pending','settled','reverted'].includes(record.status) ||
      !(txHash(record.hash) || record.hash === null && record.status === 'pending')) {
    throw Error('Saved paid post cannot be read.');
  }
  validateReview(record.review);
  return record;
}

function withStorageLock(context, callback) {
  if (!context.locks?.request) throw Error('This browser needs Web Locks for safe submission.');
  return context.locks.request(key, callback);
}

function save(storage, record) {
  const raw = JSON.stringify(record);
  if (raw.length > 16384) throw Error('Paid-post review is too large to save.');
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw Error('Could not save the paid-post review reliably.');
  return record;
}

function update(context, id, change) {
  return withStorageLock(context, () => {
    const current = readPaidDelivery(context.storage);
    if (!inProgress(current) || current.id !== id) throw Error('Paid-post recovery record changed.');
    return change(current);
  });
}

export async function submitPaidPost({provider, authorization, recheck, verifySignature, isCurrent, context}) {
  const {review, signature} = authorization;
  const guard = () => {
    if (!isCurrent()) throw Error('The wallet or reviewed post changed before submission.');
  };
  const fresh = await recheck(review);
  checkReacquired(review, fresh);
  const tx = paidPostTransaction(fresh, signature);
  const verified = await verifySignature({review:fresh,signature});
  if (verified?.digest !== fresh.preview.digest || verified?.signer !== fresh.controller) {
    throw Error('The contract wallet did not confirm this authorization.');
  }
  await checkWallet(provider, fresh);
  guard();
  const id = crypto.randomUUID();
  await withStorageLock(context, () => {
    guard();
    if (inProgress(readPaidDelivery(context.storage))) throw Error('A paid post still needs a receipt check.');
    save(context.storage, {version:1, id, status:'pending', review:fresh, calldataHash:keccak256Hex(tx.data), hash:null});
  });
  // Once the provider is called, every ambiguous outcome keeps the durable
  // reservation, including window closure, a missing hash or an RPC timeout.
  let asked = false;
  let hash;
  try {
    await checkWallet(provider, fresh);
    guard();
    asked = true;
    hash = await provider.request({method:'eth_sendTransaction', params:[tx]});
  } catch (error) {
    if (!asked || error?.code === 4001) {
      await update(context,id,() => context.storage.removeItem(key));
      throw Error(asked ? 'Wallet declined the transaction.' : 'Wallet changed before submission.');
    }
    throw Error('Wallet outcome unknown. Check wallet activity for the transaction hash.');
  }
  if (!txHash(hash)) throw Error('Wallet returned no usable hash. Check wallet activity before continuing.');
  return update(context,id,current => save(context.storage,{...current, hash:hash.toLowerCase()}));
}

export async function checkPaidDelivery(context, suppliedHash, getReceipt) {
  const record = readPaidDelivery(context.storage);
  if (!record) throw Error('No saved paid post to check.');
  const hash = record.hash ?? suppliedHash;
  if (!txHash(hash)) throw Error('Enter the transaction hash from the submitting wallet.');
  const receipt = await getReceipt({review:record.review, hash:hash.toLowerCase(), calldataHash:record.calldataHash});
  if (receipt?.hash?.toLowerCase() !== hash.toLowerCase() ||
      !['pending','settled','reverted'].includes(receipt.status)) throw Error('Unexpected paid-post receipt result.');
  if (receipt.status !== 'pending') {
    const {review} = record;
    if (receipt.calldataHash !== record.calldataHash || receipt.signer?.toLowerCase() !== review.controller || receipt.text !== review.intent.text ||
        receipt.digest !== review.preview.digest || !txHash(receipt.block?.hash) ||
        typeof receipt.block.number !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(receipt.block.number) ||
        BigInt(receipt.block.number) <= BigInt(review.block.number)) {
      throw Error('Receipt does not match the reviewed authorization.');
    }
    if (receipt.status === 'settled') {
      const expected = {fee:review.preview.typedData.message.fee, share2:review.settlement.share2,
        share3:review.settlement.share3, dust:review.settlement.dust};
      if (!Object.entries(expected).every(([field,value]) => typeof value === 'string' && receipt.settlement?.[field] === value)) {
        throw Error('Receipt settlement differs from the reviewed fee and shares.');
      }
    }
  }
  // A manually entered hash is bound only once the included transaction
  // matches the review. A previously verified hash may become pending on reorg.
  if (receipt.status !== record.status) {
    await withStorageLock(context, () => {
      const current = readPaidDelivery(context.storage);
      if (current?.id !== record.id || current.status !== record.status || current.hash !== record.hash) {
        throw Error('The saved paid-post receipt changed during verification. Check again.');
      }
      save(context.storage,{...current,hash:hash.toLowerCase(),status:receipt.status});
    });
  }
  return receipt;
}
