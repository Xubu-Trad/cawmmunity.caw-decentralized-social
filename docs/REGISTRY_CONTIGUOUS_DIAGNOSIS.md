# Independent diagnosis of contiguous capture rejections

The preserved local capture remains `LOCAL_CHAIN_ACQUIRED_VERIFICATION_GAPS`. No production reader, size limit, proof rule or captured byte was changed.

## Storage: independently reproduced included-zero leaf

The independent EthereumJS trie verifier authenticates the account under the captured final state root, derives its storage root, and traverses the proof for `approved2`. The included trie value is `0x80`, the RLP encoding of an empty byte string. The RPC reports zero, but this is an included zero leaf rather than proof of absence. The strict CAW reader still rejects it with `ETH_PROOF_STORAGE`.

A separate EthereumJS state-manager control keeps another slot nonzero, checks unwritten-slot absence, writes a nonzero value, then clears it. Clearing deletes the selected slot and restores the initial root; the strict reader accepts that absence proof as zero. Wrong-root and altered-node controls reject. This corroborates the strict reader's behavior for this saved Anvil capture. It does not establish that all Anvil versions behave alike or identify the responsible upstream source revision. No repaired capture or complete state proof is claimed.

## Transactions: two independent resource boundaries

Operations 6 and 10 (zero-based) have encoded lengths 33,230 and 33,231 bytes, with 33,124 calldata bytes each. The Shanghai research reader permits 32,768 encoded bytes and 24,576 calldata bytes. Both transactions exceed both bounds. These are this reader's support limits, not asserted Ethereum consensus transaction-size limits.

EthereumJS independently rebuilds each single-transaction trie root from the exact raw bytes and RLP transaction index; both equal the captured headers' transaction roots. Ethers decodes and reserializes the envelopes byte-for-byte, recovers the expected disposable signer and checks chain ID 31337. Altering a transaction byte changes the reconstructed root. These checks diagnose the rejection; they do not replace receipt verification or promote the strict reader's incomplete result.

Exact boundary tests retain rejection behavior: malformed envelopes of 32,767 and 32,768 bytes reach type rejection; 32,769 bytes hit the encoded-size guard. Deliberately changed calldata of 24,575 and 24,576 bytes reaches root-mismatch rejection; 24,577 bytes hits `DATA_LIMIT`. None of these altered payloads is treated as a valid signed execution.

## Reproduce offline

Use Node 20.20.2, ethers 6.16.0, and @ethereumjs/mpt, statemanager, rlp and util 10.1.3. From the draft checkout:

```sh
node --max-old-space-size=256 integration/core-baseline-v1/diagnose-contiguous.mjs evidence/registry-contiguous-20261109/capture.json evidence/registry-later-20261109/result.json
```

Compare with `evidence/registry-contiguous-diagnosis-20261110/result.json`. The recorded run used existing installed dependencies, not a clean dependency installation. The local run enforced 2 GiB free disk, 1 GiB available memory, a 256 MiB Node heap and a 120-second timeout. It made no network calls. Different libraries are independent implementations for these checks, not an external audit or independent operator certification.

## Next engineering decision

Preserve the original limits and rejection evidence. A separately versioned, bounded reader profile would need explicit workload, aggregate-input, parser-depth and resource regressions before adoption; merely raising the first failing constant is insufficient. Alternatively reduce the fixture's payload and record a new candidate rather than rewriting the old history. Acquire canonical storage evidence from an independently executed chain/state source before claiming complete reconciliation. Public-chain authentication, consensus and finality remain unresolved.
