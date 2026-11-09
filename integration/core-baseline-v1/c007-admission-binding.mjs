// Research commitment consistency only. Not action authorization or chain proof.
import { createHash } from 'node:crypto';
import { decodeCandidateLog } from './c007-claim-event-codec.mjs';
const MAX=(1n<<256n)-1n;
function uint(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length>78) throw Error('UINT_ENCODING');
  const n=BigInt(value);if(n>MAX)throw Error('UINT_RANGE');
  return Buffer.from(n.toString(16).padStart(64,'0'),'hex');
}
function hex(value,bytes) {
  if(typeof value!=='string'||value.length!==2+bytes*2||!/^0x[0-9a-fA-F]+$/.test(value))throw Error('HEX_ENCODING');
  return Buffer.from(value.slice(2),'hex');
}
export function bindCandidateAdmission(log, selection) {
  if (!selection || Object.keys(selection).sort().join(',')!=='chainId,emitter,profile') throw Error('SELECTION');
  const chain=uint(selection.chainId), contract=hex(selection.emitter,20), profile=hex(selection.profile,32);
  const row=decodeCandidateLog(log,selection.emitter);
  if(row.kind!=='admission')throw Error('NOT_ADMISSION');
  if(!hex(row.profile,32).equals(profile))throw Error('PROFILE_SELECTION');
  const preimage=Buffer.concat([Buffer.from('CAW_C007_CLAIM_RECORD_RESEARCH_V1\0'),chain,contract,profile,
    uint(row.payerAccount),uint(row.epoch),uint(row.nonce),uint(row.fee),hex(row.stakeRoot,32),uint(row.totalStake)]);
  const calculated='0x'+createHash('sha256').update(preimage).digest('hex');
  if(calculated!==row.recordId)throw Error('RECORD_COMMITMENT');
  return Object.freeze({...row,chainId:selection.chainId,verification:'RESEARCH_RECORD_CONSISTENCY_ONLY'});
}
