# direct native-call replay: discrepancy retained

FACT -- a fresh minimal direct-call capture now includes sender and fee-recipient proofs and code bytes at the selected parent and child. native proofs remain separate. the collector pins the earlier direct-call source and runner, permits only scoped account-proof requests, and checks header stability. no CAW contracts, token installation, impersonation or production credentials are involved.

the unchanged selected London executor and native-absence adapter replay the signed transaction using those proofs. status, receipt gas (25,664), cumulative gas, empty logs and bloom match. sender and fee-recipient nonce/balance match their child proofs. the captured native account exists empty; replay leaves it absent. complete selected child agreement remains false. a passing harness exit asserts this discrepancy, not correct complete execution.

three negative checks reject: missing sender proof, missing fee-recipient proof, and a child proof substituted for parent absence. missing-account attempts poison their state manager. [Machine-readable result and hashes](../evidence/DIRECT_REPLAY_RESULTS.json) identify the exact fixture and unchanged executor/adapter.

acquisition: 29 local requests, two signed transactions including setup, zero upstream requests, 3.453 seconds owned node time, listener released. replay used the pinned local EthereumJS engine; it is a second execution implementation relative to the acquisition node, but not an independent operator or build audit. the adapter is experimental and a full child trie root is not computed. raw transaction bytes are writer-supplied.

INFERENCE -- the mismatch survives removal of CAW application logic and now has a minimal second-engine reproduction. assigning the cause to the acquisition engine, proof path, configuration or adapter still requires further evidence. no protocol acceptance or production gate is closed.

## reproduce

```text
node --max-old-space-size=256 experiments/execution-engine/direct-native-replay.mjs . experiments/paid-wallet-state/direct-witnesses.json
```

use the existing pinned engine installation. capture-direct-witnesses.py adds fixed account witnesses to the earlier capture-direct-native.py; compact-direct-native.py projects the raw capture into a new file.

NEXT -- compare this minimal case with the selected engine's ordinary trie-backed state manager, independently verifying the resulting account existence and root. that isolates the experimental adapter as a possible source of the difference. retain both outcomes, then inspect the pinned acquisition implementation if the discrepancy persists. do not force an empty account or relax cleanup to obtain agreement.
