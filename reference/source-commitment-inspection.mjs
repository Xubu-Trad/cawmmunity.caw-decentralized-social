// Research byte inspection only. No source execution or trust-source selection.
import {createHash} from 'node:crypto';

function reject() {
  const error = new Error('SOURCE_COMMITMENT_REJECTED');
  error.code = 'SOURCE_COMMITMENT_REJECTED';
  throw error;
}

export function inspectSourceCommitment(sourceBytes, retainedSha256) {
  if (arguments.length !== 2 || !Buffer.isBuffer(sourceBytes) ||
      sourceBytes.length === 0 || sourceBytes.length > 65536 ||
      typeof retainedSha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(retainedSha256)) reject();
  const digest = createHash('sha256').update(sourceBytes).digest('hex');
  if (digest !== retainedSha256) reject();
  return Object.freeze({
    schema: 'caw-source-commitment-inspection/1',
    sha256: digest,
    size: sourceBytes.length,
    sourceBytesMatchRetainedCommitment: true,
    commitmentAuthorityEstablished: false,
    dependencyClosureVerified: false,
    executedBytesBound: false,
    rootAuthenticated: false,
    networkAuthenticated: false,
    independentAcquisitionVerified: false,
    forkScheduleVerified: false,
    blsValidated: false,
    signaturesVerified: false,
    finalityVerified: false,
    updatesAccepted: false,
    productionAccepted: false,
  });
}
