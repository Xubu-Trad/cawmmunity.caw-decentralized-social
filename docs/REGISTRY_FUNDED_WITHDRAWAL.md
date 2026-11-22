# Registry-backed funded withdrawal experiment

FACT — a separate local fixture now reads account ownership and epoch from an immutable registry reference instead of maintaining a second owner database in custody. It checks the selected registry runtime hash, current owner and epoch before withdrawal and rechecks them after token interaction. Transfer approval alone is not withdrawal permission.

The registry is derived from `experiments/account-authority/TestAccountRegistry.sol`: compiler changed from0.8.10 to0.8.30 and a constructor-only zero-weight account4 was added to match the preserved snapshot. All four accounts initially belong to the payer. There is no public registration or later mint. A caller-supplied matching runtime hash is not proof that a registry is authentic, safe or independent of other services.

## Observed result

20 signed transactions executed in EthereumJS, including five expected reverts: approval-only withdrawal, former-owner withdrawal, stale new-owner epoch, owner change during token callback, and same-owner epoch change during token callback. Reverted attempts retain the checked custody balances/credit, registry owner/epoch and token callback counter; reverted transactions emit no logs. Native gas and sender transaction nonce still advance and are not covered by the rollback claim.

The mock token has actual operator permission on the separate registry. Its callback can therefore change registry state despite custody's entry lock. Both callback cases reach AUTHORITY_CHANGED and revert. The same-owner transfer case demonstrates why owner equality alone is insufficient. This is not a full A-to-B-to-A callback test.

Two fees of5 fund10 mock units. Account2 claims1 before transfer and1 afterward; its new owner withdraws2. Final balances are payer90, new owner2, custody8; unpaid liability8 and account2 credit0. The remaining reward budgets stay funded. This run does not empty all accounts or prove every invariant for arbitrary inputs.

## Reproduce

Use the existing pinned research dependencies: Node20.20.2, solc0.8.30, ethers6.16.0 and EthereumJS10.1.3. From repository root, choose a new output directory:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/test-registry-funded.mjs integration/core-baseline-v1/RegistryFundedResearch.sol /tmp/caw-registry-result evidence/funded-claims-20261108/vectors.json evidence/funded-claims-20261108/proofs.json
```

The harness refuses an existing output directory and emits compiler input, signed operations and a result. Compiler input retains source key `FundedAdmissionResearch.sol`; this is intentional and part of reproducibility. Existing resource guards remain applicable. Test wallets use public disposable keys3/4; never fund them. The token's unrestricted controls are test instrumentation only.

## Limits and next checks

This is a single-engine, synthetic-context experiment, separate from the earlier61-operation two-engine fixture. Its new20 operations have not yet been independently reconstructed or compared with Geth. Safe-receiver rejection/forwarding, full ABA callback, invalid registry deployment and broader registration remain pending. Existing older evidence does not automatically cover the adapter.

Next: extend registry-specific negative cases, independently reconstruct registry and custody history, then compare execution engines. Real CAW compatibility, authentic public state, adopted economics/entitlement policy and release approval remain open. The fixed payer and supplied stake root are research constraints. No production readiness or manifesto compliance certification is claimed.


## Follow-up receiver coverage

The separate [28-operation hook fixture](REGISTRY_WITHDRAWAL_HOOKS.md) adds full ABA callback rejection, rejected receiver rollback and accepted forwarding with epoch invalidation. The20-operation evidence above remains unchanged. Independent reconstruction and second-engine replay for the new fixture remain pending.
