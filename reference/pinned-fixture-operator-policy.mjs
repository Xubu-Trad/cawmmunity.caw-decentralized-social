// Research-only source-pinned fixture reference.
// Reviewed source is a trust assumption, not live network authority.
import {createHash} from 'node:crypto';
import {inspectOperatorGenesisReference} from
  './operator-genesis-reference.mjs';

const EXPECTED_FIXTURE_REFERENCE_SHA256 =
  '7dd1be57f1e1624a656cc3ef685945929e5d5bc610211ab8b101af7119f56982';

function reject() {
  const e=new Error('PINNED_FIXTURE_POLICY_REJECTED');
  e.code='PINNED_FIXTURE_POLICY_REJECTED';
  throw e;
}

export function inspectPinnedFixtureOperatorPolicy(
  selection,configBytes,metadataBytes,
  configPin,metadataPin,operatorBytes
) {
  // No seventh, caller-supplied replacement pin is accepted.
  if (arguments.length!==6 ||
      !Buffer.isBuffer(operatorBytes) ||
      createHash('sha256')
        .update(operatorBytes).digest('hex')!==
        EXPECTED_FIXTURE_REFERENCE_SHA256) reject();

  const result=inspectOperatorGenesisReference(
    selection,configBytes,metadataBytes,
    configPin,metadataPin,operatorBytes,
    EXPECTED_FIXTURE_REFERENCE_SHA256
  );

  return Object.freeze({
    ...result,
    operatorReferenceMatchesSourcePin:true,
    independentPinAuthorityEstablished:false
  });
}
