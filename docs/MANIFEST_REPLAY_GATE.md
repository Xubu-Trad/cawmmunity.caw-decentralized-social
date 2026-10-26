# Expected local source manifest gate

FACT —66 grouped checks passed:63 prior replay/provenance groups through the manifest gate plus changed manifest identity, changed source bytes and checked-source-count assertions. The retained manifest identifies21files: the local relative-import closure rooted at the witness read/overlay modules, the adapter/outcome/binding/gate modules, package metadata and lockfile. This is a defined local-source closure, not every package or executor dependency.

The caller must supply an independently selected expected SHA-256 for the manifest. The checker validates that identity before using its entries. Each entry has a root, relative path, size and hash. Traversal components, duplicate entries and out-of-root/redirected paths are rejected. File sizes are checked before reading and sizes/hashes afterward. Limits are128KiB manifest,256entries,1MiB per source and8MiB declared total. The trusted engine callback is invoked only after verification. Setup failures throw; they are not execution-revert outcomes.

The frozen sourceManifest report records its hash and number of checked files, with installedEngineAttested=false. Existing outcome/provenance acceptance flags remain false. From `experiments/execution-engine`, after frozen installation:

```text
node --max-old-space-size=256 manifest-replay-check.mjs ../..
```

[Manifest](../experiments/execution-engine/source-manifest.json), [checker](../experiments/execution-engine/source-manifest.mjs), [gated wrapper](../experiments/execution-engine/manifest-replay.mjs), [result hashes](../evidence/MANIFEST_REPLAY_RESULTS.json). The test selects the expected manifest hash explicitly. Editing a manifest and automatically trusting its new digest would defeat this gate.

INFERENCE — this detects local source drift relative to the selected manifest. It does not prove that the manifest was reviewed, attest node_modules/runtime bytes, cover arbitrary callback code, or protect against concurrent replacement/module-cache differences. The checker itself and cooperating host are trusted. Static relative-import traversal used to prepare this manifest is not a general JavaScript dependency analyzer; dynamic external dependencies are not claimed complete.

UNRESOLVED — installed dependency/runtime verification, immutable execution snapshot, exact callback provenance, independent reproduction, complete state roots and public-chain/production acceptance. Next verify installed package contents against independently selected package artifacts before describing the engine as attested. Ordinary1241-test suite unchanged/not rerun; guards/dependency versions unchanged.
