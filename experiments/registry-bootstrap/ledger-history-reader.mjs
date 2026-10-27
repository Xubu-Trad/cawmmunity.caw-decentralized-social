import {parseBoundedJson} from '../../public/bounded-json.mjs';
import {reconstruct} from '../../reference/paid-action-reader.mjs';
import {inspectTestPaidLedger} from './ledger-reader.mjs';
function need(ok,code){if(!ok){const e=new Error('Ledger history rejected: '+code);e.code='LEDGER_HISTORY_'+code;throw e;}}
export function inspectTestLedgerHistory(text){
 need(arguments.length===1&&typeof text==='string','ARGUMENTS');
 const input=parseBoundedJson(text,1048576),keys=['schema','evidence','selection','history','manifest'];
 need(input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).length===keys.length&&keys.every(k=>Object.hasOwn(input,k)),'SCHEMA');
 need(input.schema==='caw-test-ledger-history/1','SCHEMA');
 const ledger=inspectTestPaidLedger(JSON.stringify(input.evidence),JSON.stringify(input.selection));
 const model=reconstruct(input.history,input.manifest);
 need(input.manifest.end_block_hash===ledger.binding.blockHash,'ENDPOINT');
 need(input.manifest.addresses.probe===ledger.binding.probe&&input.manifest.addresses.registry===ledger.binding.registry,'CONTRACTS');
 need(input.history.probe_runtime===input.evidence.probe.code&&input.history.registry_runtime===input.evidence.registry.code,'RUNTIME');
 for(const key of ['credits','stakes','nonces'])need(model[key].every((v,i)=>v===ledger[key][i]),key.toUpperCase());
 for(const key of ['totalCredits','poolDust','messageCount'])need(model[key]===ledger[key],key.toUpperCase());
 const index=Number(BigInt(input.selection.accountId))-1;
 need(model.owners[index]===ledger.binding.owner&&BigInt(model.epochs[index])===BigInt(ledger.binding.epoch),'OWNER');
 return Object.freeze({schema:'caw-test-ledger-history/1',ledger,selectedLedgerMatchesHistory:true,
  modeledTokenBalance:model.tokenBalance,tokenBackingVerified:false,transactionSignaturesVerified:false,completeBodyVerified:false,completeReceiptRootVerified:false,executionVerified:false,withdrawalSafetyVerified:false,accountAuthorityVerified:false,currentPermissionVerified:false,consensusVerified:false,finalityVerified:false,freshnessVerified:false,productionAccepted:false});
}
