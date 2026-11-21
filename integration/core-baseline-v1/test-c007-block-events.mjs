import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {inspectCandidateBlockEvents as inspect} from './c007-block-events.mjs';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
const raw=fs.readFileSync(process.argv[2]);
assert.equal(createHash('sha256').update(raw).digest('hex'),'689f880143cdc55f3016dcad42b70bb188af35ad296305e4ee42a9f058a76742');
const capture=JSON.parse(raw),blocks=capture.blocks.slice(1);
assert.equal(capture.blocks[0].block.number,'0x0');assert.equal(capture.chainId,'0x7a69');assert.equal(blocks.length,38);
inspectExecutionHeaderChain(blocks.map(x=>x.block),{schema:'caw-execution-header-chain-selection/1',profile:'shanghai-17',startHash:blocks[0].block.hash,endHash:blocks.at(-1).block.hash});
const context={chainId:'31337',emitter:'0x'+'22'.repeat(20),profile:'0x'+'33'.repeat(32)};
const select=b=>({profile:'shanghai-17',hash:b.block.hash,chainId:capture.chainId});
const run=(b,s=select(b),c=context)=>inspect(b.block,b.rawTransactions,b.receipts,s,c);
let total=0,failed=0,events=0;
for(const b of blocks){const x=run(b);total+=x.transactions.length;failed+=x.transactions.filter(t=>t.status==='0x0').length;events+=x.events.length;
 assert(x.transactionAssociationVerified&&x.transactionSignaturesVerified);assert(!x.executionVerified&&!x.cawActionAuthorityVerified&&!x.feeBackingVerified);
}
assert.equal(total,38);assert.equal(failed,11);assert.equal(events,0);
const original=blocks[0],selection=select(original),expected=run(original),rejected=[];
for(const [name,mutate]of [
 ['altered raw transaction',x=>{const s=x.rawTransactions[0];x.rawTransactions[0]=s.slice(0,-2)+(s.endsWith('00')?'01':'00');}],
 ['missing body',x=>x.rawTransactions=[]],
 ['duplicate body',x=>x.rawTransactions.push(x.rawTransactions[0])],
 ['missing receipt',x=>x.receipts=[]],
 ['changed status',x=>x.receipts[0].status=x.receipts[0].status==='0x1'?'0x0':'0x1']
]){const x=structuredClone(original);mutate(x);assert.throws(()=>run(x,selection));rejected.push(name);}
assert.throws(()=>run(original,{...selection,chainId:'0x1'}));rejected.push('wrong signature chain');
assert.throws(()=>run(original,selection,{...context,chainId:'1'}));rejected.push('mismatched event context chain');
assert.throws(()=>run(original,{...selection,verified:true}));rejected.push('caller verified selection flag');
const labels=structuredClone(original);labels.receipts[0].transactionHash='0x'+'aa'.repeat(32);labels.receipts[0].from='0x'+'bb'.repeat(20);labels.receipts[0].to='0x'+'cc'.repeat(20);
assert.deepEqual(run(labels),expected);
// The prior synthetic receipt fixture has a placeholder body root. Even a
// valid receipt commitment cannot replace a transaction-body commitment.
const synthetic=JSON.parse(fs.readFileSync(process.argv[3])).cases.find(x=>x.name==='valid');
assert.throws(()=>inspect(synthetic.header,[],synthetic.receipts,{profile:'london-16',hash:synthetic.header.hash,chainId:'0x7a69'},context));rejected.push('synthetic receipt-only fixture lacks matching body');
console.log(JSON.stringify({status:'RETAINED_LOCAL_SIGNED_HISTORY_CHECK',blocks:blocks.length,transactions:total,failedReceipts:failed,candidateEvents:events,
 rejected,untrustedRpcLabelsIgnored:true,executionReplayed:false,
 limits:'Existing signed local capture; no fresh chain run. No candidate events exist in this capture, so positive event-to-sender projection is not covered here. No CAW authority, payment or canonicality proof.'},null,2));
