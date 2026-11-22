# Transport interruption and failed replacement retry

## Reproduction

Use the same Linux client/runtime prerequisites and trusted Reth command array as PORTABLE_PEER_SYNC.md. Run from the pinned research checkout with a fresh output path:

```sh
python3 integration/peer-sync/run-transfer-fault.py \
  --geth /absolute/path/to/geth \
  --reth-command /absolute/path/to/reth-command.json \
  --fixture integration/peer-sync/fixture \
  --output /absolute/path/to/fresh-transfer-fault-run

node --max-old-space-size=256 \
  integration/core-baseline-v1/check-geth-header-proof.mjs \
  /absolute/path/to/fresh-transfer-fault-run/evidence.json \
  evidence/registry-later-20261109/result.json
```

## Method and evidence

Two independently initialized Geth databases contain the same public synthetic28-block fixture and have different peer identities. Fresh Reth trusts only these peers, with discovery and outbound dialing disabled. A local byte-forwarding TCP proxy connects the original source to Reth. After peer establishment and a selected-head sync request, the proxy forwards only part of an observed source-to-destination chunk and closes the connection. The source is then stopped.

The replacement connects through a second proxy. Its cutoff is armed before connection, at the observed original source stream offset, avoiding a race where this small fixture finishes before a polling loop can arm the fault. After both cuts, the target must remain absent, destination head must remain genesis, and three further forkchoice requests must each report SYNCING with no peer. The replacement then retries directly, without the fault proxy. Reth is not restarted; original source remains stopped.

Observed original cut:432received bytes,1forwarded,431discarded. Replacement cut:432received bytes,51forwarded,381discarded. Successful retry produced35SYNCING responses followed by VALID within the configured40-iteration bound. The total run took about40seconds. All29header hashes/state roots matched. Actual destination storage proof passed16fields and five mutations. All processes stopped.

The first attempt, V1, failed its target-absence assertion because the replacement completed before the polling-based cutoff was armed. It remains preserved as a failed test-control attempt, not a client verification defect. V2 moves the replacement cutoff into the proxy and passed. No broader timeout or reader relaxation was applied.

## Interpretation limits

The proxy observes encrypted bytes, not decoded Ethereum messages. This establishes stream truncation while a sync request is outstanding; it does not identify the bytes as a particular header/body, guarantee the replacement reached the same protocol phase, or demonstrate partial-block rollback. Both receivers remained at genesis during this experiment; staged partial-chain retention is the separate REPLACEMENT_PEER_SYNC.md result.

The replacement fails via injected transport truncation and is then retried intact. This is not permanent replacement loss followed by automatic discovery of a third provider. Peers are explicitly allowlisted/dialed on the same host under one operator, with an externally selected head and zero safe/finalized hashes. No public consensus/finality or production readiness is established. Source fixture imports, trusted executable configuration and release/runtime limits remain unchanged.

Results: evidence/transfer-fault-20261111/result.json. Next: protocol-aware fault attribution, repeated seeds/timing, permanently unavailable replacements, separate-host/operator reproduction and authenticated public-chain selection.
