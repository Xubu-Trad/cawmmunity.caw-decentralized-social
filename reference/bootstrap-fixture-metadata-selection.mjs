// Fixed fixture metadata. No checkpoint authentication.
import {createHash} from 'node:crypto';
import {selectResearchBootstrap} from './bootstrap-profile-selection.mjs';

function reject() {
  const e=new Error('FIXTURE_METADATA_REJECTED');
  e.code='FIXTURE_METADATA_REJECTED';
  throw e;
}

const pattern=/^genesis_validators_root: '(0x[0-9a-f]{64})'\ntrusted_block_root: '(0x[0-9a-f]{64})'\nbootstrap_fork_digest: '(0x[0-9a-f]{8})'\nstore_fork_digest: '(0x[0-9a-f]{8})'\n$/;

export function inspectPinnedFixtureSelection(selection,metadataBytes,retainedSha256) {
  if (arguments.length!==3 ||
      !Buffer.isBuffer(metadataBytes) ||
      metadataBytes.length===0 ||
      metadataBytes.length>4096 ||
      typeof retainedSha256!=='string' ||
      !/^[0-9a-f]{64}$/.test(retainedSha256)) reject();

  const selected=selectResearchBootstrap(selection);
  const digest=createHash('sha256').update(metadataBytes).digest('hex');
  const fields=pattern.exec(metadataBytes.toString('utf8'));

  if (!fields ||
      fields[3]!==fields[4] ||
      digest!==retainedSha256 ||
      selection.anchor.sha256!==retainedSha256 ||
      fields[2]!==selected.selectedBeaconRoot) reject();

  return Object.freeze({
    schema:'caw-bootstrap-fixture-selection-result/1',
    selectedBeaconRoot:selected.selectedBeaconRoot,
    fixtureProfileSelected:true,
    metadataDigestMatchesRetainedPin:true,
    rootAuthenticated:false,
    independentAcquisitionVerified:false,
    forkScheduleVerified:false,
    blsValidated:false,
    updatesAccepted:false,
    finalityVerified:false,
    productionAccepted:false
  });
}
