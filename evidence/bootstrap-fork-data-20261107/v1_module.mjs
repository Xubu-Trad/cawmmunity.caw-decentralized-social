// Fixture-only SSZ ForkData consistency. No network or checkpoint authentication.
import {createHash} from 'node:crypto';

function reject() {
  const e = new Error('FIXTURE_FORK_DATA_REJECTED');
  e.code = 'FIXTURE_FORK_DATA_REJECTED';
  throw e;
}

const isDigest = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const sha256 = b => createHash('sha256').update(b).digest('hex');

function ascii(bytes, cap) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > cap) reject();
  for (const b of bytes) if (b > 127) reject();
  return bytes.toString('ascii');
}

function readConfig(text, key, expression) {
  const found = text.split('\n').filter(line => line.startsWith(`${key}:`));
  if (found.length !== 1) reject();
  const match = expression.exec(found[0]);
  if (!match) reject();
  return match[1];
}

const metadataPattern = /^genesis_validators_root: '(0x[0-9a-f]{64})'\ntrusted_block_root: '(0x[0-9a-f]{64})'\nbootstrap_fork_digest: '(0x[0-9a-f]{8})'\nstore_fork_digest: '(0x[0-9a-f]{8})'\n$/;

export function inspectFixtureForkData(configBytes, metadataBytes, configPin, metadataPin) {
  if (arguments.length !== 4 || !isDigest(configPin) || !isDigest(metadataPin)) reject();
  const config = ascii(configBytes, 65536);
  const metadata = ascii(metadataBytes, 4096);
  if (sha256(configBytes) !== configPin || sha256(metadataBytes) !== metadataPin) reject();
  const preset = readConfig(config, 'PRESET_BASE', /^PRESET_BASE: '(minimal)'$/);
  const capellaEpoch = readConfig(config, 'CAPELLA_FORK_EPOCH', /^CAPELLA_FORK_EPOCH: (0)$/);
  const forkVersion = readConfig(config, 'CAPELLA_FORK_VERSION', /^CAPELLA_FORK_VERSION: (0x[0-9a-f]{8})$/);
  const match = metadataPattern.exec(metadata);
  if (!match) reject();
  const [, genesisValidatorsRoot, , bootstrapForkDigest, storeForkDigest] = match;
  const forkDataRoot = sha256(Buffer.concat([
    Buffer.from(forkVersion.slice(2), 'hex'),
    Buffer.alloc(28),
    Buffer.from(genesisValidatorsRoot.slice(2), 'hex'),
  ]));
  const computedDigest = `0x${forkDataRoot.slice(0, 8)}`;
  if (computedDigest !== bootstrapForkDigest || computedDigest !== storeForkDigest) reject();
  return Object.freeze({
    schema: 'caw-fixture-fork-data-consistency/1',
    preset,
    capellaEpoch,
    forkVersion,
    genesisValidatorsRoot,
    forkDataRoot: `0x${forkDataRoot}`,
    forkDigest: computedDigest,
    fixtureMetadataConsistent: true,
    rootAuthenticated: false,
    networkAuthenticated: false,
    forkScheduleVerified: false,
    blsValidated: false,
    signaturesVerified: false,
    finalityVerified: false,
    updatesAccepted: false,
    productionAccepted: false,
  });
}
