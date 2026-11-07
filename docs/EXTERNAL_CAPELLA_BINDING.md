# External Capella bootstrap structural reproduction

The combined payload/body/beacon verifier now passes a corresponding [official minimal-preset bootstrap fixture](https://github.com/ethereum/consensus-spec-tests/tree/bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908/tests/minimal/capella/light_client/sync/pyspec_tests/advance_finality_without_sync_committee), pinned to `bc5c1a7fb2a8871aaffd4b16ee4dd9c72bb81908`. The selected beacon root is copied from the upstream `meta.yaml`, not generated from our decoded header. The suite name does not imply that we ran its finality-update sequence.

## What ran

The fixture's compressed bootstrap, metadata, configuration and MIT license are retained in [the fixture directory](../evidence/consensus-capella-bootstrap). A separate Python decoder checks source hashes, decodes the raw Snappy block with a 64 KiB bound, and reads only the exact minimal Capella bootstrap/header layouts. It computes the payload SSZ root and exports the original execution branch and beacon header. JavaScript then independently checks the payload root, inclusion branch and selected header root through the production-language research modules.

All **41 focused Node checks across four files** pass, including the new external composition and altered payload/branch/metadata controls. **Four Python decoder checks** pass: a literal, overlapping copy, malformed/truncated/oversized inputs, and the official fixture. [Recorded evidence](../evidence/EXTERNAL_CAPELLA_BINDING_RESULTS.json). No dependency or supplied executable was installed or run.

```sh
python -I -B scripts/decode-capella-bootstrap-fixture.py
python -I -B tests/test_bootstrap_fixture_decoder.py
node --test tests/sha256-branch.test.mjs tests/beacon-header-root.test.mjs tests/capella-payload-root.test.mjs tests/capella-header-binding.test.mjs
```

The decoder deterministically rewrites `binding.json` only. Its Snappy handling follows the [published format](https://github.com/google/snappy/blob/main/format_description.txt); it is a fixture tool, not a general network parser or audited decompression library. The explicit offsets assume a minimal 32-member sync committee. Committee bytes and their branch are skipped, not authenticated. Input provenance checks bind to the preserved upstream bytes, not an independent trust authority.

## Boundaries

This removes the synthetic-only boundary for the combined structural test. It does not implement a light client, run the upstream sync suite, authenticate the fixture's trust root, validate committees/BLS signatures, or prove live consensus/finality/freshness. The metadata root is a test expectation. No current-mainnet or operator-independent acquisition is claimed. The stored config is provenance, not an implemented fork-schedule decision.

Next review bootstrap committee/root binding and explicit supported-profile rules with external negative cases before any signature/update work. Preserve the distinction between an authenticated trust source and successful inclusion beneath an assumed root. Public test and production remain blocked; hosted CI deferred. Historical full-suite totals are unchanged. PR #16 remains at its previously reviewed revision with changes requested.


## Follow-up — 2026-11-07

The original experiment above skipped committee data. The subsequent [minimal bootstrap committee experiment](MINIMAL_CAPELLA_BOOTSTRAP.md) now exposes and verifies its structural inclusion. BLS key/signature validation and root authentication remain unimplemented. The original 41/4 results above remain historical evidence.


## Profile/metadata composition follow-up — 2026-11-07

[The pinned composition](BOOTSTRAP_PROFILE_COMPOSITION_20261107.md) now checks supplied metadata bytes and explicit fixture selection before the existing structural committee/header checks. It adds no authenticated anchor, live network/fork policy, BLS verification or recovery adoption. [The additive provenance correction](BOOTSTRAP_BINDING_PROVENANCE_CORRECTION_20261107.md) records the historical binding-file digest discrepancy; original evidence remains unchanged. For read-only verification, run the Python decoder tests rather than the decoder's main command, which rewrites `binding.json`.
