import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyWalletWithdrawalInclusion as verify } from './withdrawal-inclusion.mjs';

const fixture = new URL('../../evidence/mixed-wallet-withdrawal-20261121/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, fixture), 'utf8'));
const block = read('block.json');
const pins = read('pins.json');
const expected = read('result.json');
assert.deepEqual(verify(block, pins), expected);
assert.equal(expected.transactionIndex, 1);
assert.equal(expected.transactionCount, 2);
assert.equal(expected.accountingEffectsVerified, false);
assert.equal(expected.publicChainAuthenticated, false);
for (const field of ['rawTransactions', 'receipts']) {
  assert.throws(() => verify({...block, [field]: [...block[field]].reverse()}, pins));
}
const sibling = structuredClone(block);
sibling.rawTransactions[0] = sibling.rawTransactions[1];
assert.throws(() => verify(sibling, pins));
const other = '0x' + '11'.repeat(20);
for (const changes of [{wallet: other}, {controller: other}, {custody: other}, {amount: '3'},
  {blockHash: '0x' + '11'.repeat(32)}, {transactionHash: block.receipts[0].transactionHash}]) {
  assert.throws(() => verify(block, {...pins, ...changes}));
}
console.log('mixed-block withdrawal and nine rejection cases passed');
