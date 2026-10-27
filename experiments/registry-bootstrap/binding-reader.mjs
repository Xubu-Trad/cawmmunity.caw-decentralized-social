// Node-only, fixed fixture composition. Not a production deployment verifier.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseBoundedJson} from '../../public/bounded-json.mjs';
import {inspectTestRegistryState} from '../../reference/test-registry-state.mjs';
import {inspectHeaderBoundCode} from '../../reference/header-bound-state-proof.mjs';
import {keccak256Hex} from '../../reference/keccak256.mjs';
const BUILD='54f130a1f49e8569cbe7b9a6db54547f8e1e9275d9c0c256b5d916b01a59c54e';
const REGISTRY='0x5bd17d0ec2568d04b7edcefb86de6aec5a54f84845004f6630b43c18d83d852d';
function need(ok,code){if(!ok){const e=new Error('Fixture binding rejected: '+code);e.code='PAID_BINDING_'+code;throw e;}}
function fields(v,keys){need(v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)),'SCHEMA');}
const raw=readFileSync(new URL('../paid-action/paid-build.json',import.meta.url));
need(createHash('sha256').update(raw).digest('hex')===BUILD,'BUILD');
const template=JSON.parse(raw).contracts.CawPaidActionProbe;
fields(template.immutables,['registry','registryCodeHash']);
function expectedRuntime(registry){
 const runtime=Buffer.from(template.runtime.slice(2),'hex'),occupied=new Set();
 for(const [field,locations] of Object.entries(template.immutables)){
  need(Array.isArray(locations)&&locations.length>0,'LAYOUT');
  const word=field==='registry'?registry.slice(2).padStart(64,'0'):REGISTRY.slice(2);
  for(const loc of locations){
   need(Number.isSafeInteger(loc.start)&&loc.start>=0&&loc.length===32&&loc.start+32<=runtime.length,'LAYOUT');
   for(let i=loc.start;i<loc.start+32;i++){need(!occupied.has(i)&&runtime[i]===0,'LAYOUT');occupied.add(i);}
   Buffer.from(word,'hex').copy(runtime,loc.start);
  }
 }
 return '0x'+runtime.toString('hex');
}
export function inspectTestPaidRegistryBinding(evidenceText,selectionText){
 need(arguments.length===2&&typeof evidenceText==='string'&&typeof selectionText==='string','ARGUMENTS');
 const selected=parseBoundedJson(selectionText,16384),evidence=parseBoundedJson(evidenceText,1048576);
 fields(selected,['schema','headerProfile','hash','registry','probe','accountId']);fields(evidence,['registry','probe']);
 need(selected.schema==='caw-test-paid-registry-binding-selection/1','SCHEMA');
 for(const key of ['registry','probe'])need(typeof selected[key]==='string'&&/^0x[0-9a-f]{40}$/.test(selected[key]),'ADDRESS');
 need(selected.registry!==selected.probe,'DISTINCT_CONTRACTS');
 const state=inspectTestRegistryState(JSON.stringify(evidence.registry),JSON.stringify({schema:'caw-test-registry-state-selection/1',headerProfile:selected.headerProfile,hash:selected.hash,registry:selected.registry,accountId:selected.accountId}));
 const expected=expectedRuntime(selected.registry);
 const probe=inspectHeaderBoundCode(JSON.stringify(evidence.probe),JSON.stringify({schema:'caw-header-code-selection/1',profile:selected.headerProfile,hash:selected.hash,address:selected.probe,storageKeys:[],expectedCodeHash:keccak256Hex(expected)}));
 need(evidence.probe.code===expected,'EXACT_RUNTIME');
 return Object.freeze({schema:'caw-test-paid-registry-binding/1',registry:state.registry,probe:selected.probe,owner:state.owner,epoch:state.epoch,blockHash:state.blockHash,registryCodeHash:REGISTRY,probeCodeHash:probe.codeHash,selectedFixtureBindingVerified:true,
  compilerReproductionVerified:false,initialAllocationAccepted:false,accountAuthorityVerified:false,currentPermissionVerified:false,transactionPermissionVerified:false,executionVerified:false,endpointAuthenticated:false,consensusVerified:false,finalityVerified:false,freshnessVerified:false,productionAccepted:false});
}
