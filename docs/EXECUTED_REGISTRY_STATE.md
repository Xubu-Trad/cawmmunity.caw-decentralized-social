# Executed local registry state proofs

FACT — the retained TestAccountRegistry was deployed to a disposable local Anvil 1.8.1 London chain. Account 1 was read before and after an A-to-B transfer. The owner/epoch proof reader independently reconstructed A/0 and B/1 from each selected header, account/storage proof and runtime bytes, matching the retained direct `authority(1)` calls.

The capture uses the existing resource-guarded node and transaction helpers, with their SHA-256 pins checked before import. Its only additional RPC method is `eth_getProof`, restricted to the current registry, the two derived mapping keys, and the captured block number. The direct call uses latest state; a second header query checks that the local endpoint did not advance during acquisition. This is a local consistency check, not independent provider validation.

## Reproduce

On the existing Windows test environment, with the pinned Anvil executable and at least 768 MiB available memory and 2 GiB disk:

```text
python experiments/account-authority/capture_registry_state.py --anvil PATH_TO_PINNED_ANVIL --output NEW_CAPTURE.json
node --test tests/executed-registry-state.test.mjs
```

The output parent must exist and the output file must not exist. The test reads the committed fixture; to inspect a newly generated capture, pass each case's evidence and selection JSON to `inspectTestRegistryState` as shown in the test. New timestamps and block hashes may differ; do not require byte identity between separate executions. The committed capture's hash is pinned by the regression test. The existing Windows guard controls the owned process, memory, deadline, output and port; failed attempts retain a failure record and do not replace earlier evidence.

## Verification limits

FACT — six checks cover capture scope, both acquired states, old-proof/new-header mismatch, a forged storage value, and a different selected block hash. Full offline regressions passed 1122/1122 across 58 files. The previous constructed-proof tests remain intact.

The actors were locally funded and impersonated, not cryptographically authenticated wallets. No public RPC was contacted, no real keys were used, no production transaction was sent, and registry code/storage was not injected. Deployment and transfer receipts are retained as local observations; this reader does not validate their transaction or receipt commitments or independently execute the transition. Runtime identity still depends on the separately reproduced build/layout evidence.

UNRESOLVED — selected-header authenticity, public-provider disagreement, finality/freshness, approvals and transaction-time authority. Block post-state ownership cannot authorize an earlier transaction in that block. All reader authority, execution, permission and production flags remain false. No automatic permission adoption is enabled.

Next: reconcile owner/epoch proofs with transaction-position authority and approval scope before connecting this decoder to the recovery permission path.
