import {parseBoundedJson} from '../public/bounded-json.mjs';
import {inspectReplayInputBinding} from './replay-input-binding.mjs';
function need(ok,c){if(!ok){const e=new Error('Witness state access rejected: '+c);e.code='WITNESS_STATE_'+c;throw e;}}
// Read-only parent-state view. No fallback, writes, callbacks or execution.
export function createWitnessState(text){
 need(arguments.length===1 && typeof text==='string','ARGUMENTS');
 const verified=inspectReplayInputBinding(text),input=parseBoundedJson(text,1048576),accounts=new Map();
 for(let i=0;i<verified.dependencies.dependencies.length;i++){
  const p=verified.dependencies.dependencies[i].state.proof;
  accounts.set(p.address,{account:Object.freeze({address:p.address,nonce:p.nonce,balance:p.balance,codeHash:p.codeHash,storageHash:p.storageHash}),code:input.dependencies.witnesses[i].code,slots:new Map(p.storage.map(s=>[s.key,s.value]))});
 }
 function selected(address){need(typeof address==='string' && /^0x[0-9a-f]{40}(?![\s\S])/.test(address),'ADDRESS');need(accounts.has(address),'MISSING_ACCOUNT');return accounts.get(address);}
 return Object.freeze({
  selection:Object.freeze({parentHash:verified.anchor.parentHash,parentStateRoot:verified.anchor.parentStateRoot,blockHash:verified.anchor.blockHash,transactionHash:verified.anchor.transaction.hash}),
  limits:Object.freeze({readOnly:true,dependencyClosureVerified:false,preTransactionStateVerified:false,executionVerified:false,accountAuthorityVerified:false,productionAccepted:false}),
  account(address){need(arguments.length===1,'ARGUMENTS');return selected(address).account;},
  code(address){need(arguments.length===1,'ARGUMENTS');return selected(address).code;},
  storage(address,key){need(arguments.length===2,'ARGUMENTS');const a=selected(address);need(typeof key==='string' && /^0x[0-9a-f]{64}(?![\s\S])/.test(key),'KEY');need(a.slots.has(key),'MISSING_SLOT');return a.slots.get(key);}
 });
}
