# Wallet mode changes under a fixed signed post

FACT — the unchanged `TestSignatureOwner` and paid-action probe produce accepted, rejected, restored acceptance for the same signed post. Only the wallet's validation mode is intentionally varied (0, 1, 0). Block metadata and the configuration sender's transaction nonce necessarily advance. The wallet owner, account epoch, post nonce, balances, message, signature and call bytes remain fixed. Read-only post simulations do not consume the action nonce.

The setup and three configuration changes use 16 signed local transactions with public test identities. Native gas and the token fixture are synthetic. No real wallet, impersonation or remote provider is used. This deliberately publicly configurable wallet is a test fixture, not a proposed secure wallet.

Each observation records the selected header, configuration receipt, mode readback, unchanged accounting and exact call/response. Reads use `latest`, with the header checked unchanged before and after the observation. They are not hash-pinned calls or independent execution proofs. The initial numbered-block attempt was refused by the existing transport; its raw capture and runner are retained privately. The transport and resource guards were not relaxed.

Five regressions check retained bytes, the three outcomes, unchanged accounting, mathematical inner-signature validity even during the rejected mode, and refusal to treat the wallet address as that ordinary signer. All 1183 Node tests across 66 files passed. The first focused check had an incorrect expected error-code spelling; the existing verifier rejected correctly and was unchanged. [Validation record](../evidence/WALLET_STATE_TEST_RESULTS.json).

INFERENCE — a valid inner signature is insufficient to establish contract-wallet permission. The wallet's state affects the decision. Endpoint observations do not establish the state at an earlier historical call, and configuration receipts alone do not prove all execution effects.

## Reproduce

Hash `experiment-inputs.json`, then run in the existing guarded Windows environment with a new output filename:

```text
python experiments/paid-wallet-state/run_wallet_state.py --anvil PATH_TO_PINNED_ANVIL --output NEW_RAW.json --expected-input-sha256 INPUT_MANIFEST_SHA256
node --test tests/paid-wallet-state-acquisition.test.mjs
```

The Node tests read committed `observations.json`, a projection of the successful raw run. The raw SHA-256 is recorded in that projection. The retained public fields are schema, wallet, intent, observations, deployments, submissions and input manifest hash, plus explicit local/trust-limit labels. No raw transcript replay is claimed. Fresh signature randomness and block times may differ.

UNRESOLVED — next establish a separately scoped execution witness at the transaction position, including wallet/probe code, relevant storage and external dependencies. The current test uses simulations rather than mined posts and London rules rather than EIP-7702. No ERC-1271, execution, historical authority or production acceptance flag is raised by this experiment.
