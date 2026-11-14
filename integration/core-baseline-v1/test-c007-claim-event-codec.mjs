import assert from 'node:assert/strict';
import { Interface, version } from 'ethers';
import { candidateEvents, decodeCandidateLog } from './c007-claim-event-codec.mjs';
assert.equal(version,'6.16.0');
const abi = new Interface(candidateEvents), emitter='0x'+'22'.repeat(20);
const key='0x'+'ab'.repeat(32), root='0x'+'cd'.repeat(32), profile='0x'+'ef'.repeat(32);
const values=[key,1n,2n,3n,5n,root,10n,2n,profile];
function event(name,args) { const x=abi.encodeEventLog(abi.getEvent(name),args); return {address:emitter,topics:x.topics,data:x.data}; }
const admission=event('ResearchFeeAdmitted',values), claim=event('ResearchFeeClaimed',[key,3n,4n]);
assert.deepEqual(decodeCandidateLog(admission,emitter),{verification:'UNVERIFIED_EVENT_LAYOUT_ONLY',emitter,recordId:key,kind:'admission',payerAccount:'1',epoch:'2',nonce:'3',fee:'5',stakeRoot:root,totalStake:'10',payerStake:'2',profile});
assert.deepEqual(decodeCandidateLog(claim,emitter),{verification:'UNVERIFIED_EVENT_LAYOUT_ONLY',emitter,recordId:key,kind:'claim',accountId:'3',amount:'4'});
const max=(1n<<256n)-1n;
assert.equal(decodeCandidateLog(event('ResearchFeeClaimed',[key,max,max]),emitter).amount,max.toString());
assert.equal(decodeCandidateLog(event('ResearchFeeClaimed',[key,3n,0n]),emitter).amount,'0');
const rejected=[];
for (const [name,mutate] of [
  ['wrong emitter',x=>x.address='0x'+'44'.repeat(20)],
  ['unknown topic',x=>x.topics[0]='0x'+'00'.repeat(32)],
  ['missing topic',x=>x.topics.pop()],
  ['extra topic',x=>x.topics.push(key)],
  ['short indexed word',x=>x.topics[1]='0x01'],
  ['nonhex topic',x=>x.topics[2]='0x'+'zz'.repeat(32)],
  ['short data',x=>x.data=x.data.slice(0,-2)],
  ['trailing data',x=>x.data+='00'],
  ['nonhex data',x=>x.data='0xzz'+x.data.slice(4)],
  ['extra field',x=>x.verified=true]
]) { const x=structuredClone(admission);mutate(x);assert.throws(()=>decodeCandidateLog(x,emitter));rejected.push(name); }
// Correctly encoded data are still untrusted. A changed fee must NOT become
// evidence of a valid debit just because the codec can read its bytes.
const altered=[...values];altered[4]=999n;
const decoded=decodeCandidateLog(event('ResearchFeeAdmitted',altered),emitter);
assert.equal(decoded.fee,'999');assert.equal(decoded.verification,'UNVERIFIED_EVENT_LAYOUT_ONLY');
console.log(JSON.stringify({status:'DRAFT_EVENT_LAYOUT_NOT_ADOPTED',ethersVersion:version,
  positiveCases:4,rejected,unverifiedFeeMutationRemainsUnverified:true,
  topics:admission.topics.slice(0,1).concat(claim.topics[0]),
  limits:'ABI encoder comparison only. No emitted contract events, receipt proof, signature, debit, record commitment or chain authentication.'},null,2));
