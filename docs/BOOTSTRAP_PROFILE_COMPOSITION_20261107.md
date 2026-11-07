# Pinned minimal Capella bootstrap composition — 2026-11-07

This research increment connects explicit fixture selection, retained metadata bytes and the existing header/committee inclusion checks. It does not activate chain recovery, change production acceptance, or implement a light client.

## Source and transformation boundaries

FACT — The six V1–V3 source/test additions are byte-identical to the supplied sealed local evidence receipt. Their parent is `2e0180b917519502d7f6fe3976a76abf61d634f9`. The receipt SHA-256 is `53565f17f5df2423eaa9c61ccfbe9fc6baff4d836ead95e5ec8a7dde7e7a34a0` (6,202 bytes). The received transfer archive SHA-256 is `1f0455ac75f18eb46881b5999c3dcf380058e9a7544f2520ead490ec421af37f`. All 15 listed artifact hashes and sizes were checked after transfer. This proves correspondence to that receipt, not independently authenticated build origin or the original operator's execution environment.

- V1, `selectResearchBootstrap`, admits the named `ethereum-minimal-capella-fixture` network and `minimal-capella-32-structural-only` profile, a nonzero selected beacon root and a separate matching anchor descriptor. It rejects the tested unsupported identities and extra enumerable authority claims.
- V2, `inspectPinnedFixtureSelection`, accepts a Buffer of at most 4,096 bytes, matches the retained metadata SHA-256 against both supplied pins, parses the exact four-line fixture metadata format and checks the selected root. The bootstrap/store fork-digest strings must match each other.
- V3, `inspectPinnedMinimalCapellaBootstrap`, passes the checked root to the existing bounded structural verifier. The beacon/execution binding and 32-member committee inclusion must pass. The current-committee proof path remains fixed at generalized index 54, depth 5, index 22, for the supported pre-Electra layout.

The underlying official fixture remains pinned to `ethereum/consensus-spec-tests` commit `bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908`; the pre-Electra protocol reference remains `ethereum/consensus-specs` commit `204fb4a19774eabb7a2e91505365deed6b8afef8`. See [external fixture provenance](EXTERNAL_CAPELLA_BINDING.md) and [committee inclusion](MINIMAL_CAPELLA_BOOTSTRAP.md). Existing third-party license notices remain unchanged. The new original modules/tests and explanatory documentation fall under the repository's code/documentation MIT scope; observations retain their evidence status.

The metadata digest is supplied by the caller, not embedded as an authenticated canonical checkpoint. Matching a self-selected replacement digest is not independent authority. The genesis root is parsed, not checked against a real network identity; matching fork digests do not validate a fork schedule. The selection APIs assume ordinary JSON-like caller data: they are not a hardened boundary against executable getters, proxies, coercion hooks or hidden/symbol properties. Do not expose them as a general untrusted-object admission API.

## Executed evidence

| Separately executed group | Original operator WSL record | Publication environment rerun |
| --- | ---: | ---: |
| V3 composition | 8 passed, 0 failed | 8 passed, 0 failed |
| V1/V2 selection | 18 passed, 0 failed | 18 passed, 0 failed |
| Existing structural checks | 47 passed, 0 failed | 47 passed, 0 failed |
| Python decoder | 4 passed, 0 failed | 4 passed, 0 failed |

The original logs record Node v20.20.2 and Python 3.10.12. The publication rerun directly executed Node v24.22.1 and Python 3.12.14, with executable hashes recorded in [the result document](../evidence/BOOTSTRAP_PROFILE_COMPOSITION_20261107.json). This is a separate runtime observation, not a rerun on the repository's declared Node 24.20.0 pin. That declaration remains unchanged. No dependency installation was needed. The focused tests are now listed in the ordinary test command for future suite runs, but no full suite or build ran here and no historical full-suite total changes.

The rerun used a Git-blob-verified partial source snapshot plus the six sealed additions. It used a 2 GiB free-disk / 1 GiB available-memory preflight, a 256 MiB Node heap cap, one test worker and a 45-second subprocess timeout per group. These are bounded local controls, not a hard OS memory sandbox. All snapshot source bytes remained unchanged after execution. The fixture decoder's rewriting main command was not run.

Reproduce the focused checks from the repository root, retaining runtime identities and each output separately:

```sh
node --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=30000 tests/pinned-minimal-capella-bootstrap.test.mjs
node --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=30000 tests/bootstrap-profile-selection.test.mjs tests/bootstrap-fixture-metadata-selection.test.mjs
node --max-old-space-size=256 --test --test-concurrency=1 --test-timeout=30000 tests/sha256-branch.test.mjs tests/beacon-header-root.test.mjs tests/capella-payload-root.test.mjs tests/capella-header-binding.test.mjs tests/minimal-capella-bootstrap.test.mjs
python3 -I -B tests/test_bootstrap_fixture_decoder.py
```

The retained tests cover changed metadata bytes/pins, unsupported selection/profile identities, injected authority claims, changed committee members/branches and changed header state roots. This is finite case coverage, not an exhaustive parser or security audit.

## Provenance correction and remaining gate

FACT — The historical bootstrap result recorded a different `binding.json` digest from the pinned Git object. The [dated additive correction](BOOTSTRAP_BINDING_PROVENANCE_CORRECTION_20261107.md) preserves both identities and the original result. Passing structural checks does not repair that historical evidence claim.

INFERENCE — The composition establishes consistency beneath the selected fixture root, not that the root is authoritative. BLS point/subgroup validity, aggregate-key relationship, signatures, genuine consensus, real network/fork selection, update acceptance, finality, freshness, mainnet's 512-member committee, independent network acquisition and production acceptance remain unestablished. The relevant returned verification flags remain false; absence of a flag is never evidence that a check passed. No administrator override, developer-selected canonical root or provider-majority fallback is introduced.

IDEA — Next, separately specify independently justified anchor sourcing/retention, supported real network/fork configuration and BLS/consensus prerequisites before any update acceptance. Test unsupported modes as refusals. Matching endpoints or digests cannot replace authority evidence. Production and the public-test candidate remain blocked; hosted CI remains deferred.
