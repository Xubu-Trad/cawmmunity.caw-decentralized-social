// Fixed fixture endpoint decoder, not execution, token backing or live authority.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseBoundedJson} from '../../public/bounded-json.mjs';
import {keccak256Hex} from '../../reference/keccak256.mjs';
import {inspectHeaderBoundCode} from '../../reference/header-bound-state-proof.mjs';
import {inspectTestPaidRegistryBinding} from './binding-reader.mjs';
const layout=readFileSync(new URL('../paid-action/storage-layout.json',import.meta.url));
if(createHash('sha256').update(layout).digest('hex')!=='bb2ae95123e44e3f36f743802f300d9d497de55bb3ee22b3cb102251aad28976')throw new Error('Paid layout identity mismatch');
function need(ok,code){if(!ok){const e=new Error('Paid ledger rejected: '+code);e.code='PAID_LEDGER_'+code;throw e;}}
const word=n=>BigInt(n).toString(16).padStart(64,'0');
const keys=Object.freeze([...[0,1,2].flatMap(slot=>[1,2,3].map(id=>keccak256Hex('0x'+word(id)+word(slot)))),...[3,4,5,6].map(slot=>'0x'+word(slot))]);
export function inspectTestPaidLedger(evidenceText,selectionText){
 need(arguments.length===2&&typeof evidenceText==='string'&&typeof selectionText==='string','ARGUMENTS');
 const evidence=parseBoundedJson(evidenceText,1048576);
 need(evidence&&typeof evidence==='object'&&!Array.isArray(evidence)&&Object.keys(evidence).length===2&&Object.hasOwn(evidence,'registry')&&Object.hasOwn(evidence,'probe'),'SCHEMA');
 need(Array.isArray(evidence.probe?.proof?.storageProof)&&evidence.probe.proof.storageProof.length===13,'SLOTS');
 const binding=inspectTestPaidRegistryBinding(JSON.stringify({...evidence,probe:{...evidence.probe,proof:{...evidence.probe.proof,storageProof:[]}}}),selectionText);
 const selected=parseBoundedJson(selectionText,16384);
 const checked=inspectHeaderBoundCode(JSON.stringify(evidence.probe),JSON.stringify({schema:'caw-header-code-selection/1',profile:selected.headerProfile,hash:binding.blockHash,address:binding.probe,storageKeys:keys,expectedCodeHash:binding.probeCodeHash}));
 const storage=checked.state.proof.storage;
 need(storage.length===13&&storage.every((v,i)=>v.key===keys[i]),'SLOTS');
 const values=storage.map(v=>BigInt(v.value)),credits=values.slice(0,3),stakes=values.slice(3,6),nonces=values.slice(6,9);
 const [totalCredits,poolDust,messageCount,entered]=values.slice(9);
 need(credits.reduce((a,b)=>a+b,0n)===totalCredits,'TOTAL');
 need(stakes.every((v,i)=>v<=credits[i]),'STAKE');
 need(totalCredits+poolDust<1n<<256n,'OVERFLOW');
 need(entered===0n,'ENTERED');
 return Object.freeze({schema:'caw-test-paid-ledger/1',binding,credits:Object.freeze(credits.map(String)),stakes:Object.freeze(stakes.map(String)),nonces:Object.freeze(nonces.map(String)),totalCredits:String(totalCredits),poolDust:String(poolDust),messageCount:String(messageCount),entered:false,
  selectedLedgerDecoded:true,localLedgerInvariantsHold:true,historyMatchesLedger:false,tokenBackingVerified:false,withdrawalVerified:false,executionVerified:false,accountAuthorityVerified:false,currentPermissionVerified:false,consensusVerified:false,finalityVerified:false,freshnessVerified:false,productionAccepted:false});
}
