// Complete, bounded transaction-trie reconstruction under a supplied London
// header, with optional receipt association by the shared contiguous index.
// Capture, RLP encoding, trie construction and Keccak are reused/adapted from
// ethereum-block-receipts.mjs and the existing reference primitives. They are
// not independent implementations of those primitives. Existing modules stay
// unchanged; the canonical transaction RLP decoder and envelope checks are new.
// https://eips.ethereum.org/EIPS/eip-155
// https://eips.ethereum.org/EIPS/eip-2718
// https://eips.ethereum.org/EIPS/eip-2930
// https://eips.ethereum.org/EIPS/eip-1559
// https://ethereum.org/developers/docs/data-structures-and-encoding/rlp/
// https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
import { Buffer } from 'node:buffer';
import { keccak256Hex } from './keccak256.mjs';
import { inspectExecutionHeader } from './ethereum-execution-header.mjs';
import { inspectBlockReceipts } from './ethereum-block-receipts.mjs';

const LIMIT = Object.freeze({ bytes: 8 * 1024 * 1024, nodes: 100000, depth: 20,
  array: 2048, transactions: 256, transactionEncoded: 16384, encoded: 1048576,
  data: 8192, accessTuples: 64, storageKeys: 256, rlpDepth: 8, rlpNodes: 2048 });
const FLAGS = Object.freeze({ transactionCommitmentVerified: true,
  transactionSetCompleteUnderRoot: true, transactionAssociationVerified: false,
  signaturesVerified: false, senderVerified: false, transactionsVerified: false,
  executionVerified: false, endpointAuthenticated: false, consensusVerified: false,
  finalityVerified: false, freshnessVerified: false });

function fail(reason) {
  const error = new Error('Block transactions rejected: ' + reason + '.');
  error.code = 'BLOCK_TRANSACTIONS_' + reason; throw error;
}
function need(condition, reason) { if (!condition) fail(reason); }
function fields(value, required) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), 'SCHEMA');
  const allowed = new Set(required);
  need(Object.keys(value).every(key => allowed.has(key))
    && required.every(key => Object.hasOwn(value, key)), 'SCHEMA');
}

// Descriptor-only copy: no getters, toJSON, or caller-supplied iterators run.
// All arguments are captured together before checking any header or payload.
// Hostile Proxy traps and replaced native built-ins are outside this same-
// process plain-data boundary. Strings and structural overhead share a budget.
function capture(input) {
  const budget = { bytes: 0, nodes: 0 }, active = new WeakSet();
  function copy(value, depth) {
    budget.bytes += 8;
    need(++budget.nodes <= LIMIT.nodes && depth <= LIMIT.depth && budget.bytes <= LIMIT.bytes, 'LIMIT');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      need(Number.isSafeInteger(value) && !Object.is(value, -0), 'INTEGER'); return value;
    }
    if (typeof value === 'string') {
      need(value.length <= 262144 && value.isWellFormed(), 'STRING');
      budget.bytes += Buffer.byteLength(value, 'utf8'); need(budget.bytes <= LIMIT.bytes, 'LIMIT'); return value;
    }
    need(value !== null && typeof value === 'object', 'SCHEMA');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    need(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'PROTOTYPE');
    need(!active.has(value), 'CYCLE'); active.add(value);
    const keys = Reflect.ownKeys(value);
    let result;
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length');
      need(length && Object.hasOwn(length, 'value') && Number.isSafeInteger(length.value)
        && length.value >= 0 && length.value <= LIMIT.array, 'LIMIT');
      need(keys.length === length.value + 1, 'SCHEMA'); result = [];
      for (let index = 0; index < length.value; index++) {
        const entry = Object.getOwnPropertyDescriptor(value, String(index));
        need(entry && entry.enumerable && Object.hasOwn(entry, 'value'), 'DESCRIPTOR');
        result.push(copy(entry.value, depth + 1));
      }
    } else {
      need(keys.length <= 64 && keys.every(key => typeof key === 'string' && key.length <= 96), 'SCHEMA');
      result = Object.create(null);
      for (const key of keys) {
        budget.bytes += Buffer.byteLength(key, 'utf8'); need(budget.bytes <= LIMIT.bytes, 'LIMIT');
        const entry = Object.getOwnPropertyDescriptor(value, key);
        need(entry && entry.enumerable && Object.hasOwn(entry, 'value'), 'DESCRIPTOR');
        result[key] = copy(entry.value, depth + 1);
      }
    }
    active.delete(value); return result;
  }
  return copy(input, 0);
}
function freeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function data(value, minimum, maximum = minimum) {
  need(typeof value === 'string' && value.length >= 2 + minimum * 2
    && value.length <= 2 + maximum * 2 && /^0x(?:[0-9a-f]{2})*$/.test(value), 'DATA');
  return Buffer.from(value.slice(2), 'hex');
}
function hex(raw) { return '0x' + raw.toString('hex'); }
function unsigned(value) {
  if (value === 0n) return Buffer.alloc(0);
  const digits = value.toString(16);
  return Buffer.from(digits.padStart(digits.length + digits.length % 2, '0'), 'hex');
}
function wrap(payload, list = false) {
  if (!list && payload.length === 1 && payload[0] < 128) return payload;
  const base = list ? 192 : 128;
  if (payload.length < 56) return Buffer.concat([Buffer.from([base + payload.length]), payload]);
  const length = unsigned(BigInt(payload.length));
  return Buffer.concat([Buffer.from([base + 55 + length.length]), length, payload]);
}
function rlpList(encoded) { return wrap(Buffer.concat(encoded), true); }
function hashBytes(raw) { return Buffer.from(keccak256Hex(hex(raw)).slice(2), 'hex'); }
function nibbles(raw) {
  const path = [];
  for (const byte of raw) path.push(byte >> 4, byte & 15);
  return path;
}
function compact(path, leaf) {
  const odd = path.length % 2, flag = (leaf ? 2 : 0) + odd;
  const prefixed = odd ? [flag, ...path] : [flag, 0, ...path];
  const result = Buffer.alloc(prefixed.length / 2);
  for (let index = 0; index < prefixed.length; index += 2) result[index / 2] = prefixed[index] * 16 + prefixed[index + 1];
  return result;
}

// Keys are the nibbles of canonical RLP(index), without a state-trie key hash.
// Leaf values are the complete envelope bytes, including a typed envelope's
// type byte. The complete value is wrapped as the leaf's RLP byte string.
function transactionRoot(encodedTransactions) {
  if (encodedTransactions.length === 0) return keccak256Hex('0x80');
  const pairs = encodedTransactions.map((value, index) => ({ path: nibbles(wrap(unsigned(BigInt(index)))), value }));
  function reference(raw) { return raw.length < 32 ? raw : wrap(hashBytes(raw)); }
  function node(entries, offset) {
    if (entries.length === 1) {
      return rlpList([wrap(compact(entries[0].path.slice(offset), true)), wrap(entries[0].value)]);
    }
    let common = 0;
    while (entries.every(entry => entry.path.length > offset + common
      && entry.path[offset + common] === entries[0].path[offset + common])) common++;
    if (common > 0) {
      return rlpList([wrap(compact(entries[0].path.slice(offset, offset + common), false)),
        reference(node(entries, offset + common))]);
    }
    const groups = Array.from({ length: 16 }, () => []);
    let terminal = Buffer.alloc(0);
    for (const entry of entries) {
      if (entry.path.length === offset) terminal = entry.value;
      else groups[entry.path[offset]].push(entry);
    }
    return rlpList([...groups.map(group => group.length ? reference(node(group, offset + 1)) : wrap(Buffer.alloc(0))), wrap(terminal)]);
  }
  // Root nodes are always hashed, including roots shorter than 32 bytes.
  return hex(hashBytes(node(pairs, 0)));
}

// Strict canonical RLP with parent-boundary and full-input consumption. No
// prefix-derived allocation occurs. Depth/node limits also bound malformed
// nested or many-item input before transaction field checks are reached.
function decodeRlp(raw) {
  let nodes = 0;
  function item(offset, end, depth) {
    need(++nodes <= LIMIT.rlpNodes && depth <= LIMIT.rlpDepth, 'RLP_LIMIT');
    need(offset < end, 'RLP');
    const prefix = raw[offset];
    if (prefix < 128) return { value: raw.subarray(offset, offset + 1), next: offset + 1 };
    const list = prefix >= 192;
    const shortBase = list ? 192 : 128, longBase = list ? 247 : 183;
    let start = offset + 1, length;
    if (prefix <= longBase) length = prefix - shortBase;
    else {
      const lengthBytes = prefix - longBase;
      need(start + lengthBytes <= end && raw[start] !== 0, 'RLP');
      length = 0;
      for (let index = 0; index < lengthBytes; index++) {
        length = length * 256 + raw[start + index];
        need(Number.isSafeInteger(length) && length <= raw.length, 'RLP');
      }
      need(length >= 56, 'RLP'); start += lengthBytes;
    }
    need(length <= end - start, 'RLP');
    const next = start + length;
    if (!list) {
      need(length !== 1 || raw[start] >= 128, 'RLP');
      return { value: raw.subarray(start, next), next };
    }
    const value = [];
    let cursor = start;
    while (cursor < next) {
      const child = item(cursor, next, depth + 1);
      value.push(child.value); cursor = child.next;
    }
    need(cursor === next, 'RLP'); return { value, next };
  }
  const decoded = item(0, raw.length, 0);
  need(decoded.next === raw.length, 'RLP'); return decoded.value;
}
function integer(value) {
  need(Buffer.isBuffer(value) && value.length <= 32 && (value.length === 0 || value[0] !== 0), 'TRANSACTION_INTEGER');
  return value.length === 0 ? '0x0' : '0x' + BigInt(hex(value)).toString(16);
}
function destination(value) {
  need(Buffer.isBuffer(value) && (value.length === 0 || value.length === 20), 'TO'); return hex(value);
}
function calldata(value) {
  need(Buffer.isBuffer(value), 'TRANSACTION_FIELDS');
  need(value.length <= LIMIT.data, 'DATA_LIMIT'); return hex(value);
}
function accessList(value) {
  need(Array.isArray(value), 'ACCESS_LIST');
  need(value.length <= LIMIT.accessTuples, 'ACCESS_LIST_LIMIT');
  let count = 0;
  return value.map(tuple => {
    need(Array.isArray(tuple) && tuple.length === 2 && Buffer.isBuffer(tuple[0])
      && tuple[0].length === 20 && Array.isArray(tuple[1]), 'ACCESS_LIST');
    count += tuple[1].length; need(count <= LIMIT.storageKeys, 'ACCESS_LIST_LIMIT');
    // EIP-2930 explicitly allows duplicate addresses and storage keys. Preserve
    // their order and multiplicity; this checker does not enforce gas rules.
    return { address: hex(tuple[0]), storageKeys: tuple[1].map(key => {
      need(Buffer.isBuffer(key) && key.length === 32, 'STORAGE_KEY'); return hex(key);
    }) };
  });
}
function decodeTransaction(raw, index) {
  const type = raw[0] >= 192 ? 0 : raw[0];
  need((type === 0 && raw[0] >= 192) || type === 1 || type === 2, 'TYPE');
  const value = decodeRlp(type === 0 ? raw : raw.subarray(1));
  need(Array.isArray(value) && value.length === (type === 0 ? 9 : type === 1 ? 11 : 12), 'TRANSACTION_FIELDS');
  let decoded;
  if (type === 0) {
    decoded = { nonce: integer(value[0]), gasPrice: integer(value[1]), gasLimit: integer(value[2]),
      to: destination(value[3]), value: integer(value[4]), data: calldata(value[5]),
      v: integer(value[6]), r: integer(value[7]), s: integer(value[8]) };
    const v = BigInt(decoded.v); need(v === 27n || v === 28n || v >= 35n, 'V');
  } else if (type === 1) {
    decoded = { chainId: integer(value[0]), nonce: integer(value[1]), gasPrice: integer(value[2]),
      gasLimit: integer(value[3]), to: destination(value[4]), value: integer(value[5]),
      data: calldata(value[6]), accessList: accessList(value[7]), yParity: integer(value[8]),
      r: integer(value[9]), s: integer(value[10]) };
  } else {
    decoded = { chainId: integer(value[0]), nonce: integer(value[1]),
      maxPriorityFeePerGas: integer(value[2]), maxFeePerGas: integer(value[3]),
      gasLimit: integer(value[4]), to: destination(value[5]), value: integer(value[6]),
      data: calldata(value[7]), accessList: accessList(value[8]), yParity: integer(value[9]),
      r: integer(value[10]), s: integer(value[11]) };
  }
  if (type !== 0) need(decoded.yParity === '0x0' || decoded.yParity === '0x1', 'PARITY');
  // r/s are only minimal uint256 fields. Zero, high-s, and invalid signatures
  // can pass these structural checks. No sender recovery or signature check
  // is performed, and no transaction-execution validity is asserted.
  return { index, type: '0x' + type.toString(16), hash: keccak256Hex(hex(raw)), encoded: hex(raw), ...decoded };
}
function checkSelection(selection) {
  fields(selection, ['schema', 'profile', 'hash']);
  need(selection.schema === 'caw-block-transactions-selection/1', 'SCHEMA');
  need(selection.profile === 'london-16', 'PROFILE'); data(selection.hash, 32);
}

/** Inspect a complete contiguous list of canonical legacy/type-1/type-2 signed
 * envelope bytes. The supplied hash and London profile are caller assumptions.
 * A matching root proves byte inclusion/completeness under that checked header;
 * it does not authenticate a chain, sender, signature, state transition or time.
 */
export function inspectBlockTransactions(headerInput, rawTransactionsInput, selectionInput) {
  need(arguments.length === 3, 'SCHEMA');
  const supplied = capture({ header: headerInput, rawTransactions: rawTransactionsInput, selection: selectionInput });
  const { header, rawTransactions, selection } = supplied;
  checkSelection(selection);
  const headerIntegrity = inspectExecutionHeader(header, {
    schema: 'caw-execution-header-selection/1', profile: selection.profile, hash: selection.hash
  });
  need(Array.isArray(rawTransactions) && rawTransactions.length <= LIMIT.transactions, 'TRANSACTION_LIMIT');
  let encodedBytes = 0;
  const encodedTransactions = rawTransactions.map(raw => {
    need(typeof raw === 'string', 'DATA');
    need(raw.length <= 2 + LIMIT.transactionEncoded * 2, 'TRANSACTION_ENCODED_LIMIT');
    const encoded = data(raw, 1, LIMIT.transactionEncoded);
    encodedBytes += encoded.length; need(encodedBytes <= LIMIT.encoded, 'ENCODED_LIMIT'); return encoded;
  });
  const transactions = encodedTransactions.map((raw, index) => decodeTransaction(raw, index));
  const root = transactionRoot(encodedTransactions);
  need(root === headerIntegrity.transactionsRoot, 'ROOT_MISMATCH');
  return freeze({ schema: 'caw-block-transactions-integrity/1', profile: selection.profile,
    blockHash: headerIntegrity.hash, blockNumber: headerIntegrity.number, transactionCount: transactions.length,
    transactionsRoot: root, header_integrity: headerIntegrity, transactions, ...FLAGS });
}

/** Verify both complete roots under one checked header and associate receipt
 * consensus payloads with transaction hash/bytes by their shared index and type.
 * RPC transactionHash/from/to and header.transactions are unauthenticated
 * metadata and are not used as evidence or copied into the associations.
 */
export function inspectBlockTransactionReceipts(headerInput, rawTransactionsInput, receiptsInput, selectionInput) {
  need(arguments.length === 4, 'SCHEMA');
  const supplied = capture({ header: headerInput, rawTransactions: rawTransactionsInput,
    receipts: receiptsInput, selection: selectionInput });
  const { header, rawTransactions, receipts, selection } = supplied;
  checkSelection(selection);
  const transactionIntegrity = inspectBlockTransactions(header, rawTransactions, selection);
  const receiptIntegrity = inspectBlockReceipts(header, receipts, {
    schema: 'caw-block-receipts-selection/1', profile: selection.profile, hash: selection.hash
  });
  need(transactionIntegrity.transactionCount === receiptIntegrity.receiptCount, 'COUNT_MISMATCH');
  const associations = transactionIntegrity.transactions.map((transaction, index) => {
    const receipt = receiptIntegrity.receipts[index];
    need(transaction.type === receipt.type, 'TYPE_MISMATCH');
    return { index, transactionHash: transaction.hash, transactionEncoded: transaction.encoded,
      transactionType: transaction.type, receiptEncoded: receipt.encoded, receiptType: receipt.type };
  });
  return freeze({ schema: 'caw-block-transaction-receipts-integrity/1', profile: selection.profile,
    blockHash: transactionIntegrity.blockHash, blockNumber: transactionIntegrity.blockNumber,
    transactionCount: transactionIntegrity.transactionCount, receiptCount: receiptIntegrity.receiptCount,
    transactionsRoot: transactionIntegrity.transactionsRoot, receiptsRoot: receiptIntegrity.receiptsRoot,
    header_integrity: transactionIntegrity.header_integrity, transaction_integrity: transactionIntegrity,
    receipt_integrity: receiptIntegrity, transactions: transactionIntegrity.transactions,
    receipts: receiptIntegrity.receipts, associations, ...FLAGS,
    transactionAssociationVerified: true, receiptCommitmentVerified: true, receiptSetCompleteUnderRoot: true });
}
