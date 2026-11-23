FACT — a further C-007 local EVM experiment now has an independently verified evidence chain, pinned to `832e3eb88ca75694a55da0478c9106046b41ba56`.

this extends, rather than replaces, the independent R-02 findings already recorded in this issue. R-02 demonstrated recipient transfer and a 1 CAW withdrawal. the new experiment uses one frozen EIP-712 signed intent, identical post calldata in two branches, and a subsequent 100 CAW withdrawal comparison.

FACT — payer NFT 1 remains owned by A with epoch 0. the only ownership treatment is recipient NFT 2 transferring A to B, advancing its epoch from 0 to 1. both posts succeed with the same digest, timestamp, account-ID allocations and `Posted` event bytes.

the probe credits NFT 2 `1666666666666666666666` base units, NFT 3 `3333333333333333333333` base units, and retains `1` base unit of dust.

FACT — B's control withdrawal of 100 CAW from NFT 2 reverts with `NotAccountOwner()` and receipt status `0x0`. after the transfer, B's withdrawal succeeds with receipt status `0x1`. its synthetic token balance increases by exactly `100000000000000000000` base units, while vault balance and account-2 credit decrease by the same amount. backing and liability conservation remain satisfied.

FACT — a separate offline audit reconstructs the EIP-712 digest, transaction calldata, event bytes, receipt status and token/credit deltas from sealed evidence. its deterministic replay passed.

provenance manifests, SHA-256:
- signed payer baseline: `96df02e65295a646d115b0e8034d5ebd187ae77ecb9e20886ef597411b74ae02`
- frozen signed intent: `3d14b93846037cc95d33382d35a64ba13c445a4ace26875fc8e33e1a0e78c912`
- paired signed posts: `a75e98f922e31f6628baf5db64c8e74cb9f4914ae51f9b9226b21bbd1780d1e8`
- paired withdrawals: `1793365df3dc51efc9397732e66c5617028e5726e16b1651d6347cdb14bdd633`
- independent withdrawal audit: `31c6784af320ab080153b0e0213bcb40189a46381deeaf42e5357ba1411b3dcf`

INFERENCE — under the existing three-account experimental contract, account-ID allocations are unchanged by an unrelated recipient NFT transfer, while current-owner withdrawal authorization follows that NFT.

this is not a new economic-policy decision. the tests use a synthetic ERC-20, fresh local Anvil state and the unchanged experimental Solidity. they do not establish real CAW compatibility, an authenticated production state, open-population scalability, bounded gas, or permissionless long-term liveness.

the underlying local scripts and receipts must be published as a verifiable evidence packet before this comment is represented as independently reproducible from GitHub.

IDEA — retain payer-exclusion identity, ownership snapshot, transferred entitlement ownership, signed-action invalidation and rounding/dust as unresolved specification choices. C-007 remains OPEN, C-001 remains BLOCKED. no production implementation or manifesto interpretation is adopted.
