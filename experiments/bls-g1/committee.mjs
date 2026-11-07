// Fixed minimal-32 research composition. No committee authority or signatures.
import {bls12_381} from '@noble/curves/bls12-381';
import {parseBoundedJson} from '../../public/bounded-json.mjs';
import {inspectPinnedMinimalCapellaBootstrap} from '../../reference/pinned-minimal-capella-bootstrap.mjs';
import {inspectG1PublicKey} from './g1.mjs';

function need(ok) {
  if (!ok) throw Object.assign(new Error('MINIMAL_COMMITTEE_KEYS_REJECTED'), {code:'MINIMAL_COMMITTEE_KEYS_REJECTED'});
}

function key(text) {
  need(typeof text === 'string' && /^0x[0-9a-f]{96}$/.test(text));
  const bytes = Buffer.from(text.slice(2), 'hex');
  inspectG1PublicKey(bytes);
  return bls12_381.G1.ProjectivePoint.fromHex(bytes);
}

export function inspectMinimalCommitteeKeys(committeeText) {
  need(arguments.length === 1 && typeof committeeText === 'string');
  const committee = parseBoundedJson(committeeText, 8192);
  need(committee !== null && typeof committee === 'object' && !Array.isArray(committee) &&
    Object.keys(committee).length === 2 && Object.hasOwn(committee, 'pubkeys') &&
    Object.hasOwn(committee, 'aggregate_pubkey'));
  need(Array.isArray(committee.pubkeys) && committee.pubkeys.length === 32);
  let sum = bls12_381.G1.ProjectivePoint.ZERO;
  // Multiplicity is intentional: sync-committee sampling can repeat validators.
  for (const member of committee.pubkeys) sum = sum.add(key(member));
  const supplied = key(committee.aggregate_pubkey);
  need(!sum.equals(bls12_381.G1.ProjectivePoint.ZERO) && sum.equals(supplied));
  return Object.freeze({
    schema:'caw-minimal-committee-key-inspection/1',
    committeeSize:32,
    aggregatePublicKey:committee.aggregate_pubkey,
    publicKeysValidated:true,
    aggregatePubkeyValidated:true,
    aggregatePublicKeyRelationshipVerified:true,
    committeeMembershipAuthenticated:false,
    signaturesVerified:false,
    rootAuthenticated:false,
    networkAuthenticated:false,
    blsValidated:false,
    consensusVerified:false,
    finalityVerified:false,
    updatesAccepted:false,
    productionAccepted:false,
  });
}

export function inspectPinnedMinimalBootstrapKeys(selection, metadataBytes, retainedSha256, bootstrapText) {
  need(arguments.length === 4);
  // Preserve the original profile/metadata/root/branch admission before key checks.
  const structural = inspectPinnedMinimalCapellaBootstrap(selection, metadataBytes, retainedSha256, bootstrapText);
  const bootstrap = parseBoundedJson(bootstrapText, 32768);
  const keys = inspectMinimalCommitteeKeys(JSON.stringify(bootstrap.committee));
  return Object.freeze({...structural, ...keys, schema:'caw-pinned-minimal-bootstrap-keys/1'});
}
