# Installed package payload comparison

FACT — all17 pinned package archives matched the SHA-512 integrity values in the retained pnpm lock. All2182 archive payload files matched installed file sizes and SHA-256 values. No archive was extracted and no package script executed. Fetching was limited to registry.npmjs.org archives; installed files were read only.

The initial strict installation-equals-archive check stopped on generated command launchers. The revised comparison distinguishes archive payload from21 installation-extra records under node_modules/.bin. Their hashes are recorded but verifiedAgainstArchive remains false. Unexpected extras outside that directory still fail. The failed initial run remains preserved. This is a narrowed payload comparison, not a successful full-installation attestation.

[Checker](../experiments/execution-engine/verify-installed.py), [package records](../evidence/INSTALLED_PACKAGE_COMPARISON.json). With Python3.12, from the repository root:

```text
python -I -B experiments/execution-engine/verify-installed.py experiments/execution-engine NEW_EMPTY_OUTPUT_DIRECTORY
```

The output directory must not exist. The script requires the exact pinned lock hash and17-entry package set. It downloads archives with compressed/expanded/member limits, verifies integrity before inspecting members and compares bytes without extraction. Use existing process/time/memory/disk guards for a bounded run. Package tarballs remain in local evidence; only records and checker are published. This check is separate from66 prior replay groups and1241 ordinary offline tests, neither rerun nor inflated.

UNRESOLVED — generated launchers, dependency-resolution links, runtime origin/installed bytes, simultaneous file changes and actual loaded-module identity. Lock integrity anchors comparison to a selected artifact; it does not prove publisher trust or package safety. installationFullyAttested, runtimeAttested, resolutionGraphVerified and productionAccepted remain false. Next map actual resolved dependencies to these compared package directories and verify the pinned runtime independently.
