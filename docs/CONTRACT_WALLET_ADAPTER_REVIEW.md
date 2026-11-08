# Contract-wallet validation in the constructor candidate

The combined-guard candidate previously routed settlement only through EOA recovery. A separate research variant now selects EOA recovery for an owner with no code, or a bounded ERC-1271-style static call for an owner with code. The explicit EOA entry point rejects a code-bearing owner rather than bypassing its wallet validation rules. Account ID, epoch and stake-root checks remain in both branches; settlement uses the new dispatcher.

This reuses the earlier paid-action probe's experimental profile: signature at most 4096 bytes, 100000 validation gas, copying only the first return word and requiring at least 32 returned bytes with the magic prefix. It is not a newly adopted universal wallet policy. [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) requires non-mutating validation and allows context-dependent behavior; its security guidance warns that hardcoded gas limits can exclude valid wallets. This experiment deliberately retains that compatibility limitation for bounded testing.

## Executed evidence

Sixteen deployed local-EVM validation cases pass: valid wallet, rejecting direct EOA-entry use for a contract owner, bad magic, revert, short return, empty return, attempted state write, exhausted gas, large return with bounded copying, changed signature, changed digest, stale epoch, wrong root, 4096-byte signature, over-limit signature and restored wallet mode. The attempted write leaves wallet storage unchanged.

The configurable wallet fixture compares the expected digest and signature hash; it is not a deployable custody wallet or a demonstration of a real wallet's signer scheme. Its large-return case returns 8192 bytes, while the caller copies one word. Validation failure does not fall back to EOA recovery.

The unchanged ordinary-account constructor/lifecycle harness also passes with the new dispatcher. That covers existing EOA settlement and normal operations. **A complete contract-owned deposit/stake/post/withdraw lifecycle has not yet been executed.** Neither the earlier signed/two-engine fixture nor this call-level result proves EIP-7702 authorization handling, NFT admission or general wallet compatibility.

The first wallet harness run mistakenly used the dispatcher when testing the explicit EOA entry point, producing the wrong expected error. The failed lane is preserved; correcting the test target produced the passing run. No contract change was made to accommodate that test mistake. No full repository suite, clean dependency installation or signed transaction run is claimed for this increment.

## Reproduce

```sh
cd experiments/c007-contract-wallet
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 run-wallet.mjs /absolute/path/to/new-wallet-output
node --max-old-space-size=256 run-lifecycle.mjs /absolute/path/to/new-eoa-output
```

Recorded Node20.20.2/Solidity0.8.30/EthereumJS10.1.3, Shanghai. Existing resource-guarded local wrapper and pinned installed dependencies were used. The source is retained separately; no prior candidate or frozen replay package is overwritten.

## Next gate

Execute a complete contract-owned lifecycle through the wallet, then verify failure rollback and ownership-transfer behavior before signed capture. Review gas/signature/return-profile choices explicitly; do not claim standard-wide support. EIP-7702 needs its own fork-aware execution lane. The existing Issue #6 outside packet and evidence must be reused rather than replaced by this narrower test.
