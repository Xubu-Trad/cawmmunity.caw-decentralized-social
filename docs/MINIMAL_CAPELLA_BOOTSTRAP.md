# Minimal Capella bootstrap committee inclusion

The research verifier now checks that the committee supplied by the preserved official bootstrap fixture is included in its beacon state. This extends the [external header-binding experiment](EXTERNAL_CAPELLA_BINDING.md), not a live light client.

## Exact scope

The fixed profile is `minimal-capella-32-structural-only`. The decoder exposes the original 32 public keys, aggregate public key and five branch nodes from the pinned minimal-preset fixture. Each 48-byte key is SSZ-merkleized, followed by the fixed vector and committee container. The verifier uses current-committee generalized index 54 (depth 5, index 22), as specified in the [pinned pre-Electra protocol](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/altair/light-client/sync-protocol.md).

The resulting committee root must reach the state root in a beacon header already bound to the separately supplied fixture metadata root. Neither the proof index nor a trust claim can be supplied as an override. Unsupported profiles and extra fields are rejected.

**47 focused Node checks across five files and four Python decoder checks pass.** The six new tests cover official inclusion, changed member/aggregate bytes, wrong committee size/key encoding, altered branch, changed state root and unsupported profile/extra claims. These are scoped checks; the historical full suite was not rerun. [Evidence and source hashes](../evidence/MINIMAL_CAPELLA_BOOTSTRAP_RESULTS.json).

```sh
python -I -B scripts/decode-capella-bootstrap-fixture.py
python -I -B tests/test_bootstrap_fixture_decoder.py
node --test tests/sha256-branch.test.mjs tests/beacon-header-root.test.mjs tests/capella-payload-root.test.mjs tests/capella-header-binding.test.mjs tests/minimal-capella-bootstrap.test.mjs
```

## What this does not prove

An inclusion proof commits bytes; it does not validate BLS points, subgroups, the aggregate key's mathematical relationship to the members, or signatures. Those result fields remain false. The fixture's metadata root is a test expectation, not an authenticated live checkpoint. Mainnet's 512-member committee, actual fork selection, light-client updates, finality, freshness and independent acquisition are not implemented by this module. It does not adopt an authority or change settlement permissions.

Next: specify and test the supported-network/bootstrap policy, independently sourced trust-anchor requirements and BLS validation boundary before adding update acceptance. No developer override or implicit trust fallback is introduced. Public test candidate and production remain blocked; hosted CI remains deferred.


## Profile/metadata composition follow-up — 2026-11-07

[The pinned composition](BOOTSTRAP_PROFILE_COMPOSITION_20261107.md) now checks supplied metadata bytes and explicit fixture selection before the existing structural committee/header checks. It adds no authenticated anchor, live network/fork policy, BLS verification or recovery adoption. [The additive provenance correction](BOOTSTRAP_BINDING_PROVENANCE_CORRECTION_20261107.md) records the historical binding-file digest discrepancy; original evidence remains unchanged. For read-only verification, run the Python decoder tests rather than the decoder's main command, which rewrites `binding.json`.


## Minimal committee key composition — 2026-11-07

[The isolated G1/aggregate composition](MINIMAL_COMMITTEE_G1_20261107.md) passes 12 new, separate 30 G1 and 73 bootstrap regression checks. The supplied32-member aggregate matches the sum with repeated members counted. Ordered inclusion and aggregate equality remain distinct. Old structural modules are unchanged; only the new research result reports checked key/aggregate properties. Next external G2/signature vectors and explicit ciphersuite/domain behavior, with checkpoint/network/fork/recency and update gates still open. Full suite/declared runtime not run; CI deferred.
