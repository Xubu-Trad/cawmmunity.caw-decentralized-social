import { parseBoundedJson } from '../public/bounded-json.mjs';
import { inspectRegistryCallSequence } from './paid-registry-permissions.mjs';
import { inspectTestRegistryState } from './test-registry-state.mjs';

function need(ok, code) {
  if (!ok) { const error = new Error('Registry reconciliation rejected: '+code); error.code='REGISTRY_RECONCILE_'+code; throw error; }
}

// Replays from explicit constructor assumptions, never from terminal ownership.
// The supplied sequence is NOT authenticated or proved complete by this API.
export function inspectRegistryStateReconciliation(text) {
  need(arguments.length===1 && typeof text==='string','ARGUMENTS');
  const input=parseBoundedJson(text,1048576);
  const keys=['schema','sequence','registrySelection','stateEvidence','stateSelection'];
  need(input && typeof input==='object' && !Array.isArray(input)
    && Object.keys(input).length===keys.length && keys.every(k=>Object.hasOwn(input,k)),'SCHEMA');
  need(input.schema==='caw-registry-state-reconciliation/1','SCHEMA');
  const replay=inspectRegistryCallSequence(input.sequence,input.registrySelection);
  const state=inspectTestRegistryState(JSON.stringify(input.stateEvidence),JSON.stringify(input.stateSelection));
  need(replay.selection.registry===state.registry,'REGISTRY');
  const index=Number(BigInt(state.accountId))-1;
  need(replay.final.owners[index]===state.owner,'OWNER');
  need(BigInt(replay.final.epochs[index])===BigInt(state.epoch),'EPOCH');
  return Object.freeze({schema:'caw-registry-state-reconciliation/1',replay,state,
    selectedAccountStateMatchesReplay:true,
    // Approval/operator slots are deliberately not covered by the state proof.
    approvalsStateVerified:false,initialStateVerified:false,sequenceComplete:false,
    sequenceOrderAuthenticated:false,transactionPositionVerified:false,
    senderVerified:false,accountAuthorityVerified:false,currentPermissionVerified:false,
    executionVerified:false,consensusVerified:false,finalityVerified:false,
    freshnessVerified:false,productionAccepted:false});
}
