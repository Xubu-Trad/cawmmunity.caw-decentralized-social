# Authorization lifetime and outside review — 2026-11-05

The independent reports in issues [2](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/2#issuecomment-6621485454), [6](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/6#issuecomment-6673113771) and [7](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/7#issuecomment-6674275118) extend the review record. They do not close their issues or approve a candidate release.

## Attributed evidence

- WD-27 supplied the requested alpha.21 reproduction receipt: exact source commit, command, runtime and artifact hashes, 72 reported cases, unchanged-state rejections and receipt/state comparisons. The raw independent trace and checker output have not been obtained or independently checked here. Different whole-file hashes are explicitly expected from recorded run-dependent content; their explanation remains attributed.
- ahdmesh reports isolated Prague EIP-7702/ERC-1271 experiments on alpha.20 with a synthetic token, including actual signed delegation and ownership-epoch rejection. Raw execution artifacts were not attached. These are reported execution results, not new tests run by Xubu or universal wallet compatibility.
- ahdmesh separately reports relay termination, replacement submission, same-block competition and failure-cost accounting. Shared local infrastructure and synthetic assets remain explicit limits. Public-network availability, sustainable subsidy and independent second execution remain open.

## Current behavior versus a policy decision

The experimental Probe commits to the current values of three stakes, not to a monotonic history of stake changes. Restoring those values restores that commitment. It does not reset the nonce or ownership epoch, extend the signed deadline, or make an invalid signature valid. A temporary stake change must not be presented as permanent cancellation.

For code-bearing owners, the Probe asks the ERC-1271 policy effective at execution time. Replacing a delegate may keep the previous signer valid if the new policy accepts it. Conversely, NFT transfer-away/return increments the registry epoch. These are distinct mechanisms; a code-address change is not an implemented cancellation epoch.

Whether either stake changes or wallet-delegation changes should permanently revoke pending intents remains UNRESOLVED. Do not add a privileged revocation service or silently change the signed domain to settle this question. A candidate needs explicit owner-controlled cancellation semantics, replay scope, expiry behavior and tests before adopting a different rule.

## New bounded regression

`tests/caw-paid-action.test.mjs` now reconstructs the retained states around `stale_pool` and the later restored stakes. It recomputes the ABI-encoded stake commitment with Keccak, checks mismatch during the rejected call and equality after restoration, and checks unchanged nonce and epoch between those points. The next retained successful post uses different calldata: this test deliberately does **not** claim the old signature was resubmitted successfully. That stronger observation currently belongs to ahdmesh's report pending its evidence packet.

The focused file passed 13/13 checks on Node24.20.0 with the existing local resource guard. No new EVM transaction ran; the full-suite count remains the previous recorded result. Protocol source, signed format, economics and deployment gates are unchanged.

## Next evidence

Request a compact reproducible packet for the outside reports: source/runtime identities, exact commands, harness and synthetic dependency source, manifest hashes, receipt/state comparisons and preserved negative runs, with credentials excluded. Hashes identify bytes; they do not replace access to those bytes. Independently rerun before promoting reported observations to locally verified outcomes. Continue gas/signature-size/malformed-return wallet boundaries and the one-public-action specification gates; CI remains deferred by user instruction.
