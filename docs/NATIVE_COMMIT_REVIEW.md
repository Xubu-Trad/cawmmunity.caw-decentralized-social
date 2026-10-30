# native account persistence: pinned commit-path review

FACT -- source archives for revm-database 42.0.0, revm-context 42.0.0 and revm-handler 42.0.1 match the SHA-256 checksums in Foundry revision 982849d3140c01fd3b72905759581a132df7aa98's Cargo.lock. [Source inventory](../evidence/NATIVE_COMMIT_RESULTS.json) records retained bytes and hashes. The local Anvil binary reports that Foundry revision, but no independent source-to-binary rebuild has been performed.

## observed source chain

1. [JournalInner::finalize](https://docs.rs/revm-context/42.0.0/src/revm_context/journal/inner.rs.html) lines 227-246 describes database responsibility for touched-empty deletion. Its normalization branch applies before Spurious Dragon, not to the selected London profile.
2. [CacheDB::commit_account](https://docs.rs/revm-database/42.0.0/src/revm_database/in_memory_db.rs.html) lines 145-177 skips untouched accounts and marks self-destructed accounts NotExisting. Otherwise it copies account information and assigns StorageCleared or Touched. That path has no separate empty-account deletion check. DatabaseCommit iterates through this function.
3. [Foundry MemDb](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/evm/core/src/backend/in_memory_db.rs) delegates commit to its CacheDB. [Anvil StateRootDb](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/anvil/src/eth/backend/mem/in_memory_db.rs) records changes and delegates to MemDb.
4. [Anvil state trie](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/anvil/src/eth/backend/mem/state.rs) excludes NotExisting entries. A retained Touched empty entry therefore reaches its account encoding. The proof builder uses the same trie_accounts selection.

INFERENCE -- if the native account reaches this commit boundary as touched, empty and not self-destructed, the reviewed path can retain the empty leaf. This is a specific candidate explanation for the earlier minimal capture and reversible one-leaf diagnostic. It does not establish that those exact runtime flags occurred, nor prove that all earlier normalization and configuration paths have been exhausted.

UNRESOLVED -- observe the actual commit-boundary flags or reproduce the exact pinned Rust path before reporting a confirmed root cause. A comment describing expected cleanup is not proof that the runtime performs it. A broader consensus or security claim would need additional cases and review.

No new runtime test, Rust build, full suite or capture was performed for this source review. Existing mismatches remain unchanged. Next use a bounded source-level reproduction or instrumentation, preserve failed evidence, and avoid changing the community adapter to match an unexplained acquisition result. Production and public test gates remain blocked.
