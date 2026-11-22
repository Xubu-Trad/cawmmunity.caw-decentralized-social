import {isDeepStrictEqual} from 'node:util';
import {AbiCoder, keccak256, toBeHex} from 'ethers';
import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
import {previewPaidPost} from './paid-post-preview.mjs';
import {fixture} from './paid-post-fixture.mjs';

const abi = AbiCoder.defaultAbiCoder();
const word = value => toBeHex(value, 32);
const MAX = (1n << 256n) - 1n;
const slots = {
  root: word(0), credit2: word(4), stake2: word(5), credit3: word(8), stake3: word(9),
  liabilities: word(10), owner: word(12), epoch: word(13), credit1: word(14),
  stake1: word(15), nonce: keccak256(abi.encode(['uint256','uint256'], [1,16])), dust: word(17)
};
const balanceKey = keccak256(abi.encode(['address','uint256'], [fixture.vault,0]));
const check = (ok, message) => { if (!ok) throw Error(message); };

async function readStorage(rpc, header, address, codeHash, keys) {
  const proof = await rpc('eth_getProof', [address, keys, {blockHash:header.hash, requireCanonical:true}]);
  const verified = inspectHeaderBoundStateProof(JSON.stringify({header,proof}), JSON.stringify({
    schema:'caw-header-state-selection/1', profile:'shanghai-17', hash:header.hash, address, storageKeys:keys
  })).proof;
  check(verified.accountExists && verified.codeHash === codeHash, 'Unexpected fixture runtime');
  return new Map(verified.storage.map(entry => [entry.key, BigInt(entry.value)]));
}

// All arithmetic is in raw mock-token units and follows the fixed three-account contract.
function allocations(v, balance, fee) {
  check(v.stake1 + fee <= v.credit1, 'Insufficient unstaked payer credit');
  check(v.stake2 <= v.credit2 && v.stake3 <= v.credit3, 'Stake exceeds account credit');
  check(v.credit1 + v.credit2 + v.credit3 === v.liabilities, 'Credit total differs from liability');
  check(v.liabilities + v.dust <= balance, 'Insufficient custody backing');
  const eligible = v.stake2 + v.stake3;
  check(eligible > 0n && eligible <= MAX && v.nonce < MAX, 'Unusable pool or nonce');
  check(fee * v.stake2 <= MAX && fee * v.stake3 <= MAX, 'Share exceeds uint256');
  const share2 = fee * v.stake2 / eligible, share3 = fee * v.stake3 / eligible;
  return {payerCredit:String(v.credit1), payerStake:String(v.stake1), stake2:String(v.stake2),
    stake3:String(v.stake3), share2:String(share2), share3:String(share3), dust:String(fee-share2-share3)};
}

export async function checkPaidPostNetwork(rpc) {
  check(await rpc('eth_chainId', []) === '0x7a69', 'Wrong fixture chain ID');
  const genesis = await rpc('eth_getBlockByNumber', ['0x0',false]);
  check(genesis?.hash === fixture.genesisHash, 'Wrong fixture genesis');
}

// Reuse precisely these account and storage proofs for post-settlement accounting,
// including at heads where the payer can no longer afford another post.
export async function readPaidPostLedger(rpc, header) {
  check(header && /^0x[0-9a-f]{64}$/.test(header.hash), 'Missing selected header');
  const values = await readStorage(rpc, header, fixture.vault, fixture.vaultHash, Object.values(slots));
  const v = Object.fromEntries(Object.entries(slots).map(([name,key]) => [name, values.get(key)]));
  const owner = toBeHex(v.owner,20), wallet = fixture.wallets[owner];
  check(wallet, 'Unknown fixture wallet');
  const [token] = await Promise.all([
    readStorage(rpc,header,fixture.token,fixture.tokenHash,[balanceKey]),
    readStorage(rpc,header,owner,wallet.codeHash,[])
  ]);
  return {values:v, backing:token.get(balanceKey), owner, controller:wallet.controller};
}

export function reviewFromLedger(header, intent, ledger) {
  check(isDeepStrictEqual(Object.keys(intent).sort(), ['deadline','text','validAfter']), 'Invalid paid-post intent fields');
  const {values:v, backing, owner, controller} = ledger;
  const preview = previewPaidPost({...intent, accountId:'1', epoch:String(v.epoch), nonce:String(v.nonce), stakeRoot:word(v.root)});
  const time = BigInt(header.timestamp);
  check(time >= BigInt(intent.validAfter) && time < BigInt(intent.deadline), 'Outside reviewed validity window');
  return {version:1, scope:'LOCAL_C007_STATE_REVIEW', block:{number:header.number,hash:header.hash},
    intent, owner, controller, settlement:allocations(v,backing,BigInt(preview.typedData.message.fee)),
    preview};
}

async function atBlock(rpc, header, intent) {
  return reviewFromLedger(header, intent, await readPaidPostLedger(rpc, header));
}

async function stableLatest(rpc, intent) {
  const latest = () => rpc('eth_getBlockByNumber',['latest',false]);
  const result = await atBlock(rpc,await latest(),intent);
  check((await latest())?.hash === result.block.hash, 'Head moved during review. Retry.');
  return result;
}

export async function preparePaidPost(rpc, intent) {
  await checkPaidPostNetwork(rpc);
  return stableLatest(rpc, intent);
}

export async function recheckPaidPost(rpc, reviewed) {
  await checkPaidPostNetwork(rpc);
  check(typeof reviewed?.block?.number === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/.test(reviewed.block.number), 'Invalid review height');
  const original = await rpc('eth_getBlockByNumber',[reviewed.block.number,false]);
  check(original?.hash === reviewed.block.hash, 'Original block is no longer canonical');
  const reconstructed = await atBlock(rpc,original,reviewed.intent);
  check(isDeepStrictEqual(reviewed, reconstructed), 'Saved review differs from verified original');
  const current = await stableLatest(rpc,reviewed.intent);
  check(BigInt(current.block.number) >= BigInt(original.number), 'Head behind original review');
  for (const field of ['owner','controller','settlement','preview']) {
    check(isDeepStrictEqual(current[field], reviewed[field]), 'Reviewed '+field+' changed. Review again.');
  }
  // A reorganization during the fresh proof reads must invalidate the old review too.
  check((await rpc('eth_getBlockByNumber',[original.number,false]))?.hash === original.hash, 'Original block changed during recheck');
  return current;
}
