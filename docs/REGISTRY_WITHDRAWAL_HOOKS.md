# Registry receiver and withdrawal callback checks

## Scope

This extends the separate20-operation registry-backed withdrawal fixture with an isolated test helper. It preserves the prior source and evidence. The production candidate is not changed or approved. Fixed payer, mock token, constructor-only accounts1–4, supplied stake root and provisional account-bound entitlement remain research constraints.

FACT —28 signed local transactions completed with expected outcomes, including eight rejected transactions. The original five rejection cases are retained. The three new cases are:

1. During withdrawal, the token calls an authorized helper that transfers account2 from its owner to the helper and back. Although final owner is unchanged, epoch advances twice. Custody returns AUTHORITY_CHANGED and the transaction rolls back ownership, epoch, checked credit/liabilities, token balances and callback counter. This demonstrates a full ABA callback, beyond the prior self-transfer check.
2. A safe transfer to a receiver returning the wrong selector returns UnsafeRecipient. Checked ownership, epoch, approval, balances and accounting remain unchanged; helper NFT balance is0 and reverted logs are empty.
3. A receiver accepts and forwards the NFT back to its prior owner. The safe transfer succeeds and epoch advances from1 to3. A withdrawal using epoch1 rejects; a withdrawal using epoch3 succeeds. Receiver forwarding is allowed rather than incorrectly demanding the receiver remain final owner.

All reverted transactions still consume native gas and sender nonces. No claim of complete state-root rollback is made. The harness checks the listed state fields; independent reconstruction has not yet been run for this fixture.

Final mock-token balances: payer90, recipient2, custody8. Credited liability0, unallocated budget8, unpaid liability8, account2 credit0. Account2 remains with the new owner at epoch3, its single-token approval cleared. This leaves unpaid rewards funded rather than withdrawing them prematurely.

## Reproduce

Use existing pinned research dependencies: Node20.20.2, solc0.8.30, ethers6.16.0, EthereumJS10.1.3. From repository root, select a fresh output directory:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/test-registry-hooks.mjs integration/core-baseline-v1/RegistryHookWithdrawalResearch.sol /tmp/caw-registry-hooks evidence/funded-claims-20261108/vectors.json evidence/funded-claims-20261108/proofs.json
```

Source compiler key remains FundedAdmissionResearch.sol intentionally. Public disposable test keys3/4 must never receive real assets. Helper and token controls are unrestricted test instrumentation. The helper introduces no new privileged path in custody. Existing disk, memory and timeout limits were retained.

Result and generated-artifact hashes are published; signed operations and compiler input remain in the retained local evidence lane and are emitted by the reproduction command. No hosted-CI run is claimed.

UNRESOLVED — invalid registry deployment controls, independent reconstruction and second-engine replay for this28-operation fixture remain pending. The earlier61-operation fixture's Geth comparison does not cover this code. Runtime hash matching does not authenticate registry policy or state. Real CAW, public registration, public-chain evidence, economic decisions and release acceptance remain open.


## Follow-up verification

[Independent reconstruction and two-engine replay](REGISTRY_WITHDRAWAL_VERIFICATION.md) now cover this exact28-operation fixture. The original single-engine limitations above describe its initial test stage; public-chain and production gates remain open.
