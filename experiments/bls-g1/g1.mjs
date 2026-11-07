// Research-only public-key validation. No committee authority or signatures.
import {bls12_381} from '@noble/curves/bls12-381';

function reject() {
  throw Object.assign(new Error('BLS_G1_PUBLIC_KEY_REJECTED'), {code:'BLS_G1_PUBLIC_KEY_REJECTED'});
}

function decodeCanonical(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 48) reject();
  const captured = Buffer.from(bytes);
  try {
    const point = bls12_381.G1.ProjectivePoint.fromHex(captured);
    point.assertValidity(); // Includes curve membership and prime-order subgroup.
    if (!Buffer.from(point.toRawBytes(true)).equals(captured)) reject();
    return {point, captured};
  } catch { reject(); }
}

// Deserialization may admit the canonical identity; a public key may not.
export function inspectG1Encoding(bytes) {
  if (arguments.length !== 1) reject();
  const {point, captured} = decodeCanonical(bytes);
  return Object.freeze({
    canonicalHex:captured.toString('hex'),
    curveMembershipValidated:true,
    subgroupMembershipValidated:true,
    isInfinity:point.equals(bls12_381.G1.ProjectivePoint.ZERO),
    rootAuthenticated:false,
    signaturesVerified:false,
    updatesAccepted:false,
    productionAccepted:false,
  });
}

export function inspectG1PublicKey(bytes) {
  if (arguments.length !== 1) reject();
  const {point, captured} = decodeCanonical(bytes);
  if (point.equals(bls12_381.G1.ProjectivePoint.ZERO)) reject();
    return Object.freeze({
      schema:'caw-bls-g1-public-key-inspection/1',
      publicKeyHex:captured.toString('hex'),
      compressedEncodingCanonical:true,
      curveMembershipValidated:true,
      subgroupMembershipValidated:true,
      nonIdentity:true,
      committeeMembershipAuthenticated:false,
      aggregatePublicKeyRelationshipVerified:false,
      signaturesVerified:false,
      rootAuthenticated:false,
      networkAuthenticated:false,
      blsValidated:false,
      finalityVerified:false,
      updatesAccepted:false,
      productionAccepted:false,
    });
}
