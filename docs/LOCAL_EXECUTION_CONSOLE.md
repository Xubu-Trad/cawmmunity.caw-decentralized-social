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

## Browser withdrawal verification — November 12, 2026

The console now independently encodes the fixed research withdrawal and compares it with the server's transaction bytes before displaying a review or asking for approval. This closes a display-versus-calldata gap: matching amount labels alone did not establish that the transaction requested that amount. Changed account, epoch, destination, selector and extra bytes reject.

Connection replies arriving after an account/network event are rejected. Refreshes are serialized and block connection/submission controls while state is loading. Receipt checking retains the submitted hash across missing/error responses and blocks another withdrawal while confirmation is pending. A mined result must match the reviewed sender, recipient, calldata and zero native value, and the selected local chain's canonical block. Reverts are reported separately. Balances refresh after confirmation. These are consistent trusted-RPC observations, not cryptographic inclusion proofs or public-chain finality.

**Executed evidence:** 75/75 focused tests pass, including an independent ethers ABI-encoding comparison. An isolated Edge 157 browser passes 16 page-level cases using a controlled EIP-1193 adapter and the public disposable fixture signer. The actual signed Geth withdrawal mined: credit 2 to 1, contract-wallet mock balance 0 to 1, custody 10 to 9. Tests cover absent wallet, no automatic wallet requests, wrong chain/controller, rejected connection/signature, an account-change race, cancelled/changed review, corrupted calldata, wrong genesis, pending receipt, receipt RPC failure and recovery. The mobile layout fits the viewport; desktop/mobile captures were inspected locally.

**Boundary:** This is browser integration with a test adapter, not a MetaMask or other wallet-extension compatibility run, not a fresh independent builder's reproduction, and not public-chain authentication. The standard in-app/native browser-control tools failed to initialize. An initial restricted headless run failed before loading the app; a normal-access isolated run passed without disabling browser security. Failed evidence remains preserved locally. No real assets or personal wallet were used.

### Reproduce the browser test

With the disposable chain/console running and the isolated console ethers dependency installed, run:

```text
node integration/local-console/test-browser.mjs PATH_TO_CHROMIUM_OR_EDGE http://127.0.0.1:4200 LOCAL_RPC_URL NEW_EVIDENCE_DIRECTORY
node --test integration/local-console/test-wallet-provider.mjs integration/local-console/test-receipt-status.mjs integration/local-console/test-withdrawal-plan.mjs
```

The browser test requires a fresh fixture with two units of credit. It creates its own browser profile, injects only a test wallet adapter, performs one signed local withdrawal, and closes its owned browser. The adapter is test code only; it is not served by the application. No wallet extension is installed or modified.

### Use an actual disposable browser wallet

Open the console in a browser that provides an EIP-1193 wallet. An in-app browser without a wallet extension will report that no compatible wallet was found. Configure the **launcher-printed loopback RPC URL**, chain ID **31337**, and a local-only disposable account. The existing fixture controller uses the publicly known test private key consisting of 63 zeroes followed by 3 (hexadecimal); never send real assets to it. Its address must match the controller shown in the console. The console does not receive or store that key, change wallet networks, or request accounts before you click Connect.

Click **Connect local test wallet**, enter **1**, then **Review withdrawal**. The recipient is the contract wallet, not the controller. Click **Approve in wallet** only after checking the local chain and plan. A pending result exposes **Check transaction receipt**; an RPC error retains the hash and must not be treated as failure to submit. Once confirmed, expect credit 1, wallet 1 and custody 9 from a fresh fixture. [Saved withdrawal recovery](LOCAL_WITHDRAWAL_RECOVERY.md) now restores pending submissions across page reloads and retains unknown outcomes for nonce-bound hash verification. No automatic resubmission occurs. Direct extension compatibility remains unverified until someone performs this check.

## Current application update: saved withdrawal recovery

The console now saves the reviewed intent before wallet submission and checks the exact sender nonce when recovering it. Reloading can resume receipt verification. If the wallet broadcast but the page missed its response, the user can verify a transaction hash from wallet activity; a prior identical withdrawal with a different nonce is rejected. Unreadable or mismatched records block new submissions and remain copyable. See [behavior, results and limits](LOCAL_WITHDRAWAL_RECOVERY.md).

Twenty-two browser cases, 178 focused Node checks and ten Python test methods pass. The browser test uses a controlled adapter, not a real wallet extension. Browser storage is not an OS-crash durability guarantee, and a different transaction replacing the saved nonce has no implemented resolution flow yet.

## Remaining gates

The old alpha frontend remains a simulation; this is a separate real local execution console on draft PR19. It is not a deployed public CAW application. The token, account population and economics remain research fixtures. Public registration, general wallet support, scalable settlement, authenticated public-chain operation and C-007 decisions remain open. Connecting a wallet does not resolve those requirements.

Next implement user-configured disposable account setup and integrate the signed action lifecycle while resolving registration/economic choices through review. Avoid another series of same-host recovery tests as the primary development activity.
