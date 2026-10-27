# registry address and state binding

FACT -- 13 focused groups pass using three freshly acquired local registry proofs. two unchanged registry contracts have identical runtime code, distinct initial owners and the same selected block/header/state root. the existing inspectTestRegistryState reader decodes each owner's mapping and zero epoch against its selected address. after a local transfer, a third proof decodes the new owner and epoch1 at its later selected block. all three agree with separate direct contract queries captured while the node's latest block remained unchanged.

the reader is unchanged. this extends the previous single-registry acquisition with a same-code, same-header, different-address counterexample. it does not repeat the earlier result as a new general verification claim.

| rejection case | boundary exercised |
| --- | --- |
| other selected registry address | account trie key must match selected address |
| another same-code registry's proof | matching runtime is insufficient to substitute accounts |
| old proof with later selected header/hash | proof must match the selected state's root |
| changed state root retaining original header hash | header bytes must match selection |
| forged owner word | claimed storage value must match its witness |
| absent epoch witness | both required mapping witnesses must be supplied |
| substituted runtime bytes | bytes must match account commitment and fixture code profile |
| added finality flag | unsupported selection fields reject |

the other five groups check capture scope, three positive/direct-query comparisons and the explicit same-header/code versus different-owner observation. these are grouped assertions, not independent audits. the source path uses compiler-reviewed fixture mapping roots0/4 and IDs1..3; it does not infer layouts for arbitrary ERC721 contracts.

## reproduce the retained capture

```text
node --max-old-space-size=256 experiments/registry-bootstrap/check-state.mjs experiments/registry-bootstrap/state-capture.json
```

[capture](../experiments/registry-bootstrap/state-capture.json), [checker](../experiments/registry-bootstrap/check-state.mjs), [result and source identities](../evidence/REGISTRY_BOOTSTRAP_STATE_RESULTS.json).

for a fresh Windows acquisition with Python's existing cryptography dependency and pinned Anvil1.8.1:

```text
python -B experiments/registry-bootstrap/capture-state.py --anvil <path-to-anvil.exe> --output <new-directory>
node --max-old-space-size=256 experiments/registry-bootstrap/check-state.mjs <new-directory>/capture.json
```

the acquisition reuses the retained compiler output and existing guarded local node, with a single-use exact-parameter eth_getProof scope. three proofs cover the owner/epoch keys only. no remote provider, token contract, real wallet or public transaction is used. accounts are locally impersonated; transactions do not prove signatures. startup memory/disk and512MiB owned-node guards are unchanged; an additional300second request deadline applies. outputs must use a fresh directory. the complete request trace remains local with its digest in the capture. the published capture contains synthetic headers, proofs, runtime bytes and direct reads, without personal paths or credentials.

## what this does not establish

INFERENCE -- registry state can be checked against an explicit account address and selected header without relying on a bare RPC owner claim. however, all of accountAuthorityVerified, transactionPermissionVerified, currentPermissionVerified, executionVerified, endpointAuthenticated, consensusVerified, finalityVerified, freshnessVerified and productionAccepted remain false. the local endpoint supplied the selected block; it did not authenticate its canonicality. post-state ownership cannot authorize every earlier transaction in that block.

UNRESOLVED -- this fixture does not prove the paid probe selected that registry on an authentic public chain. the prior bootstrap experiment checked probe bindings by local direct calls. next reconcile that relationship against selected-state code evidence, including the probe's registry-address/hash immutables, before claiming a full registry-to-wallet binding. preserve fixed-fixture scope and rejection of wrong bindings. production registry/issuance design, anchor policy, funded withdrawals and independent-operator reproduction remain separate gates. no production gate closes; prior suites were not rerun.
