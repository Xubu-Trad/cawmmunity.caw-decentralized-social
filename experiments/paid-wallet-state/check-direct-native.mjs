import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectHeaderBoundStateProof} from '../../reference/header-bound-state-proof.mjs';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {inspectBlockBodyCapture} from '../paid-body-acquisition/verify_body.mjs';
import {inspectBlockSenders,inspectDigestSignature} from '../../reference/ethereum-block-senders.mjs';
const raw=readFileSync(process.argv[2]);assert.ok(raw.length<1048576);const f=JSON.parse(raw),d=f.directNative,native='0x'+'00'.repeat(19)+'01',checks=[];
const group=(name,fn)=>{fn();checks.push(name);};
function state(header,proof){return inspectHeaderBoundStateProof(JSON.stringify({header,proof}),JSON.stringify({schema:'caw-header-state-selection/1',profile:'london-16',hash:header.hash,address:native,storageKeys:[]})).proof;}
function body(d){return inspectBlockBodyCapture({schema:'caw-block-body-capture/1',selection:{block_number:d.child.number,block_hash:d.child.hash},header:d.child,raw_transactions:[d.submission.raw],receipts:[d.row.receipt]},{schema:'caw-block-body-selection/1',profile:'london-16',number:d.child.number,hash:d.child.hash});}
let parent,child;
group('local control without token installation',()=>{assert.equal(f.localOnly,true);assert.equal(f.tokenInstalled,false);assert.equal(f.productionAccepted,false);});
group('selected native parent and child proofs',()=>{parent=state(d.parent,d.parentProof);child=state(d.child,d.childProof);assert.equal(parent.accountExists,false);assert.equal(BigInt(child.balance),0n);assert.equal(BigInt(child.nonce),0n);});
group('single signed direct call and receipt commitments',()=>{body(d);inspectExecutionHeaderChain([d.parent,d.child],{schema:'caw-execution-header-chain-selection/1',profile:'london-16',startHash:d.parent.hash,endHash:d.child.hash});const s=inspectBlockSenders(d.child,[d.submission.raw],{schema:'caw-block-senders-selection/1',profile:'london-16',hash:d.child.hash,chainId:'0x7a69',allowUnprotectedLegacy:false});assert.equal(s.transactions[0].to,native);assert.equal(s.transactions[0].data,d.row.transaction.data);assert.equal(s.transactions[0].value,'0x0');assert.equal(d.row.receipt.status,'0x1');});
group('fixed inner signature matches observed recovery',()=>{const r=inspectDigestSignature(d.intent.digest,d.intent.signature);assert.equal(r.address??r.from,d.intent.signer);assert.equal(d.row.dry_response.result,'0x'+d.intent.signer.slice(2).padStart(64,'0'));});
group('swapped parent proof rejects',()=>assert.throws(()=>state(d.child,d.parentProof)));
group('altered native receipt rejects',()=>{const b=structuredClone(d);b.row.receipt.status='0x0';assert.throws(()=>body(b));});
group('altered raw envelope rejects',()=>{const b=structuredClone(d);b.submission.raw=b.submission.raw.slice(0,-2)+(b.submission.raw.endsWith('00')?'01':'00');assert.throws(()=>body(b));});
console.log(JSON.stringify({schema:'caw-direct-native-check/1',captureSha256:createHash('sha256').update(raw).digest('hex'),passed:checks.length,checks,parentNativeExists:parent.accountExists,childNativeExists:child.accountExists,gas:d.row.receipt.gasUsed,independentExecution:false,productionAccepted:false},null,2));
