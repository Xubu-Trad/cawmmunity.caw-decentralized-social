import { parseBoundedJson } from '../public/bounded-json.mjs';
import { keccak256Hex } from './keccak256.mjs';
import { inspectHeaderBoundCode } from './header-bound-state-proof.mjs';

// Exact fixture runtime reproduced with compiler-derived layout. This profile
// is not a generic ERC-721 or production username-registry decoder.
const CODE = '0x5bd17d0ec2568d04b7edcefb86de6aec5a54f84845004f6630b43c18d83d852d';
function need(ok, code) { if (!ok) { const e = new Error('Registry state rejected: '+code);e.code='REGISTRY_STATE_'+code;throw e; } }
export function inspectTestRegistryState(evidenceText, selectionText) {
  need(arguments.length===2 && typeof evidenceText==='string' && typeof selectionText==='string','ARGUMENTS');
  const selected=parseBoundedJson(selectionText,16384);
  const keys=['schema','headerProfile','hash','registry','accountId'];
  need(selected!==null && typeof selected==='object' && !Array.isArray(selected) && Object.keys(selected).length===keys.length && keys.every(k=>Object.hasOwn(selected,k)),'SCHEMA');
  need(selected.schema==='caw-test-registry-state-selection/1','SCHEMA');
  need(['0x1','0x2','0x3'].includes(selected.accountId),'ACCOUNT');
  const word=n=>BigInt(n).toString(16).padStart(64,'0');
  const storageKeys=[0,4].map(slot=>keccak256Hex('0x'+word(selected.accountId)+word(slot)));
  const checked=inspectHeaderBoundCode(evidenceText,JSON.stringify({schema:'caw-header-code-selection/1',
    profile:selected.headerProfile,hash:selected.hash,address:selected.registry,storageKeys,expectedCodeHash:CODE}));
  const storage=checked.state.proof.storage;
  need(storage.length===2 && storage.every((s,i)=>s.key===storageKeys[i]),'SLOTS');
  const ownerWord=BigInt(storage[0].value),epoch=storage[1].value;
  need(ownerWord>0n && ownerWord<(1n<<160n),'OWNER');
  return Object.freeze({schema:'caw-test-registry-state/1',registry:selected.registry,accountId:selected.accountId,
    owner:'0x'+ownerWord.toString(16).padStart(40,'0'),epoch,blockHash:checked.state.header.hash,
    storageKeys:Object.freeze(storageKeys),selectedStateDecoded:true,codeMatchesFixture:true,
    accountAuthorityVerified:false,transactionPermissionVerified:false,currentPermissionVerified:false,
    approvalsVerified:false,executionVerified:false,endpointAuthenticated:false,consensusVerified:false,
    finalityVerified:false,freshnessVerified:false,productionAccepted:false});
}
