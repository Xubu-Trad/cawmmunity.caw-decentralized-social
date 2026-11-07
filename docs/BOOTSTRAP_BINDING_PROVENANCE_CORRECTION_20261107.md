# Additive bootstrap provenance correction — 2026-11-07

FACT — At community commit `2e0180b917519502d7f6fe3976a76abf61d634f9`, `evidence/MINIMAL_CAPELLA_BOOTSTRAP_RESULTS.json` records a SHA-256 for `evidence/consensus-capella-bootstrap/binding.json` that does not match the pinned file.

| Identity | Value |
| --- | --- |
| Historical result Git blob | `9800ab0f1a60d42bbff25321fa6c5770279d76cd` |
| Historically recorded SHA-256 | `4af4d87a19a141e78511aade1b80a1d8377d4785b23edbb60968fd906f64f426` |
| Actual binding Git blob | `8792153ae5b752d078b6d9bafe02413444351c51` |
| Actual binding SHA-256 | `96f107e5a94bd2a9bfa47f84ff257cbd18995ae8947440cac91804823236c6f8` |
| Actual size | 6,690 bytes |

Method: retrieve the file through GitHub at the full pinned commit, decode the returned base64, recompute SHA-256 and the Git blob identity (`SHA1("blob " + decimal byte length + NUL + bytes)`), and compare with the tree/contents blob. Separately compare the exact binding bytes supplied in the sealed V3 transfer. Both copies match the actual identity above. The operator's retained audit reports the same HEAD/working-tree comparison. The other three historical source hashes were also rechecked and match; exactly one of the four differs.

A local clone can reproduce the read-only Git-object comparison:

```sh
git rev-parse 2e0180b917519502d7f6fe3976a76abf61d634f9:evidence/consensus-capella-bootstrap/binding.json
git show 2e0180b917519502d7f6fe3976a76abf61d634f9:evidence/consensus-capella-bootstrap/binding.json | sha256sum
git show 2e0180b917519502d7f6fe3976a76abf61d634f9:evidence/consensus-capella-bootstrap/binding.json | wc -c
```

Impact: the historical result cannot establish the asserted binding-file identity for its earlier run. Its test counts remain historical recorded claims; the new focused rerun has its own runtime/log/source identities. Neither a current pass nor equality with the sealed transfer proves which exact binding bytes the historical test process consumed. The reason for the earlier digest is unresolved.

INFERENCE — This is a historical evidence inconsistency. It is not evidence by itself of source corruption, malicious alteration or misconduct. No original result, fixture, source pin or decoder output is rewritten to make the old digest pass. No authentication, consensus, finality, BLS or production claim follows from this correction.

See [V3 scope and reproduction](BOOTSTRAP_PROFILE_COMPOSITION_20261107.md) and [machine-readable evidence](../evidence/BOOTSTRAP_PROFILE_COMPOSITION_20261107.json).
