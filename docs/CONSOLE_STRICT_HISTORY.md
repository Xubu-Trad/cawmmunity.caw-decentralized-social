# Console strict-history verification

The local console now offers **Verify local posting history** in a separate panel below the RPC account history. The ordinary feed remains explicitly RPC-backed. Accepted history is returned only after the existing strict readers pass; there is no fallback from failed verification to RPC logs.

## Using it

Use the research checkout containing this document and the [pinned Node20.20.2/npm10.8.2 setup](REPRODUCTION_SETUP.md). Run the console against your disposable local fixture configuration as described in [local posting](LOCAL_POSTING_CONSOLE.md), then click **Verify local posting history**. When launching through a symlinked workspace on Linux, resolve the server path:

```sh
PORT=4200 node "$(realpath integration/local-console/server.mjs)" /absolute/path/to/local-console.json
```

Do not reuse an occupied port or replace another running console. No wallet connection or signing is required for verification. The displayed block hash identifies the snapshot actually checked, not an assertion that it remains the newest or canonical public state. Refresh or beginning a new wallet submission clears the verified panel; retry failure also clears it. A delayed response from an invalidated request cannot repopulate it.

## Acceptance path

`GET /api/verified-posts` acquires complete signed transaction bytes, receipts and parent-state registry/nonce/owner proofs from the configured loopback node. Proof requests select block hashes with `requireCanonical: true`. The unchanged [posting history reader](POSTING_HISTORY_VERIFICATION.md) checks hashes, roots, signatures, exact calldata/events, historical ownership and nonce continuity. The acquisition rechecks its selected endpoint and deployment-anchor hashes before returning acceptance.

The server retains its origin/Host checks, one-request-at-a-time API guard, per-RPC timeout and 128KiB response limit. This path additionally limits acquisition to128 blocks,1024 requests,8MiB total decoded JSON and30 seconds checked around RPC calls. A pending RPC still has its existing3-second timeout. Range, resource, transport, missing-data and proof errors return rejection with no accepted post rows. Proof acquisition does not call `eth_getLogs`.

## What this does not prove

Verification runs in the local console server, not independently in the browser. The browser trusts that locally run code and its response. The selected local endpoint, deployment identity, reviewed runtime/layout and fixture wallet controller remain explicit assumptions. Public-chain consensus/finality, arbitrary wallets, multiple transactions per block, independent operator reproduction and fresh source-to-fixture regeneration remain unproven. An empty deployment-only history is outside this reader's current supported range; it is not presented as an accepted empty feed.

This change does not alter posting economics, account ownership, custody or withdrawal contracts. The account-state/action-planning surface remains separate from the strict historical view. No production readiness or complete manifesto compliance is asserted.

## Evidence and reproduction

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix integration/local-console
node integration/local-console/test-console-history.mjs evidence/posting-history-20261113
```

The HTTP fixture test uses actual previously verified signed history and proofs, then changes one response at a time. Twelve checks passed: acceptance/recovery, six rejection modes (signed bytes, receipt, proof, missing receipt, JSON-RPC error and reorg), literal text rendering, clearing on failure, rejection of incomplete acceptance, and stale-response suppression. Its DOM checks use a minimal test DOM, not a browser.

Separately, a real Chrome run against the preserved local Geth database passed six checks: two verified posts rendered, markup remained literal, leading U+FEFF survived, offline failure cleared rows, retry reacquired verification, and refresh cleared the view. Existing340 wallet/action/receipt regressions passed. Browser-driver Node24.22.1 is separate from server/test Node20.20.2. No new transactions were submitted; the temporary node and console stopped and the existing user console was left untouched.

The initial live launch failed because the server entry-point check received a symlinked path; rerunning with its resolved path succeeded. An initial browser failure-injection attempt did not intercept the module's already captured fetch function; the final check used real browser offline-network emulation. Failed lanes remain preserved privately. Neither failed attempt is counted as a pass.

[Integration results](../evidence/console-history-20261113/tests.json) · [Browser result](../evidence/console-history-20261113/browser.json) · [Live reader result](../evidence/console-history-20261113/live-result.json) · [Provenance](../evidence/console-history-20261113/PROVENANCE.txt)

Next: independent execution of this pinned package, then broader supported history and chain anchoring. Server-local acceptance is a concrete step beyond a log-only feed, not removal of every trust dependency.
