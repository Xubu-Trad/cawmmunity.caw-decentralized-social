# native root difference: one-leaf diagnostic

FACT -- the standard trie replay still produces an absent native account and a different post-transaction root. after execution, a separate diagnostic checkpoint inserts exactly one canonical empty account at address 0x0000000000000000000000000000000000000001. that diagnostic root equals the captured child root. reverting the checkpoint restores the original replay root and native absence; assertions check both. [Result and source hashes](../evidence/NATIVE_LEAF_RESULTS.json).

this temporary edit is not execution, a repair, or acceptance evidence. rootsMatch remains false for the actual replay. no adapter or executor is changed. the diagnostic identifies a sufficient single-leaf difference for this fixture; it must not be used to force future results into agreement.

## pinned acquisition source

the local binary reports Anvil 1.8.1, revision 982849d3140c01fd3b72905759581a132df7aa98. the [release record](https://github.com/foundry-rs/foundry/releases/tag/v1.8.1) points to that revision. this matches the reported identity, not an independently reproduced binary build.

- [state.rs](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/anvil/src/eth/backend/mem/state.rs): StateRootCache records touched changes. root and trie_accounts filter AccountState::NotExisting; these steps do not independently filter every empty account.
- [in_memory_db.rs](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/anvil/src/eth/backend/mem/in_memory_db.rs): commit records changes before delegating to the underlying database.
- [mem/mod.rs](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/anvil/src/eth/backend/mem/mod.rs): prove_account_at builds proof leaves using trie_accounts.
- Cargo.lock selects revm-database 42.0.0. its commit and journal semantics remain the next source boundary to inspect.

INFERENCE -- the observed child proof and header can consistently include the same empty leaf. the diagnostic narrows the root difference but does not establish where the acquisition path first retained that leaf or prove a general consensus defect. account status transitions and block-finalization behavior still need review.

## reproduce

```text
node --max-old-space-size=256 experiments/execution-engine/native-leaf-diagnostic.mjs experiments/paid-wallet-state/direct-witnesses.json
```

focused run: 6.64 seconds, roughly 71 MiB observed process memory. no fresh capture, full suite, independent operator or whole-block certification. production and public test gates remain blocked. next inspect the pinned database commit path; preserve the failing original replay.
