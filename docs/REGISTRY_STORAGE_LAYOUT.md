# Fixed registry storage layout reproduction

The pinned Solidity 0.8.10 compiler was rerun on the retained account-authority compile input, adding only `storageLayout` to the requested outputs. The registry runtime bytes, creation bytes and ABI matched the retained build exactly. [The compiler layout receipt](../experiments/account-authority/storage-layout.json) records source/input/compiler/output hashes and exact compiler types.

| Mapping | Root slot | Key | Value |
|---|---|---|---|
| owners | 0 | uint256 | address |
| balances | 1 | address | uint256 |
| approved | 2 | uint256 | address |
| operators | 3 | address | mapping(address => bool) |
| epochs | 4 | uint256 | uint256 |

These are mapping roots, not the concrete storage keys for an individual account or operator. No slot-to-owner decoder is added yet. The layout applies only to the exact original TestAccountRegistry fixture, not arbitrary ERC-721 implementations, proxies or a production username registry.

## Reproduce

1. Use a retained reviewed source checkout and the compiler identified in `experiments/account-authority/toolchain.json`. Check the compiler binary SHA-256 against that record before execution. No compiler binary is distributed here.
2. Run `python scripts/registry-layout-reproduce.py input new-input.json`. It refuses to overwrite an existing file and verifies the parent and derived input hashes.
3. Feed that file to the pinned compiler's `--standard-json` standard input; save its output as UTF-8 `new-output.json`. Apply the existing local resource limits when running the compiler. The helper does not execute downloaded programs or authenticate their publisher.
4. Run `python scripts/registry-layout-reproduce.py verify new-output.json`. It compares runtime, creation bytes, ABI and the entire storage-layout output to the retained records. Matching output is reproducibility relative to those records, not compiler-publisher authentication.

The output comparison was exercised against the actual new compiler result. A copied output with owners moved from slot 0 to 99 was rejected; the original was retained. Two Node checks tie the layout record to source/compiler/build hashes and expected mapping types. [Validation record](../evidence/REGISTRY_LAYOUT_TEST_RESULTS.json).

No runtime protocol code changed. The full suite was not rerun for these isolated artifact/tooling additions; its last result remains 1102 passes across 55 files. Two focused layout checks are additional, not a claim of a new full-suite count.

## Next authority evidence

Derive the concrete requested keys using this reviewed layout; acquire and check those storage proofs against the selected header and exact registry code; reject absent owners, malformed address words and missing or mismatched account/epoch/approval slots. Ownership at a selected post-state does not by itself authorize an earlier transaction or prove callbacks, signatures, current state, canonicality or finality. Those temporal and execution boundaries must remain explicit. No ownership or deployment acceptance follows from this layout artifact.
