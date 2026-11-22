# Actual CAW account proof: acquisition remains blocked

FACT — A bounded read-only attempt to acquire the actual CAW token account proof on November 8, 2026 stopped at the first request for both selected providers. https://ethereum-rpc.publicnode.com returned HTTP403; https://eth.drpc.org returned HTTP400. Neither returned a usable chain-ID response, header, account proof or runtime in this attempt. The HTTP exception status was recorded; response bodies were not retained. No conclusion about the reason for rejection is established.

These observations do not show that Ethereum proof acquisition is unavailable generally, that the asset is unsafe, or that either provider is permanently unavailable. They show that this acquisition route did not supply evidence in this environment. No retries to evade access restrictions, unpinned latest-block substitution, wallet requests or transactions were used.

## Explicit acquisition target

- Claimed chain: Ethereum, chain ID1.
- Asset: `0xf3b9569f82b18aef890de263b84189bd33ebe452`.
- Historical block number:25936362.
- Retained expected block hash: `0xf3e3dfad2242562dbed62de90831c39eace7c7c6e88f8c509afccef9a5f73e4d`.
- Retained expected runtime Keccak: `0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256`.

The target is historical, not a claim about current/finalized state. A successful acquisition would still need to verify the supplied header encoding/hash, account proof against its state root, and code bytes against the account code hash and independently retained expected hash. Chain ID responses and provider agreement do not themselves prove canonicality/finality.

## Provider-independent input contract

Another operator may supply a full execution header, an EIP-1186 account proof with `storageProof:[]`, and the code bytes at that same block. Keep raw requests/responses and hashes. With number-tagged requests, compare the returned block hash before and after acquisition; do not use latest. Archive proof support at this historical height may be required. If a different block is necessary, record a new explicit selection and justification rather than editing this evidence lane.

The `boundInventory` composition accepts the evidence as `{header,proof,code}` and a separate selection containing chainId, blockNumber, blockHash, address, codeHash and profile. Choose the supported execution-header profile from independently reviewed fork/field evidence; do not strip unsupported header fields to force acceptance. Current synthetic composition tests do not establish the profile or actual proof for this historical Ethereum target.

Runtime/source review in RETAINED_CAW_ASSET_REVIEW.md remains useful historical evidence, but cannot replace the missing account proof. Existing C-001 and production gates remain open. No extra centralized endpoint is made a protocol requirement by this experiment. README edits remain paused.
