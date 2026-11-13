# Fresh mined posting batch: Geth / EthereumJS

Source: `927bb32a1e13204400879883429e83625dd380af`. This is a new local run, not a replay of the external reviewer's block. The reader/harness approach derives from [ahdmesh's PR19 R-01 evidence](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/pull/19#issuecomment-6848413977), archive SHA256 `fd5d0d61836a6fa782e5648a5da5b4eefcc420f2a7ff1023da6c2c5d6838ddc7`. The adapted collector preserves its isolated database and captures every block from genesis rather than inferring the starting state from sparse proofs.

## Observed result

Geth1.17.10 mined two signed posts in block13, `0xcf4643c7584caaa6b5d8d169cee61aac9cd75213d777a250687d3df406cccea7`. EthereumJS10.1.3 replayed all13 transactions from the full genesis allocation, matching all13 subsequent state roots, individual/cumulative/block gas, receipt status and exact logs. The strict posting reader accepted both posts; its eight corrupted-history controls rejected. Posting nonce advanced0→2 while observed ownership, epoch, custody credit/liability, allowance and balances remained unchanged. Three second-engine controls independently rejected reordered raw transactions, altered cumulative gas and altered final state root. Actual numeric exits are retained.

This is two execution implementations operated locally by one operator. It is not independent-operator confirmation, public consensus/finality, a deployed Community.CAW network, full manifesto economics, or proof that every transaction passes the separate bounded strict transaction reader. The existing oversized setup-transaction boundary remains unchanged. Mixed authority/action blocks remain unsupported by the posting reader.

## Reproduce the second-engine check

Use Linux, Node20.20.2 and npm10.8.2. From this directory:

```sh
sha256sum -c SHA256SUMS
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 replay.mjs capture.json genesis.json replay-result-local.json
```

Expected exit0 and13transactions/13state roots. This runs EthereumJS over the retained signed input; it does not start Geth. Compare the resulting JSON with replay-result.json. The checked lock was reused from the existing pinned dependency installation; a new clean-machine npm install was not performed in this run.

## Mine another batch

Create a clean working directory containing mine-batch.py and lane.mjs. Place a checkout of the exact source commit above in its `src/` directory. Install the console dependencies there using `npm ci --ignore-scripts --no-audit --no-fund`. Supply the verified Linux Geth binary through GETH_BIN:

```sh
GETH_BIN=/absolute/path/to/geth python3 mine-batch.py positive
node --max-old-space-size=256 replay.mjs private/positive/capture.json private/positive/genesis.json replay-result-new.json
```

The runner checks Geth SHA256 `45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea`, Node20.20.2,1GiB available memory and2GiB disk (including C: for WSL). It refuses an existing output directory, binds only loopback, disables peers and stops its own node. Retain failed runs. A different timestamp produces a different block hash; compare replay with that run's capture rather than the published hash. Disposable fixture keys and mock tokens only. Never use real assets or keys.

The exact executed collector used the established local Geth path and unconditional WSL host guard. The portable copy replaces that path with GETH_BIN and makes the C: check conditional on /mnt/c existing; those portability-only changes are syntax checked, not a new clean-machine execution. The complete executed file hash and source hashes are in provenance. This is a documented experimental developer procedure, not a one-command public-node installer.

## Next gate

Have another developer install the locked dependencies and reproduce the retained replay, then mine and replay a fresh batch. Report exact tool versions, commands, exits and failures. Generalized intra-block ownership changes and real CAW economics remain separate roadmap work. The mission is unchanged.
