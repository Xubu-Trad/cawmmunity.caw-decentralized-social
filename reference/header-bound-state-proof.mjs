import { parseBoundedJson } from '../public/bounded-json.mjs';
import { inspectExecutionHeader } from './ethereum-execution-header.mjs';
import { inspectEthereumStateProof } from './ethereum-state-proof.mjs';
import { keccak256Hex } from './keccak256.mjs';

function need(ok, code) {
  if (!ok) { const error = new Error('Header-bound state rejected: ' + code); error.code = 'HEADER_STATE_' + code; throw error; }
}

// Separate opt-in composition: requires both the account's committed code hash
// and a caller-retained expected code hash. Neither authenticates code semantics.
export function inspectHeaderBoundCode(evidenceText, selectionText) {
  need(arguments.length === 2 && typeof evidenceText === 'string' && typeof selectionText === 'string', 'ARGUMENTS');
  const selected = parseBoundedJson(selectionText, 16384);
  fields(selected, ['schema', 'profile', 'hash', 'address', 'storageKeys', 'expectedCodeHash']);
  need(selected.schema === 'caw-header-code-selection/1', 'SCHEMA');
  need(typeof selected.expectedCodeHash === 'string' && /^0x[0-9a-f]{64}$/.test(selected.expectedCodeHash), 'CODE_SELECTION');
  const evidence = parseBoundedJson(evidenceText, 524288);
  fields(evidence, ['header', 'proof', 'code']);
  // Validate and bound the supplied bytes before expensive proof processing.
  const suppliedCodeHash = keccak256Hex(evidence.code);
  const state = inspectHeaderBoundStateProof(JSON.stringify({ header: evidence.header, proof: evidence.proof }),
    JSON.stringify({ schema: 'caw-header-state-selection/1', profile: selected.profile,
      hash: selected.hash, address: selected.address, storageKeys: selected.storageKeys }));
  need(state.proof.accountExists, 'ACCOUNT_ABSENT');
  need(suppliedCodeHash === state.proof.codeHash, 'CODE_HASH');
  need(suppliedCodeHash === selected.expectedCodeHash, 'CODE_SELECTION');
  return Object.freeze({ schema: 'caw-header-code-evidence/1', state,
    codeHash: suppliedCodeHash, codeBytes: (evidence.code.length - 2) / 2,
    codeMatchesSelectedState: true, expectedCodeHashMatched: true,
    sourceReproductionVerified: false, dependenciesVerified: false,
    accountAuthorityVerified: false, executionVerified: false,
    endpointAuthenticated: false, consensusVerified: false,
    finalityVerified: false, freshnessVerified: false, productionAccepted: false });
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
