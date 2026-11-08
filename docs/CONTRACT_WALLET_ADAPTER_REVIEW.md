# Contract-wallet validation in the constructor candidate

The combined-guard candidate previously routed settlement only through EOA recovery. A separate research variant now selects EOA recovery for an owner with no code, or a bounded ERC-1271-style static call for an owner with code. The explicit EOA entry point rejects a code-bearing owner rather than bypassing its wallet validation rules. Account ID, epoch and stake-root checks remain in both branches; settlement uses the new dispatcher.

This reuses the earlier paid-action probe's experimental profile: signature at most 4096 bytes, 100000 validation gas, copying only the first return word and requiring at least 32 returned bytes with the magic prefix. It is not a newly adopted universal wallet policy. [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) requires non-mutating validation and allows context-dependent behavior; its security guidance warns that hardcoded gas limits can exclude valid wallets. This experiment deliberately retains that compatibility limitation for bounded testing.

## Executed evidence

Sixteen deployed local-EVM validation cases pass: valid wallet, rejecting direct EOA-entry use for a contract owner, bad magic, revert, short return, empty return, attempted state write, exhausted gas, large return with bounded copying, changed signature, changed digest, stale epoch, wrong root, 4096-byte signature, over-limit signature and restored wallet mode. The attempted write leaves wallet storage unchanged.

The configurable wallet fixture compares the expected digest and signature hash; it is not a deployable custody wallet or a demonstration of a real wallet's signer scheme. Its large-return case returns 8192 bytes, while the caller copies one word. Validation failure does not fall back to EOA recovery.

The unchanged ordinary-account constructor/lifecycle harness also passes with the new dispatcher. That covers existing EOA settlement and normal operations. A subsequent contract-owned deposit/stake/post/withdraw call-level lifecycle now passes, including rejected-validation rollback and ownership transfer; see below. Neither the earlier signed/two-engine fixture nor this call-level result proves EIP-7702 authorization handling, NFT admission or general wallet compatibility.

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

## Contract-owned lifecycle follow-up

The unchanged adapter source was exercised through a separate test wallet whose controller can forward calls and configure validation. Constructor creation, token approval/deposit, staking, wallet-authorized posting, unstaking, withdrawal and account transfer all execute. The test checks the exact fee split and rounding dust, backing versus liabilities, stake versus credits, nonce advancement and final balances.

Negative cases reject wallet validation, replay, a direct withdrawal by the wallet controller, an unauthorized forwarding caller, old-wallet access after transfer and an old-epoch intent. Each failed action leaves the observed account state unchanged and emits no logs. After transfer, the new ordinary owner passes EOA signature validation, unstakes and withdraws. A second paid action by that owner is not claimed.

Final account-one credit and stake are each 998 tokens; the previous wallet and new owner each received one token through withdrawal. This uses the mock token's 18-decimal units. Other accounts retain the checked fee rewards; one base unit remains rounding dust.

```sh
node --max-old-space-size=256 run-wallet-lifecycle.mjs /absolute/path/to/new-wallet-lifecycle-output
```

The fixture's configurable digest/signature hash is not a real wallet signer implementation. This is deployed local-EVM call execution, without direct storage injection, but not signed Ethereum transaction replay, public-chain acquisition, independent reproduction, EIP-7702 proof or full-suite certification. The next gate is signed capture and reconstruction for this exact wallet variant. README remains unchanged.

## Signed wallet capture and history commitments

The same fixture now executes as 29 signed legacy Ethereum transactions on a temporary loopback Anvil chain (31337, Shanghai), using synthetic funded genesis accounts. No impersonation, deployed-code injection or storage injection is used. The controller signs wallet-forwarding transactions; the contract's application-signature decision still uses the test fixture's configured digest/hash, not a real custody signer scheme. All local services were stopped after capture.

The existing header/body/receipt/sender readers accept the 29-transaction capture. Nine negative controls reject missing or reordered blocks, changed raw bytes, missing transactions/receipts, changed receipt status, wrong chain and altered event bytes. The fixture-count assertion changed from 26 to 29; the underlying cryptographic readers did not change. Start/end hashes are selected from this local capture, not independently authenticated checkpoints. Genesis remains preserved; header-chain verification begins at block one because the existing Shanghai reader does not accept the extra genesis fields exposed by Anvil.

The existing accounting model explicitly rejects this fixture with BOUNDED_HISTORY (29 versus 26). Its ordinary-account rules do not yet model the wallet deployment, configuration and forwarded calls. Final balances above are lifecycle assertions, **not independently reconstructed wallet accounting**. Do not remove the count guard and treat that as wallet support. Next: extend a separate bounded model for the exact wallet fixture, then compare storage proofs and transaction replay. No full-block replay or consensus/finality proof is claimed.

The first boundary-test wrapper matched only the assertion label; Node also included the differing counts. That wrapper failed and was retained. Matching the label plus actual29/expected26 confirms the intended rejection without changing the accounting reader.

Collector usage: `node run-signed-lifecycle.mjs /new/output http://127.0.0.1:PORT` against the same synthetic genesis/chain/fork setup; it requires ethers6.16.0 in addition to the pinned experiment dependencies. Then `node check-history.mjs /new/output/acquired-history.json /new/verified-history.json`. The complete raw capture remains local pending a reviewed publication package; this increment publishes collector code and scoped summaries only.

## Wallet-aware accounting and transaction replay

A separate 29-transaction model now recognizes the exact test wallet creation code, controller-only configuration and canonical forwarded calls to the token or vault. It preserves the original ordinary-account model. Successful contract-authorized posting is checked against the fixture's configured digest, signature hash and rejection flag; this models that fixture only, not arbitrary ERC-1271 wallets.

Reconstruction matches every final lifecycle balance, stake, owner, epoch, nonce and root. The full EthereumJS transaction processor also matches all 29 receipt outcomes (23 success, six reverts), logs and gas usage. Twenty-one storage values and four native account balances are verified against the reconstructed execution root. Total gas is 10021906. Account one's credit and stake are each 998 tokens; the wallet and new owner each hold one withdrawn token. Vault backing is 6018 tokens, equal to liabilities plus one base unit of dust.

Eight semantic negative controls reject wrong controller configuration/forwarding, an unexpected target, noncanonical offset, truncated forwarding, rejecting wallet state, changed digest and changed signature hash. These edited model inputs are not valid signed histories. Seven existing execution/proof controls also pass, including changed claims/nodes, missing storage, spent nonce, unfunded sender and wrong chain.

The reconstructed root is `0x43a1daedd9fd6d3209e537a0f1c81048c4ca49050c855d85d427f457d5d29c7e`. It differs from the captured Anvil header root; the proof verifier rejects using that original root for these reconstructed proofs. This is transaction execution under selected captured contexts, not a claim to repair or authenticate Anvil headers, perform full block replay, prove consensus/finality, or obtain independent human review. Failed transactions are skipped by the arithmetic model according to receipt status; their failure is separately checked by VM execution.

The earlier accounting rejection remains valid for the older reader. The new separate model supersedes that limitation only for this exact test fixture. Next: full-block/second-engine comparison for the wallet variant and a reviewed reproducible raw input package. README remains paused.

The replay command is `node reexecute-transactions.mjs /input-directory /new-output`; input files are acquired-history.json, compiler-output.json and genesis.json from the signed wallet capture. It requires the same pinned VM dependencies as the constructor replay experiment. `check-model.mjs` takes the verified-history file, capture execution directory and a new result path.
