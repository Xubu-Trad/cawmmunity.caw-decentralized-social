// Fixed research fixture reference. Not live network authority.
import {inspectPinnedFixtureSelection} from
  './bootstrap-fixture-metadata-selection.mjs';
import {inspectFixtureForkData} from
  './fork-data-root.mjs';

// Retained from the published minimal Capella fixture.
// This constant is not read from caller-supplied metadata.
const RETAINED_GENESIS_ROOT =
  '0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b';

function reject() {
  const e=new Error('RETAINED_GENESIS_ROOT_REJECTED');
  e.code='RETAINED_GENESIS_ROOT_REJECTED';
  throw e;
}

export function inspectRetainedFixtureGenesisBinding(
  selection,configBytes,metadataBytes,configPin,metadataPin
) {
  if (arguments.length!==5) reject();

  const selected=inspectPinnedFixtureSelection(
    selection,metadataBytes,metadataPin
  );

  const fork=inspectFixtureForkData(
    configBytes,metadataBytes,configPin,metadataPin
  );

  if (fork.genesisValidatorsRoot!==RETAINED_GENESIS_ROOT) {
    reject();
  }

  return Object.freeze({
    schema:'caw-retained-fixture-genesis-binding/1',
    selectedBeaconRoot:selected.selectedBeaconRoot,
    genesisValidatorsRoot:fork.genesisValidatorsRoot,
    genesisRootMatchesRetainedFixtureReference:true,
    rootAuthenticated:false,
    networkAuthenticated:false,
    independentAcquisitionVerified:false,
    forkScheduleVerified:false,
    blsValidated:false,
    finalityVerified:false,
    updatesAccepted:false,
    productionAccepted:false
  });
}
