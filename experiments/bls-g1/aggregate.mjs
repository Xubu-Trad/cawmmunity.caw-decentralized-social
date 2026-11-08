// Research equation only: supplied keys are not authenticated participants.
import {bls12_381} from '@noble/curves/bls12-381';
import {inspectG1PublicKey} from './g1.mjs';
import {inspectPopSignature} from './signature.mjs';
function reject() {
  throw Object.assign(new Error('BLS_AGGREGATE_EQUATION_REJECTED'),
    {code:'BLS_AGGREGATE_EQUATION_REJECTED'});
}
export function inspectPopAggregateEquation(publicKeys, message, signature) {
  if (arguments.length !== 3 || !Array.isArray(publicKeys) ||
      publicKeys.length < 1 || publicKeys.length > 32) reject();
  try {
    let aggregate = bls12_381.G1.ProjectivePoint.ZERO;
    // Preserve multiplicity. Deduplication changes the supplied equation.
    for (const bytes of publicKeys) {
      const key = inspectG1PublicKey(bytes);
      aggregate = aggregate.add(bls12_381.G1.ProjectivePoint.fromHex(key.publicKeyHex));
    }
    if (aggregate.equals(bls12_381.G1.ProjectivePoint.ZERO)) reject();
    const checked = inspectPopSignature(Buffer.from(aggregate.toRawBytes(true)), message, signature);
    return Object.freeze({schema:'caw-bls-pop-aggregate-equation/1',
      ciphersuite:checked.ciphersuite,suppliedKeyCount:publicKeys.length,
      aggregateEquationVerified:true,publicKeysValidated:true,
      participantSetAuthenticated:false,committeeMembershipAuthenticated:false,
      proofOfPossessionVerified:false,signerAuthorizationVerified:false,
      ethereumSigningDomainValidated:false,signingRootAuthenticated:false,
      rootAuthenticated:false,networkAuthenticated:false,blsValidated:false,
      consensusVerified:false,finalityVerified:false,updatesAccepted:false,
      productionAccepted:false});
  } catch { reject(); }
}
