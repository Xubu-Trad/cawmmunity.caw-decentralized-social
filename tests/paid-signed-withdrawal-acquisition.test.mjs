import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectPaidRegistryStateHistory} from '../reference/paid-registry-state-history.mjs';
const raw=readFileSync(new URL('../experiments/paid-signed-withdrawal-acquisition/joint-capture.json',import.meta.url));
const f=JSON.parse(raw),check=x=>inspectPaidRegistryStateHistory(JSON.stringify(x));
const txs=x=>x.history.blocks.flatMap(b=>b.transactions);
const withdrawal=x=>txs(x).find(t=>t.transaction.to===x.history.addresses.probe && t.transaction.data.startsWith('0xa41fe49f') && t.receipt.status==='0x0');
test('signed withdrawal capture preserves local synthetic scope and exact bytes',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'eb6b3150255e0340d5b6afe487215c41380abf75b29a87d6637a65212d158a6a');
 assert.equal(f.nonImpersonatedSubmissions,true);assert.equal(f.localOnly,true);assert.equal(f.syntheticToken,true);assert.equal(f.publicChainCertification,false);
});
for(const [name,authorization] of [['left','token-approval'],['right','operator']])test(name+' transfer delegate cannot directly withdraw before acquiring ownership',()=>{
 const x=f.branches[name],r=check(x),failed=withdrawal(x),rows=txs(x);
 assert.ok(failed);assert.equal(failed.transaction.from,x.policy.assumedEoaOwners[1]);assert.deepEqual(failed.receipt.logs,[]);
 assert.equal(failed.transaction.data,'0xa41fe49f'+[1,0,1].map(n=>n.toString(16).padStart(64,'0')).join(''));
 const i=rows.indexOf(failed);
 assert.equal(rows[i-1].transaction.to,x.history.addresses.registry);assert.equal(rows[i-1].receipt.status,'0x1');
 assert.ok(rows[i-1].transaction.data.startsWith(name==='left'?'0x095ea7b3':'0xa22cb465'));
 assert.ok(rows[i+1].transaction.data.startsWith('0x23b872dd'));assert.equal(rows[i+1].receipt.status,'0x1');
 assert.equal(r.history.operations.find(op=>op.kind==='transfer').authorization,authorization);
 assert.equal(r.selectedEndpointStateMatchesHistory,true);
 for(const flag of ['accountAuthorityVerified','executionVerified','productionAccepted','currentPermissionVerified'])assert.equal(r[flag],false);
 // A receipt commits failure, not its reason. The local runner separately checks NotAccountOwner().
});
test('failed withdrawal cannot be changed to success under the committed receipt root',()=>{
 const x=structuredClone(f.branches.left);withdrawal(x).receipt.status='0x1';assert.throws(()=>check(x));
});
test('failed withdrawal caller must agree with recovered signed transaction',()=>{
 const x=structuredClone(f.branches.right);withdrawal(x).transaction.from=x.policy.assumedEoaOwners[0];assert.throws(()=>check(x));
});
