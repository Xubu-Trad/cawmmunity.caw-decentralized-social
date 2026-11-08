// Explicit SSZ roots only. No network, fork scheduling or signer authority.
import {createHash} from 'node:crypto';
const bytes=(v,n)=>{
  if(typeof v!=='string'||!new RegExp(`^0x[0-9a-f]{${n*2}}$`).test(v))throw Error('SIGNING_DOMAIN_INPUT');
  return Buffer.from(v.slice(2),'hex');
};
const hash=b=>createHash('sha256').update(b).digest();
export function deriveSigningContext(domainType,forkVersion,genesisValidatorsRoot,objectRoot){
  if(arguments.length!==4)throw Error('SIGNING_DOMAIN_ARGUMENTS');
  const type=bytes(domainType,4),version=bytes(forkVersion,4),genesis=bytes(genesisValidatorsRoot,32),object=bytes(objectRoot,32);
  const forkDataRoot=hash(Buffer.concat([version,Buffer.alloc(28),genesis]));
  const domain=Buffer.concat([type,forkDataRoot.subarray(0,28)]);
  const signingRoot=hash(Buffer.concat([object,domain]));
  return Object.freeze({schema:'caw-signing-context-research/1',forkDataRoot:'0x'+forkDataRoot.toString('hex'),domain:'0x'+domain.toString('hex'),signingRoot:'0x'+signingRoot.toString('hex'),
    objectRootDerived:false,networkAuthenticated:false,forkScheduleVerified:false,signatureVerified:false,participantSetAuthenticated:false,updatesAccepted:false,productionAccepted:false});
}
