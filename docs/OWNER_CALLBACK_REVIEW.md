# Ownership changes during custody callbacks

## Observed behavior

The constructor candidate guards `deposit` and `withdraw`, but its `transferAccount` entry point is unguarded. A test token that also owns synthetic account 2 can call `transferAccount` during its transfer callback. Both the deposit and withdrawal complete while the account owner and epoch change inside the custody operation.

This is a source-observed and locally reproduced cross-function interleaving. It requires an adversarial callback-capable token plus the caller's account-owner authority in this fixture. **No theft, arbitrary-owner takeover, real CAW token exploit or live-chain failure was demonstrated.** The ledger and token backing remain consistent in these cases. The concern is that the authority checked at custody entry can change before that operation returns.

## Bounded proposal

Add the existing `guarded` modifier to `transferAccount`. The proposed invariant is that account ownership cannot change through this entry point while a guarded custody operation is executing. This does not grant any administrator power or decide NFT admission/economic policy.

The proposed source is retained separately in `experiments/c007-owner-callback/DeployedCustodyStakeResearch.sol`. Its only difference from the pinned `Baseline.sol` is that one modifier. The existing constructor candidate and its frozen signed replay package are unchanged. **The 26-transaction two-engine results therefore continue to describe the old candidate, not this guarded variant.** Promotion requires a new signed capture and replay, plus review of composition semantics.

## Executed tests

Four fresh local-EVM scenarios compare baseline/proposal across deposit/withdrawal:

- Baseline: nested authorized transfer succeeds; outer custody completes and backing remains equal to liabilities.
- Proposal: nested transfer returns `REENTRY`; outer custody completes, owner/epoch remain unchanged, and balances match.
- In both proposed scenarios, a subsequent standalone transfer succeeds and increments the epoch. The guard is released after the outer call.

The unchanged constructor/lifecycle harness also passes against the proposed source, including deposits, stake changes, signed application intent settlement, ownership changes, reward withdrawals and its existing negative assertions. This is creation/call-level EthereumJS execution, **not signed Ethereum transactions**, an independent-engine rerun or a full repository suite.

The first lifecycle wrapper hit a process-exit sampling race when VmRSS disappeared. That lane is preserved; the monitor now accepts missing metrics only after observing process completion, and the rerun passed. No memory/disk/time threshold was lowered.

## Reproduce

```sh
cd experiments/c007-owner-callback
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 run-callback.mjs /absolute/path/to/new-callback-output
node --max-old-space-size=256 run-lifecycle.mjs /absolute/path/to/new-lifecycle-output
```

Recorded Node 20.20.2, Solidity 0.8.30, EthereumJS 10.1.3, Shanghai. Existing pinned dependencies were reused; no fresh dependency installation is claimed for this experiment. Local wrapper startup checks required 2 GiB host disk and 768 MiB available memory, with 512 MiB RSS and 180 seconds runtime limits. Each scenario starts a fresh VM and deploys creation bytecode; no final contract state is injected.

## Remaining boundaries

This proposal serializes only account transfer against guarded custody. It does not establish a complete cross-function re-entry policy: `changeStake` and settlement remain separate review surfaces. Contract-wallet authority, NFT transfer binding, malicious-token compatibility and meaningful independent reviewer reproduction remain open. Keep this as a bounded research proposal, not a finding that real CAW funds are currently vulnerable.
