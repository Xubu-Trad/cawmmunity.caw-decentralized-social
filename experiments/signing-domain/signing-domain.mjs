// Explicit SSZ roots only. No network, fork scheduling or signer authority.
import {createHash} from 'node:crypto';
const bytes=(v,n)=>{
  if(typeof v!=='string'||!new RegExp(`^0x[0-9a-f]{${n*2}}$`).test(v))throw Error('SIGNING_DOMAIN_INPUT');
  return Buffer.from(v.slice(2),'hex');
};
const hash=b=>createHash('sha256').update(b).digest();
export function deriveForkDataRoot(forkVersion,genesisValidatorsRoot){
  if(arguments.length!==2)throw Error('SIGNING_DOMAIN_ARGUMENTS');
  return '0x'+hash(Buffer.concat([bytes(forkVersion,4),Buffer.alloc(28),bytes(genesisValidatorsRoot,32)])).toString('hex');
}
export function deriveSigningRoot(objectRoot,domain){
  if(arguments.length!==2)throw Error('SIGNING_DOMAIN_ARGUMENTS');
  return '0x'+hash(Buffer.concat([bytes(objectRoot,32),bytes(domain,32)])).toString('hex');
}
export function deriveSigningContext(domainType,forkVersion,genesisValidatorsRoot,objectRoot){
  if(arguments.length!==4)throw Error('SIGNING_DOMAIN_ARGUMENTS');
  const type=bytes(domainType,4);
  const forkDataRoot=Buffer.from(deriveForkDataRoot(forkVersion,genesisValidatorsRoot).slice(2),'hex');
  const domain=Buffer.concat([type,forkDataRoot.subarray(0,28)]);
  const signingRoot=deriveSigningRoot(objectRoot,'0x'+domain.toString('hex'));
  return Object.freeze({schema:'caw-signing-context-research/1',forkDataRoot:'0x'+forkDataRoot.toString('hex'),domain:'0x'+domain.toString('hex'),signingRoot,
    objectRootDerived:false,networkAuthenticated:false,forkScheduleVerified:false,signatureVerified:false,participantSetAuthenticated:false,updatesAccepted:false,productionAccepted:false});
}
