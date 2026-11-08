// Single-signature research only. Supplied keys/message are not trusted anchors.
import {bls12_381} from '@noble/curves/bls12-381';
import {inspectG1PublicKey} from './g1.mjs';
const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
function reject() {
  throw Object.assign(new Error('BLS_POP_SIGNATURE_REJECTED'), {code:'BLS_POP_SIGNATURE_REJECTED'});
}
function decodeG2(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== 96) reject();
  const copy = Buffer.from(bytes);
  try {
    const point = bls12_381.G2.ProjectivePoint.fromHex(copy);
    point.assertValidity();
    if (!Buffer.from(point.toRawBytes(true)).equals(copy)) reject();
    return point;
  } catch { reject(); }
}
export function inspectG2Encoding(bytes) {
  if (arguments.length !== 1) reject();
  const point = decodeG2(bytes);
  return Object.freeze({canonicalEncodingValidated:true,curveMembershipValidated:true,
    subgroupMembershipValidated:true,isInfinity:point.equals(bls12_381.G2.ProjectivePoint.ZERO),
    signatureVerified:false,rootAuthenticated:false,productionAccepted:false});
}
export function inspectPopSignature(publicKey, message, signature) {
  if (arguments.length !== 3 || !Buffer.isBuffer(message) || message.length !== 32) reject();
  try {
    const key = inspectG1PublicKey(publicKey);
    const point = decodeG2(signature);
    if (point.equals(bls12_381.G2.ProjectivePoint.ZERO)) reject();
    const publicPoint = bls12_381.G1.ProjectivePoint.fromHex(key.publicKeyHex);
    if (!bls12_381.verify(point, Buffer.from(message), publicPoint, {DST})) reject();
    return Object.freeze({schema:'caw-bls-pop-single-signature/1',ciphersuite:DST,
      signatureVerifiedUnderSuppliedKey:true,ethereumSigningDomainValidated:false,
      signingRootAuthenticated:false,committeeMembershipAuthenticated:false,
      proofOfPossessionVerified:false,rootAuthenticated:false,networkAuthenticated:false,
      blsValidated:false,consensusVerified:false,finalityVerified:false,
      updatesAccepted:false,productionAccepted:false});
  } catch { reject(); }
}
