import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readPublishedPost} from './paid-post-settlement.mjs';

const hash = '0xe43e1ac0a778fc48230e2119ac059995328dc9efc823e33bf1e6c438b748394d';
const custody = process.argv.includes('--custody');
const folder = custody ? 'custody-post-20261122' : 'mixed-post-20261122';
const file = new URL('../../evidence/'+folder+'/mixed-post-reads.json',import.meta.url);
const calls = JSON.parse(await readFile(file,'utf8'));
const replies = new Map(calls.map(c => [JSON.stringify([c.method,c.params]),c.result]));
assert.equal(replies.size,calls.length);
const verified = await readPublishedPost((method,params) => {
  const key = JSON.stringify([method,params]);
  assert(replies.has(key),'Missing recorded read: '+method);
  return replies.get(key);
},hash);
assert.equal(verified.block.hash,custody ? '0xd14857f8de7c8040b639a53ca094b7f560134f618d983c169c6334d708e6ffbf' : '0x2063e8e86c251b87f728a1fe90c3a7d9a0d5074c79945ac1b91093f5e932d092');
assert.equal(verified.transactionIndex,1);
assert.equal(verified.transactionCount,3);
assert.deepEqual(verified.settlement,{fee:'5000000000000000000000',share2:'1363636363636363636363',share3:'3636363636363636363636',dust:'1'});
if (custody) {
  const withdrawals = verified.siblingWithdrawals;
  assert.deepEqual(withdrawals.map(w => [w.index,w.account,BigInt(w.amount)]),
    [[0,'2',10n**18n],[2,'2',2n*10n**18n]]);
  const vaultProofs = calls.filter(c => c.method === 'eth_getProof' && c.result.storageProof.length === 12);
  const credit2 = proof => BigInt(proof.result.storageProof.find(slot => BigInt(slot.key) === 4n).value);
  assert.equal(vaultProofs.length,2);
  assert.equal(credit2(vaultProofs[1])-credit2(vaultProofs[0]),
    BigInt(verified.settlement.share2)-BigInt(withdrawals[0].amount)-BigInt(withdrawals[1].amount));
  for (const sibling of withdrawals) {
    const key = JSON.stringify(['eth_getRawTransactionByHash',[sibling.hash]]);
    const raw = replies.get(key);
    replies.set(key,replies.get(JSON.stringify(['eth_getRawTransactionByHash',[hash]])));
    await assert.rejects(readPublishedPost((method,params) => replies.get(JSON.stringify([method,params])),hash));
    replies.set(key,raw);
  }
}
console.log(JSON.stringify(verified));
