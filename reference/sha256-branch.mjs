// Bounded SHA-256 branch inclusion only. No root provenance or consensus claim.
import { createHash } from 'node:crypto';
import { parseBoundedJson } from '../public/bounded-json.mjs';

function need(ok, code) {
  if (!ok) { const e = new Error('SHA256 branch rejected: ' + code); e.code = 'SHA256_BRANCH_' + code; throw e; }
}
function bytes32(value) {
  need(typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value), 'BYTES32');
  return Buffer.from(value.slice(2), 'hex');
}

export function inspectSha256Branch(text) {
  need(arguments.length === 1 && typeof text === 'string', 'INPUT');
  const p = parseBoundedJson(text, 8192);
  const keys = ['schema', 'leaf', 'branch', 'depth', 'index', 'root'];
  need(p !== null && typeof p === 'object' && !Array.isArray(p)
    && Object.keys(p).length === keys.length && keys.every(k => Object.hasOwn(p, k)), 'SCHEMA');
  need(p.schema === 'caw-sha256-branch/1', 'SCHEMA');
  need(Number.isSafeInteger(p.depth) && !Object.is(p.depth, -0) && p.depth >= 0 && p.depth <= 32, 'DEPTH');
  need(Number.isSafeInteger(p.index) && !Object.is(p.index, -0) && p.index >= 0 && p.index < 2 ** p.depth, 'INDEX');
  need(Array.isArray(p.branch) && p.branch.length === p.depth, 'BRANCH_LENGTH');
  let value = bytes32(p.leaf);
  const root = bytes32(p.root);
  for (let i = 0; i < p.depth; i++) {
    const sibling = bytes32(p.branch[i]);
    // Arithmetic avoids JavaScript's signed 32-bit bitwise coercions.
    const right = Math.floor(p.index / 2 ** i) % 2 === 1;
    value = createHash('sha256').update(right ? Buffer.concat([sibling, value]) : Buffer.concat([value, sibling])).digest();
  }
  need(value.equals(root), 'ROOT_MISMATCH');
  return Object.freeze({ schema: 'caw-sha256-branch-result/1', inclusionVerified: true,
    root: p.root, depth: p.depth, index: p.index, rootAuthenticated: false,
    consensusVerified: false, finalityVerified: false, productionAccepted: false });
}
