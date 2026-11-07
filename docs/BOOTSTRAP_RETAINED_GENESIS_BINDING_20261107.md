# Retained minimal Capella genesis-root binding — 2026-11-07

Status: research-only. Parent: 5d8f488c328066e67ad97263f6277564f03c0030.

FACT — An initial synthetic probe changed the full genesis validators root while recomputing its dependent four-byte fork digest and metadata SHA-256. Existing supplied-data consistency checks admitted the coherent substitution, while the original retained metadata hash rejected it.

FACT — A new separate verifier checks the full genesis validators root against a constant retained in reviewed research source. The reference originates from the same preserved minimal Capella fixture; it is not independent live-network authority.

FACT — Local Ubuntu tests passed 2/2 for the new gate, including a coherent synthetic substitution rejected by the fixed reference. The unchanged fork-data suite passed 13/13. Input and output identities are retained in the adjacent evidence JSON and saved TAP files. Node v20.20.2 was used for the local results; the repository-declared Node v24.20.0 and full suite were not exercised.

The fixture's retained genesis root is 0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b. The synthetic changed-root digest is 0x51369403.

INFERENCE — Fixing the expected full root prevents this caller-side re-pinning while the reviewed code remains unchanged. It cannot prove the reference is canonical, independently acquired or sufficiently recent.

UNRESOLVED — Live network identity and fork schedule, checkpoint origin, weak-subjectivity recency, BLS signatures, consensus, finality, update transitions and independent operation without mandatory builder infrastructure.

No network authentication, production approval, public-test clearance, BLS validation or update acceptance is claimed. Hosted CI remains deferred.
