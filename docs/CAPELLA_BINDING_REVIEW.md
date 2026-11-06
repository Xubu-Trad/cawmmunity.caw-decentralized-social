# Capella payload-to-beacon structural binding

The [composed inspector](../reference/capella-header-binding.mjs) now checks the full structural path: execution-payload fields → SSZ payload root → beacon body root → caller-selected beacon header root. It reuses the separately tested [payload](CAPELLA_PAYLOAD_REVIEW.md), [branch](SHA256_BRANCH_REVIEW.md) and [beacon-header](BEACON_HEADER_REVIEW.md) inspectors.

The execution proof position is fixed to Capella's generalized index 25 (depth 4, subtree index 9), from the [pinned specification](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/capella/light-client/sync-protocol.md#constants). The proof cannot supply a separate body root or a different index. Its leaf must equal the root verified from the full payload header. The beacon body root must come from the header checked against the separately supplied selected beacon root.

## Evidence

All **39 tests across four related files** pass under the existing resource guard, including seven new composition cases. They cover the complete path, altered payload fields, substitution of another individually valid payload/root, altered/reversed proof nodes, a changed beacon body/root, injected proof-position/body-root/authority fields, unsupported profiles and incomplete branches. [Result and hashes](../evidence/CAPELLA_BINDING_RESULTS.json).

The [fixture](../evidence/CAPELLA_BINDING_FIXTURE.json) deliberately combines one official Capella payload-header vector with synthetic body siblings and a modified beacon header. Python hashlib independently constructs its synthetic body/header roots. It is **not** a real beacon block, a valid complete BeaconBlockBody, or an official combined light-client fixture. The official standalone component vectors remain in the combined run. No claim is made that these generated slot values belong to Capella on any deployed network.

```sh
python -I -B scripts/generate-capella-binding-fixture.py
node --test tests/sha256-branch.test.mjs tests/beacon-header-root.test.mjs tests/capella-payload-root.test.mjs tests/capella-header-binding.test.mjs
```

The generator rewrites only the synthetic fixture. The new test is in the package list; the historical full-suite total was not rerun or changed.

## Remaining trust boundary

Success means structuralBindingVerified, not executionPayloadValid or canonicalChainVerified. Execution block hash is a committed field, not independently recomputed execution validity. The input profile is an explicit Capella structural format; actual slot/network fork selection is not verified. Root authentication, execution, consensus, finality and production flags remain false.

Next obtain a corresponding external combined fixture and implement explicit supported-network/fork checks before any light-client composition. Bootstrap provenance, committee/BLS signatures, update ordering, stale/conflicting updates and finality remain separate missing pieces. No maintainer key, RPC vote or supplied root becomes authority. This component remains isolated from settlement and recovery adoption. Public test and production remain blocked; CI remains deferred.
