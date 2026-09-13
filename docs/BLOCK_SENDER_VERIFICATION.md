# Transaction signatures and senders

Alpha.42 adds an offline [sender verifier](../reference/ethereum-block-senders.mjs) over the complete transaction bytes already checked against a selected London header. It reconstructs each signing digest, checks the signature, recovers a public key and derives its Ethereum address. It supports legacy, type 1 and type 2 envelopes. No RPC `from` field supplies the answer.

This is a separate reference component. It does not establish the sender's CAW account authority, balance, nonce availability, valid execution, or a canonical chain. Earlier body, recovery, observer and provider readers keep their existing behavior and flags. The frontend remains a simulation.

## Inputs and policy

`inspectBlockSenders(header, rawTransactions, selection)` takes exactly three arguments. The selection contains exactly `schema: 'caw-block-senders-selection/1'`, `profile: 'london-16'`, `hash`, `chainId` and `allowUnprotectedLegacy`. The chain ID is a canonical lower-case hexadecimal uint256 quantity; the legacy policy is an explicit boolean. No default network or permissive fallback is supplied.

All arguments are copied through bounded data descriptors before checking begins. The unchanged transaction reader then verifies the selected header and complete transaction root. The new check rebuilds signing data from its canonical decoded fields, preserving contract-creation destinations and access-list order and duplicates.

- Protected legacy signatures derive their chain ID and parity from `v`. Their chain ID must match the selection. Unprotected `v = 27/28` is accepted only when explicitly permitted; each transaction result reports `chainId: null` and `replayProtected: false`. The top-level chain ID retains the caller's selection. See [EIP-155](https://eips.ethereum.org/EIPS/eip-155).
- Type 1 and type 2 sign their respective type prefix followed by the unsigned payload. Their encoded chain ID must match the selection. See [EIP-2930](https://eips.ethereum.org/EIPS/eip-2930) and [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559).
- The London profile requires nonzero signature scalars below the curve order and enforces low-s under [EIP-2](https://eips.ethereum.org/EIPS/eip-2). This does not implement every transaction-validity or gas rule.

Public-key recovery follows [Standards for Efficient Cryptography 1 (SEC 1), version 2.0, sections 4.1.4 and 4.1.6](https://www.secg.org/sec1-v2.pdf), using Ethereum's parity choice. The implementation checks the curve point, rejects an infinite recovered key and verifies the ECDSA equation. It returns the uncompressed 65-byte public key and hashes its 64 coordinate bytes to derive the address. Arithmetic operates only on public verification data; it supplies no key generation or signing API and makes no constant-time claim.

The result's `signaturesVerified` and `senderVerified` flags describe this mathematical check under the selected bytes and policy. Its nested `body_integrity` retains the old reader's narrower flags. A successful signature can belong to a different address from a claimed sender: flipping parity or changing a signed payload need not make recovery fail. The caller must compare the derived sender with separately justified authority. Matching a transaction's chain ID likewise does not authenticate the selected header or endpoint.

## Reproduction

The [fixture generator](../reference/fixtures/generate-block-senders-fixtures.py) uses native Python cryptography signing and verification with disclosed test identities, together with the pinned Python header/trie primitives. It does not import the JavaScript implementation. The [vectors](../reference/fixtures/block-senders-v1.json) record independently derived public keys, addresses and signing hashes. They include the published EIP-155 example and malformed signatures inside otherwise valid transaction commitments. Shared hashing/trie primitives are disclosed; this is not an external audit.

Run `node --test tests/block-senders.test.mjs` with the repository's recorded Node runtime and resource supervision. To generate another fixture file, use Python with the recorded cryptography version and a new output path:

```sh
python -I -B reference/fixtures/generate-block-senders-fixtures.py --output block-senders-reproduced.json
```

The following example uses the 30 retained [alpha.41 observations](SIGNED_BODY_ACQUISITION.md). Selected hashes and expected addresses come from that local fixture; the example does not contact or authenticate a provider. Run it as a Node ES module from the repository root:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectBlockSenders } from './reference/ethereum-block-senders.mjs';

const fixture = JSON.parse(readFileSync('experiments/paid-signed-body-acquisition/body-captures.json', 'utf8'));
let checked = 0;
for (const body of [...fixture.branches.left, ...fixture.branches.right]) {
  const result = inspectBlockSenders(body.header, body.raw_transactions, {
    schema: 'caw-block-senders-selection/1', profile: 'london-16',
    hash: body.header.hash, chainId: '0x7a69', allowUnprotectedLegacy: false,
  });
  assert.equal(result.signaturesVerified, true);
  assert.equal(result.senderVerified, true);
  assert.equal(result.endpointAuthenticated, false);
  assert.equal(result.executionVerified, false);
  result.transactions.forEach((transaction, index) => {
    assert.equal(transaction.from, body.receipts[index].from);
    assert.equal(transaction.replayProtected, true);
    checked++;
  });
}
assert.equal(checked, 30);
console.log(JSON.stringify({checked, signaturesVerified: true, senderVerified: true,
  endpointAuthenticated: false, executionVerified: false}));
```

**40 focused checks and 862/862 full-suite Node tests passed.** The guide derived the recorded senders for all 30 retained observations. Native fixture generation passed; the build retained 22 byte-identical frontend assets. See the [current receipt](../evidence/TEST_RESULTS.json) for runtime, timing and source pins.

## Limits and next work

The reader retains the existing admission limits: 256 transactions, 16 KiB per envelope, 1 MiB combined encoded bytes, 8 KiB calldata, 64 access-list entries and 256 storage keys per transaction. The combined descriptor capture is bounded to 8 MiB of weighted data, 100,000 nodes and depth 20. Fixed-width public curve operations bound each signature's work. These are reference implementation limits, not network block rules; a block beyond them is refused.

Only the London header profile and transaction types 0, 1 and 2 are supported. Later envelope types are refused. Receipt commitments and their acquisition labels are checked separately by the existing body wrapper. A mathematically valid signature does not establish transaction execution, receipt validity, chain selection, freshness, finality or CAW permission. Empty bodies and repeated envelopes are commitment/verification cases, not evidence of a valid executed history. Hostile same-process proxies or replaced built-ins remain outside the plain-data boundary.

Next: bind derived senders and committed call data to CAW account authority, then integrate complete-body checks into selected-history recovery. Independent acquisition, endpoint authentication and confirmation policy remain open. No new network acquisition, chain experiment, wallet connection or deployment is introduced here.
