# Peer source unavailable, then restored

**Peer availability check:** A fresh Reth client stayed at genesis with the target block absent during three requests while its Geth source was stopped. Restoring the same peer allowed all29headers to synchronize without restarting Reth or importing block files. This adds a bounded source-outage/recovery check to the earlier localhost synchronization and offline-restart evidence. It does not establish alternate-provider failover, interruption halfway through a download, separate-host operation or public-chain finality.

## Method

Repeat the retained Geth-to-Reth local fixture using a fresh destination initialized only with the common genesis. Start the source to identify its peer identity, then stop it before requesting the selected head. Issue three Engine forkchoice requests. Require SYNCING, block28 absent and block number zero each time. Restart the same Geth source database and dial the same still-running Reth destination. Require VALID and agreement on all29header hashes and state roots. No execution payload, block file or source database is supplied to the destination. Both client processes are stopped afterward.

The target hash is externally selected; safe/finalized hashes remain zero. The source outage is before acquisition, not a demonstrated mid-download interruption. The test does not prove permanent-loss recovery or that an alternative peer can provide the data. Client/runtime supply-chain limitations from INDEPENDENT_CLIENT_IMPORT.md remain unchanged.

Result: evidence/peer-source-outage-20261111/result.json. Original acquisition requests and service logs remain preserved locally; no JWT secret is published. The complete portable acquisition driver remains pending. Next: portable two-client acquisition, interrupted transfer and replacement-source checks, followed by separate-host reproduction and authenticated public-chain selection.
