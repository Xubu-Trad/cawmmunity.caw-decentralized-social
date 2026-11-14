# Wallet staged delivery and reviewer controls

Five deterministic stop points pass: chunk write, staged-file sync, proof verification, rename and directory sync. Before rename the old final bytes remain; after rename the verified replacement bytes remain. Restart rechecks all 34 fields. Lost, truncated, oversized and corrupt deliveries reject without invalidating the final view; orphan stage files are ignored and a valid replacement succeeds.

This is a single-writer local research store with a trusted directory and retained selection. Tests use exception injection and local chunk generators, not process kills, power loss, real transport or concurrent writers.

ahdmesh reviewer B7/B8 patch applied without fuzz to retained original runner; Solidity unchanged. B7 ownership change inside token callback reverted AUTHORITY_CHANGED and restored checked state, callback count and logs. B8 returned ownership at epoch 3 rejected epoch 1, accepted epoch 3; wallet 2 / custody 8 / liability 8 / credit 0. These are new local executions, not every archive claim or mainnet approval. C-007 remains open.

Reproduce from research branch:
node integration/core-baseline-v1/test-wallet-recovery-store.mjs evidence/wallet-recovery-20261112 NEW_OUTPUT_DIRECTORY

PR16 unchanged aba275b8239289ed63de331961207c6a13f47f41. No receipt-error fix or new reply. Other builds paused. Next abrupt process interruption and bounded transport. Publication of this package and reply was explicitly approved. Raw execution logs remain local.
