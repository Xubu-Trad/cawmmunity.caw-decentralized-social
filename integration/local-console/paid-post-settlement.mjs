import {isDeepStrictEqual} from 'node:util';
import {Interface, hexlify, keccak256, recoverAddress, toUtf8Bytes} from 'ethers';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockTransactionReceipts} from '../../reference/ethereum-block-transactions.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {fixture} from './paid-post-fixture.mjs';
import {checkPaidPostNetwork, readPaidPostLedger, reviewFromLedger} from './paid-post-state.mjs';

const contract = new Interface([
  'function settleFixedPool1((uint256 accountId,uint256 epoch,uint256 nonce,uint256 validAfter,uint256 deadline,bytes32 stakeRoot,bytes32 textHash) req,bytes signature,bytes text)',
  'event ExperimentalFeeSettled(uint256 indexed payerAccount,uint256 indexed nonce,uint256 allocation2,uint256 allocation3,uint256 dust,bytes32 textHash)',
  'event ExperimentalTextPublished(uint256 indexed payerAccount,uint256 indexed nonce,bytes text)'
]);
const hashPattern = /^0x[0-9a-f]{64}$/;
const heightPattern = /^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/;
function requireMatch(ok, message) {
  if (!ok) throw Error(message);
}

async function reviewInterval(read, end, start) {
  const distance = BigInt(end.number) - BigInt(start.number);
  requireMatch(distance > 0n && distance <= 128n, 'Receipt must be within 128 blocks after review');
  const headers = [end];
  for (let step = 0n; step < distance; step++) {
    const previous = await read('eth_getBlockByHash', [headers.at(-1).parentHash, false]);
    requireMatch(previous, 'Missing header between review and settlement');
    headers.push(previous);
  }
  headers.reverse();
  inspectExecutionHeaderChain(headers, {schema:'caw-execution-header-chain-selection/1',
    profile:'shanghai-17', startHash:start.hash, endHash:end.hash});
  requireMatch(headers[0].number === start.number, 'Receipt chain starts at a different review height');
  return {reviewHeader:headers[0], parent:headers.at(-2)};
}

function verifyCall(header, raw, receipt, hash, calldataHash, review) {
  const select = {profile:'shanghai-17',hash:header.hash};
  const joined = inspectBlockTransactionReceipts(header,[raw],[receipt],{
    ...select,schema:'caw-block-transactions-selection/1'
  });
  const tx = inspectBlockSenders(header,[raw],{...select,schema:'caw-block-senders-selection/1',
    chainId:'0x7a69',allowUnprotectedLegacy:false}).transactions[0];
  requireMatch(tx.hash === hash && tx.from === review.controller && tx.to === fixture.vault &&
    BigInt(tx.value) === 0n, 'Transaction differs from reviewed controller, target or value');

  requireMatch(keccak256(tx.data) === calldataHash, 'Mined calldata differs from the wallet-reviewed bytes');
  const message = review.preview.typedData.message;
  const signature = contract.decodeFunctionData('settleFixedPool1',tx.data).signature;
  requireMatch(/^0x[0-9a-f]{128}1[bc]$/.test(signature) &&
    recoverAddress(review.preview.digest,signature).toLowerCase() === review.controller,
    'Settlement authorization signature differs from review');
  const fields = [message.accountId,message.epoch,message.nonce,message.validAfter,message.deadline,
    message.stakeRoot,message.textHash];
  const text = hexlify(toUtf8Bytes(review.intent.text));
  requireMatch(contract.encodeFunctionData('settleFixedPool1',[fields,signature,text]) === tx.data,
    'Signed settlement calldata differs from the reviewed intent');
  return joined.receipts[0];
}

function verifyPublishedEvents(logs, review) {
  const {accountId,nonce,textHash} = review.preview.typedData.message;
  const {share2,share3,dust} = review.settlement;
  const expected = [
    contract.encodeEventLog('ExperimentalFeeSettled',[accountId,nonce,share2,share3,dust,textHash]),
    contract.encodeEventLog('ExperimentalTextPublished',[accountId,nonce,toUtf8Bytes(review.intent.text)])
  ].map(({data,topics}) => ({address:fixture.vault,data,topics}));
  requireMatch(isDeepStrictEqual(logs, expected), 'Mined settlement events differ from the reviewed fee or exact text');
}

function verifyAccounting(before, after, review) {
  const {share2,share3,dust} = review.settlement;
  const fee = review.preview.typedData.message.fee;
  const v = before.values;
  const expected = {...v,
    credit1:v.credit1-BigInt(fee), credit2:v.credit2+BigInt(share2), credit3:v.credit3+BigInt(share3),
    liabilities:v.liabilities-BigInt(dust), dust:v.dust+BigInt(dust), nonce:v.nonce+1n
  };
  requireMatch(isDeepStrictEqual(after.values, expected) && before.backing === after.backing,
    'Proven custody changes differ from reviewed settlement');
  return {fee,share2,share3,dust};
}

export async function verifyPaidPostReceipt(read, input) {
  requireMatch(input && isDeepStrictEqual(Object.keys(input).sort(), ['calldataHash','hash','review']) &&
    typeof input.hash === 'string' && hashPattern.test(input.hash) &&
    typeof input.calldataHash === 'string' && hashPattern.test(input.calldataHash),
    'Expected a review, transaction hash and calldata hash');
  const {hash,calldataHash,review} = input;
  requireMatch(typeof review?.block?.hash === 'string' && hashPattern.test(review.block.hash) &&
    typeof review.block.number === 'string' && heightPattern.test(review.block.number), 'Missing review header');
  await checkPaidPostNetwork(read);
  const located = await read('eth_getTransactionReceipt',[hash]);
  if (located === null) return {status:'pending',hash};
  requireMatch(located?.transactionHash === hash && hashPattern.test(located.blockHash), 'Receipt locator mismatch');
  const header = await read('eth_getBlockByHash',[located.blockHash,false]);
  requireMatch(header?.hash === located.blockHash && Array.isArray(header?.transactions) &&
    header.transactions.length === 1 && header.transactions[0] === hash, 'Expected a block containing only the selected post');
  const {reviewHeader,parent} = await reviewInterval(read,header,review.block);
  const savedLedger = await readPaidPostLedger(read,reviewHeader);
  const saved = reviewFromLedger(reviewHeader,review.intent,savedLedger);
  requireMatch(isDeepStrictEqual(saved,review), 'Saved review differs from authenticated state');

  const raw = await read('eth_getRawTransactionByHash',[hash]);
  const receipt = verifyCall(header,raw,located,hash,calldataHash,saved);
  const result = {hash,calldataHash,block:{hash:header.hash,number:header.number},signer:saved.controller,
    text:saved.intent.text,digest:saved.preview.digest};
  if (receipt.status === '0x0') {
    requireMatch(receipt.logs.length === 0,'Reverted transaction has unexpected events');
    result.status = 'reverted';
  } else {
    const before = parent.hash === reviewHeader.hash ? savedLedger : await readPaidPostLedger(read,parent);
    const atParent = reviewFromLedger(parent,saved.intent,before);
    requireMatch(isDeepStrictEqual({...atParent,block:saved.block},saved),
      'Settlement inputs changed between the original review and execution');
    requireMatch(BigInt(header.timestamp) >= BigInt(saved.intent.validAfter) &&
      BigInt(header.timestamp) < BigInt(saved.intent.deadline), 'Mined outside reviewed validity window');
    verifyPublishedEvents(receipt.logs,saved);
    result.settlement = verifyAccounting(before,await readPaidPostLedger(read,header),saved);
    result.status = 'settled';
  }
  const canonical = await read('eth_getBlockByNumber',[header.number,false]);
  requireMatch(canonical?.hash === header.hash, 'Settlement block left canonical history');
  return result;
}
