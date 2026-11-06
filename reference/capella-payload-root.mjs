// Capella ExecutionPayloadHeader SSZ hashing only, not execution validation.
import { createHash } from 'node:crypto';
import { parseBoundedJson } from '../public/bounded-json.mjs';
const FIELDS = ['parent_hash', 'fee_recipient', 'state_root', 'receipts_root', 'logs_bloom', 'prev_randao',
  'block_number', 'gas_limit', 'gas_used', 'timestamp', 'extra_data', 'base_fee_per_gas', 'block_hash', 'transactions_root', 'withdrawals_root'];
function need(ok, code) { if (!ok) { const e = new Error('Capella payload rejected: ' + code); e.code = 'CAPELLA_PAYLOAD_' + code; throw e; } }
const hash = (a, b) => createHash('sha256').update(a).update(b).digest();
function bytes(v, length) {
  need(typeof v === 'string' && /^0x(?:[0-9a-f]{2})*$/.test(v), 'BYTES');
  need(v.length === 2 + length * 2, 'LENGTH'); return Buffer.from(v.slice(2), 'hex');
}
function uint(v, bits) {
  need(typeof v === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(v), 'UINT');
  let n = BigInt(v); need(n < 2n ** BigInt(bits), 'UINT');
  const out = Buffer.alloc(32);
  for (let i = 0; i < bits / 8; i++) { out[i] = Number(n & 255n); n >>= 8n; }
  return out;
}
function merkle(chunks) {
  let layer = chunks.slice();
  while (layer.length > 1) { const next = []; for (let i = 0; i < layer.length; i += 2) next.push(hash(layer[i], layer[i + 1])); layer = next; }
  return layer[0];
}
export function inspectCapellaPayloadHeader(text, selectedRoot) {
  need(arguments.length === 2 && typeof text === 'string', 'INPUT');
  const expected = bytes(selectedRoot, 32), h = parseBoundedJson(text, 8192);
  need(h !== null && typeof h === 'object' && !Array.isArray(h)
    && Object.keys(h).length === FIELDS.length && FIELDS.every(k => Object.hasOwn(h, k)), 'SCHEMA');
  const recipient = Buffer.alloc(32); bytes(h.fee_recipient, 20).copy(recipient);
  const bloom = bytes(h.logs_bloom, 256), bloomChunks = [];
  for (let i = 0; i < 256; i += 32) bloomChunks.push(bloom.subarray(i, i + 32));
  need(typeof h.extra_data === 'string' && /^0x(?:[0-9a-f]{2}){0,32}$/.test(h.extra_data), 'EXTRA_DATA');
  const extra = Buffer.from(h.extra_data.slice(2), 'hex'), extraChunk = Buffer.alloc(32); extra.copy(extraChunk);
  const chunks = [bytes(h.parent_hash, 32), recipient, bytes(h.state_root, 32), bytes(h.receipts_root, 32),
    merkle(bloomChunks), bytes(h.prev_randao, 32), uint(h.block_number, 64), uint(h.gas_limit, 64),
    uint(h.gas_used, 64), uint(h.timestamp, 64), hash(extraChunk, uint(String(extra.length), 256)),
    uint(h.base_fee_per_gas, 256), bytes(h.block_hash, 32), bytes(h.transactions_root, 32), bytes(h.withdrawals_root, 32), Buffer.alloc(32)];
  need(merkle(chunks).equals(expected), 'ROOT_MISMATCH');
  return Object.freeze({ schema: 'caw-capella-payload-root/1', profile: 'capella-15-fields',
    payloadRootVerified: true, payloadRoot: selectedRoot, executionBlockHash: h.block_hash,
    rootAuthenticated: false, beaconBindingVerified: false, executionVerified: false,
    consensusVerified: false, finalityVerified: false, productionAccepted: false });
}
