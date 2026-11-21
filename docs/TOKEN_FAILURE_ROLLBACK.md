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

## Malformed responses and failing balance queries

A separate extended fixture now passes22failure cases and11recovery cycles, retaining the original10cases and adding12. Both deposit and withdrawal reject: empty transfer return data,31byte transfer return data, a32byte invalid boolean value2, a reverting balance query, a31byte balance response, and a balance query that starts reverting only after transfer changes token state.

The fixture exposes raw balances separately so the test can inspect state even while balanceOf fails. Comparisons cover vault account state, raw token balances, allowance and a token mutation flag. Token return-data failures happen after attempted balance/allowance changes; all changes and the flag roll back. Failed operations emit no logs. Normal operation restored between cases allows all11deposit/withdraw cycles. Final user balance is1000units; vault balance/credit/liabilities are zero; allowance is900from an initial2000after11successful100unit deposits. Rejected deposits consume no allowance.

The vault source is unchanged. This is local EVM call evidence with a separate fault token, not signed transaction or second-engine coverage of the faults. The raw-balance accessor is a test observation mechanism, not part of the production token interface. Production token compatibility remains unproven.

An important consequence: successful token transfers that return no data are rejected by the current typed interface. These tests do not justify silently treating empty return data as success. Any optional-return adapter must be a separate reviewed change with exact supported-token behavior and balance invariants. Reverting or malformed balanceOf also blocks operations; rollback preserves credit but cannot restore availability. Dishonest but well-formed balance reporting and gas exhaustion remain untested here.

Run the same lifecycle command in `experiments/c007-token-responses/` with a new output directory. Earlier failure fixtures and evidence remain unchanged. Next: bounded gas-exhaustion tests and the limitations of trusting external balance reports, without adding an administrator or migration bypass. README remains paused.
