# Existing-account balance and nonce journal

FACT — the existing storage overlay now exposes `account(address)`, `originalAccount(address)` and `putAccount(address, nonce, balance)`. Updates require a selected proven existing account. They cannot create an account or replace code/storage hashes. The address and both hashes in returned records remain those of the original proof. In particular, storageHash is NOT recomputed after overlay storage writes and must not be used as a resulting state commitment.

Balance and nonce updates share the same snapshot map as storage writes. A child commit remains reversible by its enclosing frame; a child revert restores both account and storage fields together. All account records are frozen. Earlier returned records remain stable after subsequent writes. A storage failure blocks account access too, and an account failure blocks the whole attempt. Cleanup cannot reset failure.

Experimental bounds are16selected accounts,256selected slots and16nested frames. Nonces are canonical lowercase hexadecimal quantities up to64bits; balances up to256bits. These are adapter input bounds, not proof of transaction validity, sufficient funds or consensus nonce rules. No value transfer or authority rule is inferred from writing a balance.

Nine new cases plus the11existing storage cases passed; full1241/1241 offline checks across73files passed. The prior four EVM storage-write cases were rerun successfully against the modified backing implementation. [Validation record](../evidence/REPLAY_ACCOUNT_TEST_RESULTS.json). Reproduce focused checks with `node --test tests/replay-storage-overlay.test.mjs tests/replay-account-overlay.test.mjs`.

Tests cover joint rollback, child commit/parent revert, unknown-account rejection, canonical/overflow bounds, immutable original data, cross-surface failure and attempted extra-field injection. The account-count ceiling is not independently exercised by the one-account fixture. The EVM probe still rejects account writes; the new account API has not yet been connected to engine putAccount.

UNRESOLVED — engine account-write integration must accept only supported changes and reject code/root replacement, deletion and unproved creation. Transaction-level checkpoint handling, sender/fee-recipient evidence, signed executable fixture, gas/refunds and updated state commitments remain open. No production or wallet-authority acceptance is established.
