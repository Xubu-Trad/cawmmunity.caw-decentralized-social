# C-007 recipient-transfer and withdrawal evidence

FACT — Source commit: 832e3eb88ca75694a55da0478c9106046b41ba56.

This reduced packet retains selected original evidence bytes and
their SHA-256 identities. Full original manifests and node logs are
kept separately in the private forensic archive.

The signed post remains identical before and after NFT 2 transfers.
The control withdrawal reverts; the treatment withdrawal succeeds
for 100 synthetic CAW. Two independent offline verifiers replay
the recorded evidence.

Verify using:
  bash verify.sh /path/to/pinned/repository

The verifier requires Python 3 and the repository's pinned
source and cryptographic fixtures. Verification of saved
evidence is not a fresh EVM execution.

No production CAW token, scalable settlement, canonical economic
policy or long-term withdrawal guarantee is established.

C-007 OPEN. C-001 BLOCKED.

## V2 review corrections

All 20 original lane artifacts and ORIGIN_INDEX.json remain byte-identical.
The original issue5_comment.md is retained historical draft text, not an
approved publication message. Read its claims with these limitations.

Offline replay additionally requires the Python cryptography package with
secp256k1 support. This review ran Python 3.12.14 and cryptography 50.0.0;
a fresh dependency installation was not tested. The two required repository
files are verified by Git blob in verify.sh. This is not a full source-tree
or original private-manifest verification.

receipt_consistency.py checks the withdrawal run's recorded control post,
recipient transfer and treatment post against the previously audited post
run: requests, successful status, sender/recipient, gas, block number and
event payloads, plus paired branch summaries. Block hashes and log metadata
are not equated across independent saved runs. Both original offline audits
still run unchanged. No live RPC or Anvil is invoked by this verification.

The failed control withdrawal has no receipt logs. Its state_unchanged flag
is an original runner assertion; a separate complete after-state snapshot
is not retained here. This packet cannot independently reconstruct that
complete unchanged-state claim. Successful withdrawal accounting is checked
against retained before/after values, not authenticated live chain state.

Fresh EVM reproduction also needs the pinned repository's build/input files,
token fixture, native Anvil and runner/hook orchestration. It was not tested
from this reduced packet. Synthetic signing material is a public test fixture,
never a funded-wallet credential. No economic rule is selected.

PUBLICATION_HOLD=YES. No commit, push, PR, or issue comment is authorized here.
