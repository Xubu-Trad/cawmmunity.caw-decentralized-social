// Verify a bounded one-block acquisition against a separate explicit selection.
// The descriptor capture is adapted from the unchanged alpha39 reader, which
// also supplies canonical transaction decoding, header and both trie checks.
// This is an acquisition boundary, not an independent implementation of those
// primitives. RPC transaction hashes are checked against hashes of raw bytes;
// RPC from/to metadata never becomes sender or execution evidence.
import { Buffer } from 'node:buffer';
import { inspectBlockTransactionReceipts } from '../../reference/ethereum-block-transactions.mjs';

const LIMIT = Object.freeze({ bytes: 8 * 1024 * 1024, nodes: 100000, depth: 20,
  array: 2048, transactions: 256, string: 262144 });

function fail(reason) {
  const error = new Error('Block body capture rejected: ' + reason + '.');
  error.code = 'BLOCK_BODY_' + reason;
  throw error;
}
function need(condition, reason) { if (!condition) fail(reason); }
function fields(value, required) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), 'SCHEMA');
  const allowed = new Set(required);
  need(Object.keys(value).every(key => allowed.has(key))
    && required.every(key => Object.hasOwn(value, key)), 'SCHEMA');
}

// Both arguments are detached together before any field is inspected. Only own
// enumerable data descriptors are read; getters, toJSON and caller iterators do
// not execute. Hostile Proxy traps and replaced native built-ins remain outside
// this same-process plain-data boundary, as in the underlying reference reader.
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
      need(keys.length <= 64 && keys.every(key => typeof key === 'string' && key.length <= 96
        && key.isWellFormed()), 'SCHEMA');
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

function freeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Verify both complete body commitments under a separately selected London
 * header, then require both acquired RPC transaction-hash lists to agree with
 * hashes derived from the committed raw bytes. The selected hash/profile remain
 * caller assumptions. Signatures, senders, execution, endpoint authenticity,
 * consensus, finality and freshness retain the underlying reader's false flags.
 */
export function inspectBlockBodyCapture(captureInput, selectionInput) {
  need(arguments.length === 2, 'SCHEMA');
  const supplied = capture({ body: captureInput, selected: selectionInput });
  const { body, selected } = supplied;
  fields(selected, ['schema', 'profile', 'number', 'hash']);
  need(selected.schema === 'caw-block-body-selection/1', 'SCHEMA');
  need(selected.profile === 'london-16', 'PROFILE');
  need(typeof selected.number === 'string' && selected.number.length <= 18
    && /^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(selected.number), 'NUMBER');
  need(typeof selected.hash === 'string' && /^0x[0-9a-f]{64}$/.test(selected.hash), 'HASH');
  fields(body, ['schema', 'selection', 'header', 'raw_transactions', 'receipts']);
  need(body.schema === 'caw-block-body-capture/1', 'SCHEMA');
  fields(body.selection, ['block_number', 'block_hash']);
  need(body.selection.block_number === selected.number
    && body.selection.block_hash === selected.hash, 'SELECTION');
  const { header, raw_transactions: rawTransactions, receipts } = body;
  need(header !== null && typeof header === 'object' && !Array.isArray(header), 'SCHEMA');
  need(header.number === selected.number && header.hash === selected.hash, 'HEADER_SELECTION');

  const integrity = inspectBlockTransactionReceipts(header, rawTransactions, receipts, {
    schema: 'caw-block-transactions-selection/1', profile: selected.profile, hash: selected.hash,
  });

  // Standalone alpha39 deliberately ignores these unauthenticated RPC labels.
  // Here they are acquisition records and must match the independently derived
  // byte hashes at the same contiguous index, after both roots have passed.
  need(Array.isArray(header.transactions) && header.transactions.length <= LIMIT.transactions
    && header.transactions.length === integrity.transactionCount
    && rawTransactions.length === integrity.transactionCount
    && receipts.length === integrity.receiptCount, 'COUNT');
  const seen = new Set();
  integrity.transactions.forEach((transaction, index) => {
    need(header.transactions[index] === transaction.hash
      && Object.hasOwn(receipts[index], 'transactionHash')
      && receipts[index].transactionHash === transaction.hash, 'TRANSACTION_HASH');
    need(!seen.has(transaction.hash), 'DUPLICATE_TRANSACTION');
    seen.add(transaction.hash);
  });
  return freeze({ schema: 'caw-block-body-verification/1', selected,
    body_integrity: integrity, rpcTransactionHashesVerified: true });
}
