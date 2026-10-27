# local executed ledger and history reconciliation

FACT -- 14 focused groups pass against three local executed endpoints: zero, deposited/staked, and withdrawn. the unchanged registry and paid probe ran on disposable Anvil1.8.1 London31337. the existing synthetic-token adapter installed its exact pinned test runtime at the token address on that empty chain. this was not a fork of the real token. locally impersonated actors received fabricated gas and synthetic token balances. no public provider or real wallet was used.

| endpoint | credits for IDs1/2/3 | stakes | totalCredits |
| --- | --- | --- | --- |
| zero | 0/0/0 | 0/0/0 | 0 |
| deposited and staked | 100/200/300 | 10/20/30 | 600 |
| withdrawn and partially unstaked | 93/200/300 | 5/20/30 | 593 |

nonces, poolDust and messageCount remain zero; those fields exercise absence proofs here, not executed posting or dust allocation. a7-unit withdrawal and5-unit unstake succeeded locally. a subsequent nonowner withdrawal reverted with no receipt logs. this is scoped behavior of the unchanged probe with the synthetic token, not real-CAW withdrawal safety.

## what the composition verifies

the new experimental composition calls the existing ledger proof decoder and the existing paid-history replay. it requires the same endpoint block hash, registry/probe addresses and runtime bytes. it compares all three credits/stakes/nonces, aggregate totals/dust/messageCount, and the selected registry owner/epoch. direct getter observations are separately compared by the checks, not accepted as proofs by the composition. storage witnesses bind to the selected header/code, including valid zero-value evidence.

negative cases reject valid earlier proof/selection substituted for a later endpoint, valid earlier history substituted for a later ledger, changed final credit, missing history block, a failed receipt promoted to success, forged ledger slot, missing witness and caller-supplied acceptance claims.

selectedLedgerMatchesHistory means only that this bounded replay agrees with the proof-backed values at the explicit selection. the history reader used here does not add transaction signatures, complete transaction-body commitments or complete receipt-root proofs. transactionSignaturesVerified, completeBodyVerified and completeReceiptRootVerified therefore remain false. modeledTokenBalance is derived from the replay; it is not an external token-state proof. tokenBackingVerified, withdrawalSafetyVerified, executionVerified, authority, current permission, consensus, finality, freshness and production acceptance also remain false.

## reproduce

```text
node --max-old-space-size=256 experiments/registry-bootstrap/check-executed-ledger.mjs experiments/registry-bootstrap/executed-ledger.json
```

[composition](../experiments/registry-bootstrap/ledger-history-reader.mjs), [checks](../experiments/registry-bootstrap/check-executed-ledger.mjs), [synthetic local capture](../experiments/registry-bootstrap/executed-ledger.json), [results and identities](../evidence/EXECUTED_LEDGER_RESULTS.json).

fresh Windows capture requires the existing Python cryptography dependency and pinned Anvil binary:

```text
python -B experiments/registry-bootstrap/capture-ledger.py --anvil <path-to-anvil.exe> --output <new-directory>
node --max-old-space-size=256 experiments/registry-bootstrap/check-executed-ledger.mjs <new-directory>/capture.json
```

fresh output required. the existing startup memory/disk/process safeguards remain, plus the300second capture request deadline. exact one-use proof requests are restricted to the selected addresses, slots and block. synthetic token installation uses the previously bounded adapter; no general code/storage override was added. the complete request trace remains private with a digest in the published synthetic capture. the owned node is stopped after capture.

the first checker attempt failed because the new composition requested a2MiB JSON bound above the existing parser's1MiB maximum. the new composition was corrected to request1MiB; no parser guard was relaxed. both logs are retained.14groups then passed. previous suites were not rerun, and no production contract changed.

UNRESOLVED -- next reconcile this composition with the existing stronger body/sender/receipt verification, without treating the modeled token balance as asset proof. retain adversarial endpoint, branch and transaction-position cases. separate real-token provenance/semantics, independent reproduction, production registry/anchor policy and public release agreement remain open. no production gate closes.
