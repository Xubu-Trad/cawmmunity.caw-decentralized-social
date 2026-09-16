# Signed post permissions

Alpha.44 verifies the signature inside a paid post against the reconstructed owner when that post occurred. The submitting account can be a relayer. Matching its transaction signature alone does not establish permission to spend another CAW account's credit.

The new [post inspector and history wrapper](../reference/paid-post-signatures.mjs) rebuild the exact signing data specified by the unchanged [experimental contract](../experiments/paid-action/CawPaidActionProbe.sol). This is an offline, explicitly selected check. No existing recovery or observer API silently changes mode.

## Exact bytes, explicit assumptions

`inspectPaidPostSignature(calldata, selection)` takes exactly two arguments. The selection contains exactly `schema: 'caw-paid-post-selection/1'`, `profile: 'paid-action-v1-eoa-65-low-s'`, `chainId`, `verifyingContract` and `expectedSigner`. Chain IDs are canonical hexadecimal uint256 quantities; addresses are nonzero lower-case 20-byte hex. No selected digest, fee or type hash can override the implementation.

The parser requires the canonical `post` ABI layout: exact offsets, contiguous tails, zero padding, full consumption and a 65-byte signature. Text remains the exact UTF-8 bytes, including a BOM or NUL; no normalization occurs. The contract's bounds of 1–420 Unicode scalars and at most 1,680 bytes apply. A permissive ABI alternative can be refused even if an EVM decoder would accept it.

The digest commits to the contract's name/version, selected chain and contract, account ID, epoch, nonce, validity interval, distribution hash, text hash, fixed fee and profile. It follows [EIP-712's domain and structure hashing](https://eips.ethereum.org/EIPS/eip-712). The existing curve arithmetic checks `r`, low-s and `v = 27/28`, recovers a public key and compares its address with `expectedSigner`. Its new `inspectDigestSignature(digest, signature)` export is a mathematical primitive; it does not authenticate a domain or choose an expected identity.

Standalone success means the signature matches those bytes and that expected signer. An expired or stale request can still have a valid signature. No current owner, code absence, nonce availability, balance or time-window eligibility is proved by this standalone result.

## Match a complete history

`inspectPaidPostHistory(history, manifest, captures, policy)` takes exactly four arguments. The policy contains exactly `schema: 'caw-paid-post-policy/1'`, `profile: 'paid-action-v1-eoa-65-low-s'` and `assumedEoaOwners`: up to 64 distinct nonzero addresses. These are caller-supplied ordinary-account assumptions, not verified code proofs.

The wrapper first runs [alpha.43 body/history binding](PAID_BODY_HISTORY.md). For each successful post, it matches the ordered `Posted` event to the reconstructed message, requires that historical owner's policy membership, verifies the exact inner signature and checks the account, epoch, nonce, text and distribution binding. It uses neither the final owner list nor the outer relayer as a substitute for that historical owner.

Failed post calls are counted in `failedPostCallsNotSignatureChecked` and excluded from accepted-post signature checks. A failed call may revert before signature verification; this result does not assign a failure reason. The retained right-branch orphan has a mathematically valid signature but is not an accepted post in that history.

The output separates `body_history` from the per-post reports. `postSignaturesVerified` and `historicalOwnerMatchesVerified` are conditional checks over successful posts only; `successfulPostCount` states the coverage. An empty successful-post set does not demonstrate a signature check. Older nested flags remain unchanged.

`accountAuthorityVerified`, `codeAbsenceVerified`, `erc1271Verified`, `currentPermissionVerified`, `executionVerified`, `endpointAuthenticated`, `consensusVerified`, `finalityVerified` and `freshnessVerified` stay false. Contract-wallet permission needs a different path, including the relevant state and execution assumptions; [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) supplies a contract validation interface. A 65-byte shape does not prove an owner has no code. Registry approval/transfer execution, runtime/endpoint authentication and present retry safety remain outside this check.

## Reproduce

Run `node --test tests/digest-signature.test.mjs tests/paid-post-signatures.test.mjs` with the recorded runtime and supervision. The [native fixture generator](../reference/fixtures/generate-paid-post-fixtures.py) can reproduce its [vectors](../reference/fixtures/paid-post-signatures-v1.json) into a new file:

```sh
python -I -B reference/fixtures/generate-paid-post-fixtures.py --output paid-post-reproduced.json
```

It uses native cryptography signing/verification and public-point derivation with disclosed test identities. Keccak, RLP and trie helpers are reused from pinned Python sources; no JavaScript verifier is imported. Six positive vectors cover ordinary text, BOM/NUL, decomposed Unicode, the maximum four-byte text, an expired window and uint256 boundaries. Retained EVM `postDigest` responses provide an additional comparison for the local historical posts.

One negative recipe changes an inner signature, re-signs the outer transaction and rebuilds the affected transaction root and linked headers. The old body/history check accepts it; the new signature check rejects it. Its retained success receipts are deliberately inconsistent with execution. This is synthetic test evidence, not a new chain observation or an exploit against a deployed service.

Run this offline example from the repository root:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { inspectPaidPostHistory } from './reference/paid-post-signatures.mjs';
const root = 'experiments/paid-signed-body-acquisition/';
const bytes = readFileSync(root + 'body-captures.json');
assert.equal(createHash('sha256').update(bytes).digest('hex'),
  'e2db3326525f1b6b3e24af6582482220c7db1cf8d2e5a1099005caca84ba0c36');
const expanded = gunzipSync(readFileSync(root + 'execution-trace.json.gz'), {maxOutputLength: 8 * 1024 * 1024});
assert.equal(createHash('sha256').update(expanded).digest('hex'),
  '6ca0685230a9917eb3d73ce0a74666c9d4442059883df65f4a374551735c2975');
const captures = JSON.parse(bytes), trace = JSON.parse(expanded);
const policy = {schema: 'caw-paid-post-policy/1', profile: 'paid-action-v1-eoa-65-low-s',
  assumedEoaOwners: ['0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76', '0x47ecac8221f18970c48cf48aaa3cbe8167bbbe73']};
let histories = 0, successfulPostObservations = 0, failedPostObservations = 0;
for (const branch of ['left', 'right']) for (const collector of ['number', 'hash']) {
  const {history, manifest} = trace.branches[branch].collectors[collector];
  const result = inspectPaidPostHistory(history, manifest, captures.branches[branch], policy);
  assert.equal(result.postSignaturesVerified, true);
  assert.equal(result.codeAbsenceVerified, false);
  assert.equal(result.accountAuthorityVerified, false);
  successfulPostObservations += result.successfulPostCount;
  failedPostObservations += result.failedPostCallsNotSignatureChecked;
  histories++;
}
assert.equal(successfulPostObservations, 10);
assert.equal(failedPostObservations, 2);
console.log(JSON.stringify({histories, successfulPostObservations, failedPostObservations,
  postSignaturesVerified: true, codeAbsenceVerified: false, accountAuthorityVerified: false}));
```

**76 focused checks and 979/979 full-suite Node tests passed.** Native fixture generation and the guide passed; the build retained 22 byte-identical frontend assets. See the [current receipt](../evidence/TEST_RESULTS.json) for exact scope and run records.

Four collector histories reuse two local branches: left has three accepted posts, right has two, and they share one prefix post. These are four distinct successful post transactions, not ten independent observations or providers. The right branch also contains one failed post seen by both collectors. Historical capture bytes are unchanged; no new RPC run or deployment occurred.

## Bounds and next work

The history wrapper retains alpha.43's 128-block/256-total-transaction limits and combined 8 MiB/100,000-node/depth-20 input capture, plus the 64-owner policy bound. Signature calls have fixed public curve work and strict 32/65-byte inputs. No key generation, wallet connection or signing API is added. Same-process hostile proxies and altered native built-ins remain outside the input model.

Next: verify registry permission and ordinary-account state assumptions, add a separately justified contract-wallet path, then integrate the checked history into selection invalidation, rollback and restart. Source decisions and public-release gates remain open.
