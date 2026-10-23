import {parseBoundedJson} from '../public/bounded-json.mjs';
import {inspectExecutionHeaderChain} from './ethereum-execution-header.mjs';
import {inspectBlockSenders} from './ethereum-block-senders.mjs';
function need(ok,code){if(!ok){const e=new Error('First transaction anchor rejected: '+code);e.code='FIRST_TX_'+code;throw e;}}
function fields(v,keys){need(v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k)),'SCHEMA');}
// This prepares a replay starting point. It does not execute a transaction.
// Even position zero can have fork-specific system operations before it.
export function inspectFirstTransactionAnchor(text){
 need(arguments.length===1 && typeof text==='string','ARGUMENTS');
 const x=parseBoundedJson(text,1024*1024);
 fields(x,['schema','parentHeader','header','rawTransactions','selection']);need(x.schema==='caw-first-transaction-anchor/1','SCHEMA');
 const s=x.selection;fields(s,['profile','parentHash','blockHash','chainId','transactionIndex','transactionHash']);
 need(s.transactionIndex==='0x0','POSITION_UNSUPPORTED');
 need(typeof s.transactionHash==='string' && /^0x[0-9a-f]{64}$/.test(s.transactionHash),'TRANSACTION_HASH');
 const chain=inspectExecutionHeaderChain([x.parentHeader,x.header],{schema:'caw-execution-header-chain-selection/1',profile:s.profile,startHash:s.parentHash,endHash:s.blockHash});
 const body=inspectBlockSenders(x.header,x.rawTransactions,{schema:'caw-block-senders-selection/1',profile:s.profile,hash:s.blockHash,chainId:s.chainId,allowUnprotectedLegacy:false});
 need(body.transactions.length>0,'EMPTY_BODY');need(body.transactions[0].hash===s.transactionHash,'TRANSACTION_MISMATCH');
 return Object.freeze({schema:'caw-first-transaction-anchor-report/1',parentHash:chain.headers[0].hash,
 parentStateRoot:chain.headers[0].stateRoot,blockHash:body.blockHash,transaction:body.transactions[0],transactionCount:body.transactionCount,
 parentLinkVerified:true,bodyCommitmentVerified:true,senderRecovered:true,transactionPositionBound:true,
 parentStateAuthenticated:false,preTransactionStateVerified:false,systemTransitionsVerified:false,
 executionVerified:false,accountAuthorityVerified:false,erc1271Verified:false,consensusVerified:false,finalityVerified:false,productionAccepted:false});
}
