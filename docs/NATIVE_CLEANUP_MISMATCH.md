# native child-state mismatch: retained blocking regression

FACT -- expanded child-state verification found a mismatch excluded from the earlier selected-value comparisons. both calls still reproduce status, gas, receipt bloom/logs and previously selected accounts/storage. the newly checked native signature-precompile account differs on restored success:

| attempt | captured child proof at address1 | replay adapter after runTx | agreement |
| --- | --- | --- | --- |
| rejection | absent | absent | yes |
| restored success | present empty account | absent | no |

the account proof is checked against the selected child header. the present account has zero balance/nonce and canonical empty code/storage hashes. absence and an empty existing account are not the same trie claim. the successful-path report now sets nativeChildAccountMatches and completeSelectedChildAgreement to false. complete state-root recomputation remains false for both cases.

the final harness exit0 confirms this exact blocking regression, not successful whole-state agreement. an initial check incorrectly expected child absence for both cases and failed; a corrected comparison exposed the adapter/capture disagreement. both failed runs and source versions are retained. the native adapter, executor and acquired evidence were not modified to force a match.

eighteen boundary groups now pass, adding commit/deletion handling, extra read argument, inconsistent address bytes/text, nonempty code/storage hashes, original-storage refusal, discard behavior and wrong-account proof rejection to the earlier ten. both replay attempts retain missing-wallet-mode refusal. these tests do not explain the child-state discrepancy or establish consensus correctness.

## reproduce

```text
node --max-old-space-size=256 experiments/execution-engine/wallet-native-replay.mjs . experiments/paid-wallet-state/witnesses.json
```

use the existing pinned execution-engine installation. [Results and source identities](../evidence/NATIVE_CLEANUP_RESULTS.json), [earlier narrow replay](WALLET_NATIVE_REPLAY.md). no fresh node, public RPC, full-suite run or deployment occurred.

UNRESOLVED -- determine whether the difference originates in capture-engine empty-account persistence, selected-engine cleanup, or the bridge's checkpoint/touch representation. trace native-account lifecycle calls and compare with the pinned engine implementations and fork rules. do not choose a preferred result by modifying the final account or treating existing-empty as absent. until reconciled, this fixture does not establish complete selected child-state agreement on success, much less production wallet authority.


## lifecycle follow-up

[Forwarded callback trace](NATIVE_ACCOUNT_LIFECYCLE.md) identifies the selected engine cleanup deletion. The capture-side discrepancy remains open; no final state was forced to match.
