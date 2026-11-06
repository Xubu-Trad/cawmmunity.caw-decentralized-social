# Capella execution-payload header root

The [isolated inspector](../reference/capella-payload-root.mjs) hashes the fifteen-field Capella ExecutionPayloadHeader and compares it with a caller-selected SSZ root. This complements [beacon-header hashing](BEACON_HEADER_REVIEW.md); the two are not yet connected through an execution inclusion proof.

## Verification

Five official [Capella ExecutionPayloadHeader fixtures](https://github.com/ethereum/consensus-spec-tests/tree/bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908/tests/mainnet/capella/ssz_static/ExecutionPayloadHeader/ssz_random) match their independently supplied expected roots. Original YAML, normalized inputs, hashes and upstream MIT license are retained in [the fixture directory](../evidence/consensus-capella-payload). These are generated conformance fixtures, not live block observations.

Eleven focused tests pass on pinned Node24.20.0 under the existing resource guard. Besides five root matches, tests change each of the fifteen fields, reject wrong fixed lengths and oversized/odd extra data, verify extra-data length affects the commitment, reject uint64/uint256 overflow and unsafe numeric representations, reject later-fork fields/duplicate keys, and reject the wrong selected root. [Evidence](../evidence/CAPELLA_PAYLOAD_RESULTS.json).

The fee recipient occupies a padded 32-byte chunk; the bloom is merkleized from eight chunks. Extra data is a byte list with its length mixed into the root. Integers are canonical decimal strings encoded little-endian, preserving all uint256 bits. The container is padded to sixteen leaves. No dependency or supplied fixture executable is installed or run.

```sh
node --test tests/capella-payload-root.test.mjs
```

The file is in the package's explicit test list. No full-suite rerun or increase to its historical pass count is claimed.

## Limits

This is an explicitly Capella-only research component. It does not infer a fork from a slot, accept Deneb/Electra extensions, or claim current-mainnet support. Structural hashing does not establish valid gas economics, execution, transactions, withdrawals or account state. In particular, the block_hash field is committed as supplied; the corresponding execution block's RLP hash is not recomputed here. The transactions_root and withdrawals_root are consensus SSZ commitments, not substitutes for execution-layer trie checks.

The root remains caller-selected and unauthenticated. Beacon binding, execution, consensus, finality and production flags stay false. The module is isolated from settlement, recovery adoption and frontend authority. Next compose payload hashing with the correct execution inclusion branch and selected beacon header, using a genuinely corresponding fixture or clearly labeled synthetic composition. Independent bootstrap provenance, signatures/committees, fork selection and freshness still remain separate prerequisites. No production trust design is adopted; public test and production remain blocked, hosted CI deferred.
