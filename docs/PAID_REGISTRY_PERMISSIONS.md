# Registry permission checks

Alpha.46 adds an offline check between a signed transaction and the account it tries to control. A valid signature identifies a signer. This check asks whether the fixed registry's reconstructed permissions allow that signer to approve or transfer the account.

The [reader](../reference/paid-registry-permissions.mjs) is additive. Existing contracts, capture bytes, readers and frontend behavior are unchanged. This is the three-account [test registry](../experiments/paid-action/TestAccountRegistry.sol), not production registration or a general wallet verifier.

## Two boundaries

`inspectRegistryCallSequence(sequence, selection)` takes exactly two arguments. Selection contains `schema: 'caw-registry-selection/1'`, `profile: 'test-account-registry-direct-v1'`, `registry`, `firstOwner` and `secondOwner`. Accounts 1/2 initially belong to the first owner and account 3 to the second; epochs, token approvals and operator permissions start empty. These are supplied assumptions. Each entry has exactly `from`, `to`, `value`, `data`, `status` and `logs`; each log has exactly `address`, `topics` and `data`. Calls must go directly to the selected registry with zero value. This standalone function does **not** authenticate senders: `senderVerified` stays false.

`inspectPaidRegistryHistory(history, manifest, captures, policy)` takes exactly four arguments and first invokes the unchanged [body and post signature checks](PAID_POST_SIGNATURES.md), including their explicit ordinary-account policy. It then:

1. Matches the supplied registry runtime and creation prefix to the preserved compiler artifact, parses the two constructor owners and requires exactly the three ordered mint events.
2. Replays direct registry calls chronologically using transaction senders already bound to recovered signatures. It rejects registry events arising through another top-level target, where the outer sender is not sufficient to identify the internal caller.
3. Checks exact call arguments and the complete expected receipt log sequence; additional callback effects are outside this profile. Final owners and epochs must agree with the accounting reader.

Both functions detach plain data without invoking supplied accessors or `toJSON`. The combined input budget is 8 MiB, 100,000 nodes and depth 20; the sequence permits at most 256 calls. The composed body reader additionally limits the interval to 128 blocks and 256 transactions. Hostile Proxy traps and modified native built-ins are outside the same-process boundary.

## Rules actually checked

| Call | Permission and effect |
| --- | --- |
| `approve` | Current owner or its owner-wide operator may replace or clear a token approval. A per-token approved caller alone cannot reapprove. This fixture permits approval to zero or to the owner. |
| `setApprovalForAll` | Permission belongs to the calling owner and selected operator. Self-operator is rejected; zero operator is permitted by this fixture. Revocation and repeated settings are recorded. |
| `transferFrom` | The supplied source must be the current owner. The caller must be that owner, the current token-approved address or an owner-wide operator. Recipient must be nonzero. |
| Both `safeTransferFrom` overloads | The same permission and event checks apply. Receiver acceptance and callback execution are not verified. Additional callback logs or onward transfers reject as out of profile. |

Every transfer, including a self-transfer, clears the token approval before its Transfer event and increases the account epoch. Owner-wide operator permissions remain keyed to their original owner; they do not follow an account to its new owner and are still present if it returns.

Successful mutation calls require canonical ABI layout, zero padding and full byte consumption. Dynamic safe-transfer data is limited to 4,096 bytes. Getters, unknown selectors, extra logs and other successful effects are outside this profile. Some otherwise executable ABI aliases can therefore reject. Failed calls require no logs, change no reconstructed permissions and are counted in `failedCallsNotPermissionChecked`; no failure reason or permission verdict is assigned to them.

## What a pass means

`registryPermissionRulesVerified` reports conditional consistency with the fixture's rules. `successfulCalls` states the coverage, including a possible empty set. The composed wrapper also reports `registryCallSendersBound` and `registryBytePinsMatched`; its operations carry their transaction and block hashes. The nested standalone report retains `senderVerified: false`, while the nested body report retains its signature checks. Earlier flags are not rewritten.

Matching runtime/creation byte strings does not prove that they were deployed or executed, that constructor storage was empty, or that a supplied successful receipt describes valid execution. Runtime pins identify the preserved [compiler artifact](../experiments/paid-action/paid-build.json); this increment does not recompile it. The wrapper explicitly assumes the fixed fixture's constructor and direct-call semantics.

`accountAuthorityVerified`, `codeAbsenceVerified`, `currentPermissionVerified`, `receiverCallbacksVerified`, `executionVerified`, `endpointAuthenticated`, `consensusVerified`, `finalityVerified` and `freshnessVerified` remain false. The post owner's ordinary-account assumption remains unproven. There is no contract-wallet validation, authenticated registry storage, live retry permission or automatic history adoption.

## Evidence and reproduction

The four retained collector histories cover two local branches: one owner-to-owner transfer and one self-transfer, each observed twice. They share a node and history prefix. They contain no approval/operator calls. [Standalone tests](../tests/registry-call-sequence.test.mjs) provide synthetic approval, revocation, operator, safe-transfer and malformed-input cases; they do not claim new EVM observations.

The [native fixture generator](../reference/fixtures/generate-paid-registry-fixtures.py) changes the retained transfer's outer signer to a disclosed, unauthorized test identity and recomputes its signed bytes, transaction root and linked headers. The [generated recipe](../reference/fixtures/paid-registry-v1.json) deliberately retains impossible success receipts. The [integration test](../tests/paid-registry-history.test.mjs) demonstrates that the previous body/post checks accept these consistent bytes while this permission layer rejects `PAID_REGISTRY_NOT_AUTHORIZED`. This illustrates why signatures and commitments alone do not establish permission or execution. No real key, new chain run or network submission is involved.

With the pinned Python/cryptography environment described by the generator, reproduce into a new file and compare SHA-256:

```sh
python -I -B reference/fixtures/generate-paid-registry-fixtures.py --output paid-registry-reproduced.json
node --test tests/registry-call-sequence.test.mjs tests/paid-registry-history.test.mjs
```

The generator uses native deterministic ECDSA with disclosed test scalar `0x1337ca200002`. Its Keccak/RLP/trie/header helpers are shared, pinned Python sources; it imports no JavaScript verifier. The recipe is 11,032 bytes, SHA-256 `404d6a675d6a8f8cba0daa7f4e531d3e66c42540639586137b636d5c6299f64a`.

Run this offline example from the repository root:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { inspectPaidRegistryHistory } from './reference/paid-registry-permissions.mjs';
const root = 'experiments/paid-signed-body-acquisition/';
const bytes = readFileSync(root + 'body-captures.json');
assert.equal(createHash('sha256').update(bytes).digest('hex'),
  'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const expanded = gunzipSync(readFileSync(root + 'execution-trace.json.gz'), { maxOutputLength: 8 * 1024 * 1024 });
assert.equal(createHash('sha256').update(expanded).digest('hex'),
  '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975');
const captures = JSON.parse(bytes), trace = JSON.parse(expanded);
const policy = { schema: 'caw-paid-post-policy/1', profile: 'paid-action-v1-eoa-65-low-s',
  assumedEoaOwners: ['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76', '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73'] };
let histories = 0, transferObservations = 0;
for (const branch of ['left', 'right']) for (const collector of ['number', 'hash']) {
  const { history, manifest } = trace.branches[branch].collectors[collector];
  const result = inspectPaidRegistryHistory(history, manifest, captures.branches[branch], policy);
  assert.equal(result.registryCallSendersBound, true);
  assert.equal(result.registryPermissionRulesVerified, true);
  assert.equal(result.accountAuthorityVerified, false);
  assert.equal(result.executionVerified, false);
  assert.equal(result.registry_sequence.successfulCalls, 1);
  transferObservations += result.registry_sequence.successfulCalls;
  histories++;
}
console.log(JSON.stringify({ histories, transferObservations, accountAuthorityVerified: false, executionVerified: false }));
```

The next gates are authenticated code/state authority and explicit callback/contract-wallet coverage, then composition into selected-history invalidation, rollback and restart. Approval for public deployment remains a separate gate.
