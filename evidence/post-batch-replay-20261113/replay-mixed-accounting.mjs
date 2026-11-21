import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createVM, runTx} from '@ethereumjs/vm';
import {createTxFromRLP} from '@ethereumjs/tx';
import {createBlock} from '@ethereumjs/block';
import {MerkleStateManager} from '@ethereumjs/statemanager';
import {createCustomCommon, Mainnet, Hardfork} from '@ethereumjs/common';
import {Account, createAddressFromString} from '@ethereumjs/util';
import {inspectExecutionHeaderChain} from '../../reference/ethereum-execution-header.mjs';
import {verifyWalletWithdrawalInclusion} from '../../integration/local-console/withdrawal-inclusion.mjs';
import {accountingSlots, tokenBalanceSlot} from '../../integration/local-console/verify-console-accounting.mjs';

const load = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const prefix = load('../console-withdrawal-20261116/capture.json').blocks.slice(0, 13);
const genesis = load('../withdrawal-effects-20261116/genesis.json');
const {config} = load('../console-withdrawal-20261116/withdrawal-selection.json');
const mixed = load('../mixed-wallet-withdrawal-20261121/block.json');
const pins = load('../mixed-wallet-withdrawal-20261121/pins.json');
const selected = verifyWalletWithdrawalInclusion(mixed, pins);
const blocks = [...prefix, {block: mixed.header, rawTransactions: mixed.rawTransactions}];
const genesisHash = '0xc190afab951bdb9e657448e32761736857d0d76869bc5073b43d6160a8d19ddc';
inspectExecutionHeaderChain(blocks.map(b => b.block), {
  schema: 'caw-execution-header-chain-selection/1', profile: 'shanghai-17', startHash: genesisHash, endHash: pins.blockHash
});
assert.equal(pins.wallet, config.contracts.wallet.address);
assert.equal(pins.custody, config.contracts.custody.address);
assert.equal(pins.controller, config.controller);
const bytes = h => Buffer.from(h.slice(2), 'hex');
const hex = b => '0x' + Buffer.from(b).toString('hex');
const addr = createAddressFromString;
const state = new MerkleStateManager();
const common = createCustomCommon({chainId: 31337}, Mainnet, {hardfork: Hardfork.Shanghai});
for (const [key, value] of Object.entries(genesis.alloc)) {
  assert(!value.code && !value.storage);
  await state.putAccount(addr('0x' + key.replace(/^0x/, '')), new Account(BigInt(value.nonce ?? 0), BigInt(value.balance)));
}
const vm = await createVM({common, stateManager: state});
const root = async () => hex(await state.getStateRoot());
assert.equal(await root(), blocks[0].block.stateRoot);

async function snapshot() {
  const {custody, token, wallet} = config.contracts;
  for (const contract of [custody, token, wallet]) {
    assert.equal(hex((await state.getAccount(addr(contract.address))).codeHash), contract.codeHash);
  }
  const slots = accountingSlots(config, pins.wallet).custody;
  const values = {};
  for (const [label, contract, slot] of [
    ['unpaid', custody, slots[0]], ['unallocated', custody, slots[1]], ['credited', custody, slots[2]],
    ['credit2', custody, slots[3]], ['credit3', custody, slots[4]], ['credit4', custody, slots[5]],
    ['custodyBalance', token, tokenBalanceSlot(pins.custody)], ['walletBalance', token, tokenBalanceSlot(pins.wallet)]
  ]) {
    const value = await state.getStorage(addr(contract.address), bytes(slot));
    values[label] = String(value.length ? BigInt(hex(value)) : 0n);
  }
  return {root: await root(), values};
}

let before, after, opening;
for (const {block: h, rawTransactions} of blocks.slice(1)) {
  assert.deepEqual(h.withdrawals, []);
  assert.equal(BigInt(h.difficulty), 0n);
  const txs = rawTransactions.map(raw => createTxFromRLP(bytes(raw), {common}));
  const block = createBlock({header: {number: h.number, timestamp: h.timestamp, gasLimit: h.gasLimit,
    baseFeePerGas: h.baseFeePerGas, coinbase: h.miner, mixHash: h.mixHash}, withdrawals: []}, {common});
  assert.deepEqual(txs.map(tx => hex(tx.hash())), h.transactions);
  const trieBlock = createBlock({transactions: txs.map(tx => tx.toJSON())}, {common});
  assert.equal(hex(await trieBlock.genTxTrie()), h.transactionsRoot);
  let gas = 0n;
  if (h.hash === pins.blockHash) opening = await snapshot();
  for (const [index, tx] of txs.entries()) {
    const target = h.hash === pins.blockHash && index === selected.transactionIndex;
    if (target) before = await snapshot();
    const result = await runTx(vm, {tx, block, blockGasUsed: gas});
    gas += result.totalGasSpent;
    if (h.hash === pins.blockHash) {
      const receipt = mixed.receipts[index];
      assert.equal(result.receipt.status, Number(BigInt(receipt.status)));
      assert.equal(gas, BigInt(receipt.cumulativeGasUsed));
      assert.deepEqual(result.receipt.logs.map(([a,t,d]) => [hex(a),t.map(hex),hex(d)]),
        receipt.logs.map(log => [log.address,log.topics,log.data]));
    }
    if (target) after = await snapshot();
  }
  assert.equal(gas, BigInt(h.gasUsed));
  assert.equal(await root(), h.stateRoot, 'block state root ' + h.number);
}
assert.equal(selected.transactionIndex, 1);
assert.equal(selected.transactionCount, 2);
assert.notEqual(opening.root, before.root);
assert.deepEqual(opening.values, before.values);
const amount = BigInt(pins.amount);
for (const [key, delta] of Object.entries({unpaid:-amount, unallocated:0n, credited:-amount, credit2:-amount,
  credit3:0n, credit4:0n, custodyBalance:-amount, walletBalance:amount})) {
  assert.equal(BigInt(after.values[key]) - BigInt(before.values[key]), delta, key);
}
console.log(JSON.stringify({blockHash:pins.blockHash, transactionHash:pins.transactionHash,
  transactionIndex:selected.transactionIndex, recipient:pins.wallet, opening, before, after,
  matchingPostGenesisRoots:blocks.length-1, accountingEffectsVerified:true, independentOperator:false,
  publicChainAuthenticated:false}, null, 2));
