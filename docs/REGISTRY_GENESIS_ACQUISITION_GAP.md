# Captured-context replay: missing complete genesis state

## What was executed

Pinned Geth evm1.17.10 (`d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`) replayed the same28 signed transactions sequentially, carrying each output allocation into the next transaction. Unlike the earlier repeated-context experiment, this run used each captured block's number, timestamp, base fee, gas limit, coinbase, randomness, withdrawals and preceding block hashes. The initial allocation was the two-account funding file supplied when starting Anvil.

All28 transaction roots, receipt roots, status values, gas charges, signed-body bytes and logs match the captured sequence. All28 resulting state roots differ, starting at operation0. **This is not evidence of a Geth execution defect: the supplied starting state is not the captured genesis state.**

## Demonstrated starting-state mismatch

Reconstructing the complete account trie from that funding file gives `0x7db35ca88845c0a6ae4198fed747f974eb748f895dbeb28cf28852d22f4acde4`. The captured genesis header commits to `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421`. These differ before any transaction executes. Treating the funding file as a complete genesis allocation was an invalid acquisition assumption; it cannot authenticate the replay's state roots.

Additional node-created initial state is a possible explanation, not established here. Do not guess accounts until a root happens to match, substitute the Geth root into the Anvil header, or describe a state proof under another root as repairing the old capture. The unchanged capture and failing comparisons remain preserved.

## Storage result and limits

The separately executed final Geth allocation agrees with all16 selected ownership, epoch, approval, balance and operator fields in the reconstructed model. The cleared `approved2` slot is absent, consistent with canonical zero handling; Anvil's retained included-zero proof remains rejected. This comparison is against the Geth allocation, **not a successful proof under the captured Anvil state root**. No complete captured-state reconciliation, independently authenticated public history or finality is claimed.

## Reproduction method and next gate

The published result lists every captured and replayed state root. Use the retained capture and exact signed operations; construct one t8n environment per block from the fields above. Run pinned `evm t8n --state.fork=Shanghai --state.chainid=31337 --state.reward=-1` with the previous output allocation and RLP list containing that block's exact typed transaction. The recorded run kept per-step environments, allocations, result/body files and provenance, with2GiB disk/1GiB startup-memory guards, GOMEMLIMIT256MiB, twoGo workers,30seconds per step and240seconds overall. No network or live deployment was used. A fully portable acquisition/replay runner remains pending; this method is not presented as a one-command release package.

For a new capture, explicitly disable or enumerate node-generated accounts and any genesis predeploys; obtain the complete initial allocation, independently reconstruct its root and require equality with the genesis header **before** treating subsequent state-root comparisons as valid. Then replay every transition and generate canonical final storage evidence. External checkpoint selection and consensus/finality verification are separate gates even after local genesis matches.
