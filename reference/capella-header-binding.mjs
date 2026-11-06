// Structural Capella payload -> body -> selected beacon header composition.
import { parseBoundedJson } from '../public/bounded-json.mjs';
import { inspectCapellaPayloadHeader } from './capella-payload-root.mjs';
import { inspectBeaconHeader } from './beacon-header-root.mjs';
import { inspectSha256Branch } from './sha256-branch.mjs';
function need(ok) { if (!ok) { const e = new Error('Capella binding schema rejected'); e.code = 'CAPELLA_BINDING_SCHEMA'; throw e; } }
export function inspectCapellaHeaderBinding(text, selectedBeaconRoot) {
  need(arguments.length === 2 && typeof text === 'string');
  const p = parseBoundedJson(text, 16384);
  const fields = ['schema', 'profile', 'beacon', 'execution', 'executionRoot', 'executionBranch'];
  need(p !== null && typeof p === 'object' && !Array.isArray(p)
    && Object.keys(p).length === fields.length && fields.every(k => Object.hasOwn(p, k)));
  need(p.schema === 'caw-capella-header-binding/1' && p.profile === 'capella-structural-only');
  const beacon = inspectBeaconHeader(JSON.stringify(p.beacon), selectedBeaconRoot);
  const execution = inspectCapellaPayloadHeader(JSON.stringify(p.execution), p.executionRoot);
  // Capella execution_payload gindex=25: depth=4, subtree index=9.
  // Caller cannot select another index or substitute a separate body root.
  inspectSha256Branch(JSON.stringify({ schema: 'caw-sha256-branch/1', leaf: execution.payloadRoot,
    branch: p.executionBranch, depth: 4, index: 9, root: beacon.bodyRoot }));
  return Object.freeze({ schema: 'caw-capella-header-binding-result/1',
    structuralBindingVerified: true, selectedBeaconRoot: beacon.headerRoot,
    payloadRoot: execution.payloadRoot, executionBlockHash: execution.executionBlockHash,
    rootAuthenticated: false, forkScheduleVerified: false, executionVerified: false,
    consensusVerified: false, finalityVerified: false, productionAccepted: false });
}
