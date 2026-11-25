# OI-01 R-03 · Static recovery on an operator-controlled Mac
25 November 2026 · Bounded static recovery verification record

**R-03 Technical: PASS_WITHIN_SCOPE. OI-01 remains OPEN.** An operator-controlled macOS/arm64 session using Node.js 24.20.0 reproduced the historical CAWmmunity static frontend. The operator reported staging the source from a Git repository retained on an operator-controlled VPS. Earlier Work runs used Linux.

| Historical reference | Value |
| --- | --- |
| Source commit selected for the run | `bd350c7be5004fd28382470a6a841be6e133c50f` |
| Git tree reconstructed from 1,089 recorded blob entries | `b6f20122aa1e564e9ca723f7a58140261bf7ba66` |
| Generated checksum manifest, SHA-256 | `c4916abc6e35579d89d367eb8368ddcb4d677830c35eed30584ea4da796d4374` |
| Deterministic static tar, SHA-256 | `d277ba5dc919324716e178b1623ade1cbd2e505be3b1576b218ec75d0619ad31` |

The first attempt stopped during tool preflight because a logging call supplied the same argument twice. After a one-token change to the logging keyword, the second attempt completed the build and HTTP phases with exit code zero. Both attempts were retained.

The reviewer checked the 1,446,912-byte tar against the selected digest. Its 22 assets and one manifest totalled 1,428,692 bytes. All 23 extracted files matched the tar byte for byte. At each of two relocated prefixes, all 23 logged HTTP responses had the expected status, MIME type and body digest. A missing required script returned 404. A modified response returned 200 and failed the byte comparison.

The missing-source, modified-asset and wrong-pin controls each rejected their input. A substituted manifest failed against the original pin. Supplying the replacement pin accepted internal consistency and left origin authentication false. Browser smoke was not run.

The return packet contained the source inventory and a corroborating subset of source files. It omitted the complete source tar and raw commit, limiting direct rehashing to the available bytes. Separate Mac execution is supported by the operator account and runtime record. Independent physical hardware corroboration and a separate human operator remain unestablished. The operator reported disconnecting Wi-Fi and the route probes could not select external routes to their test destinations. Residual virtual IPv6 routes limit any claim of complete egress enforcement.

Independent custody, independent pin provenance, publisher authentication and production protocol recovery remain open. This report contains only original review prose and hash references; it does not redistribute the recovered archive, project artwork, source files, or PRIVATE Evidence.
