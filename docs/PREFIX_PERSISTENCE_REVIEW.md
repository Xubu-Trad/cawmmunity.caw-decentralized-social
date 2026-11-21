# Partial-history persistence investigation

## Observations and control

The original failing SIGKILL lane is retained unchanged. Reth reported head14 before the kill, but head0 immediately after restart, with no connected peers. The orderly SIGTERM control retained head14 and recovered the remaining history. Neither experiment established an active database-write interruption.

The installed Reth 2.10.1 help describes `--engine.persistence-threshold` as the number of canonical blocks ahead of the last persisted block before flushing again; its default is **50**. The fixture prefix is only **14** blocks. Threshold zero requests persistence as blocks arrive, disables state masking, and implies a zero default in-memory buffer target. This is a documented client configuration, not a verifier change. See [version-pinned upstream arguments](https://github.com/paradigmxyz/reth/blob/58ebce14ae63dab040beae301e1578cd0dc55e8a/crates/node/core/src/args/engine.rs). The observed executable identifies the same 58ebce1 revision; this is not an independent reproducible-build attestation.

A new fresh-database lane changes only the explicit command option `--engine.persistence-threshold 0` relative to the failing driver. It still SIGKILLs the receiver after head14, restarts the same database/identity with zero peers, and requires head14 and all 15 prefix header hashes/state roots to remain. All assertions pass. The replacement then supplies blocks through28; all29 headers match and the strict reader checks16 storage fields plus5 rejection controls. The original source stays stopped. All test services stopped.

## Interpretation and limits

**INFERENCE:** the default buffering/persistence policy explains the observed head regression more directly than database corruption. A reported execution head/VALID response is not by itself a durable-persistence acknowledgment. Changing the persistence policy makes this particular retention test pass. This does not establish that original on-disk data was corrupted, nor that all records had been durably flushed before the earlier kill.

No assertion or proof reader was weakened. No synthetic head was marked safe/finalized to force persistence. No replacement data was supplied before the post-restart retention check. The public fixture, selected head and original failed evidence remain unchanged.

This is one local synthetic run per configuration, not a guarantee about kill timing, concurrent database writes, filesystem/power failure, public finality, or production durability. Zero increases database write frequency and should not be silently imposed as a universal production default. Client configuration and durability assumptions must be recorded in any independent reproduction.

## Reproduce

Run `integration/peer-sync/run-prefix-persist-zero.py` with the same arguments documented in INDEPENDENT_PEER_REPRODUCTION.md and a fresh output directory. It is the original failing prefix-restart driver plus the explicit threshold option. Run the unchanged header-proof checker against the output evidence and expected registry model. Compare the original failure, orderly-shutdown control and zero-threshold run separately. Preserve failures. Next: explicit persistence-boundary observation and controlled kill timing; separate-host and public-chain authentication remain open.


## Default-policy rollback recovery

[The separate rollback recovery experiment](PREFIX_ROLLBACK_RECOVERY.md) reacquires the lost prefix and remaining history from a replacement peer while the original stays offline. This does not convert the durable-retention failure into a pass.
