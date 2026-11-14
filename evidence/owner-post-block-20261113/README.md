# Owner transfer followed by a post in the same block

## New capability

`integration/local-console/post-authority-sequence.mjs` adds a separate experimental verifier for a bounded sequence of direct owner transfers and posts for fixture account2. It reconstructs ownership and epoch in transaction order instead of assigning every post the block's starting owner. The existing console reader is unchanged and still rejects mixed blocks; this new entry point is not yet exposed in its UI/API.

The entry point checks both headers, their link, transaction/receipt roots and signatures; verifies initial owner/epoch/nonce plus owner runtime proofs; requires exact signed calls and canonical event sequences; then binds final owner/epoch/nonce to state proofs under the ending header. Approved delegates, arbitrary wallet contracts, callbacks, unknown actions and reverted transactions remain unsupported. Selected contract code hashes and fixture wallet controller remain explicit trust inputs. The exported semantic reducer alone is not a cryptographic verifier.

## Execution evidence

Sources extend `599b862d47853ea567a28e6d0bfaf98414de45b1`; the unmodified selected setup closure originated at927bb32a1e13204400879883429e83625dd380af. New module hash is recorded in PROVENANCE. Geth1.17.10 mined block13 `0x18ffd7efdbc05d4302f20823f659e9225432b30e0b73dc31b9cdab57e75eda04`: the fixture wallet transfers account2 to its controller EOA, then that EOA publishes a post in the same block. Epoch1→2; posting nonce0→1. Observed custody credit/liability, token balances and allowance remain unchanged.

The verifier accepts the new owner's epoch2 post. Eight proof/commitment corruption controls and six semantic controls reject, including a stale signer, stale epoch and approved-delegate path outside scope. The offline suite has16checks including the positive and proof that the old console still rejects this block. Semantic-only mutations are not claimed to be freshly signed/mined counterexamples.

EthereumJS10.1.3 replayed all13signed transactions from the complete genesis allocation and matched all13post-genesis state roots, individual/cumulative/block gas, receipt status and logs. Both engines ran on one machine by one operator. This is not public chain authentication/finality, independent-operator reproduction, general NFT support, paid settlement, or a full-protocol release. The two previously oversized setup transactions remain outside the separate strict-reader resource limit; that limit is unchanged.

## Reproduce

Use the Linux/Node20.20.2 setup documented in the prior post-batch-replay-20261113 package. Install the console's committed lock with `npm ci --ignore-scripts --no-audit --no-fund`. From the repository root:

```sh
node integration/local-console/test-owner-post.mjs evidence/owner-post-block-20261113/owner-post-evidence.json
```

Expected16checks. For second-engine replay, use the locked EthereumJS package and replay.mjs from ../post-batch-replay-20261113 against this directory's capture.json/genesis.json. Expected13transactions/13state roots. This reexecutes retained inputs rather than mining again.

To mine anew, put a checkout containing this module in `src/` beside mine-owner-post.py and lane.mjs, install its console dependencies, and run `GETH_BIN=/absolute/path/to/verified/geth python3 mine-owner-post.py positive`. Geth hash, Node version, memory/disk guards, loopback isolation and retained-output refusal are inherited from the previous runner. The portable GETH_BIN wrapper differs from the executed local path and is not claimed as a clean-machine run. Repeat with a new output directory. Never real keys/assets.

## Next gate

Integrate acquisition of the extra owner and final-registry proofs into the local console, with cancellation/retry and unknown-action rejection intact. Independent review of this new block verifier remains pending. Do not enable general mixed blocks or silently adopt new economics.
