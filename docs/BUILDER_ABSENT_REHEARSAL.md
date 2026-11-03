# Builder-absent rehearsal for one CAW action

Prepared 2026-11-03 against community commit `ae8adb696d11a816e35b7b51acf864305c1c47ce`. This resumes the [one-action milestone](PUBLIC_ACTION_MILESTONE.md), using the existing readers and evidence. It is an execution plan, not an executed outage, new protocol policy or release approval.

## Two tracks, with different prerequisites

**Track A: retained-fixture portability.** Another builder can attempt the [offline recovery bundle](RECOVERY_BUNDLE.md) now, using its pinned fixture bytes and separately selected digest. It requires no RPC, original database, browser state or original operator credentials. That run can establish bounded portability of the existing EOA fixture. It cannot establish public acquisition, canonicality, contract-wallet authority or complete execution. Repeating it on the original operator's machine is not independent reproduction.

**Track B: integrated action survival.** This remains NOT_READY. First resolve the candidate's asset/registration scope, provisional economics and authority/anchor decisions in the existing review lanes. Then freeze a single candidate for posting, distribution and withdrawal. Do not deploy the current three-ID probe as though it implements scalable permissionless registration. Do not substitute an asset or reset key to make the exercise work.

## What the successor must receive

| Input | Evidence already available | What still has to be selected or obtained |
|---|---|---|
| Source and tools | Public source, reader commands, selected runtime/source identities | Independently retained source and exact required dependencies; a fresh installation receipt from another operator |
| Selected history | Retained headers, bodies, receipts and signed-action fixtures | Original creation-to-endpoint public acquisition, separately operated paths, chain/finality trust statement |
| Account/asset authority | Registry/epoch, owner-signature and custody experiments | Chosen deployment, runtime/state bindings, supported wallet modes, real asset compatibility and registration decisions |
| Economic rules | Candidate-terms and reward-model comparisons | Explicit provisional recipient/snapshot/rounding/dust/lifetime rules; no model silently becomes settlement |
| Data needed to reconstruct | Recovery bundle specifies four JSON members and a separate selection pin | Complete production text/history availability; authoritative data distinguished from derived indexes/cache |
| Operational access | Local static frontend and offline readers can run separately | Successor-owned infrastructure and credentials; no original operator private keys, database or domain account |
| Review | Existing issue and PR evidence | Attributed second-builder receipt, retained failures, unresolved objections and explicit release agreement |

## Ordered experiments

Each row is a separate experiment on disposable, authorized fixtures. Never disable a production service for this rehearsal. Capture baseline and changed-case receipts; change one dependency at a time.

| ID | Remove or change | Reuse | Acceptance / refusal | Current status |
|---|---|---|---|---|
| BA-01 | Original working directory, caches and private configuration | [Recovery bundle](RECOVERY_BUNDLE.md), [independent review](INDEPENDENT_EXECUTOR_REVIEW.md) | Independently selected package runs on successor environment; no hidden path, secret or network dependency; output scope remains explicit | Outside execution NOT_RUN for this plan |
| BA-02 | Original GitHub account and website hostname | [Static recovery](STATIC_RECOVERY.md), source manifests | Obtain retained bytes from an independently controlled copy, verify against separately retained identities, serve without original domain credentials | Static local evidence exists; independent serving/rebuild NOT_RUN |
| BA-03 | Primary RPC and its API key | [Acquisition review](https://github.com/Xubu-Trad/cawmmunity.caw-decentralized-social/issues/3), provider comparisons | Alternate independent acquisition covers the entire interval; missing/pruned/conflicting evidence rejects without unchecked fallback | Public acquisition/anchor decision BLOCKED |
| BA-04 | Index/cache database and checkpoint marker | Existing history/reorg readers | Fresh reconstruction agrees on the selected record; missing rows, repeated writes and rollback do not create accepted fabricated state | Production database adapter NOT_IMPLEMENTED; retained readers are not proof of it |
| BA-05 | Preferred submitter/relay/sponsor | Existing paid-action and wallet fixtures | Authorized owner submits and withdraws through an independent path; wrong owner/epoch/recipient/domain and unavailable sponsorship reject safely | Integrated candidate NOT_READY |
| BA-06 | Original storage host or last local copy | [Availability design](DATA_AVAILABILITY_AND_REBUILD.md) | Retrieve exact required bytes from a surviving independent source; absent bytes remain missing rather than reconstructed by assumption | Production transport/storage NOT_SELECTED |
| BA-07 | Original browser state or account ownership | Account-authority and source-conflict records | Separate user-key loss from operator loss; old owner cannot spend; DM history behavior follows an explicit agreed policy | Production DM/recovery policy UNRESOLVED |
| BA-08 | Original builder's release participation | [Review baseline](REVIEW_BASELINE.md), [operator independence](OPERATOR_INDEPENDENCE.md) | Other builders can reproduce, review and record objections without a privileged successor; no automatic release from a passing receipt | Release agreement NOT_ESTABLISHED |

## Minimum receipt

Record: exercise ID; operator and environment attribution; exact source/tool/input identities; independently retained selection and its provenance; baseline; single removed dependency; commands actually run; raw outputs/errors and hashes; expected versus observed behavior; missing inputs; authority/acquisition/execution/finality limits; and result `PASS_WITHIN_SCOPE`, `FAIL`, `BLOCKED` or `NOT_RUN`. A planned command is not a completed result. Never include keys, tokens or private account exports.

Track A's supported fixture must continue reporting `endpointAuthenticated`, `acquisitionIndependent`, `accountAuthorityVerified`, `executionVerified`, `finalityVerified` and production acceptance as false. Do not promote those flags because another builder reproduces the same output. Track B requires separately justified evidence for each claim.

## Next work

The next independent contribution is BA-01 using the existing commands and a separately retained receipt, not a new checker. In parallel, package 1/2 of the one-action milestone needs explicit candidate rules before settlement integration. Candidate contracts must not acquire an administrator recovery key to solve liveness. The native replay discrepancy and deferred acquisition-side build/CI remain open. No additional test pass is claimed by this plan; the recorded full Node suite remains 1,251 across 73 files.

