import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Interface,version } from 'ethers';
import { candidateEvents } from './c007-claim-event-codec.mjs';
import { bindCandidateAdmission } from './c007-admission-binding.mjs';
assert.equal(version,'6.16.0');
const vectors=JSON.parse(fs.readFileSync(process.argv[2])).vectors, abi=new Interface(candidateEvents);
function log(v) {
 const x=abi.encodeEventLog(abi.getEvent('ResearchFeeAdmitted'),[v.recordId,v.payerAccount,v.epoch,v.nonce,v.fee,v.stakeRoot,v.totalStake,v.payerStake,v.selection.profile]);
 return {address:v.selection.emitter,topics:x.topics,data:x.data};
}
for(const v of vectors){const b=bindCandidateAdmission(log(v),v.selection);assert.equal(b.recordId,v.recordId);assert.equal(b.verification,'RESEARCH_RECORD_CONSISTENCY_ONLY');}
const original=vectors[0],rejected=[];
for(const [field,value] of Object.entries({payerAccount:'2',epoch:'1',nonce:'2',fee:'6',stakeRoot:'0x'+'aa'.repeat(32),totalStake:'11',recordId:'0x'+'bb'.repeat(32)})){
 const v=structuredClone(original);v[field]=value;
 assert.throws(()=>bindCandidateAdmission(log(v),v.selection),/RECORD_COMMITMENT/);rejected.push(field);
}
for(const [field,value] of Object.entries({chainId:'1',emitter:'0x'+'44'.repeat(20),profile:'0x'+'55'.repeat(32)})){
 const v=structuredClone(original);v.selection[field]=value;
 assert.throws(()=>bindCandidateAdmission(log(v),v.selection),/RECORD_COMMITMENT/);rejected.push(field);
}
assert.throws(()=>bindCandidateAdmission(log(original),{...original.selection,chainId:'031337'}),/UINT_ENCODING/);rejected.push('noncanonical chain encoding');
assert.throws(()=>bindCandidateAdmission(log(original),{...original.selection,chainId:(1n<<256n).toString()}),/UINT_RANGE/);rejected.push('chain out of range');
const weight=structuredClone(original);weight.payerStake='999';
assert.equal(bindCandidateAdmission(log(weight),weight.selection).recordId,original.recordId);
// Anyone can compute a self-consistent commitment. This is not a signature.
console.log(JSON.stringify({status:'RESEARCH_NOT_ADOPTED',pythonDigestMatches:vectors.length,rejected,
 payerStakeNotCommittedNeedsSeparateProof:true,zeroVectorIsByteConsistencyNotAdmission:true,
 limits:'Cross-language byte commitment and ABI layout only. Caller context is not authenticated; signatures, debit, receipt inclusion and stake membership remain unverified.'},null,2));
