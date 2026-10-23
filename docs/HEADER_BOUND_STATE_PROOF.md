# State proofs bound to a selected execution header

The new offline composition removes a separate caller-supplied state-root argument. It recomputes the execution header hash using an explicitly selected layout, requires the selected block hash to match, and passes that checked header's state root to the existing account/storage proof verifier.

```js
import { inspectHeaderBoundStateProof } from '../reference/header-bound-state-proof.mjs';
const result = inspectHeaderBoundStateProof(
  JSON.stringify({ header, proof }),
  JSON.stringify({ schema: 'caw-header-state-selection/1',
    profile: 'prague-21', hash: selectedBlockHash,
    address: selectedAccountAddress, storageKeys: [] })
);
```

`header`, `proof` and the selections above must be supplied explicitly. This example does not acquire data or choose a canonical block. Only exact JSON text is accepted; evidence is bounded to 256 KiB and selection to 16 KiB. Duplicate keys, extra root overrides and caller-added trust flags reject. The existing readers retain their tighter proof-node, header and profile limits.

Success sets `selectedHeaderBindingVerified` only: the account/storage commitment belongs to the state root encoded in that selected header. It does not authenticate the selection, validate that its layout was active on a particular chain, prove consensus/finality/freshness, execute contracts, establish NFT ownership or restore live permissions. The nested proof retains its original conservative flags, including `blockBindingProven: false`; the composition's separately named flag expresses the narrower selected-header relation. No existing recovery profile or acceptance flag is widened.

## Evidence

The retained dRPC CAW-token account proof is checked against its retained header and previously selected hash. This is historical evidence replay, not a new RPC observation. The retained PublicNode proof request failed with a proof-window error; it remains unavailable evidence and is tested as rejection. It is not counted as a second successful proof source.

Tests reject the wrong selected hash, altered header root, an unrelated valid synthetic proof, a different selected account, a missing requested storage proof, mismatched/unsupported layouts, duplicate keys and root/trust overrides. The first focused attempt mistakenly treated the proof-window failure as a proof-bearing fixture and failed; that receipt is preserved, and the corrected tests distinguish these cases.

This increment is a prerequisite for authenticating historical account state, not an authority solution. Public chain selection, independent acquisition, registry code/storage layout, ownership transitions, contract-wallet validation and permission-at-transaction execution remain unresolved. See [recovery trust](RECOVERY_TRUST_MODEL.md). The public test candidate and production remain blocked.
