import {parseBoundedJson} from '../public/bounded-json.mjs';
import {inspectFirstTransactionAnchor} from './first-transaction-anchor.mjs';
import {inspectReplayDependencies} from './replay-dependencies.mjs';
function need(ok,c){if(!ok){const e=new Error('Replay inputs rejected: '+c);e.code='REPLAY_INPUT_'+c;throw e;}}
export function inspectReplayInputBinding(text){
 need(arguments.length===1 && typeof text==='string','ARGUMENTS');const x=parseBoundedJson(text,1048576);
 need(x && typeof x==='object' && !Array.isArray(x) && Object.keys(x).length===3 && x.schema==='caw-replay-input-binding/1' && Object.hasOwn(x,'anchor') && Object.hasOwn(x,'dependencies'),'SCHEMA');
 const anchor=inspectFirstTransactionAnchor(JSON.stringify(x.anchor));const dependencies=inspectReplayDependencies(JSON.stringify(x.dependencies));
 need(x.anchor.selection.profile===x.dependencies.selection.profile,'PROFILE');
 need(anchor.parentHash===dependencies.parentHash && anchor.parentStateRoot===dependencies.parentStateRoot,'PARENT');
 return Object.freeze({schema:'caw-replay-input-binding-report/1',anchor,dependencies,parentDependencyBindingVerified:true,
 dependencyClosureVerified:false,parentStateAuthenticated:false,preTransactionStateVerified:false,systemTransitionsVerified:false,executionVerified:false,accountAuthorityVerified:false,productionAccepted:false});
}
