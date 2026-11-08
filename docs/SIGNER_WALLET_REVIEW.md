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
