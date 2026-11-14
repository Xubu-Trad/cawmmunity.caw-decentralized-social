# Recovery after default-policy prefix rollback

## FACT — a separate recovery invariant

The retained default-policy prefix test still fails durable retention: after the receiver had 15 matching headers (genesis through block 14), SIGKILL and restart with the same database/identity returned head 0. All fourteen non-genesis blocks were unavailable by number before replacement connected. Three zero-peer checks returned SYNCING for the target, with the original source stopped.

This experiment asks whether that loss can be repaired through peer acquisition, rather than changing the original retention assertion to claim success. `retentionPassed` remains **false** in its result. The previous failing test and the separate threshold-zero retention control are unchanged.

A separately initialized replacement Geth peer, with a different identity and full public fixture history, then connected. The same restarted Reth receiver reacquired all 29 headers through block 28. Every header hash and state root matched the fixture. Its newly requested registry proof passed the unchanged strict reader: 16 fields and five tampering controls. The original source remained stopped and there was no receiver-side file import. All experiment processes stopped.

## Interpretation

The default 50-block persistence threshold versus the 14-block prefix, orderly-shutdown control and explicit zero-threshold control support buffering/unpersisted state as the explanation. This follow-up proves bounded reacquisition after that observed regression, not durable retention under the default policy. The application's selected target must still be independently authenticated; a peer returning data is not authority to select canonical history.

## Reproduce and preserve failures

Run `integration/peer-sync/run-prefix-rollback-recovery.py` with the arguments and prerequisites in INDEPENDENT_PEER_REPRODUCTION.md, using a fresh output directory. The exact fixture hashes, 2 GiB free-space and 1 GiB available-memory guards are retained. The driver requires this particular default-policy rollback; a different observed state fails for investigation rather than being silently accepted.

Run the existing `integration/core-baseline-v1/check-geth-header-proof.mjs` against the new evidence.json and `evidence/registry-later-20261109/result.json`. A passed driver is insufficient without the strict proof checks.

The first attempt stopped at START_TIMEOUT before reaching synchronization. Its four-second readiness window expired as the RPC server started. Cleanup passed. V2 changes only the readiness polling budget from 40 to 300 attempts at 0.1 seconds, retaining live-process and chain-ID checks. It passed. Startup failures and all earlier evidence lanes remain preserved; no proof acceptance rule was relaxed.

## Limits and next work

Same host/operator, synthetic fixture, manually trusted replacement and externally supplied target. No autonomous discovery, public consensus/finality, independently reproduced new run, observed mid-write crash, filesystem/power-loss safety or complete deployment recovery claim. Explicit persistence-completion observation, repeated kill timings and separate-host reproduction remain next steps. Existing independent review covers earlier pinned peer tests, not this new experiment.
