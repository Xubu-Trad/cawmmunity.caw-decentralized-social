# Retained CAW token evidence — historical authority review

## Observed facts

This review rechecks the retained September 9, 2026 Sourcify response for Ethereum address `0xf3b9569f82b18aef890de263b84189bd33ebe452`. Its exact SHA-256 is `e329b9a5fe9b53bea5eea3a1612b211a60b4ff1c0fa66a4100b895b5552ca691`. [Original acquisition endpoint](https://sourcify.dev/server/v2/contract/1/0xf3b9569f82b18aef890de263b84189bd33ebe452?fields=all). The endpoint may change; different bytes must not be represented as this capture.

The retained runtime is 2,278 bytes and recomputes to Keccak `0x6ee560d3e6b1f881a8711e0be0b30a0e8e0cf8b915ce8f75ea05002126c94256`. The flattened source recomputes to Keccak `0xecb60d357ab18ecefb17b11d354cc9df3a83f6cea76a1e00ef2fc0dee510c4e8`. The recorded service recompiled runtime differs only at byte314 and bytes2235–2266. Its declared decimals immutable and metadata substitutions reproduce the retained runtime exactly. This turn did not rerun the compiler or recover original metadata.

The ABI lists eleven ordinary ERC-20 functions: allowance, approve, balanceOf, decimals, decreaseAllowance, increaseAllowance, name, symbol, totalSupply, transfer, transferFrom. Source inspection finds the fee-receiver call in the ServicePayer constructor, not an ongoing runtime service dependency. The final StandardERC20 constructor mints once; its only added runtime override is decimals. No owner, upgrade, pause or public mint entry point appears in this reviewed source/ABI. Internal mint/burn helpers are not public callable functions.

The PUSH-aware linear scan finds no CALL, CALLCODE, DELEGATECALL, STATICCALL or SELFDESTRUCT before the service-declared metadata boundary at byte2225. This corroborates the source observation; it is not standalone control-flow verification. Full scan results remain in the result file. The service also reports isProxy=false; that is an attributed service classification, not independent proof.

## Consequence and remaining gates

INFERENCE — The deliberately dishonest-token fixture from TOKEN_REPORT_TRUST_BOUNDARY.md is not evidence that this historical CAW artifact has those malicious behaviors. Current evidence narrows the runtime external-authority concern for the retained artifact. It does not establish current-chain deployment identity or approve production custody.

UNRESOLVED — The historical block context in the result comes from the earlier capture record, not a newly verified account proof. Account-proof verification, current canonical block selection/finality, original metadata correspondence and production token selection remain unproved here. The existing C-001 registration/burn conflict remains open. Do not substitute another burn destination or silently change economics. Neither the API's match classification nor the empty opcode list constitutes a security audit.

## Reproduction

With ethers6.16.0 and the retained response file, run `node --max-old-space-size=256 experiments/c007-asset-inventory/check-retained-caw.mjs /absolute/path/to/sourcify-v2-response.json`. The script rejects any different capture hash before examining it. An extra-byte mutation was rejected. It checks runtime/source hashes, declared substitutions and the complete ABI function-name list. No downloaded code is executed. The raw third-party capture is not republished in this change; obtaining these exact historical bytes is required to repeat this check.

Next, use the existing header-bound account/code readers to tie a separately selected asset/block to account proof and runtime bytes. Header integrity still requires an explicit consensus/finality boundary. Preserve the older zero-storage rejection evidence; account-code binding must not silently convert those failed storage proofs into passes. README updates remain paused.
