# Wallet authority evidence and next execution gate

Review baseline: `b4e962e4ee0f3015f396d52ac6f58df7b3e0a982`. This is an evidence inventory and proposed next experiment, not a change to accepted protocol policy.

## Existing coverage; do not duplicate

| Surface | Source / retained checks | What remains unproved |
| --- | --- | --- |
| Ordinary-account post signature | [post inspector](../reference/paid-post-signatures.mjs), [signature regressions](../tests/paid-post-signatures.test.mjs) | `assumedEoaOwners` is supplied by the caller; it is not proof of historical code absence. |
| Contract signature branch | [probe](../experiments/paid-action/CawPaidActionProbe.sol), [paid-action checks](../tests/caw-paid-action.test.mjs) | Local fixture results do not establish permission for an arbitrary wallet. |
| Callback, return-size and resource behavior | [attack fixture](../experiments/paid-adversarial/PaidAttackFixtures.sol), [evidence validator](../reference/paid-adversarial-evidence.mjs), [regressions](../tests/caw-paid-adversarial.test.mjs) | These already cover bad magic, revert, short/large results, gas exhaustion, length bounds, nested calls and static-write attempts. They do not constitute independent EVM replay. |
| NFT transfer permission versus funds | [signed withdrawals](SIGNED_WITHDRAWAL_ACQUISITION.md), [account-authority checks](../tests/caw-account-authority.test.mjs) | Transfer rights can enable acquisition of ownership; they are not a guarantee against a subsequent owner withdrawal. |
| Code bound to selected state | [header/code inspector](../reference/header-bound-state-proof.mjs) | A selected endpoint account proof does not establish the code and storage at an earlier signature call. |
| Transaction envelopes | [transaction decoder](../reference/ethereum-block-transactions.mjs) | Only legacy, type 1 and type 2 envelopes are accepted. Type 4 is unsupported. |

FACT — the pinned probe selects ordinary signature recovery when `owner.code.length == 0`; otherwise it makes a bounded static contract call. Its contract branch limits signature length to 4096 bytes, forwards 100000 gas, copies one word and requires at least 32 return bytes with the magic prefix. These are the experimental implementation's boundaries, not universal wallet compatibility guarantees.

FACT — [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) permits context-dependent signature validation. [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) defines type-4 authorization transactions and delegation code indicators. The existing London local experiment does not exercise those rules. Neither ordinary signature recovery nor a 65-byte signature proves absence of code or delegated behavior.

INFERENCE — combining a successful historical post signature with an end-of-block owner/code proof would leave a time-of-check gap. The wallet's state, code/delegation, dependencies or ownership may have changed between the actual call and the selected endpoint. The next step must preserve transaction ordering and the relevant execution context, rather than raising an authority flag on endpoint evidence alone.

## Next bounded experiment

IDEA — use the existing configurable test signature owner, unchanged paid probe and public test signer. Keep the digest, signature and wallet ownership fixed; change only wallet validation mode between calls. Record a valid post simulation, a rejected simulation after the mode change, and a restored valid simulation. Use read-only simulations so a successful probe call does not itself consume the action nonce. Bind each observation to its selected block, wallet/probe runtime, registry owner/epoch and relevant wallet state. Submit configuration changes as signed local transactions; do not impersonate the wallet. This is a local state-sensitivity experiment, not historical execution proof.

After that, design a separate historical replay path that starts from a selected parent state and executes the ordered preceding transactions to the call position. A provider's trace or `eth_call` result is an observation, not an independently verified execution witness. Reject missing code, storage or external-call dependencies. Do not silently fall back to ordinary-account recovery when contract validation is unavailable.

Negative cases for the eventual verifier: wrong block/transaction position, altered wallet mode or signer, replaced runtime, missing dependency, wrong digest/domain, stale owner/epoch, and a post-state proof substituted for pre-call state. Each must preserve the original failed evidence. EIP-7702 needs a separate hardfork-aware lane covering authorization processing and delegation-target dependencies; adding type-4 decoding alone cannot establish wallet authority.

UNRESOLVED — public trust anchors, independent replay engine/toolchain, wallet gas compatibility and supported wallet policy remain open. Keep `erc1271Verified`, `accountAuthorityVerified`, `executionVerified` and production acceptance false in the ordinary-account reader. No deployment or new admin authority is proposed.

## Validation scope

This review changes documentation only. It does not add tests or rerun an EVM. The latest recorded full suite remains 1178/1178 across 65 files, linked from the README. The review guide's test command is synchronized with the current package test list so it no longer omits the newer recovery and signed-acquisition checks.
