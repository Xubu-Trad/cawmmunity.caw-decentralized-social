// Bind the fixed paid-action history to complete London bodies and recovered
// senders before invoking the unchanged accounting reader. Header/receipt/trie,
// canonical transaction, Keccak and sender primitives are reused. This adds an
// explicit binding boundary, not independent implementations or state execution.
import { Buffer } from 'node:buffer';
import { keccak256Hex } from './keccak256.mjs';
import { inspectExecutionHeaderChain } from './ethereum-execution-header.mjs';
import { inspectBlockSenders } from './ethereum-block-senders.mjs';
import { reconstruct } from './paid-action-reader.mjs';
import { inspectBlockBodyCapture } from '../experiments/paid-body-acquisition/verify_body.mjs';

const LIMIT = Object.freeze({ bytes: 8 * 1024 * 1024, nodes: 100000, depth: 20,
  array: 2048, string: 262144, blocks: 128, transactions: 256 });
const PROFILE = 'london-16', CHAIN_ID = '0x7a69';
const HISTORY_FIELDS = ['schema', 'chain_id', 'addresses', 'registry_runtime',
  'probe_runtime', 'start_block', 'end_block', 'blocks', 'final'];
const MANIFEST_FIELDS = ['chain_id', 'addresses', 'registry_runtime_sha256',
  'probe_runtime_sha256', 'start_block_hash', 'end_block_hash'];
const RECEIPT_FIELDS = ['status', 'cumulativeGasUsed', 'logs', 'transactionHash',
  'transactionIndex', 'blockHash', 'blockNumber', 'gasUsed', 'from', 'to', 'contractAddress'];
const RECEIPT_OPTIONAL = ['type', 'logsBloom', 'effectiveGasPrice', 'blobGasPrice',
  'blobGasUsed', 'blockTimestamp'];
const FLAGS = Object.freeze({ transactionCommitmentVerified: true,
  receiptCommitmentVerified: true, signaturesVerified: true, senderVerified: true,
  transactionFieldsBound: true, anchorBodyVerified: false, accountAuthorityVerified: false,
  transactionsVerified: false, executionVerified: false, endpointAuthenticated: false,
  consensusVerified: false, finalityVerified: false, freshnessVerified: false });

function fail(reason) {
  const error = new Error('Paid body history rejected: ' + reason + '.');
  error.code = 'PAID_BODY_HISTORY_' + reason;
  throw error;
}
function need(condition, reason) { if (!condition) fail(reason); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function fields(value, required, optional = []) {
  need(object(value), 'SCHEMA');
  const allowed = new Set([...required, ...optional]);
  need(Object.keys(value).every(key => allowed.has(key))
    && required.every(key => Object.hasOwn(value, key)), 'SCHEMA');
}

// Capture all three arguments together before reading any field. Adapted from
// the unchanged body/sender readers: own enumerable data descriptors only, no
// getters, toJSON or caller iterators. Hostile Proxy traps and replaced native
// built-ins remain outside this same-process plain-data boundary.
function capture(input) {
  const budget = { bytes: 0, nodes: 0 }, active = new WeakSet();
  function copy(value, depth) {
    budget.bytes += 8;
    need(++budget.nodes <= LIMIT.nodes && depth <= LIMIT.depth && budget.bytes <= LIMIT.bytes, 'LIMIT');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      need(Number.isSafeInteger(value) && !Object.is(value, -0), 'INTEGER');
      return value;
    }
    if (typeof value === 'string') {
      need(value.length <= LIMIT.string && value.isWellFormed(), 'STRING');
      budget.bytes += Buffer.byteLength(value, 'utf8');
      need(budget.bytes <= LIMIT.bytes, 'LIMIT');
      return value;
    }
    need(value !== null && typeof value === 'object', 'SCHEMA');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    need(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'PROTOTYPE');
    need(!active.has(value), 'CYCLE');
    active.add(value);
    const keys = Reflect.ownKeys(value);
    let result;
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length');
      need(length && Object.hasOwn(length, 'value') && Number.isSafeInteger(length.value)
        && length.value >= 0 && length.value <= LIMIT.array, 'LIMIT');
      need(keys.length === length.value + 1, 'SCHEMA');
      result = [];
      for (let index = 0; index < length.value; index++) {
        const entry = Object.getOwnPropertyDescriptor(value, String(index));
        need(entry && entry.enumerable && Object.hasOwn(entry, 'value'), 'DESCRIPTOR');
        result.push(copy(entry.value, depth + 1));
      }
    } else {
      need(keys.length <= 64 && keys.every(key => typeof key === 'string'
        && key.length <= 96 && key.isWellFormed()), 'SCHEMA');
      result = Object.create(null);
      for (const key of keys) {
        budget.bytes += Buffer.byteLength(key, 'utf8');
        need(budget.bytes <= LIMIT.bytes, 'LIMIT');
        const entry = Object.getOwnPropertyDescriptor(value, key);
        need(entry && entry.enumerable && Object.hasOwn(entry, 'value'), 'DESCRIPTOR');
        result[key] = copy(entry.value, depth + 1);
      }
    }
    active.delete(value);
    return result;
  }
  return copy(input, 0);
}

// Called only on captured plain data. Object key order is not content, whereas
// array order, scalar types, optional metadata and every supplied field are.
function equal(left, right) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}
function freeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function creationAddress(from, nonce) {
  // Inputs come from the canonical decoder and recovered 20-byte sender.
  // A uint256 nonce needs at most 32 bytes: this specialized two-item RLP
  // payload is at most 54 bytes, so its list always uses the short form.
  const value = BigInt(nonce);
  let digits = value.toString(16);
  if (digits.length % 2) digits = '0' + digits;
  const unsigned = value === 0n ? Buffer.alloc(0) : Buffer.from(digits, 'hex');
  const encodedNonce = unsigned.length === 1 && unsigned[0] < 128 ? unsigned
    : Buffer.concat([Buffer.from([128 + unsigned.length]), unsigned]);
  const payload = Buffer.concat([Buffer.from([0x94]), Buffer.from(from.slice(2), 'hex'), encodedNonce]);
  need(unsigned.length <= 32 && payload.length <= 55, 'CREATE_INPUT');
  const encoded = Buffer.concat([Buffer.from([192 + payload.length]), payload]);
  return '0x' + keccak256Hex('0x' + encoded.toString('hex')).slice(-40);
}

/** Inspect the fixed experiment: London, chain 31337, protected legacy only.
 * Captures cover every block after the exclusive start header through the end.
 * The manifest's endpoints and runtime hashes remain supplied trust. Direct
 * owner comparisons in the old reader now consume fields bound to recovered
 * senders; relayed post account authorization is still unverified. This module
 * does not adopt histories into recovery or establish execution/finality.
 */
export function inspectPaidBodyHistory(historyInput, manifestInput, capturesInput) {
  need(arguments.length === 3, 'SCHEMA');
  const supplied = capture({ history: historyInput, manifest: manifestInput, captures: capturesInput });
  const { history, manifest, captures } = supplied;
  fields(history, HISTORY_FIELDS);
  fields(manifest, MANIFEST_FIELDS);
  need(history.schema === 'caw-paid-history/1' && history.chain_id === 31337
    && manifest.chain_id === 31337, 'CONTEXT');
  need(Array.isArray(history.blocks) && history.blocks.length >= 1
    && history.blocks.length <= LIMIT.blocks, 'BLOCK_LIMIT');
  need(Array.isArray(captures) && captures.length === history.blocks.length, 'CAPTURE_COUNT');
  need(object(history.start_block) && object(history.end_block), 'SCHEMA');

  // Count the entire interval and check detached record shape before any header
  // hashing, trie work or curve arithmetic. No partial result is returned.
  let transactionCount = 0;
  for (let blockIndex = 0; blockIndex < history.blocks.length; blockIndex++) {
    const block = history.blocks[blockIndex], body = captures[blockIndex];
    fields(block, ['header', 'transactions']);
    fields(body, ['schema', 'selection', 'header', 'raw_transactions', 'receipts']);
    need(body.schema === 'caw-block-body-capture/1', 'SCHEMA');
    fields(body.selection, ['block_number', 'block_hash']);
    need(object(block.header) && object(body.header), 'SCHEMA');
    need(Array.isArray(block.transactions) && Array.isArray(block.header.transactions)
      && Array.isArray(body.raw_transactions) && Array.isArray(body.receipts), 'SCHEMA');
    transactionCount += block.transactions.length;
    need(transactionCount <= LIMIT.transactions, 'TRANSACTION_LIMIT');
    need(block.transactions.length === block.header.transactions.length
      && block.transactions.length === body.raw_transactions.length
      && block.transactions.length === body.receipts.length, 'TRANSACTION_COUNT');
    need(equal(block.header, body.header), 'HEADER_MISMATCH');
    for (let index = 0; index < block.transactions.length; index++) {
      const envelope = block.transactions[index];
      fields(envelope, ['transaction', 'receipt']);
      fields(envelope.transaction, ['from', 'to', 'data', 'gas', 'gasPrice', 'value']);
      fields(envelope.receipt, RECEIPT_FIELDS, RECEIPT_OPTIONAL);
      need(equal(envelope.receipt, body.receipts[index]), 'RECEIPT_MISMATCH');
      if (Object.hasOwn(envelope.receipt, 'type')) need(envelope.receipt.type === '0x0', 'TRANSACTION_TYPE');
    }
  }
  need(equal(history.end_block, history.blocks.at(-1).header), 'END_HEADER_MISMATCH');
  const headerIntegrity = inspectExecutionHeaderChain(
    [history.start_block, ...history.blocks.map(block => block.header)], {
      schema: 'caw-execution-header-chain-selection/1', profile: PROFILE,
      startHash: manifest.start_block_hash, endHash: manifest.end_block_hash,
    });

  const blocks = history.blocks.map((block, blockIndex) => {
    const body = captures[blockIndex];
    const bodyIntegrity = inspectBlockBodyCapture(body, {
      schema: 'caw-block-body-selection/1', profile: PROFILE,
      number: block.header.number, hash: block.header.hash,
    });
    const senderIntegrity = inspectBlockSenders(block.header, body.raw_transactions, {
      schema: 'caw-block-senders-selection/1', profile: PROFILE, hash: block.header.hash,
      chainId: CHAIN_ID, allowUnprotectedLegacy: false,
    });
    need(senderIntegrity.transactionCount === block.transactions.length
      && bodyIntegrity.body_integrity.receiptCount === block.transactions.length, 'TRANSACTION_COUNT');
    const transactions = senderIntegrity.transactions.map((raw, index) => {
      const { transaction: tx, receipt } = block.transactions[index];
      need(raw.type === '0x0' && raw.chainId === CHAIN_ID && raw.replayProtected === true, 'TRANSACTION_TYPE');
      const to = raw.to === '0x' ? null : raw.to;
      need(tx.from === raw.from && receipt.from === raw.from, 'SENDER_MISMATCH');
      need(tx.to === to && receipt.to === to, 'TO_MISMATCH');
      need(tx.data === raw.data && tx.gas === raw.gasLimit && tx.gasPrice === raw.gasPrice
        && tx.value === raw.value, 'TRANSACTION_FIELDS');
      const contractAddress = to === null && receipt.status === '0x1'
        ? creationAddress(raw.from, raw.nonce) : null;
      need(receipt.contractAddress === contractAddress, 'CREATE_ADDRESS');
      return { index, hash: raw.hash, from: raw.from, to, nonce: raw.nonce, contractAddress };
    });
    return { blockHash: block.header.hash, blockNumber: block.header.number,
      transactionCount: transactions.length, body_integrity: bodyIntegrity,
      sender_integrity: senderIntegrity, transactions };
  });

  // Transaction summaries and full receipts consumed below are bound to the
  // checked captures. Runtime/endpoint trust is still supplied, and receipt
  // commitment does not prove execution. Preserve all lower flags verbatim.
  const reconstructed = reconstruct(history, manifest);
  return freeze({ schema: 'caw-paid-body-history/1', profile: PROFILE, chainId: CHAIN_ID,
    history: reconstructed, header_integrity: headerIntegrity,
    blockCount: blocks.length, transactionCount, receiptCount: transactionCount,
    blocks, ...FLAGS });
}
