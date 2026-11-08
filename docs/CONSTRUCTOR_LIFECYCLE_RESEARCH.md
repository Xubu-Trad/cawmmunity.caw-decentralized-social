# Constructor-initialized local lifecycle

This extends PR #18 at `843d59b2097d5d75242bf6a887f870e2ad034125` without changing its original source or evidence. It removes the positive-path dependency on installed runtime bytecode and injected vault storage. The token and vault are created through their compiled creation bytecode; the vault constructor fixes the token and three synthetic owners and computes the zero-stake tree for accounts 1–3. There is no root setter. Credits, stake, liabilities, dust, epochs and nonces start at zero.

## What ran

On Node v20.20.2, solc 0.8.30, EthereumJS EVM/common/util 10.1.3 and Shanghai rules, the final run records **20 successful creation/call operations and 8 expected rejections**. These are operation counts, not a full suite or independent audit. The first lifecycle run is retained privately; the final run adds transfer-away/return signature rejection.

The sequence creates the mock token, rejects invalid constructor inputs, creates the vault, checks its zero state/root, mints test tokens through the mock API, rejects an unapproved deposit, approves and deposits, stakes through real contract calls, signs and settles a post, rejects replay, transfers recipient authority, withdraws rewards and rejects a queued old-epoch post after payer ownership returns. No `putCode` or `putStorage` appears in this harness.

Assertions check credit totals, total stake, token backing including dust, exact fee debit, independently calculated floor shares, nonce consumption, unchanged state on the tested rejections, and exact message event bytes. Recorded creation/call inputs, logs, compiler inputs/output and state snapshots are in [the evidence directory](../evidence/c007-constructor-20261108). Each successful external operation uses the same deployed vault instance.

```sh
cd experiments/c007-constructor
npm ci --ignore-scripts
node --max-old-space-size=256 run-lifecycle.mjs /absolute/path/to/new-output-directory
```

The recorded run reused existing dependencies with the four declared versions checked; a clean `npm ci` installation was not rerun. The existing PR #18 lockfile is retained. Node20.20.2 was used for this research run, not the root package's declared24.20.0. Execution was bounded to180seconds,512MiB RSS,256MiB Node heap and10MiB logs, with resource preflight. Reproduction on another operator remains open.

## Remaining boundaries

`createEVM.runCall` executes contract creation and calls, but it is not a mined signed Ethereum transaction path. No transaction envelope/receipt-root acquisition or network fees are proven. Native balances are not needed by this call-level harness. The owners are three constructor-selected synthetic identities; `transferAccount` is not an ERC-721 implementation. The mock token has unrestricted test minting. The token address is immutable, but arbitrary-token callback/fee/rebase compatibility is not established.

Economics remain PR #18's provisional fixed-pool model: payer account1, recipients2/3, fee5000×10^18, floor shares and retained dust. It is not scalable distribution or an adopted solution to C-007. Strict UTF-8 scalar counting remains provisional C-004 behavior. C-001 original-token registration is not solved. Test-only failure injection in `changeStake` is preserved; this is not deployable production code.

## Next integration gate

Execute this same constructor/deposit/stake/post/withdrawal sequence as signed transactions on a controlled local chain. Acquire receipts and transaction bytes through the existing readers, and demonstrate reconstruction against the exact candidate. Then replace synthetic identity with the reviewed NFT authority path. Preserve existing adversarial cases and resolve economics explicitly; do not infer production approval from constructor success.
