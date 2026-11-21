# Registry authenticated-chain acquisition requirements

UNRESOLVED — the selected registry exists in the retained synthetic experiment, not in an authenticated public-chain deployment record. Do not attach a real-chain checkpoint to its synthetic transactions and call that migration or authentication.

The next acquisition must retain these independently reviewable inputs:

- Selected network identity and independently obtained checkpoint hash, with a documented source and finality policy. RPC agreement is corroboration, not consensus proof. Checkpoint selection must be external to the provider bundle being validated.
- Exact candidate source/compilation/initialization and a real deployment transaction on that network. A different nonce, chain ID or address requires a new explicitly selected deployment manifest; the existing frozen fixture must remain unchanged.
- Complete transaction/receipt sets at deployment and target state, linked to the selected headers; signatures, constructor encoding, CREATE address, receipt success and complete root reconstruction must verify.
- Header ancestry from deployment through target state to the selected checkpoint under an explicitly supported fork/profile. The current repeated-context fixture cannot satisfy this. A fresh contiguous local-node exercise can test the adapter but still cannot prove public-network finality.
- Account runtime and required storage proofs under those same selected state roots. Reconstruct transfers and approvals from complete acquired history and compare selected slots. Do not treat an account-only proof as proof of ownership slots.
- Explicitly assessed consensus/finality trust and replay/reorg handling. The existing execution-header readers establish hash/structure/parent linkage, not consensus validity. Require an independently checked consensus/light-client path or disclose the external trusted-checkpoint assumption; never silently set consensusVerified true.

Keep acquisition transport replaceable: accept serialized evidence from independently operated endpoints, retain request/source provenance, and run verification offline. No mandatory Xubu endpoint, GitHub token, subscription or administrator allowlist should determine acceptance. Missing bodies, receipts, proof nodes, anchors or unsupported fork fields must reject or remain incomplete.

Before public test deployment, prepare and independently reproduce a contiguous local acquisition using the same constructor candidate. This requires a new evidence lane, not edits to existing synthetic headers. Public release and mainnet remain blocked pending the broader protocol decisions and review gates.
