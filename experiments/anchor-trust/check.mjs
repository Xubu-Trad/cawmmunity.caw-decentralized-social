import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectFirstTransactionAnchor} from '../../reference/first-transaction-anchor.mjs';
const bytes=readFileSync(new URL('../paid-signed-withdrawal-acquisition/joint-capture.json',import.meta.url));
const fixture=JSON.parse(bytes);
function sample(branch){
 const b=fixture.branches[branch],c=b.captures[12],parent=b.captures[11].header;
 return {schema:'caw-first-transaction-anchor/1',parentHeader:parent,header:c.header,rawTransactions:c.raw_transactions,selection:{profile:'london-16',parentHash:parent.hash,blockHash:c.header.hash,chainId:'0x7a69',transactionIndex:'0x0',transactionHash:b.history.blocks[12].transactions[0].receipt.transactionHash}};
}
const left=sample('left'),right=sample('right');let checks=0;
assert.equal(left.parentHeader.hash,right.parentHeader.hash);assert.equal(left.header.number,right.header.number);assert.notEqual(left.header.hash,right.header.hash);checks++;
const observations=[];
for(const [branch,input] of [['left',left],['right',right]]){
 const result=inspectFirstTransactionAnchor(JSON.stringify(input));
 assert(result.parentLinkVerified&&result.bodyCommitmentVerified&&result.senderRecovered);
 for(const key of ['parentStateAuthenticated','consensusVerified','finalityVerified','productionAccepted'])assert.equal(result[key],false);
 observations.push({branch,parentHash:result.parentHash,blockHash:result.blockHash,transactionHash:result.transaction.hash,consensusVerified:result.consensusVerified,finalityVerified:result.finalityVerified});checks++;
}
for(const [input,other] of [[left,right],[right,left]]){
 const mixed=structuredClone(input);mixed.selection.blockHash=other.header.hash;
 assert.throws(()=>inspectFirstTransactionAnchor(JSON.stringify(mixed)));checks++;
}
// An extra claimed finality flag is not an accepted extension of the input schema.
const forged=structuredClone(right);forged.selection.finalityVerified=true;
assert.throws(()=>inspectFirstTransactionAnchor(JSON.stringify(forged)));checks++;
console.log(JSON.stringify({schema:'caw-anchor-trust-boundary/1',checks,passed:checks,fixtureSha256:createHash('sha256').update(bytes).digest('hex'),observations,scope:'retained local branch capture; no fresh acquisition or consensus verification',productionAccepted:false},null,2));
