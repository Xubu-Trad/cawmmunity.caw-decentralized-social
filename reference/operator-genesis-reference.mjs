// Research-only comparison. Caller pin is not authenticated authority.
import {createHash} from 'node:crypto';
import {inspectPinnedFixtureSelection} from
  './bootstrap-fixture-metadata-selection.mjs';
import {inspectFixtureForkData} from
  './fork-data-root.mjs';

function reject() {
  const e=new Error('OPERATOR_REFERENCE_REJECTED');
  e.code='OPERATOR_REFERENCE_REJECTED';
  throw e;
}

const sha=b=>createHash('sha256').update(b).digest('hex');
const pinValid=p=>typeof p==='string' &&
  /^[0-9a-f]{64}$/.test(p);

function readReference(bytes,pin) {
  if (!Buffer.isBuffer(bytes) ||
      bytes.length===0 || bytes.length>1024 ||
      !pinValid(pin) || sha(bytes)!==pin) reject();

  for (const b of bytes) if (b>127) reject();

  let record;
  const text=bytes.toString('ascii');
  try {
    record=JSON.parse(text);
  } catch {
    reject();
  }

  const keys=[
    'schema','network','genesisValidatorsRoot',
    'sourceClass','authority'
  ];

  if (!record || typeof record!=='object' ||
      Array.isArray(record) ||
      Object.keys(record).length!==keys.length ||
      !keys.every(k=>Object.hasOwn(record,k)) ||
      text!==JSON.stringify(record,null,2)+'\n') reject();

  if (
    record.schema!=='caw-operator-genesis-reference/1' ||
    record.network!=='ethereum-minimal-capella-fixture' ||
    record.sourceClass!=='retained-minimal-capella-fixture' ||
    record.authority!=='research-only' ||
    typeof record.genesisValidatorsRoot!=='string' ||
    !/^0x[0-9a-f]{64}$/.test(
      record.genesisValidatorsRoot
    )
  ) reject();

  return record;
}

export function inspectOperatorGenesisReference(
  selection,configBytes,metadataBytes,
  configPin,metadataPin,operatorBytes,operatorPin
) {
  if (arguments.length!==7) reject();

  const record=readReference(operatorBytes,operatorPin);

  const selected=inspectPinnedFixtureSelection(
    selection,metadataBytes,metadataPin
  );

  const fork=inspectFixtureForkData(
    configBytes,metadataBytes,configPin,metadataPin
  );

  if (record.network!==selection.network ||
      record.genesisValidatorsRoot!==
        fork.genesisValidatorsRoot) reject();

  return Object.freeze({
    schema:'caw-operator-genesis-comparison/1',
    selectedBeaconRoot:selected.selectedBeaconRoot,
    genesisValidatorsRoot:fork.genesisValidatorsRoot,
    operatorReferenceDigestMatchesProvidedPin:true,
    fullGenesisRootMatchesOperatorRecord:true,
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
