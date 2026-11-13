# Local chain-connected wallet console

This is an executable application slice, not a simulated balance screen. It reads deployed contracts on a private local Geth chain, prepares a withdrawal for the selected contract wallet and requests an explicit signature from an injected browser wallet. The server never receives signing keys and does not submit transactions. The smoke test alone uses the existing public disposable research signer.

## Implemented

- Terminal-style account/credit/custody view backed by block-bound RPC calls.
- Chain31337, selected genesis, four runtime hashes and immutable controller checks.
- Fixed account2 withdrawal encoding; positive bounded amount, actual credit and ownership checks.
- Browser connection on explicit click, separate review and signature buttons, plan invalidation on wallet/account/input changes.
- Before submission the wallet provider must match the selected genesis and block, not just chain ID. Account/network are rechecked after the provider calls.
- Loopback serving, Host/Origin checks, request/RPC limits, no redirects or external assets.

## Local use

Checkout the PR19 research branch. Install the isolated console dependency from integration/local-console/package.json using npm install --ignore-scripts in that directory. Use the already reviewed local Geth executable and Node20.20.2; no external chain RPC is used. From repository root:

```text
python3 integration/local-console/launch.py --geth PATH_TO_REVIEWED_GETH --capture evidence/wallet-headers-20261112/capture.json --genesis evidence/wallet-headers-20261112/genesis.json --selection evidence/wallet-state-20261112/selection.json --registry-proof evidence/wallet-headers-20261112/evidence.json --output NEW_LOCAL_DIRECTORY
```

The launcher initializes a new chain and submits the first10 existing signed fixture transactions, leaving the contract wallet with two mock units of withdrawable credit. It prints the local RPC address; the UI is http://127.0.0.1:4200 (PORT can override the UI port). Configure only a disposable test wallet for this RPC. The fixed fixture controller is the public test account derived from key3; never fund these test accounts on a public network. Existing inputs/configuration and the local RPC remain explicitly trusted. This is not general account onboarding.

Stop the launcher with Ctrl+C to stop its owned services. Failed startup logs and data stay in the selected directory; use a new directory for a new run. For a headless actual transaction check add --smoke. The smoke test signs only a mock withdrawal on this new local chain.

## Validation

The actual local transaction mined successfully: credit2 became1, wallet token balance became1, custody became9. Wrong genesis, wrong runtime, cross-origin requests and four invalid amounts rejected. Nine wallet-provider tests pass, including wrong/missing selected block, wrong genesis and account/network changes. HTTP serving of the UI and live state was checked. The in-app browser preview could not initialize, so no browser-wallet click-through or visual approval is claimed.

An independent code review identified missing injected-provider chain binding; that was implemented and tested before packaging. A preview restart initially hit an occupied port; only the prior task-owned service was stopped, and launcher nonzero-exit reporting was corrected. Failed lane preserved.

## Remaining gates

The old alpha frontend remains a simulation; this is a separate real local execution console on draft PR19. It is not a deployed public CAW application. The token, account population and economics remain research fixtures. Public registration, general wallet support, scalable settlement, authenticated public-chain operation and C-007 decisions remain open. Connecting a wallet does not resolve those requirements.

Next implement user-configured disposable account setup and integrate the signed action lifecycle while resolving registration/economic choices through review. Avoid another series of same-host recovery tests as the primary development activity.
