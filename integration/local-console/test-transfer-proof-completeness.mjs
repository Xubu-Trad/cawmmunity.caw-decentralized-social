import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {verifyPostingHistory} from './verify-posting-history.mjs';
import {verifyReceiptHistory} from './verify-receipt-history.mjs';
import {exportReceiptHistory,verifyReceiptExport} from './ui/receipt-export.mjs';
import {OUTCOME_PREFIX} from './ui/receipt-outcomes.mjs';

// Read-only replay of retained signed research evidence. No RPC or wallet use.
const directory=process.argv[2];
assert(directory,'RETAINED_TRANSFER_EVIDENCE_DIRECTORY_REQUIRED');
const read=name=>fs.readFileSync(path.join(directory,name),'utf8');
const text=read('transfer-export.json'),bundle=JSON.parse(read('capture.json'));
const state=JSON.parse(read('review-state.json')),selection=JSON.parse(read('selection.json'));
const original=(await verifyReceiptExport(text,state)).value.original;
const history=verifyPostingHistory(bundle,selection);
const transfer=history.transfers.find(t=>t.transactionHash===original.transactionHash.toLowerCase());
assert(transfer,'RETAINED_TRANSFER_REQUIRED');
const index=bundle.blocks.findIndex(r=>r.header.hash===transfer.blockHash);
assert.equal(bundle.blocks[index].rawTransactions.length,1,'SIGNED_STANDALONE_TRANSFER_REQUIRED');
const checks=[],run=async(name,fn)=>{await fn();checks.push(name);};

await run('complete signed standalone transfer remains included',async()=>{
 const result=await verifyReceiptHistory(text,state,bundle,selection);
 assert.equal(result.status,'INCLUDED_TRANSFER_MATCHES_LOCAL_RECORD');
 assert.equal(result.transactionIncluded,true);
 assert.equal(result.publicChainAuthenticated,false);
 assert.equal(result.accountingEffectsVerified,false);
});

for(const [name,change]of [
 ['deleted ownership context',row=>delete row.ownerTransition],
 ['null ownership context',row=>row.ownerTransition=null],
 ['false ownership context',row=>row.ownerTransition=false],
 ['array ownership context',row=>row.ownerTransition=[]]
])await run(name+' rejects incomplete evidence',async()=>{
 const copy=structuredClone(bundle);change(copy.blocks[index]);
 assert.throws(()=>verifyPostingHistory(copy,selection),/OWNER_TRANSITION_EVIDENCE_REQUIRED/);
 await assert.rejects(()=>verifyReceiptHistory(text,state,copy,selection),/OWNER_TRANSITION_EVIDENCE_REQUIRED/);
});

for(const field of ['ownerProofs','finalRegistry','finalPosting'])await run('missing '+field+' still rejects',async()=>{
 const copy=structuredClone(bundle);delete copy.blocks[index].ownerTransition[field];
 await assert.rejects(()=>verifyReceiptHistory(text,state,copy,selection));
});

await run('altered committed receipt still rejects before classification',async()=>{
 const copy=structuredClone(bundle);
 const log=copy.blocks[index].receipts.flatMap(r=>r.logs).find(l=>l.address===selection.contracts.registry.address&&l.topics.length===4);
 assert(log,'RETAINED_REGISTRY_LOG_REQUIRED');log.topics[0]='0x'+'11'.repeat(32);
 await assert.rejects(()=>verifyReceiptHistory(text,state,copy,selection));
});

await run('genuinely absent transaction retains absence result',async()=>{
 const absent=structuredClone(original);absent.transactionHash=absent.action.hash='0x'+'ee'.repeat(32);
 assert(!history.transfers.some(t=>t.transactionHash===absent.transactionHash));
 const locks={request:async(_name,_options,fn)=>fn({})};
 const exported=await exportReceiptHistory({getItem:key=>key===OUTCOME_PREFIX+absent.action.id?JSON.stringify(absent):null},locks,state,absent);
 const result=await verifyReceiptHistory(exported.text,state,bundle,selection);
 assert.equal(result.status,'NOT_FOUND_IN_SELECTED_VERIFIED_TRANSFER_HISTORY');
 assert.equal(result.transactionIncluded,false);
 assert.equal(result.accountingEffectsVerified,false);
});

console.log(JSON.stringify({passed:checks.length,checks,transactionHash:transfer.transactionHash,scope:'Offline retained signed standalone-transfer evidence; no fresh execution, public-chain authentication or consensus claim.'},null,2));
