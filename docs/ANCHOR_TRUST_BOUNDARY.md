# Retained checkpoint is not canonical-chain authority

FACT -- six checks pass using the existing signed-withdrawal local branch capture. At block15 (0xf), two different blocks share the same parent. Selecting each branch separately satisfies the current first-transaction parent linkage, complete body commitment and sender checks. Both reports retain consensusVerified=false, finalityVerified=false and productionAccepted=false. Cross-branch selected-hash substitutions reject in both directions; an added finality claim rejects as an unsupported schema field.

This is retained local rollback evidence, not a new acquisition, live network fork or consensus experiment. It changes no reader behavior. [Exact hashes and results](../evidence/ANCHOR_TRUST_BOUNDARY.json), [check](../experiments/anchor-trust/check.mjs). From the repository root with Node24.20.0:

```text
node --max-old-space-size=256 experiments/anchor-trust/check.mjs
```

INFERENCE -- a self-consistent candidate can be checked relative to a retained selection without proving it is canonical, final or current. A separately retained digest prevents silent replacement relative to that digest; it does not explain why the original selection should govern fund authority. A sender signature authenticates the transaction authorization under its supported policy, not the chain's canonicality.

## Decision that remains open

| Candidate trust path | What it could establish | Additional assumptions / evidence required |
| --- | --- | --- |
| User-retained checkpoint, inspection only | Reproduction relative to an explicit selected history | Selection provenance remains external; no automatic permission restoration or current-state claim |
| Local validating-node anchor | Anchor accepted under that node's rules | Exact chain/genesis/fork profile, bootstrap trust, sync completeness, finality policy, node implementation and operational independence |
| Independently verified consensus/light-client anchor | Anchor accepted under an explicit verification protocol | Bootstrap/checkpoint trust, supported consensus/fork rules, proof availability, update/expiry rules and independent implementation review |

These are proposed review alternatives, not selected production designs or claims that such adapters exist here. Multiple RPC endpoints alone do not implement any consensus proof. Do not turn a maintainer's signature into a new permanent authority to bypass the decision.

Before a live authority adapter is implemented, its decision record must state: network/genesis and supported fork; trust/bootstrap source; exact finalized state selection and freshness rules; behavior under divergent/stale/missing anchors; reorg/restart behavior; registry/code binding at that same state; and how another operator can replace the original acquisition path. Missing decisions keep the adapter inspection-only. See the existing [recovery trust model](RECOVERY_TRUST_MODEL.md), [authority design](AUTHORITY_AND_FRESHNESS.md) and [acquisition issue3](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/3).

No source ambiguity is resolved here. No new developer key, automatic branch vote, permission restoration, settlement or production acceptance is introduced. Prior suites were not rerun. Next examine the production registry/bootstrap decision with the same explicit trust boundary while independent executor reproduction remains open.
