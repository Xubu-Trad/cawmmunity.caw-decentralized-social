# Token failure and custody rollback

The unchanged constructor custody candidate was deployed with a separate fault-injecting token. Five token behaviors were tested on both deposit and withdrawal: false return, revert, mutate balances/allowance then return false, return true without transferring, and credit the recipient one unit short. All ten operations revert with the expected error and no logs. Account credits, liabilities, stakes, ownership, nonce, token backing, user balance and allowance match their pre-attempt values.

After each deposit failure, restoring normal behavior permits deposit. After each withdrawal failure, restoring normal behavior permits withdrawal. Five complete recovery cycles leave credit/liabilities/vault balance at zero and the user at the original1000units. Allowance ends at500because five successful100unit deposits consumed it; rejected deposits consumed none. This also checks the custody guard is not left locked after rejection.

These are local deployed-EVM call tests, not signed transactions or second-engine proof. The token fixture has unrestricted mint/mode controls solely for fault injection; it must never be used as a production token. The vault source is unchanged, but this run uses a different token contract and does not inherit earlier replay certification. Callback behavior has separate earlier experiments; this increment isolates token return/transfer semantics.

## Safety is not availability

Rollback prevents a failed token operation from consuming recorded credit. It does not make an unavailable or malicious token transfer funds. The TOKEN address is immutable. A permanently reverting, blacklisting, upgradeable or otherwise incompatible token can strand usable balances even with correct rollback. The current tests assume truthful balanceOf reporting. They do not cover dishonest/reverting balance queries, malformed return data, gas exhaustion, rebasing, production token authority or all fee-on-transfer behavior.

Production remains blocked on exact-token selection, chain/address/code and authority verification, supported behavior decisions, further negative tests and independent review. No rescue administrator, forced migration or hidden withdrawal bypass was added. Any migration/recovery proposal must resolve its authority and economic consequences publicly before implementation.

## Reproduce

```sh
cd experiments/c007-token-failure
npm ci --ignore-scripts --no-audit --no-fund
node --max-old-space-size=256 run-lifecycle.mjs /absolute/path/to/new-output
```

Recorded Node20.20.2/Solidity0.8.30/EthereumJS10.1.3, Shanghai, existing pinned dependencies. No clean-install, CVE audit, full-suite or production compatibility claim. Next: malformed token returns and failing balance queries, while preserving rollback evidence. README remains paused.
