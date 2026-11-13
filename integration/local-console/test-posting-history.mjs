import fs from 'node:fs';
import assert from 'node:assert/strict';
import {verifyPostingHistory} from './verify-posting-history.mjs';
const [capturePath, selectionPath] = process.argv.slice(2);
function load(path) {
  assert(fs.statSync(path).size <= 8 * 1024 * 1024, 'INPUT_SIZE');
  return JSON.parse(fs.readFileSync(path));
}
const bundle = load(capturePath), selection = load(selectionPath);
const result = verifyPostingHistory(bundle, selection);
assert.equal(result.posts.length, 2);
assert.deepEqual(result.posts.map(p => [p.epoch,p.nonce]), [['1','0'],['2','1']]);
assert.equal(result.posts[0].author, selection.contracts.wallet.address);
assert.equal(result.posts[1].text.codePointAt(0), 0xfeff);
const controls = [];
function reject(name, mutate) {
  const b = structuredClone(bundle), s = structuredClone(selection);
  mutate(b,s);
  assert.throws(() => verifyPostingHistory(b,s), undefined, name);
  controls.push(name);
}
reject('changed signed bytes', b => { const x=b.blocks[0].rawTransactions[0]; b.blocks[0].rawTransactions[0]=x.slice(0,-2)+(x.endsWith('00')?'01':'00'); });
reject('changed receipt status', b => b.blocks[0].receipts[0].status='0x0');
reject('changed receipt text', b => {let l=b.blocks[0].receipts[0].logs.at(-1);l.data=l.data.slice(0,-2)+'ff';});
reject('omitted first block', b => b.blocks.shift());
reject('omitted middle block', b => b.blocks.splice(1,1));
reject('reordered blocks', b => [b.blocks[0],b.blocks[1]]=[b.blocks[1],b.blocks[0]]);
reject('changed state root', b => b.blocks[0].header.stateRoot='0x'+'00'.repeat(32));
reject('wrong parent registry proof', b => b.blocks[0].parent.registry=b.blocks.at(-1).parent.registry);
reject('claimed owner changed', b => b.blocks[0].parent.registry.storageProof[0].value='0x1');
reject('wrong controller selection', (b,s) => s.controller='0x'+'11'.repeat(20));
reject('wrong posting code hash', (b,s) => s.contracts.posting.codeHash='0x'+'00'.repeat(32));
reject('missing code hash selection', (b,s) => delete s.contracts.registry.codeHash);
reject('changed final nonce', b => b.finalPosting.storageProof[0].value='0x3');
reject('wrong endpoint selection', (b,s) => s.endHash='0x'+'00'.repeat(32));
reject('multiple transactions outside scope', b => b.blocks[0].rawTransactions.push(b.blocks[0].rawTransactions[0]));
console.log(JSON.stringify({result,negativeControls:controls,negativeControlsPassed:controls.length},null,2));
