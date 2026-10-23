import { parseBoundedJson } from '../public/bounded-json.mjs';
import { inspectPaidRegistryHistory } from './paid-registry-permissions.mjs';
import { inspectTestRegistryApprovalState } from './test-registry-state.mjs';

function need(ok,code) { if(!ok) {const e=new Error('Registry history/state rejected: '+code);e.code='REGISTRY_HISTORY_STATE_'+code;throw e;} }
// Existing body/signature/receipt checks are mandatory. No caller-supplied
// "verified report" is accepted. Endpoint selection remains a trust assumption.
export function inspectPaidRegistryStateHistory(text) {
 need(arguments.length===1 && typeof text==='string','ARGUMENTS');
 const input=parseBoundedJson(text,1048576);
 const keys=['schema','history','manifest','captures','policy','stateEvidence','stateSelection'];
 need(input && typeof input==='object' && !Array.isArray(input) && Object.keys(input).length===keys.length && keys.every(k=>Object.hasOwn(input,k)),'SCHEMA');
 need(input.schema==='caw-paid-registry-state-history/1','SCHEMA');
 const history=inspectPaidRegistryHistory(input.history,input.manifest,input.captures,input.policy);
 const state=inspectTestRegistryApprovalState(JSON.stringify(input.stateEvidence),JSON.stringify(input.stateSelection));
 need(state.state.blockHash===input.manifest.end_block_hash,'ENDPOINT');
 need(state.state.registry===history.registry_sequence.selection.registry,'REGISTRY');
 const final=history.registry_sequence.final,index=Number(BigInt(state.state.accountId))-1;
 need(final.owners[index]===state.state.owner,'OWNER');
 need(BigInt(final.epochs[index])===BigInt(state.state.epoch),'EPOCH');
 need(final.approved[index]===state.approved,'APPROVAL');
 const operator=final.operators.find(row=>row.owner===state.operatorOwner && row.operator===state.operator);
 need((operator?.allowed??false)===state.operatorAllowed,'OPERATOR');
 return Object.freeze({schema:'caw-paid-registry-state-history/1',history,state,
  selectedEndpointStateMatchesHistory:true,selectedOperatorMatchesReplay:true,
  allRegistryStateVerified:false,initialStateVerified:false,executionVerified:false,
  accountAuthorityVerified:false,currentPermissionVerified:false,endpointAuthenticated:false,
  consensusVerified:false,finalityVerified:false,freshnessVerified:false,productionAccepted:false});
}
