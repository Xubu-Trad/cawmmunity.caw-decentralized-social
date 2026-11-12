# Contract-wallet history reconstruction and second-engine replay

The21-operation wallet-owner fixture has now been independently reconstructed by a separate state model and replayed by Geth against EthereumJS. "Separate model" means a different implementation on the same host/operator, not an external audit or separate operator reproduction.

The reader checks raw transaction hashes, recovered signatures through the existing sender reader, nonces, chain ID, value, exact rebuilt creation bytes and canonical constructor arguments. It decodes wallet execute calls and derives the effective contract caller, controller authorization, NFT owner/epoch changes, credits, budgets, token balances and rollback. All predicted event logs and receipt statuses match. It is specific to this fixture, not an interpreter for arbitrary smart wallets.

Eight altered histories reject: missing/duplicated operation, changed hash, missing mint log, changed withdrawal amount, missing wallet-transfer event, false success status and changed ownership event. Final balances are payer90, wallet1, new owner1, custody8; total unpaid/unallocated liability8, account2 credit0 and epoch2. The controller is not substituted for the contract wallet as the custody caller.

EthereumJS was rerun with intermediate root capture; removing only the new root field leaves all original signed operations identical, with unchanged compiler input and final report. Pinned Geth evm1.17.10 executes those exact bytes with the same starting allocation and synthetic context. All21 intermediate roots, gas charges, statuses, logs and transaction bodies match. Final root: `0xd7044e64bfe7b918e5361d9f2f561e3c702012ce26ce233cde3b405331f65142`.

The portable replay also rejects changed expected root, gas, status, logs and transaction body; actual wrong-chain and spent-nonce submissions reject. These seven controls are not additional protocol operations. Existing resource guards and rejection of optimized Python remain enabled.

## Reproduce

Use the existing pinned research Node/solc/ethers dependencies, and Geth binary fingerprint enforced by the replay script:

```text
node --max-old-space-size=256 integration/core-baseline-v1/reconstruct-wallet-owner.mjs evidence/wallet-verification-20261112/input evidence/wallet-verification-20261112/input-pins.json
python3 integration/core-baseline-v1/replay-wallet-owner-geth.py evidence/wallet-verification-20261112/fixture.json PATH_TO_PINNED_EVM NEW_OUTPUT_DIRECTORY
```

The fixture SHA-256 is `2f28c4812aacbcef6c78ad410a1c4ec83e4cd899748a95069369fe19cefb9d9d`. Public disposable keys3/4 signed the synthetic inputs; do not fund them. No real-wallet material or network deployment is included.

## Limits and next core gate

Repeated block1/time1 execution is not canonical-chain history. Gas is checked by the second engine, not independently modeled by the accounting reader. No public finality, real-token proof, general ERC1271/4337 support, production wallet selection, registration or economic-policy acceptance is established. Two engines can share errors; external review remains required.

Next bind this new wallet lifecycle to canonical headers and state proofs, reusing the existing registry pipeline without treating its older28-operation evidence as coverage of this21-operation fixture. Independent persistence reproduction remains separately pending. PR16's receipt-error fix has not landed.
