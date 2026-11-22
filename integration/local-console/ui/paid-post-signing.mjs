import {fixture} from '../paid-post-fixture.mjs';
import {keccak256Hex} from './keccak256.mjs';
import {postText} from './post-plan.mjs';
import {verifyWalletProviderContext} from './wallet-provider.mjs';

const chainId = '0x7a69';
const domain = {
  name: 'CAW C007 Synthetic Action', version: '1', chainId, verifyingContract: fixture.vault
};
const fee = '5000000000000000000000';
const integerNames = ['accountId', 'epoch', 'nonce', 'validAfter', 'deadline'];
const field = (name, type) => ({name, type});
const types = {
  EIP712Domain: [field('name','string'), field('version','string'), field('chainId','uint256'), field('verifyingContract','address')],
  Post: [...integerNames.map(name => field(name,'uint256')), field('stakeRoot','bytes32'),
    field('textHash','bytes32'), field('fee','uint256'), field('profile','bytes32')]
};

const active = new WeakSet();
const word = value => BigInt(value).toString(16).padStart(64,'0');
const uint = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value) && BigInt(value) < 2n**256n;
const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value);
const literal = text => keccak256Hex('0x' + Array.from(new TextEncoder().encode(text),
  byte => byte.toString(16).padStart(2,'0')).join(''));
function structHash(type, values) {
  const declaration = type + '(' + types[type].map(({name, type}) => type + ' ' + name).join(',') + ')';
  return keccak256Hex(literal(declaration) + values.join(''));
}
const domainHash = structHash('EIP712Domain', [
  literal(domain.name).slice(2), literal(domain.version).slice(2), word(chainId), word(fixture.vault)
]);
const profile = literal('CAW_C007_SYNTHETIC_POST_V1');

// Compare JSON objects independent of key order; EIP-712 field array order matters.
function sameJson(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b,key) && sameJson(a[key],b[key]));
}

function validateReview(review) {
  const {intent, preview} = review;
  const data = preview?.typedData;
  const message = data?.message;
  if (review.version !== 1 || review.scope !== 'LOCAL_C007_STATE_REVIEW' ||
      preview?.scope !== 'OFFLINE_C007_SYNTHETIC_PREVIEW' ||
      !Object.hasOwn(fixture.wallets,review.owner) || fixture.wallets[review.owner].controller !== review.controller ||
      !sameJson(data?.domain,domain) || data.primaryType !== 'Post' || !sameJson(data.types,types) ||
      !sameJson(Object.keys(data).sort(), ['domain','message','primaryType','types']) || !message ||
      !sameJson(Object.keys(message).sort(), types.Post.map(({name}) => name).sort()) ||
      !integerNames.every(name => uint(message[name])) || message.accountId !== '1' ||
      message.validAfter !== intent?.validAfter || message.deadline !== intent.deadline ||
      BigInt(message.validAfter) >= BigInt(message.deadline) || preview.text !== intent.text ||
      preview.feeMockTokens !== '5000' || message.fee !== fee || message.profile !== profile ||
      !hash(message.stakeRoot) || message.textHash !== postText(intent.text).textHash) {
    throw Error('Paid-post wallet payload differs from the reviewed C-007 intent.');
  }
  const postHash = structHash('Post', [...integerNames.map(name => word(message[name])),
    message.stakeRoot.slice(2), message.textHash.slice(2), word(fee), profile.slice(2)]);
  const digest = keccak256Hex('0x1901' + domainHash.slice(2) + postHash.slice(2));
  if (digest !== preview.digest) throw Error('Paid-post signing digest mismatch.');
}

// A block may advance with identical signing state. Every reviewed field other
// than the selected block must survive both independent state acquisitions.
function checkReacquired(original, current) {
  validateReview(current);
  if (!sameJson({...original,block:null}, {...current,block:null})) {
    throw Error('Paid-post review changed. Prepare and review again.');
  }
}

async function checkWallet(provider, review) {
  await verifyWalletProviderContext(provider, {
    chainId, from: review.controller, genesisHash: fixture.genesisHash,
    blockHash: review.block.hash, blockNumber: review.block.number
  });
}

export async function signReviewedPaidPost({provider, review, recheck, verifySignature, isCurrent, onPhase = () => {}}) {
  if (!provider?.on || !provider.removeListener || !provider.request || typeof isCurrent !== 'function') {
    throw Error('Connect a wallet that reports account and network changes.');
  }
  if (active.has(provider)) throw Error('A paid-post wallet review is already open.');
  const original = structuredClone(review);
  validateReview(original);
  let changed = false;
  const invalidate = () => { changed = true; };
  const guard = () => {
    if (changed || !isCurrent()) throw Error('Wallet or review changed. Prepare and review again.');
  };
  const events = [];
  active.add(provider);
  try {
    for (const event of ['accountsChanged','chainChanged','disconnect']) {
      provider.on(event,invalidate);
      events.push(event);
    }
    guard();
    onPhase('rechecking');
    const fresh = await recheck(structuredClone(original));
    guard();
    checkReacquired(original,fresh);
    await checkWallet(provider,fresh);
    guard();
    onPhase('awaiting-wallet');
    guard();
    let signature;
    try {
      signature = await provider.request({method:'eth_signTypedData_v4',
        params:[original.controller, JSON.stringify(original.preview.typedData)]});
    } catch (error) {
      if (error?.code === 4001) throw Error('Wallet signature declined.');
      throw Error('The wallet could not sign the reviewed paid post.');
    }
    guard();
    if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
      throw Error('Wallet returned an invalid signature.');
    }
    onPhase('verifying');
    const latest = await recheck(structuredClone(original));
    guard();
    checkReacquired(original,latest);
    await checkWallet(provider,latest);
    guard();
    const verified = await verifySignature({review:structuredClone(latest),signature});
    guard();
    if (verified?.digest !== original.preview.digest || verified?.signer?.toLowerCase() !== original.controller) {
      throw Error('Signature verification differs from the reviewed controller or digest.');
    }
    return {digest:original.preview.digest, signer:original.controller, block:latest.block};
  } finally {
    active.delete(provider);
    for (const event of events) provider.removeListener(event,invalidate);
  }
}
