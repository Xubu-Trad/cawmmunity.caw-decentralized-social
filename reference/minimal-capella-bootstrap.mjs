// Fixed minimal-preset Capella structural bootstrap. No BLS or trust adoption.
import { createHash } from 'node:crypto';
import { parseBoundedJson } from '../public/bounded-json.mjs';
import { inspectCapellaHeaderBinding } from './capella-header-binding.mjs';
import { inspectSha256Branch } from './sha256-branch.mjs';
function need(ok) { if (!ok) { const e = new Error('Minimal Capella bootstrap schema rejected'); e.code='MINIMAL_BOOTSTRAP_SCHEMA'; throw e; } }
function fields(p,keys) { need(p!==null && typeof p==='object' && !Array.isArray(p) && Object.keys(p).length===keys.length && keys.every(k=>Object.hasOwn(p,k))); }
const hash=(a,b)=>createHash('sha256').update(a).update(b).digest();
function pubkeyRoot(text) {
  need(typeof text==='string' && /^0x[0-9a-f]{96}$/.test(text));
  const b=Buffer.from(text.slice(2),'hex'),tail=Buffer.alloc(32);b.subarray(32).copy(tail);
  return hash(b.subarray(0,32),tail);
}
export function inspectMinimalCapellaBootstrap(text,selectedBeaconRoot) {
  need(arguments.length===2 && typeof text==='string');const p=parseBoundedJson(text,32768);
  fields(p,['schema','profile','header','committee','committeeBranch']);
  need(p.schema==='caw-minimal-capella-bootstrap/1' && p.profile==='minimal-capella-32-structural-only');
  const bound=inspectCapellaHeaderBinding(JSON.stringify(p.header),selectedBeaconRoot);
  fields(p.committee,['pubkeys','aggregate_pubkey']);need(Array.isArray(p.committee.pubkeys) && p.committee.pubkeys.length===32);
  let layer=p.committee.pubkeys.map(pubkeyRoot);
  while(layer.length>1) { const next=[];for(let i=0;i<layer.length;i+=2)next.push(hash(layer[i],layer[i+1]));layer=next; }
  const committeeRoot='0x'+hash(layer[0],pubkeyRoot(p.committee.aggregate_pubkey)).toString('hex');
  // Current sync committee gindex=54 in this fixed pre-Electra state layout.
  inspectSha256Branch(JSON.stringify({schema:'caw-sha256-branch/1',leaf:committeeRoot,
    branch:p.committeeBranch,depth:5,index:22,root:p.header.beacon.state_root}));
  return Object.freeze({schema:'caw-minimal-capella-bootstrap-result/1',structuralBindingVerified:bound.structuralBindingVerified,
    committeeInclusionVerified:true,committeeRoot,selectedBeaconRoot:bound.selectedBeaconRoot,
    publicKeysValidated:false,aggregatePubkeyValidated:false,signaturesVerified:false,
    rootAuthenticated:false,forkScheduleVerified:false,consensusVerified:false,finalityVerified:false,productionAccepted:false});
}
