# Registry withdrawal history verification

FACT — the28-operation [registry hook fixture](REGISTRY_WITHDRAWAL_HOOKS.md) has now been reconstructed with a separate state model and replayed in EthereumJS and Geth. This is a bounded synthetic experiment, not a public blockchain or production acceptance.

## Independent reconstruction

The reader verifies raw transaction hashes, signatures with the existing sender reader, sender nonces, chain ID, value, deployment bytecode/constructor arguments and all predicted event logs. It recompiles the preserved source and checks the supplied registry runtime hash. It derives registry owners, epochs, approvals/operators, receiver forwarding and rollback, token balances, reward budgets, credits and liabilities from decoded signed calls. Stake proofs use the retained independent SHA-256 tree reconstruction.

Nested callback behavior is modeled from the fixture's helper/token semantics; the model is not a third EVM or an external review. Failed low-level callbacks have their own rollback boundary. Custody authority failure rolls back the outer modeled token and registry effects. Native gas accounting and chain authentication are outside this reader.

All28 operations reconcile. Eight altered histories reject: omission, duplication, changed transaction hash, missing mint event, modified withdrawal amount, omitted forwarding event, false success status and altered ownership event. Final balances are payer90, recipient2, custody8; unpaid and unallocated liabilities8, credited liability0. Account2 is owned by the recipient at epoch3 with credit0 and no single-token approval.

## Second execution engine

EthereumJS was rerun with state-root capture. Removing the added stateRoot field leaves operations identical to the original saved history; compiler input and queried final report are unchanged. Pinned Geth evm1.17.10 independently executed the exact signed bytes with the same initial allocation and synthetic environment. Every intermediate root, gas charge, receipt status, log and transaction body matched.

Final state root: `0x87510643272dc550d8fab031a3291505960b30f1fecdddd5a611d161efdb873f`.

The portable replay rejects altered expected roots, gas, status, logs and signed bodies. Actual wrong-chain and spent-nonce execution controls reject. A changed fixture hash and optimized Python invocation are rejected before replay. These controls test comparison behavior; they are not additional protocol transactions in the28-operation scenario.

## Reproduce from repository root

Use pinned Node20.20.2, solc0.8.30, ethers6.16.0 and the existing reference modules:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/reconstruct-registry-hooks.mjs evidence/registry-withdrawal-verification-20261109/input evidence/registry-withdrawal-verification-20261109/input-pins.json
python3 integration/core-baseline-v1/replay-registry-geth.py evidence/registry-withdrawal-verification-20261109/fixture.json /path/to/evm /tmp/caw-registry-geth-fresh
```

The output directory must not exist. Replay checks Geth SHA-256 `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da` and fixture SHA-256 `7f115a6a1a8e55c75450db1719e381f57f70048575f2ec3b26b8269bfd3bdce6`. It retains resource limits and refuses Python -O. The fixture contains synthetic transactions signed by public disposable keys3/4, not real wallets; never fund these keys.

## Remaining gates

Repeated block1/time1 contexts are not valid canonical-chain history. There is no header/finality verification, real-token proof, adopted entitlement/economic policy, public registration or external audit. Matching engines does not prove source requirements correct or rule out shared mistakes. Constructor rejection coverage and adversarial registry trust boundaries remain next; no developer override is introduced. README remains deliberately unchanged during this engineering increment.
