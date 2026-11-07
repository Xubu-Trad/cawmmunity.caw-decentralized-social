// Research-only retained five-module fixture admission. No caller replacement pin.
// Manifest/checker/runtime trust are assumptions; no chain authority is established.
import {createHash} from 'node:crypto';
import {executeReviewedGraph, requireResearchRuntime} from './graph-engine.mjs';
const INVENTORY = [
  {
    "path": "reference/bootstrap-fixture-metadata-selection.mjs",
    "size": 1612,
    "sha256": "45fed5181c4945b7eb3b4f0344e078d4f1bd927a0243fc55ec9d3561fd85d791"
  },
  {
    "path": "reference/bootstrap-profile-selection.mjs",
    "size": 1476,
    "sha256": "35cc48473d793b88d24215a62a8153dd17fe4d64d5a5eb17e7239ef22be2d8ab"
  },
  {
    "path": "reference/fork-data-root.mjs",
    "size": 4500,
    "sha256": "fcae14704319a6da56eb170fbd8f7367e715e6afeb291a3a0d59ba29540db45d"
  },
  {
    "path": "reference/operator-genesis-reference.mjs",
    "size": 2668,
    "sha256": "b8d013e71d898acb26b43c22e436c5b24c753ec471437c52a2fbf8c2aa04f9fa"
  },
  {
    "path": "reference/pinned-fixture-operator-policy.mjs",
    "size": 1196,
    "sha256": "59741781544a672c7500a4480dad037d1262f79ebacbc84450056c3028015980"
  }
];
const EDGES = {
  "reference/pinned-fixture-operator-policy.mjs": {
    "./operator-genesis-reference.mjs": "reference/operator-genesis-reference.mjs",
    "node:crypto": "HOST:createHash"
  },
  "reference/operator-genesis-reference.mjs": {
    "./bootstrap-fixture-metadata-selection.mjs": "reference/bootstrap-fixture-metadata-selection.mjs",
    "./fork-data-root.mjs": "reference/fork-data-root.mjs",
    "node:crypto": "HOST:createHash"
  },
  "reference/bootstrap-fixture-metadata-selection.mjs": {
    "./bootstrap-profile-selection.mjs": "reference/bootstrap-profile-selection.mjs",
    "node:crypto": "HOST:createHash"
  },
  "reference/bootstrap-profile-selection.mjs": {},
  "reference/fork-data-root.mjs": {
    "node:crypto": "HOST:createHash"
  }
};
function reject() {
  throw Object.assign(new Error('CAPTURED_FIXTURE_REJECTED'), {code:'CAPTURED_FIXTURE_REJECTED'});
}
export function captureFixture(sources) {
  requireResearchRuntime();
  if (arguments.length !== 1 || !(sources instanceof Map) || sources.size !== INVENTORY.length ||
      [...sources.keys()].some(key => !INVENTORY.some(f => f.path === key))) reject();
  const captured = new Map();
  for (const file of INVENTORY) {
    const input = sources.get(file.path);
    if (!Buffer.isBuffer(input) || input.length !== file.size || input.length > 65536) reject();
    const bytes = Buffer.from(input);
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) reject();
    captured.set(file.path, bytes.toString('utf8'));
  }
  return Object.freeze({
    async run(...args) {
      if (args.length !== 6) reject();
      const fixtureResult = await executeReviewedGraph(captured, EDGES,
        'reference/pinned-fixture-operator-policy.mjs', 'inspectPinnedFixtureOperatorPolicy', args);
      return Object.freeze({
        schema:'caw-captured-fixture-execution/1',
        capturedLocalSourcesMatched:true,
        independentSoftwareAuthorityEstablished:false,
        hostileCodeSandbox:false,
        runtimeAuthenticated:false,
        rootAuthenticated:false,
        networkAuthenticated:false,
        blsValidated:false,
        finalityVerified:false,
        updatesAccepted:false,
        productionAccepted:false,
        fixtureResult:Object.freeze(fixtureResult),
      });
    },
  });
}
