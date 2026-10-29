# native replay with the standard trie state manager

FACT -- the same published minimal direct-call fixture now replays through EthereumJS 10.1.3's standard MerkleStateManager, constructed from the selected parent proofs. the experimental witness/native-absence adapters are not imported. each parent proof is checked against the selected header, and the manager's initial trie root equals that header's state root before execution.

the unchanged selected London executor produces matching receipt status, gas, cumulative gas, empty logs and bloom. sender and fee-recipient nonce/balance match their child proofs. the native account is absent after replay, while its captured child proof establishes presence. the computed post-transaction trie root differs from the captured child header's root. [Exact results and fixture/harness hashes](../evidence/DIRECT_TRIE_RESULTS.json) preserve both values.

INFERENCE -- the native-account discrepancy does not require our experimental adapter. this narrows the candidate causes but does not certify the acquisition engine, standard manager or complete block execution. runTx executes one transaction; a post-transaction root comparison must not silently stand in for all block-level transitions. the fixture remains synthetic and locally acquired, and this is not an independent operator audit.

## reproduce

```text
node --max-old-space-size=256 experiments/execution-engine/direct-trie-replay.mjs experiments/paid-wallet-state/direct-witnesses.json
```

the focused run completed in 0.672 seconds, with approximately 69 MiB observed process memory. no new node capture or full suite was run. passing exit status asserts the retained mismatch. no adapter, execution dependency or existing verifier was modified.

NEXT -- inspect the pinned acquisition implementation's native-account persistence and distinguish transaction execution, block finalization and proof serialization. use the existing minimal fixture as a regression case. do not force an empty account or skip cleanup to match the capture. production and public test gates remain blocked.
