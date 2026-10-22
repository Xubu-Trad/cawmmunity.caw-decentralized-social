// Offline fixture recovery only. The caller supplies a separately retained
// selection; matching that selection is not endpoint authentication.
import { createHash } from 'node:crypto';
import { parseBoundedJson } from '../public/bounded-json.mjs';
import { inspectPaidRegistryHistory } from './paid-registry-permissions.mjs';

export const RECOVERY_FILES = Object.freeze(['history.json', 'manifest.json', 'bodies.json', 'policy.json']);
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');
function need(ok, reason) {
  if (!ok) { const e = new Error('Recovery bundle rejected: ' + reason); e.code = 'RECOVERY_BUNDLE_' + reason; throw e; }
}
function fields(value, names) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value), 'SCHEMA');
  const keys = Reflect.ownKeys(value);
  need(keys.length === names.length && keys.every(k => names.includes(k)), 'SCHEMA');
  for (const name of names) {
    const d = Object.getOwnPropertyDescriptor(value, name);
    need(d && d.enumerable && Object.hasOwn(d, 'value'), 'SCHEMA');
  }
}

export function inspectRecoveryBundle(parts, selectionText) {
  need(arguments.length === 2 && typeof selectionText === 'string', 'SCHEMA');
  const selection = parseBoundedJson(selectionText, 16384);
  fields(selection, ['schema', 'profile', 'chainId', 'startBlockHash', 'endBlockHash', 'sha256']);
  need(selection.schema === 'caw-recovery-selection/1' && selection.profile === 'fixed-registry-eoa/1', 'PROFILE');
  need(selection.chainId === '0x7a69', 'CHAIN');
  for (const key of ['startBlockHash', 'endBlockHash']) need(/^0x[0-9a-f]{64}$/.test(selection[key]), 'SELECTION');
  fields(selection.sha256, RECOVERY_FILES); fields(parts, RECOVERY_FILES);
  const captured = Object.create(null);
  for (const file of RECOVERY_FILES) {
    const value = Object.getOwnPropertyDescriptor(parts, file).value;
    need(typeof value === 'string' && value.length <= 1048576 && Buffer.byteLength(value, 'utf8') <= 1048576, 'LIMIT');
    need(/^[0-9a-f]{64}$/.test(selection.sha256[file]), 'SELECTION');
    need(sha(value) === selection.sha256[file], 'HASH');
    captured[file] = parseBoundedJson(value);
  }
  const manifest = captured['manifest.json'];
  need(manifest.chain_id === 31337 && manifest.start_block_hash === selection.startBlockHash
    && manifest.end_block_hash === selection.endBlockHash, 'ENDPOINT');
  const checked = inspectPaidRegistryHistory(captured['history.json'], manifest,
    captured['bodies.json'], captured['policy.json']);
  return Object.freeze({ schema: 'caw-recovery-bundle/1', profile: selection.profile,
    selectionSha256: sha(selectionText), byteIntegrityVerified: true, reconstructionVerified: true,
    endpointAuthenticated: false, acquisitionIndependent: false, accountAuthorityVerified: false,
    executionVerified: false, finalityVerified: false, productionAccepted: false,
    authorityAssumption: 'fixed-fixture-constructor-and-direct-call-semantics; caller-supplied-eoa',
    endpointTrust: 'caller-supplied-selection', checked });
}
