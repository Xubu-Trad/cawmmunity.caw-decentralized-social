import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createLocalRpc } from '../local-rpc.mjs';
import { BOUNDED_JSON_LIMITS } from '../../../public/bounded-json.mjs';
import { readJsonFile } from '../read-proof-file.mjs';
import { capturePostCapsule } from './post-capsule.mjs';
import { capturePostCheckpoint, verifyPostCheckpoint } from './post-checkpoint.mjs';
import { verifyPostCapsule } from './verify-post-capsule.mjs';

const strictTime = { requireIncreasingTime: true };
const archiveLimit = 524288;
const packetLimit = BOUNDED_JSON_LIMITS.maxBytes;

export function verifyLocatedPost(archive, blockHash, txHash, checkpointHash, packet) {
  if (packet.originalBlockHash !== blockHash || packet.transactionHash !== txHash ||
      packet.checkpointHash !== checkpointHash) throw Error('Saved selection differs from the supplied hashes.');
  const original = verifyPostCheckpoint(archive, blockHash, txHash, checkpointHash, packet.originalEvidence, strictTime);
  if (original.checkpointHeight !== packet.checkpointHeight) throw Error('Selected checkpoint height mismatch.');
  const archivedPost = verifyPostCapsule(archive, blockHash, txHash);
  if (original.status === 'included') {
    if (packet.observed !== null) throw Error('Unexpected replacement evidence for an included block.');
    return { original, located: original, archivedPost, post: archivedPost };
  }
  // A missing receipt is a limitation of the chosen reader. It cannot establish absence.
  if (packet.observed === null) return { original, located: null, archivedPost, post: null };
  const observed = packet.observed;
  const located = verifyPostCheckpoint(observed.archive, observed.blockHash, txHash, checkpointHash, observed.evidence, strictTime);
  if (located.status !== 'included' || located.blockHash === blockHash) throw Error('Replacement post is outside the selected branch.');
  return { original, located, archivedPost, post: verifyPostCapsule(observed.archive, observed.blockHash, txHash) };
}

export async function captureLocatedPost(rpc, archive, blockHash, txHash, checkpointHeight) {
  if (!/^0x(?:0|[1-9a-f][0-9a-f]{0,15})$/.test(checkpointHeight)) throw Error('Expected a canonical hex checkpoint height.');
  const blockAtHeight = () => rpc('eth_getBlockByNumber', [checkpointHeight, false]);
  const checkpoint = await blockAtHeight();
  if (checkpoint?.number !== checkpointHeight) throw Error('Checkpoint height unavailable.');
  const checkpointHash = checkpoint.hash;
  const originalEvidence = await capturePostCheckpoint(rpc, archive, blockHash, txHash, checkpointHash);
  const original = verifyPostCheckpoint(archive, blockHash, txHash, checkpointHash, originalEvidence, strictTime);
  let observed = null;
  if (original.status === 'different-block') {
    const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
    if (receipt !== null) {
      if (receipt.transactionHash !== txHash) throw Error('Receipt transaction mismatch.');
      const newArchive = await capturePostCapsule(rpc, receipt.blockHash, txHash);
      const evidence = await capturePostCheckpoint(rpc, newArchive, receipt.blockHash, txHash, checkpointHash);
      observed = { blockHash: receipt.blockHash, archive: newArchive, evidence };
    }
  }
  const packet = { originalBlockHash: blockHash, transactionHash: txHash, checkpointHash, checkpointHeight, originalEvidence, observed };
  verifyLocatedPost(archive, blockHash, txHash, checkpointHash, packet);
  const last = await blockAtHeight();
  if (last?.hash !== checkpointHash || last.number !== checkpointHeight) throw Error('Checkpoint changed while locating the post.');
  return packet;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'capture' && args.length === 6) {
    const [endpoint, block, tx, archiveFile, height, output] = args;
    const archive = readJsonFile(archiveFile, archiveLimit);
    const packet = await captureLocatedPost(createLocalRpc(endpoint), archive, block, tx, height);
    const serialized = JSON.stringify(packet) + '\n';
    if (Buffer.byteLength(serialized) > packetLimit) throw Error('Evidence packet exceeds the offline reader limit.');
    await writeFile(output, serialized, { flag: 'wx' });
    console.log(JSON.stringify({ checkpointHeight: height, checkpointHash: packet.checkpointHash }));
  } else if (command === 'verify' && args.length === 5) {
    const [block, tx, archiveFile, checkpoint, packet] = args;
    console.log(JSON.stringify(verifyLocatedPost(readJsonFile(archiveFile, archiveLimit), block, tx, checkpoint,
      readJsonFile(packet, packetLimit)), null, 2));
  } else {
    throw Error('Use capture RPC OLD_BLOCK TX ARCHIVE CHECKPOINT_HEIGHT NEW_FILE or verify OLD_BLOCK TX ARCHIVE CHECKPOINT_HASH FILE.');
  }
}
