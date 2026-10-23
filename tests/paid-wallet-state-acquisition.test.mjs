import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectPaidPostSignature} from '../reference/paid-post-signatures.mjs';
const raw=readFileSync(new URL('../experiments/paid-wallet-state/observations.json',import.meta.url));
const f=JSON.parse(raw),rows=f.observations;
test('wallet observation has exact retained bytes and local-only boundary',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),'93616b53822f8fa4e7708ee2458c8715c69c1d3cb583a86c7b63919c25b63e09');
 assert.equal(f.localOnly,true);assert.equal(f.executionVerified,false);assert.equal(f.productionAccepted,false);assert.equal(f.submissions.length,16);
});
test('same post bytes produce valid rejected restored local observations',()=>{
 assert.deepEqual(rows.map(x=>x.mode),[0,1,0]);assert.equal(new Set(rows.map(x=>JSON.stringify(x.call))).size,1);
 assert.equal(rows[0].response.result,'0x');assert.equal(rows[1].response.error.data,'0x8baa579f');assert.equal(rows[2].response.result,'0x');
 for(const x of rows){assert.equal(BigInt(x.mode_readback),BigInt(x.mode));assert.equal(x.request_block,'latest');assert.equal(x.observed_block,x.header.number);assert.equal(x.configuration.receipt.blockHash,x.header.hash);}
});
test('simulations leave account owner epoch nonce and balances unchanged',()=>{
 assert.deepEqual(rows[0].accounting,rows[1].accounting);assert.deepEqual(rows[1].accounting,rows[2].accounting);
 assert.equal(rows[0].accounting.owners[0],f.wallet);assert.equal(rows[0].accounting.nonces[0],'0');assert.equal(rows[0].accounting.epochs[0],'1');
});
test('inner signature remains mathematically valid even in rejected wallet mode',()=>{
 for(const x of rows){const v=inspectPaidPostSignature(x.call.data,{schema:'caw-paid-post-selection/1',profile:'paid-action-v1-eoa-65-low-s',chainId:'0x7a69',verifyingContract:x.call.to,expectedSigner:f.intent.signer});
 assert.equal(v.digest,f.intent.digest);assert.equal(v.signature,f.intent.signature);assert.equal(v.signatureVerified,true);assert.equal(v.erc1271Verified,false);assert.equal(v.accountAuthorityVerified,false);}
});
test('the wallet address cannot replace the inner test signer in EOA recovery',()=>{
 assert.notEqual(f.wallet,f.intent.signer);
 assert.throws(()=>inspectPaidPostSignature(rows[0].call.data,{schema:'caw-paid-post-selection/1',profile:'paid-action-v1-eoa-65-low-s',chainId:'0x7a69',verifyingContract:rows[0].call.to,expectedSigner:f.wallet}),{code:'PAID_POST_SIGNATURE_SIGNER_MISMATCH'});
});
