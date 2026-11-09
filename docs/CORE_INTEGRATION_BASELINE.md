# Core integration baseline v1 — research, not a release candidate

The engineering priority is now a complete reviewable lifecycle, following the November8 planning recommendation. That recommendation supplies priorities, not accepted manifesto amendments. Existing research remains preserved. No PR is merged or production behavior adopted by this baseline.

Parent: `61631f107de47d975006931a80a37a1fd3202d39`. PR18 refreshed head `843d59b2097d5d75242bf6a887f870e2ad034125`, state `open`, merged=false. PR19 remains draft. Selected lineage: experiments/c007-new-owner-post and its retained38-transaction signed lifecycle. It contains constructor-initialized custody/staking, the controller-signature wallet fixture and a mock token. It still has three predefined accounts and provisional economics.

## Rebuild identity

integration/core-baseline-v1/manifest.json pins compiler input bytes, source hashes, exact compiler version and soljson hash, ABI, creation byte hashes, runtime-template byte hashes and immutable-reference layout for DeployedCustodyStakeResearch, MockTokenResearch and SignerWalletFixture. Compiler input preserves optimizer200runs and Shanghai settings from the historical signed run. No source or financial rule changed.

All three artifacts rebuilt identically to the retained compiler outputs. Three negative controls rejected altered input bytes, compiler version and expected runtime-template hash. Nodev20.20.2,256MiBheap,90second process deadline;2GiBdisk/1GiBavailablememory startup gates. Existing pinned compiler reused. This is same-toolchain reproducibility, not a second independent compiler audit or independent software-supply authentication.

Runtime-template hashes exclude constructor-filled immutable values and do not by themselves identify deployed runtime. The complete instantiated contract graph, constructor argument manifest and replay package linkage remain next. This increment did not rerun38transactions, two-engine replay, callbacks or the full suite. Historical receipts are not summed into a new candidate-wide pass.

To reproduce, provide the pinned solc package matching the manifest's full compiler/soljson identity, then run `node --max-old-space-size=256 integration/core-baseline-v1/check-core-baseline.mjs integration/core-baseline-v1/manifest.json integration/core-baseline-v1/compiler-input.json`. Run in a reviewed environment and verify the manifest's delivery separately. Replacing both expected hashes and artifacts is not prevented by local equality checks.

## Ordered integration backlog

1. Complete the baseline's constructor/deployment graph and link each frozen artifact to its existing signed-history evidence; rerun the chosen lifecycle against that baseline before promotion.
2. Consolidate C-001 evidence into a decision packet. Historical source/behavior and blocked account-proof acquisition must remain distinct. No substitute burn adopted without explicit agreement.
3. Draft a versioned protocol specification and parameter manifest with unresolved choices visibly blocked. Do not call it authoritative or frozen until required interpretations are reviewed and accepted.
4. Bind actual NFT account ownership to custody after registration/payment and transfer-authority interfaces are sufficiently defined. Fixed fixture accounts are not permissionless registration.
5. Compare scalable reward designs and conservation/rounding policies before replacing the three-account fixture.
6. Reuse readers, adversarial cases and alternative-client work for the resulting end-to-end acceptance journey. Resume standalone consensus research only when it directly supports the selected history-authentication route.

Hosted CI remains deferred under the user's earlier access decision; no workflow permission is assumed. Production and public-test gates remain blocked. The attached plan's19 acceptance items are planning gates, not verified completions or consensus. README edits remain paused.
