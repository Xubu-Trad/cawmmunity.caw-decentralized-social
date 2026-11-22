# Wallet recovery admission

Four accounts and 34 selected fields verify against a reader-retained header/address/code/slot selection before replacing the current in-memory view. Eight corrupt bundles reject for both fresh and already-populated readers. Failed candidates leave the accepted view unchanged. An equivalent replacement bundle produces the same verified result in a second reader.

Cases: truncated JSON, missing account, reordered accounts, corrupted final wallet runtime, wrong balance, wrong header, donor selection injection and missing proof. Scope: offline admission only, no live transfer, disk durability or external reproduction.

The first run used an unsupported parser maximum and rejected. The corrected caller reduces its limit to 512 KiB; the existing parser and cryptographic verification are unchanged. Raw V1/V2 lanes remain preserved.

PR16 remains at aba275b8239289ed63de331961207c6a13f47f41 with its receipt-error fix pending. New ahdmesh PR19 review at issuecomment-6827724537: downloaded archive hash matches 5d365e4bd3a5af76dd57acbb7972fbd2bd0866e7903212f550eba78ab7c1ca62 and 436 internal manifest entries match. Report inspected; added B7/B8 executions not yet rerun. Reviewer PASS is attributed, not merge approval.

Next integrate bounded transfer/persistence and rerun reviewer controls. Other builds paused. Publication of this exact synthetic package and review acknowledgment was explicitly approved by Xubu.

## Reproduce

From the research branch with its existing Node/reference readers:

```text
node integration/core-baseline-v1/test-wallet-recovery.mjs evidence/wallet-recovery-20261112
```

Keep selection.json as a locally retained trusted input. Do not let a supplying peer replace it with its own selection.
