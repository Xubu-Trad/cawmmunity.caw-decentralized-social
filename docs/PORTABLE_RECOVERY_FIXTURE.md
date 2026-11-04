# Portable retained recovery fixture

The exporter packages the existing offline reader and its retained synthetic input into a fresh directory. It needs Python 3.12 to export and Node 24.20.0 to check; no npm installation, RPC, server, wallet or original database is used. The source checkout and runtime must be independently trusted. This is preparation for BA-01, not a completed independent builder-absent test.

## Export and retain the selection separately

From a reviewed checkout:

```sh
python -B scripts/export-recovery-fixture.py ../caw-retained-fixture
python -B tests/test_recovery_export.py
```

The destination's parent must exist and the destination must not exist. A previous or partially written directory is never overwritten. Inputs are checked before output creation; an interrupted write can leave partial output, which must not be treated as a completed export. There is no automatic download, archive extraction or cleanup.

Save the printed `selectionSha256` through a separately chosen trusted process **before** transferring the directory. For the pinned retained fixture, this exporter produces:

```text
6e764f9fd0f6cfa66f1b021feabe92f5fa001ed8c527470570b4f1a96e3270ac
```

Then, from the copied directory:

```sh
node --max-old-space-size=128 scripts/check-recovery-bundle.mjs bundle selection.json 6e764f9fd0f6cfa66f1b021feabe92f5fa001ed8c527470570b4f1a96e3270ac
```

That literal is for this synthetic fixture only. It does not select a public-chain endpoint. Do not calculate a replacement digest from an untrusted received selection to make verification pass. `INVENTORY.json` records the included reader, licence and data bytes; it is not a signature or an independent source of trust. Authenticate the code and its inventory through a separately retained source selection before running it. The inventory excludes itself; the exporter prints its digest separately. Source line-ending differences change inventory identities. The selection serialization is deliberately deterministic and differs from the older documentation's whitespace, without changing fixture semantics.

The explicit source list contains the current reader's dependency closure, including `experiments/paid-body-acquisition/verify_body.mjs`. Future reader import changes require updating and retesting the exporter. It does not package the full protocol, runtime, frontend, production history or a dependency installer. The local filesystem is trusted; this is not a malicious-filesystem sandbox or network isolation mechanism.

## Recorded local checks — 2026-11-03

[Evidence](../evidence/RECOVERY_EXPORT_RESULTS.json) records:

- Four Python tests: repeatable exported bytes and inventory agreement; existing destination preserved; altered capture refused before output; altered decompressed trace refused before output.
- The 22-file output ran from its own directory, with the existing reader reporting three successful posts and all six authority/acquisition/execution/finality/production limitations still false.
- Separate copies with altered bodies and selection bytes rejected as `RECOVERY_BUNDLE_HASH` and `RECOVERY_BUNDLE_SELECTION_PIN`. Removing the Keccak module rejected at Node module loading. Original positive output and negative copies were retained.

These runs used the same Windows operator and pinned runtimes. No original checkout was deleted and no hostile host, physical outage or independent operator was simulated. A second builder should select the code and input identities independently, run without the original checkout/configuration, and retain actual commands, environment and outputs using the [rehearsal receipt](BUILDER_ABSENT_REHEARSAL.md). BA-01 remains open until that evidence exists. The existing full-suite result remains 1,251/1,251; this change adds four separately run Python export tests and CLI checks, not a new full-suite result.

No economic rule, production code path, state adoption or release gate changed. Integrated public-action candidate decisions remain unresolved.


## Corrected linked-path reader — 2026-11-03

The [CLI entry fix](RECOVERY_BUNDLE.md#linked-entry-paths--2026-11-03) prevents an empty success when launched through a directory junction. A fresh export includes this corrected reader and passed its positive CLI check. The fixture selection digest is unchanged; the source inventory changes because the reader changed. [Updated export identity and run evidence](../evidence/RECOVERY_CLI_PATH_RESULTS.json) retain that distinction. Earlier exports remain historical evidence and should be regenerated from the reviewed corrected source before new use.
