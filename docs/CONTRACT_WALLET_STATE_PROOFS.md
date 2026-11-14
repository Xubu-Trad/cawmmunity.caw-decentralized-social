# Wallet custody and runtime proofs; canonical-context second engine

## Verified result

EthereumJS replayed the exact 21 signed transactions using the captured local Geth block numbers, timestamps, base fees, coinbase and randomness, starting from the complete preserved genesis allocation. All 21 resulting state roots match the captured headers and prior Geth t8n replay. Gas, statuses, transaction hashes/signatures and event logs also match. These blocks have no withdrawals. This extends the earlier repeated-context engine comparison to the actual local captured block contexts.

At that same final header, strict account/storage/code proofs now cover three additional contract accounts:

- Mock token: four balances (payer90, custody8, wallet1, new owner1), remaining allowance90 and reset outbound failure mode0.
- Custody: next nonce2, unpaid liability8, unallocated budget8, reentry flag0, credited liability0, credits for accounts2/3/4 all0, two remaining record budgets4 each and both account2 claim flags set. Twelve fields in total.
- Test wallet: its account proof commits to the runtime code hash. Recompiling the preserved source and inserting the constructor-selected controller into the compiler's immutable references reproduces that runtime exactly. The controller is immutable runtime data, not a storage slot; no controller-storage proof is claimed.

Together these are 18 new storage fields, in addition to the prior 16 registry fields. Sixteen negative cases reject across the three accounts: changed runtime, wrong header, damaged account node, wrong selected code hash, and (for contracts with selected slots) wrong value or missing storage proof.

The remaining8 mock units back8 unpaid/unallocated units. Account2 credit is exhausted after one unit goes to the wallet and one to the later NFT owner. This proves the selected final balances and commitments, not that all possible accounting histories or wallets are correct.

## Reproduce

Use the existing pinned Node20.20.2, solc0.8.30, ethers6.16.0 and EthereumJS10.1.3 research dependencies. Run from the PR19 research branch; OUTPUT_DIRECTORY must not exist.

```text
node --max-old-space-size=256 integration/core-baseline-v1/replay-wallet-canonical-state.mjs evidence/wallet-headers-20261112/capture.json evidence/wallet-headers-20261112/genesis.json evidence/wallet-verification-20261112/input/compiler-input.json OUTPUT_DIRECTORY
node integration/core-baseline-v1/verify-wallet-full-proofs.mjs evidence/wallet-state-20261112
```

Compare the generated selection.json with the published selection.json before using its expected code hashes and slots. The proof reader pins the retained terminal header hash. The preserved input bytes and scripts have SHA-256 records in PROVENANCE.txt. The replay starts with an independently rebuilt genesis root; it does not start from the final proof's asserted state.

## Boundaries

Both engines ran on the same host under one operator. Independent operator reproduction is still pending. This remains a local synthetic chain: no public consensus, finality, real CAW backing, ERC1271/4337 compatibility, accepted registration/economic rules or production approval is established. The mock token intentionally has unrestricted test failure controls and must never be used as a production token.

This replay compares state roots, gas, status and logs; it does not independently construct EthereumJS transaction/receipt tries. Those roots were checked by the earlier Geth replay. Headers were separately hashed in the preceding evidence package. No intermediate custody storage proofs or arbitrary-contract BLOCKHASH coverage are claimed.

The first harness run reached the storage comparison but failed to parse the empty byte representation of a zero slot. That failed lane is retained. The correction maps only empty bytes to zero; it does not bypass proof checks or alter execution rules. The corrected run passes.

## Next gate

Exercise the wallet lifecycle through the existing independent reader/recovery path so an operator can verify the same selected state after losing a node or replacing a peer. Keep independent reproduction and public-chain authentication as separate gates. PR16's receipt-error envelope fix remains pending.
