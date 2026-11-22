import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readPublishedPost} from './paid-post-settlement.mjs';

const hash = '0xe43e1ac0a778fc48230e2119ac059995328dc9efc823e33bf1e6c438b748394d';
const file = new URL('../../evidence/mixed-post-20261122/mixed-post-reads.json',import.meta.url);
const calls = JSON.parse(await readFile(file,'utf8'));
const replies = new Map(calls.map(c => [JSON.stringify([c.method,c.params]),c.result]));
assert.equal(replies.size,calls.length);
const verified = await readPublishedPost((method,params) => {
  const key = JSON.stringify([method,params]);
  assert(replies.has(key),'Missing recorded read: '+method);
  return replies.get(key);
},hash);
assert.equal(verified.block.hash,'0x2063e8e86c251b87f728a1fe90c3a7d9a0d5074c79945ac1b91093f5e932d092');
assert.equal(verified.transactionIndex,1);
assert.equal(verified.transactionCount,3);
assert.deepEqual(verified.settlement,{fee:'5000000000000000000000',share2:'1363636363636363636363',share3:'3636363636363636363636',dust:'1'});
console.log(JSON.stringify(verified));
