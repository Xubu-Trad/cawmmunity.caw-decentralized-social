# ESM transaction/block replay comparison

FACT -- the tx/block imports in eight retained harnesses now have a separately generated ESM comparison variant. All 66 existing replay groups passed. All eight structured result records are identical to the retained mixed-mode run after removing the new entrypoint-identity observations. This is the same 66 groups in a changed import configuration, not 66 additional cases or proof of equivalence for every transaction.

The generator pins the eight original files by SHA-256, refuses existing output files and leaves originals unchanged. It switches only the VM-relative tx/block imports from CJS to their declared ESM entrypoints and routes harness-to-harness imports to the generated variants. The bounded resolver verifies the package identity/version and declared export path; exact generated-source and resolved-entrypoint hashes are retained in [the comparison record](../evidence/ESM_REPLAY_COMPARISON.json).

The same local signed fixtures, adapter, 21-file source-manifest digest and negative assertions are used. Coverage includes transfer, contract storage changes, revert/refunds, missing evidence, unsupported operations, resource bounds, malformed outcomes and source/input identity checks. The original ordinary 1241-test suite was not rerun. Existing startup, process, disk and time limits remained unchanged.

After frozen installation, from experiments/execution-engine, using Python 3.12 and Node 24.20.0 with default conditions:

```text
python -I -B prepare-esm-comparison.py
node --max-old-space-size=256 esm-manifest-replay-check.mjs ../..
```

Run the generator in a fresh checkout; it refuses to overwrite its generated outputs. No dependency install scripts are required by this transformation. The original source manifest is unchanged and covers its existing selected files; it does not incorporate the newly generated harness/callback code. Those source hashes are recorded separately, not enforced by the runtime manifest gate.

INFERENCE -- these selected replay results do not depend on using CJS tx/block entrypoints. This supports evaluating consistent ESM imports without discarding the earlier evidence. It does not certify every dependency as ESM, remove the need for byte-level address validation or establish library safety.

UNRESOLVED -- complete loaded-code identity, immutable execution, runtime release-signature verification, complete state-root recomputation, independent public-chain acquisition and production acceptance. The generated comparison remains experimental; original harnesses are not replaced. Next bind the selected executor/harness identity explicitly before describing a replay receipt as tied to that executor.
