# Registry integration boundary for funded credits

Source review at `93569f7d5947a9ff0fa1c5960c261df860af2d64`. No adapter or new test result is claimed here.

The existing `experiments/account-authority/TestAccountRegistry.sol` is an ERC-721 core fixture. It exposes `authority(accountId)` as owner/epoch, clears approval and advances epoch before safe-receiver callbacks, and increments epoch on every transfer, including self-transfer. It has constructor accounts1/2/3 only, no public registration or later mint. A safe receiver may transfer onward; requiring it to remain final owner would contradict this fixture's deliberately preserved behavior.

`CawAccountCustodyProbe.sol` already reads registry owner/epoch, distinguishes owner spending from transfer approval, pins registry runtime code, and rechecks authority after external token interaction. Runtime equality alone is not proof of honest state, immutable dependencies or an authentic registry. Its fixed original-token address and Solidity0.8.10 are not drop-in compatible with the new constructor-token,0.8.30 research fixture.

## Required integration changes

Replace constructor owner maps with one immutable registry reference and explicit authority reads. Do not retain a competing custody owner map or add a sync operator. Existing registry transfers increment epoch; custody should consume that epoch rather than maintain another counter. Remove the custody-local transfer function when a registry owns transfer authority.

The custody entry lock protects custody functions only. A token callback can call a separate registry and potentially change owner/epoch if authorized there. Therefore check owner, epoch and selected registry code both before and after token transfers, even while custody is locked. Reversion must roll back token/accounting and any nested ownership change. An A-to-B-to-A callback needs epoch comparison because final owner equality is insufficient.

Keep claims tied to an account under the disclosed experimental entitlement choice. Approval to transfer an NFT is not permission to withdraw it while another wallet owns it. A delegate that validly transfers the NFT to itself becomes its owner; do not claim a guarantee against that valid ownership transition.

## Concrete next fixture

Reuse the existing registry source/semantics with changes separately documented for compiler and account-ID mapping. The funded snapshot currently contains accounts1/2/3/4, whereas the retained registry only creates1/2/3. Select an explicit test mapping before execution rather than treating missing account4 as registered. Either add a clearly labelled constructor-only zero-weight account4 to a derived fixture or use a separate new snapshot; preserve the older roots and transactions.

Test owner/operator distinction, stale epochs, ordinary transfer, self-transfer, safe-receiver rejection/forward transfer, registry change during a token callback and A-to-B-to-A callback. Include post-call authority failure with full rollback. Reconstruct the same registry/custody history and compare engines after the bounded adapter passes. No username-burn resolution or live NFT authority is inferred from this fixture.
