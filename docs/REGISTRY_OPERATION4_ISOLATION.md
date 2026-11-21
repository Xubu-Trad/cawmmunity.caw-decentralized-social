# Operation4 state-root divergence isolated

The first differing transition was rerun alone in pinned Geth, starting from the complete Anvil state exported after operation3. Reconstructing that predecessor trie gives `0xab5c916ace9650af3d32f0bd83003ecf94c042abb5666c92cd483eed93982189`, equal to its captured header. This avoids assuming that an incomplete funding file represents the starting state.

The signed operation4, block environment, predecessor allocation and both resulting allocations are retained. Geth and Anvil agree on balances, nonces, code and nonzero storage. Their transaction and receipt roots agree. The Anvil export additionally contains six zero-valued storage entries and one empty account at `0x0000000000000000000000000000000000000002`.

## Causal root comparison

| Reconstruction of the exported post-state | Root |
| --- | --- |
| Include zero leaves and empty account | `0xd8a41469fb4e855135a1be66ee98565bf4feee28c0b4d84c85bf1395f37d0721` — exactly the captured Anvil root |
| Omit zero leaves and empty account | `0x3a553b8627e939042c11041d338766d0303dd0ca20ebf86115d2ba2a553f27d8` — exactly the independently executed Geth root |
| Omit zero leaves only | `0xdc92d476b027ea3e35cfac4801dcab67ff313abe8427fe4a3dc94dc0a2e7a9df` |
| Omit empty account only | `0xa7ca7d8d365affa4215a756bcbe43f1cc9ffac9cf998db95d1a6ab981f62c48f` |

Changing either account balance or nonce also changes the reconstructed root. The two intermediate variants match neither endpoint: zero storage alone was an incomplete explanation. The first hypothesis failed and is retained locally; no mismatching allocation was silently normalized into acceptance.

This establishes the cause of this operation's root difference in the pinned local run. It does not prove the cause of every later divergence, identify the exact upstream implementation line, or establish behavior of all Anvil versions. The empty account is the SHA-256 precompile address, but this experiment establishes the state difference rather than a complete call-trace explanation.

## Reproduce the isolated transition

Use pinned Geth evm1.17.10 SHA-256 `d8cfddad15a8c601e7b069bc5973ad073dbc2d632b8c5ab50e513ef27c53d6da`. Copy the evidence directory to a new scratch location and run with the retained `pre.json`, `env.json` and `txs.rlp`:

```sh
evm t8n --state.fork=Shanghai --state.chainid=31337 --state.reward=-1 --input.alloc=pre.json --input.env=env.json --input.txs=txs.rlp --output.alloc=replayed-alloc.json --output.result=replayed-result.json --output.body=replayed-body.rlp
```

Use the repository's existing `reference/fixtures/generate-ethereum-proof-fixtures.py` trie/RLP/Keccak functions to reconstruct each allocation: hash each32-byte storage key, RLP-encode each integer value, form the storage trie, encode nonce/balance/storageRoot/codeHash, hash each20-byte address, then form the account trie. Include versus omit the specifically listed zero entries and empty account only for diagnosis. The original captured root and proof are not rewritten. A portable consolidated reproducer remains pending.

## Acceptance boundary and next step

The strict storage reader continues to reject the included-zero approval proof. No rule changed. A proof reconstructed under Geth's different root does not authenticate an Anvil header. For canonical history evidence, use a source whose roots and canonical execution agree, or investigate and correct the capture tool separately; do not add permissive proof handling to the protocol reader. Public checkpoint trust and finality remain open. This isolated finding narrows the acquisition problem; it is not complete production history verification.
