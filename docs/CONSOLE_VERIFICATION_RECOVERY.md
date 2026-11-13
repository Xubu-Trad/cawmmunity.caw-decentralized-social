# Interrupted console verification and recovery

## Reproduced defect and fix

At baseline `254fc0361132a353bf89fd92fb23e6bed6870979`, disconnecting a strict-history HTTP request did not cancel its pending upstream proof request. The focused regression failed with `CANCELLATION_NOT_PROPAGATED` after waiting1.2 seconds for the upstream connection to close. The existing three-second RPC timeout still bounded that pending read; this was a cancellation/recovery defect, not acceptance of an invalid proof.

The verified-history panel now owns an abort controller. Refresh, action confirmation or a newer verification invalidates the old generation **and** aborts its request. The server propagates a disconnected response through acquisition into its pending RPC fetch/body read; acquisition checks cancellation before and after each read. The busy guard is released in `finally`. A disconnected response is not written to again. Generation checks remain in place even when a transport or test double delivers an old result after cancellation.

No transaction, receipt, header, signature or state-proof acceptance rule changed. The existing timeout and resource limits remain. Cancellation stops pending asynchronous acquisition; it does not promise immediate preemption of synchronous cryptographic work.

## Recovery behavior

- No partial post list is returned or displayed as verified history.
- A truncated response or RPC timeout rejects the attempt. There is no RPC-log fallback.
- Retry acquires the complete history again; no partially checked evidence or acceptance is persisted.
- Late results cannot overwrite a newer verified view or a view cleared for another action.
- The console still serializes API work. A retry while another refresh is running can return `BUSY`; wait for refresh to finish and retry explicitly. Busy is not proof of empty history and does not bypass checks.

## Evidence

Eleven focused checks passed using the previously verified synthetic posting history over real local HTTP sockets: initial acceptance; client disconnect at registry-proof, last-receipt and final-proof reads; truncation at those three points; the actual existing RPC timeout; server-instance recreation and full reacquisition; a late old response body after a newer acceptance; and action-confirmation cancellation. Each interrupted read is followed by a successful clean retry. The disconnect checks also require the upstream connection to close and no later acquisition requests to occur.

The12 existing console integration checks and340 wallet/action/receipt regressions passed. A separate real Chrome run against the preserved local Geth database passed8 checks, including response-delivery interruption, cancellation by refresh, reacquisition, literal text rendering, BOM preservation and offline failure recovery. No new chain transactions were submitted. Temporary browser, node and console were stopped; the existing user console was untouched.

The first browser recovery attempt timed out when it retried soon after starting a chain refresh. A rerun explicitly waiting for the refresh to complete passed. The failed attempt is retained; no broader claim about its exact timing cause is made. This remains same-operator testing. Server-instance recreation is not a process-crash durability experiment. These tests do not establish public-chain finality, independent operation, arbitrary wallets or broader protocol safety.

## Reproduce

Use Node20.20.2/npm10.8.2 and the complete research checkout containing these changes:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix integration/local-console
node integration/local-console/test-console-interruption.mjs evidence/posting-history-20261113
node integration/local-console/test-console-history.mjs evidence/posting-history-20261113
```

These commands use recorded signed history/proofs and disposable loopback HTTP servers; they do not start an EVM node, sign transactions or use funds. The focused test has an actual three-second timeout case. Preserve failures instead of lengthening or removing verification limits to make a run pass.

The browser exercise is separately reported, not part of those two commands. Its driver used WindowsNode24.22.1/Chrome while the console used LinuxNode20.20.2. It paused response delivery through the browser debugging interface, refreshed the page's chain state, waited for that request to finish, and retried. The browser still trusts its local server's verification result. Reviewed code/layout/controller selections and the local chain endpoint remain assumptions.

[Focused results](../evidence/console-interruption-20261113/tests.json) · [Browser results](../evidence/console-interruption-20261113/browser.json) · [Baseline failure](../evidence/console-interruption-20261113/baseline.json) · [Console integration](CONSOLE_STRICT_HISTORY.md)


## Frozen console reproduction package

[The pinned53-file runner](CONSOLE_HISTORY_REPRODUCTION.md) now installs into a fresh directory/cache and runs the strict-history, HTTP-recovery and action checks with an output receipt. It uses recorded synthetic inputs; independent execution, browser and fresh-chain reproduction remain separate.
