// BeaconBlockHeader SSZ container root only; selected root is not authenticated.
import { createHash } from 'node:crypto';
import { parseBoundedJson } from '../public/bounded-json.mjs';
import { inspectSha256Branch } from './sha256-branch.mjs';
function need(ok, code) { if (!ok) { const e = new Error('Beacon header rejected: ' + code); e.code = 'BEACON_HEADER_' + code; throw e; } }
const hash = (a, b) => createHash('sha256').update(a).update(b).digest();
const hex = b => '0x' + b.toString('hex');
function root(v) { need(typeof v === 'string' && /^0x[0-9a-f]{64}$/.test(v), 'ROOT'); return Buffer.from(v.slice(2), 'hex'); }
function uint64(v) {
  need(typeof v === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(v), 'UINT64');
  const n = BigInt(v); need(n < 2n ** 64n, 'UINT64');
  const b = Buffer.alloc(32); b.writeBigUInt64LE(n); return b;
}
export function inspectBeaconHeader(text, selectedRoot) {
  need(arguments.length === 2 && typeof text === 'string', 'INPUT');
  const expected = root(selectedRoot), h = parseBoundedJson(text, 2048);
  const keys = ['slot', 'proposer_index', 'parent_root', 'state_root', 'body_root'];
  need(h !== null && typeof h === 'object' && !Array.isArray(h)
    && Object.keys(h).length === 5 && keys.every(k => Object.hasOwn(h, k)), 'SCHEMA');
  const chunks = [uint64(h.slot), uint64(h.proposer_index), root(h.parent_root), root(h.state_root), root(h.body_root), Buffer.alloc(32), Buffer.alloc(32), Buffer.alloc(32)];
  const pairs = [0, 2, 4, 6].map(i => hash(chunks[i], chunks[i + 1]));
  const halves = [hash(pairs[0], pairs[1]), hash(pairs[2], pairs[3])];
  const calculated = hash(halves[0], halves[1]); need(calculated.equals(expected), 'ROOT_MISMATCH');
  // body_root is field 4 in a container padded to 8 leaves: gindex 12.
  const proof = { schema: 'caw-sha256-branch/1', leaf: h.body_root,
    branch: [hex(chunks[5]), hex(pairs[3]), hex(halves[0])], depth: 3, index: 4, root: selectedRoot };
  inspectSha256Branch(JSON.stringify(proof));
  Object.freeze(proof.branch); Object.freeze(proof);
  return Object.freeze({ schema: 'caw-beacon-header-root/1', headerRootVerified: true,
    headerRoot: selectedRoot, bodyRoot: h.body_root, bodyRootProof: proof,
    rootAuthenticated: false, executionPayloadVerified: false, consensusVerified: false,
    finalityVerified: false, productionAccepted: false });
}
