# Beacon header roots against official fixtures

The [header inspector](../reference/beacon-header-root.mjs) computes the five-field BeaconBlockHeader SSZ container root and compares it with a caller-selected root. It also constructs the body_root inclusion branch (field index 4, depth 3) and checks it through our SHA-256 branch module. This is structural verification, not a light client or authentication of the selected root.

## Independent expected roots

All five Capella `BeaconBlockHeader/ssz_random` cases from [ethereum/consensus-spec-tests at bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908](https://github.com/ethereum/consensus-spec-tests/tree/bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908/tests/mainnet/capella/ssz_static/BeaconBlockHeader/ssz_random) match their published expected roots. Original value/root YAML files, SHA-256 provenance, normalized JSON and the upstream MIT license are retained in [the fixture directory](../evidence/consensus-beacon-header). They are externally maintained test vectors, not evidence of a live mainnet observation. The `mainnet` directory names the fixture preset.

The discovery API's recursive tree was truncated; we make no exhaustive-vector claim. The five exact paths were fetched separately at the pinned commit. Official single-Merkle-proof files were also inspected but supply no standalone expected root; they were not counted as complete conformance tests. No supplied test code, Snappy decoder or dependency installer ran.

Ten focused tests pass on Node24.20.0 under the existing guard: five official root matches, changes to every header field, wrong selected root and branch position, uint64 overflow/noncanonical representation, unknown authority fields/duplicate keys, and a valid replacement header/root that stays unauthenticated. [Results and hashes](../evidence/BEACON_HEADER_RESULTS.json).

```sh
node --test tests/beacon-header-root.test.mjs
```

The new file is in the package test list. Historical full-suite totals are unchanged; this turn did not rerun the full suite. Unsigned 64-bit values must be canonical decimal strings, avoiding JavaScript Number precision loss. SSZ values use little-endian chunks and the five-field container is padded to eight leaves. The selected root and exact schema remain required.

## Boundaries and next step

The returned body-root branch is locally derived, not an independently supplied branch vector; its root is checked against each external expected header root. This gives external expected-root coverage to that branch path, not conformance for every generalized index or consensus container.

No execution payload header/root has been computed or linked yet. Next implement an explicitly bounded fork-specific payload-header root and execution branch, tested against independent fixtures, before composing it with this header result. Do not treat a caller-supplied payload root as proof that the execution fields were hashed correctly.

Bootstrap trust, committee/BLS verification, network/fork selection, update ordering, finality and freshness remain absent. All authentication/consensus/finality/production flags remain false. The module is isolated from recovery adoption and settlement; no production trust model or policy is selected. Public test and production remain blocked, and hosted CI remains deferred.
