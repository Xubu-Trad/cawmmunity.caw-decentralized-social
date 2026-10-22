# Operator independence: recovery contract

Reviewed baseline: `b81a4a54b6b07281777578716555098ff5ba4b50` (alpha.46). This adds an engineering acceptance plan, not a new protocol version or an executed recovery result. The initial alpha.20 review target remains unchanged.

The existing [resilience plan](RESILIENCE_PLAN.md) defines OUT-01 through OUT-09. This register makes OUT-08 (original team absent) concrete for the current readers and experiments. It does not replace that plan or resolve C-006, C-011 or C-012 in the [conflict register](../sources/SPEC_CONFLICTS.md).

## Dependencies and required replacement evidence

| ID | Surface and observed boundary | Dependency / failure | Required evidence before closing |
|---|---|---|---|
| OI-01 | [Build](../scripts/build.mjs), [review recipe](REVIEW_GUIDE.md) and static release | Original GitHub account, host or domain disappears | A different builder starts from a retained commit and complete source, reproduces the static manifest and serves it without original credentials. Missing or altered assets must fail verification. A copied website alone proves no protocol capability. |
| OI-02 | [Header recovery](../reference/paid-header-recovery.mjs) and [provider comparison](../reference/paid-provider-comparison.mjs) | Caller-selected endpoint or multiple labels backed by one operator | Explicitly record the endpoint trust source and acquisition operators. Matching headers/provider reports must not be reported as independently authenticated canonical history. Endpoint authentication and finality remain unresolved. |
| OI-03 | [Body history](../reference/paid-body-history.mjs), [signed capture](SIGNED_BODY_ACQUISITION.md) | Original capture, archive or index becomes unavailable | Reconstruct from complete public inputs with an empty working directory; reject missing blocks, altered transaction bytes and inconsistent receipts. Independently acquired public history remains a separate gate from retained local fixtures. |
| OI-04 | [Registry permissions](../reference/paid-registry-permissions.mjs), [post signatures](../reference/paid-post-signatures.mjs) | Fixture registry and ordinary-account assumptions mistaken for actual account authority | Authenticate the selected registry code/state and owner history; separately exercise contract wallets and callbacks. Matching a recovered sender is insufficient to prove these assumptions. |
| OI-05 | [Paid-action probe](../experiments/paid-action/CawPaidActionProbe.sol), [account custody](ACCOUNT_AUTHORITY.md) | Original operator, signing service or sponsor required to submit/exit | Demonstrate synthetic direct submission and withdrawal without an operator credential, including stale authority, replay, wrong recipient and unavailable sponsorship. Production registration and custody are still blocked. |
| OI-06 | [Data availability](DATA_AVAILABILITY_AND_REBUILD.md), [media scope](MEDIA_AND_PRODUCT_SCOPE.md) | Last retained copy, storage account or transport disappears | Inventory required bytes and obtain them from a surviving independent source; reject partial recovery. A content hash proves integrity, not availability. No production storage/transport provider is selected by this register. |
| OI-07 | [Authority design](AUTHORITY_AND_FRESHNESS.md), [v0 scope](PROTOCOL_V0_SCOPE.md) | A hidden setup/update/recovery capability remains exclusive to the builder | Enumerate every deployed contract, constructor/one-shot binding, external authority and fund-moving path. Compare former deployer privileges with an ordinary account. No deployed production graph exists to certify here. |
| OI-08 | [Review baseline](REVIEW_BASELINE.md), [source conflicts](../sources/SPEC_CONFLICTS.md) | Release requires one person's account or judgment | Retain source, objections and reproduction records outside one account; identify independent reviewers and an explicit release-agreement record. Neither repository access nor this checklist grants protocol authority. |
| OI-09 | [Local EVM toolchains](../experiments/account-authority/toolchain.json), [review guide](REVIEW_GUIDE.md) | Original machine, compiler cache, runtime download or private environment is indispensable | Rebuild from documented toolchain identities and accessible dependencies on a second environment. Separate the dependency-free Node readers from optional Python/EVM requirements. Retained binaries/results are not fresh reproduction. |

All rows remain OPEN. Existing finite experiments supply partial evidence as linked; no row is closed by documentation alone. Production and a public test candidate remain blocked.

## Next bounded implementation slice: recovery without the original working directory

**IDEA —** implement an offline recovery-bundle checker around existing readers, rather than inventing another ledger or silently connecting a network.

1. Define the exact supported fixture package: selected chain/interval, contract/registry assumptions, raw headers, complete block bodies/receipts, history, source identities and expected reconstruction. File hashes must come from a separately retained expected manifest; a self-consistent replacement manifest is not authenticity.
2. In a fresh disposable directory, read only that package and the pinned public reader source. No original database, browser storage, environment secrets, absolute machine paths or RPC access may be required.
3. Invoke the existing integrity, signature/permission and reconstruction checks in their documented supported order. Report each check and its assumptions separately. Do not substitute caller-supplied account labels for recovered signatures or inferred contract execution.
4. Inject one variable per case: missing body, mutated bytes, wrong selected endpoint, unsupported account model, then a valid retained fixture. Preserve the failed inputs and exact reader rejection. Treat unsupported evidence as rejection, never a fallback to unchecked adoption.
5. Output separate fields for byte integrity, reconstruction, authority assumptions, endpoint trust, acquisition independence and execution scope. A successful offline fixture must still report endpoint authentication, public acquisition and production acceptance as NOT ESTABLISHED.

**FACT —** the [bounded recovery checker](RECOVERY_BUNDLE.md) now implements this retained-fixture slice, with 14 focused checks and separate CLI execution. All nine dependency rows remain open. **UNRESOLVED —** public acquisition and authenticated authority are not established. It cannot prove survival after every public copy disappears, canonical chain selection, actual contract-wallet authority or production withdrawal safety. Those remain explicit successor experiments.

## Review receipt

Record the source commit, input parent hashes, transformation, output SHA-256/size/path, runtime versions, exact checks and negative results. Keep historical failures. A second builder should be able to disagree with the selected trust assumptions without needing the original operator's permission.
