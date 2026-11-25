# OI-01 R-04A · Simulated recovery from retained inputs
The recovery process received a complete historical source export, raw commit, separate verification pins and written instructions. The selected commit was bd350c7be5004fd28382470a6a841be6e133c50f. Its 1,089 files reconstructed Git tree b6f20122aa1e564e9ca723f7a58140261bf7ba66.

The simulation recovered 22 assets and one manifest, totalling 1,428,692 bytes. The manifest SHA-256 was c4916abc6e35579d89d367eb8368ddcb4d677830c35eed30584ea4da796d4374. The 1,446,912-byte static archive matched SHA-256 d277ba5dc919324716e178b1623ade1cbd2e505be3b1576b218ec75d0619ad31. All 23 extracted files matched the build. Both relocated prefixes served all 23 expected responses with matching content and MIME types.

External socket creation was denied to the recovery processes. The HTTP test used a single local TCP connection established by the trusted launcher before applying the restriction. All ten controls met their expected outcomes, including refusal to start recovery when retained inputs were absent.

The technical recommendation is PASS_WITHIN_SCOPE for this simulation. Independent human operation, independent custody, publisher authentication and independent selection of the verification pins remain unestablished. OI-01 remains open. This report documents a bounded simulation, not actual independent third-party custody, whole-host network isolation, or completion of OI-01.
