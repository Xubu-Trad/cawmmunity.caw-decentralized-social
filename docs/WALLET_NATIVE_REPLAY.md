> 2026-10-29 follow-up: [expanded child proof comparison](NATIVE_CLEANUP_MISMATCH.md) finds present-empty versus absent disagreement at the native account after success. Earlier receipt and selected-value matches do not establish complete child-state agreement.

# native account absence in the local wallet replay

FACT -- both retained wallet transactions now replay with the selected EthereumJS London executor: rejected status0/gas82721 and restored status1/gas166660. receipt bloom/logs/cumulative gas and the selected child account balances, nonces and storage values match the captured observations. missing wallet-mode evidence still rejects and invalidates the attempt.

the original witness adapter and blocked replay harness remain unchanged. a separate opt-in adapter verifies nonmembership of exactly address0x0000000000000000000000000000000000000001 against the selected parent header, restricted to the existing London31337 profile. absent evidence, wrong-parent evidence and duplicate declarations reject. other undeclared accounts still fail through the original adapter.

## narrow representation

the installed engine creates an empty account object during a call even when the destination was absent and call value is zero. the initial read-only bridge refused this putAccount and poisoned the attempt. that failure is retained. the revised bridge represents only this native address's empty touch, with nested checkpoint/commit/revert handling and fresh account copies on reads. it accepts only the library Account type with zero balance/nonce/version/code size and canonical empty code/storage hashes. nonempty accounts, code writes and storage operations reject. it does not supply a funded account, replace code or turn unknown accounts into empty accounts.

native signature-recovery semantics still come from the pinned engine and selected fork. the nonmembership proof establishes absence at the selected header; it does not prove the engine's native implementation. the adapter is experimental and does not add general absent-account creation or value-transfer support. an empty native touch is an execution overlay, not a proof of a persisted account or a trie-root update.

ten boundary checks cover absence reads and nested rollback, detached account copies, nonzero balance/nonce rejection, code-write/storage-read rejection, unknown accounts, wrong-parent/missing proof rejection and failure persistence through cleanup. both replay cases additionally reject a missing wallet-mode slot. previous full suites were not rerun.

## reproduce

use the existing pinned execution-engine install and Node runtime:

```text
node --max-old-space-size=256 experiments/execution-engine/wallet-native-replay.mjs . experiments/paid-wallet-state/witnesses.json
```

[adapter](../experiments/execution-engine/native-absence-adapter.mjs), [harness](../experiments/execution-engine/wallet-native-replay.mjs), [results/source identities](../evidence/WALLET_NATIVE_REPLAY_RESULTS.json), [historical blocker](WALLET_WITNESS_REPLAY.md). the retained capture is unchanged; no fresh network acquisition or contract deployment occurred.

UNRESOLVED -- this second local engine reproduces two fixed-wallet outcomes and selected child values, not a complete recomputed child state root or independent-operator result. arbitrary contract wallets, other precompiles/forks, nonzero native transfers, production registry/token identity, canonicality/finality and production acceptance remain unproven. existing public authority flags are not promoted. no frontend integration or production state adoption is added.

next review the narrow adapter's proof/argument boundaries and native-touch cleanup against the selected child absence evidence, including unsupported account writes and transaction failure. do not generalize it to arbitrary absent accounts without separate review and tests.
