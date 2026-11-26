import { pathToFileURL } from 'node:url';
import { readJsonFile } from '../read-proof-file.mjs';
import { verifyLocatedPost } from './locate-archived-post.mjs';

export function recheckFeed(checkpoint, entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 32) throw Error('Supply 1 to 32 saved posts.');
  const hashes = new Set();
  const posts = [], unresolved = [];
  for (const {block, tx, archive, packet} of entries) {
    const checked = verifyLocatedPost(archive, block, tx, checkpoint, packet);
    if (hashes.has(checked.original.txHash)) throw Error('Duplicate post transaction.');
    hashes.add(checked.original.txHash);
    if (!checked.located) {
      unresolved.push({tx, originalBlock: block});
      continue;
    }
    posts.push({height: checked.located.postHeight, position: checked.post.transactionIndex ?? 0,
      membership: checked.original.status === 'included' ? 'retained' : 're-mined', post: checked.post});
  }
  posts.sort((a,b) => BigInt(a.height) === BigInt(b.height) ? b.position-a.position :
    BigInt(a.height) > BigInt(b.height) ? -1 : 1);
  return {checkpoint, posts, unresolved};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [checkpoint, ...args] = process.argv.slice(2);
  if (!args.length || args.length % 4 || args.length > 128)
    throw Error('Use CHECKPOINT followed by OLD_BLOCK TX ARCHIVE PACKET for each retained post.');
  const entries = [];
  for (let i=0; i<args.length; i+=4) {
    const [block,tx,archive,packet] = args.slice(i,i+4);
    entries.push({block,tx,archive:readJsonFile(archive,524288),packet:readJsonFile(packet,1048576)});
  }
  console.log(JSON.stringify(recheckFeed(checkpoint,entries),null,2));
}
