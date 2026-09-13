// Complete, bounded receipt-trie reconstruction under a supplied London header.
// This proves receipt payload commitments, not transaction association or chain
// authenticity. Capture and Keccak are shared with the existing reference code.
// https://eips.ethereum.org/EIPS/eip-2718
// https://eips.ethereum.org/EIPS/eip-658
// https://eips.ethereum.org/EIPS/eip-2930
// https://eips.ethereum.org/EIPS/eip-1559
// https://ethereum.org/developers/docs/data-structures-and-encoding/patricia-merkle-trie/
import { Buffer } from 'node:buffer';
import { keccak256Hex } from './keccak256.mjs';
import { inspectExecutionHeader } from './ethereum-execution-header.mjs';

const LIMIT = Object.freeze({ bytes: 4 * 1024 * 1024, nodes: 100000, depth: 20,
  array: 2048, receipts: 256, receiptLogs: 64, logs: 512, topics: 4,
  data: 8192, receiptEncoded: 16384, encoded: 1048576 });
const RECEIPT_REQUIRED = ['type', 'status', 'cumulativeGasUsed', 'logsBloom', 'logs',
  'transactionIndex', 'blockHash', 'blockNumber'];
const RECEIPT_METADATA = ['transactionHash', 'gasUsed', 'effectiveGasPrice', 'blobGasPrice',
  'blobGasUsed', 'from', 'to', 'contractAddress', 'blockTimestamp'];
const LOG_METADATA = ['blockHash', 'blockNumber', 'blockTimestamp', 'transactionHash',
  'transactionIndex', 'logIndex', 'removed'];
const FLAGS = Object.freeze({ receiptCommitmentVerified: true, receiptSetCompleteUnderRoot: true,
  transactionAssociationVerified: false, transactionsVerified: false, executionVerified: false,
  endpointAuthenticated: false, consensusVerified: false, finalityVerified: false, freshnessVerified: false });

function fail(reason) {
  const error = new Error('Block receipts rejected: ' + reason + '.');
  error.code = 'BLOCK_RECEIPTS_' + reason; throw error;
}
function need(condition, reason) { if (!condition) fail(reason); }
function fields(value, required, optional = []) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), 'SCHEMA');
  const allowed = new Set([...required, ...optional]);
  need(Object.keys(value).every(key => allowed.has(key))
    && required.every(key => Object.hasOwn(value, key)), 'SCHEMA');
}

// Descriptor-only copy: no getters, toJSON, or caller-supplied iterators run.
// Hostile Proxy traps and replaced native built-ins are outside this same-
// process plain-data boundary. The combined three arguments share one budget.
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
function quantity(value) {
  need(typeof value === 'string' && value.length <= 66
    && /^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(value), 'QUANTITY');
  return BigInt(value);
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

// These are raw RLP(index) paths, without a state-trie key hash. The values are
// the complete encoded receipt bytes, wrapped as the leaf's byte-string value.
function receiptRoot(encodedReceipts) {
  if (encodedReceipts.length === 0) return keccak256Hex('0x80');
  const pairs = encodedReceipts.map((value, index) => ({ path: nibbles(wrap(unsigned(BigInt(index)))), value }));
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
  // Root nodes are always hashed, even if their encoding would be embeddable.
  return hex(hashBytes(node(pairs, 0)));
}

function addBloom(bloom, value) {
  const digest = hashBytes(value);
  for (let offset = 0; offset < 6; offset += 2) {
    const bit = (digest[offset] * 256 + digest[offset + 1]) & 2047;
    bloom[255 - Math.floor(bit / 8)] |= 1 << (bit % 8);
  }
}
function association(value, name, expected) {
  if (Object.hasOwn(value, name)) need(value[name] === expected, 'ASSOCIATION');
}

/** Inspect every receipt at contiguous indices under a separately selected
 * header hash. Only the London layout and post-Byzantium types 0/1/2 are
 * supported. The caller's hash and fork selection remain assumptions; receipt
 * payloads do not include transaction hashes, callers, recipients or calldata.
 */
export function inspectBlockReceipts(headerInput, receiptsInput, selectionInput) {
  need(arguments.length === 3, 'SCHEMA');
  const supplied = capture({ header: headerInput, receipts: receiptsInput, selection: selectionInput });
  const { header, receipts, selection } = supplied;
  fields(selection, ['schema', 'profile', 'hash']);
  need(selection.schema === 'caw-block-receipts-selection/1', 'SCHEMA');
  need(selection.profile === 'london-16', 'PROFILE'); data(selection.hash, 32);
  const headerIntegrity = inspectExecutionHeader(header, {
    schema: 'caw-execution-header-selection/1', profile: selection.profile, hash: selection.hash
  });
  need(quantity(header.gasUsed) <= quantity(header.gasLimit), 'BLOCK_GAS');
  need(Array.isArray(receipts) && receipts.length <= LIMIT.receipts, 'RECEIPT_LIMIT');
  const blockBloom = Buffer.alloc(256), encodedReceipts = [], checked = [];
  let cumulative = 0n, logCount = 0, encodedBytes = 0;
  for (let index = 0; index < receipts.length; index++) {
    const receipt = receipts[index];
    fields(receipt, RECEIPT_REQUIRED, RECEIPT_METADATA);
    need(receipt.type === '0x0' || receipt.type === '0x1' || receipt.type === '0x2', 'TYPE');
    need(receipt.status === '0x0' || receipt.status === '0x1', 'STATUS');
    need(quantity(receipt.transactionIndex) === BigInt(index), 'INDEX');
    need(receipt.blockHash === headerIntegrity.hash && receipt.blockNumber === headerIntegrity.number, 'ASSOCIATION');
    const nextCumulative = quantity(receipt.cumulativeGasUsed);
    need(nextCumulative > cumulative, 'CUMULATIVE_GAS'); cumulative = nextCumulative;
    data(receipt.logsBloom, 256);
    need(Array.isArray(receipt.logs) && receipt.logs.length <= LIMIT.receiptLogs, 'LOG_LIMIT');
    const logs = [], encodedLogs = [], bloom = Buffer.alloc(256);
    for (const log of receipt.logs) {
      need(++logCount <= LIMIT.logs, 'LOG_LIMIT');
      fields(log, ['address', 'topics', 'data'], LOG_METADATA);
      const address = data(log.address, 20), payload = data(log.data, 0, LIMIT.data);
      need(Array.isArray(log.topics) && log.topics.length <= LIMIT.topics, 'TOPIC_LIMIT');
      const topics = log.topics.map(topic => data(topic, 32));
      association(log, 'blockHash', headerIntegrity.hash); association(log, 'blockNumber', headerIntegrity.number);
      association(log, 'transactionIndex', receipt.transactionIndex);
      if (Object.hasOwn(log, 'logIndex')) need(quantity(log.logIndex) === BigInt(logCount - 1), 'LOG_INDEX');
      if (Object.hasOwn(log, 'removed')) need(log.removed === false, 'REMOVED');
      addBloom(bloom, address); topics.forEach(topic => addBloom(bloom, topic));
      logs.push({ address: log.address, topics: [...log.topics], data: log.data });
      encodedLogs.push(rlpList([wrap(address), rlpList(topics.map(topic => wrap(topic))), wrap(payload)]));
    }
    need(hex(bloom) === receipt.logsBloom, 'BLOOM');
    for (let byte = 0; byte < blockBloom.length; byte++) blockBloom[byte] |= bloom[byte];
    const payload = rlpList([wrap(unsigned(quantity(receipt.status))), wrap(unsigned(cumulative)),
      wrap(bloom), rlpList(encodedLogs)]);
    const encoded = receipt.type === '0x0' ? payload : Buffer.concat([Buffer.from([Number(quantity(receipt.type))]), payload]);
    need(encoded.length <= LIMIT.receiptEncoded, 'RECEIPT_ENCODED_LIMIT');
    encodedBytes += encoded.length; need(encodedBytes <= LIMIT.encoded, 'ENCODED_LIMIT');
    encodedReceipts.push(encoded);
    checked.push({ index, type: receipt.type, status: receipt.status, cumulativeGasUsed: receipt.cumulativeGasUsed,
      logsBloom: receipt.logsBloom, logs, encoded: hex(encoded) });
  }
  need(cumulative === quantity(header.gasUsed), 'BLOCK_GAS');
  need(hex(blockBloom) === header.logsBloom, 'BLOCK_BLOOM');
  const root = receiptRoot(encodedReceipts);
  need(root === headerIntegrity.receiptsRoot, 'ROOT_MISMATCH');
  return freeze({ schema: 'caw-block-receipts-integrity/1', profile: selection.profile,
    blockHash: headerIntegrity.hash, blockNumber: headerIntegrity.number, receiptCount: checked.length,
    receiptsRoot: root, header_integrity: headerIntegrity, receipts: checked, ...FLAGS });
}
