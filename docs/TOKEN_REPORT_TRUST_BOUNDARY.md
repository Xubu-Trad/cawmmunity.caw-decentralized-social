# Token reports are a release-critical trust boundary

FACT — A separate deliberately dishonest test token passes the unchanged candidate's balance-delta checks while its underlying fixture ledger does not transfer. For deposit100, the vault records100credit but its raw token ledger balance remains0 and the user's remains1000. For withdrawal after a real100deposit, the vault clears credit to0 while its raw balance remains100 and the user's remains900. The token instead reports the balances the candidate expects.

This is negative evidence, not a passing custody-safety result and not a finding that the actual CAW token behaves this way. The fixture exposes rawBalance only as a test oracle. ERC-20 has no universal independent ledger oracle; calling the same untrusted token more times does not resolve intentionally consistent false reports.

INFERENCE — Code presence, an immutable token address and balance-delta checks do not establish the semantics or future behavior of that token. A proxy at an immutable address can still change implementation. Before a real asset is accepted, review the exact chain/address/code, implementation and upgrade/admin paths, supported transfer/balance semantics, and any mutability. Reproduce actual behavior with independent evidence and record unresolved findings. No production readiness may be inferred from the cooperative mock or rollback tests.

UNRESOLVED — Production asset/registration selection and source conflicts remain open. No runtime adapter can generally prove an arbitrary token's economic backing. Do not add a privileged migration/rescue route or claim a code-hash check alone fixes this. A future constrained asset design needs explicit scope and review.

## Bounded gas failures

Four additional cases exhaust forwarded gas during balance queries or after transfer-state mutation, on both deposit and withdrawal. Each outer call is limited to500000gas and reverts without logs. Account state, raw balances, allowance and mutation flag roll back. Two recovery cycles succeed after fault removal. These are local EVM calls, not signed transaction or second-engine proof; test runtime retains existing process limits.

## Reproduce

Use the pinned dependencies in `experiments/c007-token-trust`, then run `node --max-old-space-size=256 run-lifecycle.mjs /absolute/path/to/new-output`. The output deliberately records `misleadingReportsAccepted:true`. Do not describe the overall experiment as proving token safety. Contract source is unchanged; the separate fault token is never suitable for deployment. README remains paused.
