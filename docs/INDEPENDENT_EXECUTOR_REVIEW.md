# Independent executor reproduction handoff

Status: NOT YET INDEPENDENTLY REPRODUCED. This procedure is an invitation and a bounded evidence contract, not an assertion that someone ran it.

Pin code commit d047704b19898dfa3f13e87bf8e7ac4a92c99f6c. Obtain source through your own retrieval path and record its provenance. A GitHub copy still shares GitHub as an upstream distribution dependency. Preserve the exact commit, source archive hash and any local changes. No Xubu credentials, private evidence directory or existing local dependency junction are required by the public commands.

Use Node24.20.0 and pnpm11.25.0. Record platform/runtime hashes and how they were obtained. From the pinned checkout:

```text
cd experiments/execution-engine
pnpm install --frozen-lockfile --ignore-scripts
node --max-old-space-size=256 selected-executor-check.mjs ../..
node --max-old-space-size=256 executor-result-check.mjs ../..
node --max-old-space-size=256 owned-output-check.mjs ../..
```

Expected retained group counts are13,28and9 respectively, with zero failures. Keep full stdout/stderr, exit status and tool versions. These commands exercise different scopes and must not be added into a production-proof percentage. The 28-case inspector deliberately cannot detect a plausible forged gas value as false execution; it keeps executionAuthenticated=false.

On Windows, additionally follow [owned-process execution](OWNED_EXECUTOR.md), creating input with prepare-process-input.py and using an absolute path to the pinned Node executable. Expected worker and inspector exits are zero, storage-increment gas26012, recordMatchesSelection true, executionAuthenticated false, productionAccepted false. The supervisor intentionally requires Windows job controls; do not weaken those controls to claim cross-platform supervisor coverage. On another OS, report supervisor NOT RUN unless equivalent controls have been separately implemented and reviewed.

Preserve negative results. Do not update expected hashes, discard failing fixtures or change package versions until the discrepancy is explained. Record whether the machine, operator, install source, network provider and source archive are independent or shared; operator independence cannot be inferred from a different directory or URL. Omit private usernames/paths/tokens from public receipts.

Report against the existing review/reproduction issue with the pinned commit and [receipt template](reproduction/EXECUTOR_REVIEW_RECEIPT.json). A completed receipt needs evidence links/hashes and exact commands. Another operator's successful reproduction advances OI-09 only within that scope; it does not authenticate a public chain, prove full state roots, settle specification conflicts or approve deployment. No receipt has been completed by an independent reviewer in this increment.
