# Review a local paid-post request

The C-007 fixture charges account 1 a fixed 5,000 mock tokens. The owner authorizes the exact post text and stake root for a specific epoch, nonce and validity window. The two successful historical calls use different controllers because account 1 changed hands. This separate research contract has its own signing domain and economics. The running console’s ordinary post remains unpaid.

Run the complete reviewer workflow with `sh integration/local-console/review-paid-post.sh` from the repository root on Node 20.20.2. The individual commands are:

```sh
npm ci --prefix integration/local-console --ignore-scripts
node integration/local-console/paid-post-preview.mjs integration/local-console/paid-post-example.json
node integration/local-console/test-paid-post-preview.mjs
```

The example uses the first successful historical request. The command displays text, fee, digest and complete EIP-712 data offline. The numeric inputs are unsigned decimal strings. Times are Unix seconds. The command accepts caller-provided state and does not establish present ownership, fee affordability, stake eligibility or freshness. It never contacts a wallet. The expected digest for the example is `0xe362f82314cbff5789cf89a332c8a215b179aa60e9716e7cdaba95cf5430b189`.

The regression reads the retained signed transactions and successful receipts, rebuilds each request, and recovers the expected fixture controller from the historical signature. It also checks invalid fields and that changing the text, nonce or stake root changes the digest. This tests compatibility with the historical fixture. Live acquisition, signing, submission and independent reproduction are separate steps.
