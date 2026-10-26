# Declared dependency links and runtime checksum

FACT —17 pinned package declarations and all61dependency/root links resolve to the expected version-specific pnpm directories. Package names/versions and declared dependency names agree with the exact pinned lockfile. This extends the earlier archive payload comparison; it does not re-download or re-compare every package file.

The Node24.20.0 Windows x64 executable matches both the established local pin and the win-x64/node.exe checksum fetched from the exact release's official SHASUMS256.txt. The checksum document hash/source are recorded. releaseSignatureVerified remains false: this is an HTTPS-published checksum comparison, not independent signer verification or proof of runtime safety.

[Checker](../experiments/execution-engine/verify-links-runtime.py), [records](../evidence/LINKS_RUNTIME_COMPARISON.json). With Python3.12 from the repository root:

```text
python -I -B experiments/execution-engine/verify-links-runtime.py experiments/execution-engine PATH_TO_NODE_EXE NEW_OUTPUT_DIRECTORY
```

The output directory must not exist. The checker is deliberately restricted to the retained lock hash and17-package graph. Earlier attempts rejected parser errors: nested keys were initially read as snapshot entries, then blank lines were not skipped. Both failures are preserved; the corrected parser completed the comparison. No package scripts ran and no installation files changed. Existing process/resource guards remained active. Prior66 replay and1241 ordinary test counts are unchanged, not rerun or inflated.

UNRESOLVED — conditional ESM/CommonJS exports, subpath/builtin resolution, generated launchers, actual loaded module identities, concurrent file replacement and release-signature trust. Declared link agreement is not a complete module-resolution proof. loadedModulesAttested, conditionalExportsVerified, releaseSignatureVerified and productionAccepted remain false. Next exercise both relevant import modes against the compared directories and retain their concrete resolved entrypoint identities.
