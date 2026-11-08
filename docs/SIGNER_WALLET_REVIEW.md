# ECDSA signer-wallet research fixture

This separate fixture replaces configurable expected digest/hash validation with recovery of a controller's ECDSA signature. The constructor rejects a zero controller. The controller is immutable; there is no key rotation or recovery. Only that controller can forward calls. Validation requires exactly65bytes, v27or28, nonzero low-s and a recovered nonzero address matching the controller. It returns ERC-1271 magic on acceptance and failure magic otherwise. This is purpose-built research code, not an audited custody wallet or general wallet-compatibility implementation.

The vault source is byte-identical to the previous adapter. Its experimental100000gas/4096byte profile and all prior limitations remain. The existing frozen configurable-wallet package is unchanged; its two-engine evidence does not cover this new signer bytecode.

## Executed checks

Sixteen deployed local-EVM validation cases pass: valid controller, wrong signer, changed message, changed nonce, empty/short/overlength signatures, invalid recovery ID, high-s malleability, zero-s, zero-r, direct EOA bypass, stale epoch, wrong stake root, another contract's typed-data domain and a valid signature after rejection cases.

The full local call lifecycle also passes: wallet forwarding for approval/deposit/staking, cryptographically signed posting, wrong-signature rollback, replay rejection, unauthorized withdrawal/forwarding rejection, unstake/withdrawal, transfer, old-wallet rejection and new-owner validation/withdrawal. Final account-one credit/stake are998tokens each; the wallet and new owner each received1token; backing and fee rounding reconcile. Application signatures are real ECDSA signatures from disposable test keys. Calls themselves are not signed Ethereum transactions in this increment.

```sh
cd experiments/c007-signer-wallet
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 run-wallet.mjs /absolute/path/to/new-validation-output
node --max-old-space-size=256 run-lifecycle.mjs /absolute/path/to/new-lifecycle-output
```

Recorded Node20.20.2, Solidity0.8.30, EthereumJS10.1.3 under Shanghai using pinned existing dependencies. No clean dependency installation or full repository suite is claimed. Next: signed transaction capture and model/replay support for this exact signer fixture. EIP-7702, arbitrary wallets, key recovery, quantum resistance, production readiness and independent review remain unproven. ECDSA validation is not a post-quantum defense. README updates remain paused.

## Signed capture and accounting follow-up

The exact signer fixture now has27signed legacy transactions on a temporary local Shanghai chain:21successes and6expected reverts. The two configurable-wallet setup transactions are absent. Local services stopped after capture. Sender/header/body/receipt readers pass with nine corruption controls. The application signature is recovered independently by the bounded accounting model against the fixture controller; there is no configured-digest acceptance path in this model.

Full transaction execution matches outcomes, logs and gas9908964. Twenty-one storage values and four native account balances verify against reconstructed root `0x5b433f3bcc261ae030028f2d003f1433c34aec9284fa7d26c4d386728ecf4340`. Final accounting matches the capture. Five model controls reject wrong forwarding controller, unexpected target, noncanonical offset, truncated forwarding and a wrong application signer. Seven transaction/proof controls pass. Model mutation tests deliberately alter semantic inputs and do not represent valid signed histories.

The arithmetic model skips receipt-failed transactions; VM execution separately checks those failures. The original Anvil root still differs from reconstructed execution and is rejected by the proof check. No full-block or second-engine result for this signer bytecode is claimed yet. Earlier configurable-wallet results cannot substitute for it. Raw signer inputs remain local; this increment publishes code and summaries. Next: separate frozen signer package, full-block replay and Geth comparison. README remains paused.

The collector requires ethers6.16.0 in addition to the existing dependencies and the same loopback Anvil31337/Shanghai synthetic-genesis setup. The accounting/replay runner requires the constructor experiment's pinned VM dependencies. This increment used installed pinned dependencies; it does not claim a clean installation or independent external reproduction.

## Signer-specific block replay and Geth comparison

Fresh replay of27constructed synthetic blocks matches every state root and transaction/receipt root. Seven block corruption controls pass. Geth1.17.10 matches all27transitions against EthereumJS10.1.3, with21successes,6reverts, four native balances and six comparison/execution controls. Eight input-integrity checks pass. The final root is `0x5b433f3bcc261ae030028f2d003f1433c34aec9284fa7d26c4d386728ecf4340`.

The four frozen inputs (566318bytes) are published separately in `evidence/c007-signer-replay-20261108/`. Their exact digests are pinned in the signer comparison script. The data scan found no path/credential-pattern matches; all transaction senders are the known disposable synthetic actors. This is reviewed synthetic data, not production wallet history.

Use Python3 standard library on Linux amd64 and the pinned Geth evm binary described in [tool acquisition instructions](WALLET_REPLAY_REPRODUCTION.md). No Node, RPC or credentials are needed for this comparison. From the checkout root:

```sh
python3 experiments/c007-signer-wallet/check-replay-inputs.py experiments/c007-signer-wallet/compare-geth-transition.py evidence/c007-signer-replay-20261108 evidence/c007-signer-replay-20261108/blocks.json /absolute/path/to/new-check-output
python3 experiments/c007-signer-wallet/compare-geth-transition.py evidence/c007-signer-replay-20261108 evidence/c007-signer-replay-20261108/blocks.json /absolute/path/to/evm /absolute/path/to/new-replay-output
```

The prior configurable-wallet package is unchanged. Synthetic genesis fee1142857142 and26timestamp adjustments define this new constructed chain; it does not repair or authenticate the original Anvil chain. Geth t8n validates transitions under supplied contexts, not consensus/full headers. This is not external human review, a clean source build, general wallet compatibility, key recovery or EIP-7702 certification. README remains paused.

## Contract-wallet ownership round trip

A separate local-call regression deploys two signer wallets with different controllers. After account1 transfers from walletA to walletB, walletA can neither withdraw nor transfer the account. An intent that validated before the transfer fails with EPOCH. Signing the current epoch with the previous controller fails wallet validation; the new controller's signature passes. Unauthorized forwarding through walletB fails, while its controller can unstake and withdraw.

Transferring the account back to walletA advances epoch to2. The exact original previously valid signature remains rejected with EPOCH. A walletB signature validated immediately before return is also rejected. With the current epoch, controllerB fails and controllerA passes. WalletB can no longer withdraw. Failed attempts preserve the observed account state and emit no logs. Final credit/stake remain998tokens each, and both wallets hold one withdrawn token.

The vault and signer-wallet contract sources are unchanged. Run `node run-wallet-transfer.mjs /absolute/path/to/new-output` from the signer experiment using its pinned dependencies. This increment executes local EVM calls, not a signed transaction capture or second-engine replay of the round trip. Existing27transaction evidence covers the earlier lifecycle only. Signature validation after transfer is not a second paid-action execution. The current-root checks isolate epoch rejection around the final transfer; an additional check retains the exact older pre-transfer signature.

Next: capture and reconstruct this transfer sequence, including both wallet controllers and monotonic epochs. Account transfer remains a research account operation, not proof of production NFT admission/transfer integration. No recovery administrator or special key was added. README stays paused.

## Signed wallet-to-wallet round trip

A separate capture executes32signed transactions:23successes and9expected reverts. The model now maps both exact deployed wallet instances to their immutable controllers, rather than assuming one contract wallet. Replay matches every receipt outcome, log and gas charge (10396198gas). Twenty-two storage values and four native balances verify against reconstructed root `0x6c2aad21af54a9c8ddadd543d099414d1eb7a85b0d116cb7ddb7d325ad302bd6`. Seven existing replay/proof controls pass.

Final ownership returns to walletA at epoch2; account-one credit/stake remain998tokens and each wallet holds1withdrawn token. The source contracts remain unchanged. Read-only validation checks are not included in the32signed-transaction count. There is still only one paid post; acceptance of a later signature does not claim a second settlement.

The first collector run stopped because it propagated an expected read-only RPC revert as an unhandled error. The second collector represents that revert as a rejected call, using its returned revert data; both contract sources are unchanged, and the failed first lane is retained. This correction does not manufacture a transaction or success receipt.

Code is under `experiments/c007-wallet-transfer/`. Raw transfer inputs remain local. The previous27transaction reproduction package is unchanged and does not cover this sequence. Next: transfer-specific model corruption controls and fresh block/second-engine replay. The original Anvil-root mismatch, production NFT integration and external review remain unresolved. README stays paused.
