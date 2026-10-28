import {parseBoundedJson} from '../../public/bounded-json.mjs';
import {inspectPaidBodyHistory} from '../../reference/paid-body-history.mjs';
import {inspectTestLedgerHistory} from './ledger-history-reader.mjs';
function need(ok,code){if(!ok){const e=new Error('Body ledger rejected: '+code);e.code='BODY_LEDGER_'+code;throw e;}}
// Experimental composition, exercised against acquired local signed fixtures.
// Separate JSON boundaries retain the existing parser's 1 MiB maximum.
export function inspectTestBodyLedger(ledgerText,bodyText){
 need(arguments.length===2&&typeof ledgerText==='string'&&typeof bodyText==='string','ARGUMENTS');
 const input=parseBoundedJson(ledgerText,1048576);
 const bodies=parseBoundedJson(bodyText,1048576);
 const ledger=inspectTestLedgerHistory(ledgerText);
 const body=inspectPaidBodyHistory(input.history,input.manifest,bodies);
 need(body.signaturesVerified===true&&body.transactionCommitmentVerified===true&&body.receiptCommitmentVerified===true&&body.transactionFieldsBound===true,'INCOMPLETE');
 return Object.freeze({schema:'caw-test-body-ledger/1',ledger,body,
  selectedLedgerMatchesHistory:true,transactionSignaturesVerified:true,
  completeBodyVerified:true,completeReceiptRootVerified:true,anchorBodyVerified:false,
  tokenBackingVerified:false,executionVerified:false,withdrawalSafetyVerified:false,
  accountAuthorityVerified:false,currentPermissionVerified:false,endpointAuthenticated:false,
  consensusVerified:false,finalityVerified:false,freshnessVerified:false,productionAccepted:false});
}
