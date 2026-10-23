import { parseBoundedJson } from '../public/bounded-json.mjs';
import { inspectExecutionHeader } from './ethereum-execution-header.mjs';
import { inspectEthereumStateProof } from './ethereum-state-proof.mjs';

function need(ok, code) {
  if (!ok) { const error = new Error('Header-bound state rejected: ' + code); error.code = 'HEADER_STATE_' + code; throw error; }
}
function fields(value, keys) {
  need(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), 'SCHEMA');
}

// Exact JSON text boundaries detach inputs and reject duplicate keys. The
// caller selects the header hash; no chain authenticity is inferred from it.
export function inspectHeaderBoundStateProof(evidenceText, selectionText) {
  need(arguments.length === 2 && typeof evidenceText === 'string' && typeof selectionText === 'string', 'ARGUMENTS');
  const selected = parseBoundedJson(selectionText, 16384);
  fields(selected, ['schema', 'profile', 'hash', 'address', 'storageKeys']);
  need(selected.schema === 'caw-header-state-selection/1', 'SCHEMA');
  const evidence = parseBoundedJson(evidenceText, 262144);
  fields(evidence, ['header', 'proof']);
  const header = inspectExecutionHeader(evidence.header, {
    schema: 'caw-execution-header-selection/1', profile: selected.profile, hash: selected.hash });
  // There is deliberately no caller-supplied stateRoot argument here.
  const proof = inspectEthereumStateProof(evidence.proof, {
    stateRoot: header.stateRoot, address: selected.address, storageKeys: selected.storageKeys });
  return Object.freeze({ schema: 'caw-header-state-evidence/1', header, proof,
    selectedHeaderBindingVerified: true, endpointAuthenticated: false,
    consensusVerified: false, finalityVerified: false, freshnessVerified: false,
    accountAuthorityVerified: false, executionVerified: false, productionAccepted: false });
}
