// Reproduce this retained fixture only; no live trust or update acceptance.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectPinnedMinimalBootstrapKeys} from './committee.mjs';
const read = p => readFileSync(new URL('../../' + p, import.meta.url));
const bytes = read('evidence/consensus-capella-bootstrap/binding.json');
if (createHash('sha256').update(bytes).digest('hex') !==
    '96f107e5a94bd2a9bfa47f84ff257cbd18995ae8947440cac91804823236c6f8') {
  throw new Error('RETAINED_BINDING_DIGEST_MISMATCH');
}
const fixture = JSON.parse(bytes);
const pin = 'bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29';
const result = inspectPinnedMinimalBootstrapKeys({
  schema:'caw-bootstrap-selection/1', network:'ethereum-minimal-capella-fixture',
  profile:'minimal-capella-32-structural-only', selectedBeaconRoot:fixture.selectedBeaconRoot,
  anchor:{source:'externally-retained-fixture-metadata',beaconRoot:fixture.selectedBeaconRoot,sha256:pin},
}, read('evidence/consensus-capella-bootstrap/meta.yaml'), pin, JSON.stringify({
  schema:'caw-minimal-capella-bootstrap/1', profile:'minimal-capella-32-structural-only',
  header:fixture.input, committee:fixture.committee, committeeBranch:fixture.committeeBranch,
}));
console.log(JSON.stringify(result, null, 2));
