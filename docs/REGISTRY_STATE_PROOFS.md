# Fixed-registry owner and epoch state

`inspectTestRegistryState(evidenceText, selectionText)` composes the existing header, account, storage and code checks with the compiler-reviewed TestAccountRegistry layout. It is restricted to fixture account IDs `0x1`, `0x2` and `0x3` and its exact runtime hash. There is no generic ERC-721 layout inference.

Evidence is the exact header/proof/code JSON accepted by the code-binding reader. Selection contains exactly schema `caw-test-registry-state-selection/1`, `headerProfile`, `hash`, `registry` and `accountId`. The selected block hash remains a trust assumption. Input bounds and duplicate-key rejection are inherited from the existing readers.

The reader derives owner and epoch mapping keys using the account ID and compiler-confirmed roots 0 and 4. Both witnesses must be present in the proof response, including a valid absence proof for a zero epoch. The account/storage proofs must bind to the selected header and fixed runtime code. The owner word must be nonzero and fit 160 bits. Unknown IDs, missing slots, different-code substitutions and forged values reject.

Success reports `owner`, `epoch`, `blockHash`, the derived keys, `selectedStateDecoded` and `codeMatchesFixture`. It deliberately leaves account authority, transaction/current permission, approvals, execution, chain authenticity, finality, freshness and production acceptance false. The result is not wired into live recovery adoption.

## Evidence boundary

The [Python generator](../reference/fixtures/generate-registry-state-fixtures.py) constructs account/storage tries and synthetic headers using existing Python primitives, separately from the JavaScript reader. It embeds the retained fixture runtime after checking its SHA-256. These are constructed states, not an EVM execution, observed registry deployment or a second independent cryptographic implementation.

Twelve focused cases cover owner changes across separately selected synthetic states, zero and maximum epochs, absent/oversized owners, missing epoch witnesses, wrong account IDs, altered claimed values, substituted code and proofs for another state. The two positive ownership states are not evidence of a valid transition between them. [Full offline regressions: 1116 passes across 57 files](../evidence/REGISTRY_STATE_TEST_RESULTS.json).

Next: acquire comparable registry proofs from an executed fixture, reconcile with direct state queries, and separately address transaction ordering and approvals. A block's post-state owner cannot authorize every earlier transaction in that block. No automatic permission decision may be based on this decoder alone. Compiler layout provenance remains in [registry storage layout](REGISTRY_STORAGE_LAYOUT.md).
