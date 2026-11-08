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
