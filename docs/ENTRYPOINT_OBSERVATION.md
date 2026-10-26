# Selected conditional entrypoint observations

FACT -- 12 selected resolutions passed under Node.js 24.20.0 on Windows: the five direct EthereumJS package roots in default ESM import and CommonJS require modes, plus tx/block require paths resolved from the VM entrypoint as in the existing replay harnesses. Each resolves inside the expected pinned 10.1.3 pnpm package, agrees with its package export declaration, and has a recorded entrypoint and package.json SHA-256. No installation files were modified.

The address probe imports util in both modes. The constructors differ; a CommonJS Address fails instanceof against the ESM constructor despite identical address text and 20 bytes. This reproduces a cross-mode identity hazard and supports the existing adapter's byte validation/copying boundary. It does not prove every earlier instance mismatch had this cause or establish that all engine types are interchangeable.

[Checker](../experiments/execution-engine/entrypoint-check.mjs), [records](../evidence/ENTRYPOINT_OBSERVATION.json). After the pinned frozen installation, from experiments/execution-engine:

```text
node --max-old-space-size=256 entrypoint-check.mjs
```

The checker requires the retained lock digest. Run with default Node conditions and without loader overrides. Prior package/archive and link comparisons are separate observations; this check does not repeat all payload comparisons. The trusted Node loader and cooperating filesystem remain assumptions. Recorded entrypoint hashes are observations, not an independently trusted expected digest.

UNRESOLVED -- arbitrary subpaths, custom conditions, all transitive modules actually loaded, concurrent replacement, release-signature trust and complete engine attestation. No deployment, full state-root comparison or production acceptance. The 66 prior replay groups and 1241 ordinary offline tests were not rerun or increased by this check. Existing resource limits remained active.

NEXT -- isolate a single import mode in an experimental harness and compare its signed replay results before changing existing harness imports; preserve the current mixed-mode evidence.
