import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectBlockBodyCapture} from '../paid-body-acquisition/verify_body.mjs';
import {inspectBlockSenders} from '../../reference/ethereum-block-senders.mjs';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
const raw=readFileSync(process.argv[2]);assert.ok(raw.length<1048576);const f=JSON.parse(raw),checks=[];
const group=(name,fn)=>{fn();checks.push(name);};
function inspect(m){
 const selection={schema:'caw-block-body-selection/1',profile:'london-16',number:m.header.number,hash:m.header.hash};
 const body={schema:'caw-block-body-capture/1',selection:{block_number:m.header.number,block_hash:m.header.hash},header:m.header,raw_transactions:[m.submission.raw],receipts:[m.row.receipt]};
 const roots=inspectBlockBodyCapture(body,selection);
 const senders=inspectBlockSenders(m.header,body.raw_transactions,{schema:'caw-block-senders-selection/1',profile:'london-16',hash:m.header.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});
 inspectExecutionHeaderChain([m.parent,m.header],{schema:'caw-execution-header-chain-selection/1',profile:'london-16',startHash:m.parent.hash,endHash:m.header.hash});
 assert.equal(senders.transactions[0].data,m.row.transaction.data);assert.equal(senders.transactions[0].from,m.row.transaction.from);assert.equal(senders.transactions[0].to,m.row.transaction.to);
 return roots;
}
group('explicit local writer evidence limitations',()=>{assert.equal(f.localOnly,true);assert.equal(f.writerSuppliedRawTransactions,true);for(const k of ['independentAcquisition','erc1271Verified','executionVerified','productionAccepted'])assert.equal(f[k],false);assert.equal(f.mined.length,2);});
for(const m of f.mined)group(m.label+' mined body sender receipt and parent commitments',()=>{inspect(m);});
group('same post calldata with rejection then success',()=>{const [a,b]=f.mined;assert.equal(a.label,'reject');assert.equal(b.label,'restored');assert.equal(a.row.transaction.data,b.row.transaction.data);assert.equal(a.row.receipt.status,'0x0');assert.deepEqual(a.row.receipt.logs,[]);assert.equal(b.row.receipt.status,'0x1');assert.ok(b.row.receipt.logs.length>0);assert.deepEqual(a.before,a.after);assert.deepEqual(a.after,b.before);assert.equal(BigInt(b.after.nonces[0]),BigInt(b.before.nonces[0])+1n);assert.equal(BigInt(b.after.messageCount),BigInt(b.before.messageCount)+1n);});
const reject=(name,change)=>group(name,()=>{const m=structuredClone(f.mined[1]);change(m);assert.throws(()=>inspect(m));});
reject('altered raw envelope',m=>{m.submission.raw=m.submission.raw.slice(0,-2)+(m.submission.raw.endsWith('00')?'01':'00');});
reject('other post receipt',m=>{m.row.receipt=f.mined[0].row.receipt;});
reject('promoted receipt status',m=>{m.row.receipt.status='0x0';});
reject('earlier parent',m=>{m.parent=f.mined[0].parent;});
reject('forged sender summary',m=>{m.row.transaction.from=f.wallet;});
console.log(JSON.stringify({schema:'caw-mined-wallet-check/1',captureSha256:createHash('sha256').update(raw).digest('hex'),passed:checks.length,checks,erc1271Verified:false,executionVerified:false,productionAccepted:false},null,2));

