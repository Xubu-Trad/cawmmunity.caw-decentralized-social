import {parseBoundedJson} from '../public/bounded-json.mjs';
import {inspectHeaderBoundCode} from './header-bound-state-proof.mjs';
function need(ok,c){if(!ok){const e=new Error('Replay dependencies rejected: '+c);e.code='REPLAY_DEPENDENCIES_'+c;throw e;}}
function fields(v,keys){need(v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k)),'SCHEMA');}
// Selected dependencies are not a proven complete execution access set.
export function inspectReplayDependencies(text){
 need(arguments.length===1 && typeof text==='string','ARGUMENTS');const x=parseBoundedJson(text,1048576);
 fields(x,['schema','header','selection','witnesses']);need(x.schema==='caw-replay-dependencies/1','SCHEMA');
 const s=x.selection;fields(s,['profile','parentHash','dependencies']);
 need(Array.isArray(s.dependencies) && s.dependencies.length>0 && s.dependencies.length<=16,'COUNT');
 need(Array.isArray(x.witnesses) && x.witnesses.length===s.dependencies.length,'COUNT');
 const addresses=new Set();
 // Validate every declaration before performing cryptographic work.
 for(const d of s.dependencies){fields(d,['address','storageKeys','expectedCodeHash']);need(typeof d.address==='string' && /^0x[0-9a-f]{40}$/.test(d.address),'ADDRESS');need(!addresses.has(d.address),'DUPLICATE');addresses.add(d.address);}
 const reports=s.dependencies.map((d,i)=>{const w=x.witnesses[i];fields(w,['proof','code']);return inspectHeaderBoundCode(JSON.stringify({header:x.header,proof:w.proof,code:w.code}),JSON.stringify({schema:'caw-header-code-selection/1',profile:s.profile,hash:s.parentHash,...d}));});
 return Object.freeze({schema:'caw-replay-dependencies-report/1',parentHash:s.parentHash,parentStateRoot:reports[0].state.header.stateRoot,dependencies:Object.freeze(reports),selectedDependenciesVerified:true,
 dependencyClosureVerified:false,parentChildBindingVerified:false,parentStateAuthenticated:false,preTransactionStateVerified:false,executionVerified:false,accountAuthorityVerified:false,productionAccepted:false});
}
