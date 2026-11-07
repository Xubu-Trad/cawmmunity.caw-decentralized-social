// Research-only composition. Neither metadata nor inclusion authenticates a live root.
import { inspectPinnedFixtureSelection } from './bootstrap-fixture-metadata-selection.mjs';
import { inspectMinimalCapellaBootstrap } from './minimal-capella-bootstrap.mjs';

function need(ok) {
  if (!ok) {
    const e = new Error('PINNED_MINIMAL_BOOTSTRAP_REJECTED');
    e.code = 'PINNED_MINIMAL_BOOTSTRAP_REJECTED';
    throw e;
  }
}

export function inspectPinnedMinimalCapellaBootstrap(selection, metadataBytes, retainedSha256, bootstrapText) {
  need(arguments.length === 4 && typeof bootstrapText === 'string');
  const selected = inspectPinnedFixtureSelection(selection, metadataBytes, retainedSha256);
  const committee = inspectMinimalCapellaBootstrap(bootstrapText, selected.selectedBeaconRoot);
  need(selected.fixtureProfileSelected === true && selected.metadataDigestMatchesRetainedPin === true);
  need(committee.structuralBindingVerified === true && committee.committeeInclusionVerified === true);
  need(committee.selectedBeaconRoot === selected.selectedBeaconRoot);
  for (const flag of ['rootAuthenticated', 'independentAcquisitionVerified', 'blsValidated', 'updatesAccepted', 'finalityVerified', 'productionAccepted']) {
    need(selected[flag] === false);
  }
  for (const flag of ['publicKeysValidated', 'aggregatePubkeyValidated', 'signaturesVerified', 'rootAuthenticated', 'forkScheduleVerified', 'consensusVerified', 'finalityVerified', 'productionAccepted']) {
    need(committee[flag] === false);
  }
  return Object.freeze({
    schema: 'caw-pinned-minimal-capella-bootstrap-result/1',
    selectedBeaconRoot: selected.selectedBeaconRoot,
    committeeRoot: committee.committeeRoot,
    fixtureProfileSelected: true,
    metadataDigestMatchesRetainedPin: true,
    structuralBindingVerified: true,
    committeeInclusionVerified: true,
    rootAuthenticated: false,
    independentAcquisitionVerified: false,
    publicKeysValidated: false,
    aggregatePubkeyValidated: false,
    signaturesVerified: false,
    forkScheduleVerified: false,
    consensusVerified: false,
    finalityVerified: false,
    updatesAccepted: false,
    productionAccepted: false
  });
}
