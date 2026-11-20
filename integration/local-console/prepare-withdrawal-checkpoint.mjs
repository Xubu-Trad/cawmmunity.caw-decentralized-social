// Generate a new empty Shanghai child of the archived withdrawal, before any
// node starts. An operator-supplied historical checkpoint is a separate input.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { encodeRlp, keccak256, toBeHex } from 'ethers';
import { makeWithdrawalProofPackage } from './withdrawal-proof-package.mjs';

const dir = new URL('../../evidence/console-withdrawal-20261116/', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, dir)));
const evidence = read('withdrawal-boundaries.json');
const selection = read('withdrawal-selection.json');
const parent = evidence.after.header;
assert.equal(parent.hash, selection.endHash);
assert.equal(parent.number, '0xe');
assert.equal(parent.baseFeePerGas, '0x1');
assert(BigInt(parent.gasUsed) < BigInt(parent.gasLimit) / 2n);
const emptyTrie = keccak256('0x80');
const header = { ...parent, parentHash: parent.hash, number: '0xf',
  timestamp: '0x' + (BigInt(parent.timestamp) + 1n).toString(16), gasUsed: '0x0', extraData: '0x',
  mixHash: '0x' + '00'.repeat(32), transactionsRoot: emptyTrie, receiptsRoot: emptyTrie,
  withdrawalsRoot: emptyTrie, logsBloom: '0x' + '00'.repeat(256), transactions: [], withdrawals: [] };
const quantity = n => BigInt(n) === 0n ? '0x' : toBeHex(BigInt(n));
header.hash = keccak256(encodeRlp([header.parentHash, header.sha3Uncles, header.miner, header.stateRoot,
  header.transactionsRoot, header.receiptsRoot, header.logsBloom, quantity(header.difficulty),
  quantity(header.number), quantity(header.gasLimit), quantity(header.gasUsed), quantity(header.timestamp),
  header.extraData, header.mixHash, header.nonce, quantity(header.baseFeePerGas), header.withdrawalsRoot]));
const save = (name, value) => fs.writeFileSync(path.join(process.argv[2], name), JSON.stringify(value), {flag:'wx'});
save('checkpoint.json', { number: header.number, hash: header.hash, parentHash: parent.hash,
  source: 'precomputed deterministic local continuation using ethers RLP and Keccak' });
save('child.json', header);
save('proofs.json', makeWithdrawalProofPackage(evidence, selection));
