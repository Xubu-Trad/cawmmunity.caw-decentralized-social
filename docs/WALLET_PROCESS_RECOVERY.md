# Wallet real process interruption and HTTP recovery

Five real SIGKILL checkpoints passed: chunk, staged-file sync, verified proof, rename and directory sync. Only owned test children were killed. Fresh readers verify all 34 fields after restart. Original bytes remain before rename; verified replacement bytes remain after rename. Subsequent valid replacement succeeds.

Dropped, corrupt, stalled and redirecting loopback HTTP sources reject without replacing verified state. Transport is explicitly loopback-only with deadlines and the existing512KiB limit. Server sockets and child processes are bounded. No verification weakened.

Reproduce:
node integration/core-baseline-v1/test-wallet-recovery-process.mjs evidence/wallet-recovery-20261112 NEW_OUTPUT_DIRECTORY

Scope: single-writer same-host Linux filesystem and loopback HTTP. Not power-loss, disk-cache-loss, remote identity, multiwriter or public-chain certification. Next independent-host reproduction and writer-ownership boundary. PR16 unchanged aba275b8239289ed63de331961207c6a13f47f41; receipt-error fix pending. Other builds paused.

Publication explicitly approved by Xubu. Raw lane COMMUNITY_WALLET_PROCESS_RECOVERY_20261112_V1.
