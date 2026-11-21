# Header-sync interruption and combined reproduction

FACT — two fresh runs selected the first observed fsync/fdatasync entry on the header static file after the exact block-15 persistence-start marker. Both stopped the receiver group, found no matching completion marker, and killed it. The first observed fsync at 2026-11-11 12:57:25.894102 UTC (local trace time). Both restarted at genesis with preserved identity and zero peers, then recovered all 29 exact header hashes/state roots from a different Geth peer while the original source remained stopped. The receiver imported no history files. Each passed the unchanged strict reader: 16 fields and all five rejection controls. All test processes stopped.

Only the watcher selector changed from the prior header-write experiment. Reth 2.10.1, threshold14/buffer0/masking0, fixture, resource guards and deliberate 100 ms pwrite64 exit delay are unchanged. No delay was added to fsync. An unfinished fsync trace entry does not prove SIGKILL occurred inside fsync, that fsync failed, or that storage was not durable. This remains an observed-operation interruption, not an instruction-level or power-failure test.

## One command, including strict verification

From the repository root, with the pinned clients and runtime prepared as described in [the existing guide](INDEPENDENT_PEER_REPRODUCTION.md):

```sh
python3 integration/peer-sync/reproduce-persistence.py   --driver integration/peer-sync/run-header-sync.py   --geth "$GETH" --reth-command "$RETH_COMMAND_JSON"   --fixture integration/peer-sync/fixture   --output "$FRESH_OUTPUT"   --reader integration/core-baseline-v1/check-geth-header-proof.mjs   --expected evidence/registry-later-20261109/result.json
```

Use Linux strace with delay-injection support, Python3 and Node. FRESH_OUTPUT must not already exist. GETH is the executable path and RETH_COMMAND_JSON is the existing runtime command-array file; preserve version pins and fixture manifest verification from the guide. The wrapper runs the exact experiment, checks isolation/recovery/cleanup boundaries, then invokes the existing strict reader. It exits nonzero on a driver failure, missed window, failed proof or changed scope. It records reproduction.json, strict-reader.log and hashes of driver, reader, expected model and outputs. It does not replace cryptographic checks with summary assertions.

The combined command was exercised in the second fresh local run. This is reproduction preparation and a same-operator replay, **not independent reproduction**. The exact executed driver retains the earlier generic trace claim string; the trigger field identifies sync entry and this report narrows its interpretation. Prior failed evidence is preserved.

## Reviewer receipt

Please provide the exact repository commit, client versions and executable hashes, strace/OS/filesystem versions, invocation, fresh output provenance, selected sync trace, matching start/completion-marker observations, restart state and strict-reader output. Exclude jwt.hex and credentials. Report missed windows and failures rather than relabeling them passes. Record whether the machine and operator are independent and any changes to the documented setup.

UNRESOLVED — separate-operator/host reproduction, public chain authentication/finality, power-loss durability and production acceptance remain unproven. The target is externally selected synthetic block28. Next priority is an independent replay of the combined command; repeated local successes cannot substitute for that review.
