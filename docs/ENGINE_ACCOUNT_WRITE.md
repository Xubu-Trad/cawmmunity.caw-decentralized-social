# Existing-account writes through the pinned engine

FACT — nine bounded checks passed with the existing frozen EthereumJS10.1.3 dependency graph. The experiment extends the injected-code adapter to read current journaled accounts and write only nonce/balance fields of selected existing accounts.

- Direct callback updates persist nonce/balance and return defensive engine Account objects; later mutation of an earlier object does not alter journaled values.
- A state-manager checkpoint/revert restores account and storage changes together.
- Six independent rejected writes cover changed code hash, changed storage root, undefined account/deletion, unproved account, nonzero account version and changed code-size metadata. Reverting afterward does not clear adapter failure.
- A zero-value self CALL through the actual engine completes successfully, invokes putAccount twice and leaves the final account unchanged.

[Source](../experiments/execution-engine/account-write-boundary.mjs) and [validation record](../evidence/ENGINE_ACCOUNT_WRITE_RESULTS.json). After frozen installation, from `experiments/execution-engine` run:

```text
node --max-old-space-size=256 account-write-boundary.mjs ../..
```

The callback checks proposed hashes against the immutable original proof before accepting field updates. The overlay does not recompute storage or state roots. Version/code-size checks are deliberately limited to this London probe and are not a compatibility claim for other account representations. Rejected callbacks permanently invalidate this attempt, even when cleanup reverts a frame.

INFERENCE — this demonstrates the selected engine account callback can be connected to the bounded journal without accepting the tested unsupported changes. The adapter is embedded in a probe, not a complete public StateManager implementation. Inherited methods and other execution paths have not been certified. The zero-value self CALL does not prove funds move correctly between distinct accounts. It does not consume a signed transaction nonce or validate fee-recipient accounting.

Outer/child code remains injected. No full transaction, authenticated runtime replay, post-state root, gas/refund comparison or public-chain certification is claimed. Network isolation was not independently enforced. These nine checks are separate from the unchanged1241/1241 offline suite, which was not rerun because existing application/reference sources were unchanged.

UNRESOLVED — next acquire a genuine signed first-transaction fixture with proven sender, recipient and fee-recipient state, then connect the transaction runner without bypassing nonce/balance checks. Value transfer, transaction-level rollback, creation/absence, fork transitions and independent result comparison remain open. Production and wallet-authority acceptance remain false.
