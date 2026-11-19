import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { isDeepStrictEqual } from 'node:util';
import { BOUNDED_JSON_LIMITS } from '../../public/bounded-json.mjs';
import { verifyWithdrawalEffects } from './verify-withdrawal-effects.mjs';

export const WITHDRAWAL_PROOF_SCHEMA = 'caw-console-withdrawal-proofs/1';
export const MAX_WITHDRAWAL_PACKAGE_BYTES = BOUNDED_JSON_LIMITS.maxBytes;
export const MAX_WITHDRAWAL_SELECTION_BYTES = 64 * 1024;

const address = /^0x[0-9a-f]{40}$/;
const hash = /^0x[0-9a-f]{64}$/;
const contractNames = ['registry', 'posting', 'custody', 'token', 'wallet'];
const headerFields = [
  'hash', 'parentHash', 'sha3Uncles', 'miner', 'stateRoot', 'transactionsRoot', 'receiptsRoot',
  'logsBloom', 'difficulty', 'number', 'gasLimit', 'gasUsed', 'timestamp', 'extraData',
  'mixHash', 'nonce', 'baseFeePerGas', 'withdrawalsRoot',
];

function pick(source, fields) {
  return Object.fromEntries(fields.map(key => {
    assert(source && Object.hasOwn(source, key), 'WITHDRAWAL_PROOF_MISSING_' + key);
    return [key, source[key]];
  }));
}

function publicSelection(selection) {
  const { config, startHash, endHash, transactionHash, amount } = selection;
  for (const value of [startHash, endHash, transactionHash]) assert.match(value, hash);
  assert.match(amount, /^[1-9][0-9]{0,77}$/);
  assert(BigInt(amount) < (1n << 256n), 'WITHDRAWAL_AMOUNT');
  assert.match(config.controller, address);
  const contracts = Object.fromEntries(contractNames.map(name => {
    const contract = pick(config.contracts[name], ['address', 'codeHash']);
    assert.match(contract.address, address);
    assert.match(contract.codeHash, hash);
    return [name, contract];
  }));
  return { config: { controller: config.controller, contracts }, startHash, endHash, transactionHash, amount };
}

function publicBoundary({ header, proofs, observed }) {
  const state = pick(observed, ['owner', 'epoch', 'nonce', 'credit', 'unpaidLiability']);
  const accounts = Object.entries(pick(proofs, ['registry', 'posting', 'custody', 'token', 'owner']));
  return {
    header: pick(header, headerFields),
    proofs: Object.fromEntries(accounts.map(([name, proof]) => [name, {
      ...pick(proof, ['address', 'balance', 'codeHash', 'nonce', 'storageHash', 'accountProof']),
      storageProof: proof.storageProof.map(entry => pick(entry, ['key', 'value', 'proof'])),
    }])),
    observed: { ...state, balances: pick(observed.balances, ['wallet', 'owner', 'custody']) },
  };
}

function publicReceipt(receipt) {
  const fields = ['type', 'status', 'cumulativeGasUsed', 'logsBloom', 'transactionIndex', 'blockHash', 'blockNumber'];
  return { ...pick(receipt, fields), logs: receipt.logs.map(log => pick(log, ['address', 'topics', 'data'])) };
}

// Acquired inputs are plain JSON. The writer exports the evidence required for
// replay. Verification and selection provenance are separate caller actions.
export function makeWithdrawalProofPackage(evidence, selection) {
  assert(Array.isArray(evidence.rawTransactions) && evidence.rawTransactions.length === 1, 'WITHDRAWAL_SINGLE_TRANSACTION_ONLY');
  assert(Array.isArray(evidence.receipts) && evidence.receipts.length === 1, 'WITHDRAWAL_SINGLE_RECEIPT_ONLY');
  const bundle = {
    schema: WITHDRAWAL_PROOF_SCHEMA,
    selection: publicSelection(selection),
    evidence: {
      before: publicBoundary(evidence.before),
      after: publicBoundary(evidence.after),
      rawTransactions: evidence.rawTransactions,
      receipts: evidence.receipts.map(publicReceipt),
    },
  };
  assert(Buffer.byteLength(JSON.stringify(bundle)) <= MAX_WITHDRAWAL_PACKAGE_BYTES, 'WITHDRAWAL_PACKAGE_SIZE');
  return structuredClone(bundle);
}

export function verifyWithdrawalProofPackage(bundle, independentSelection) {
  assert(independentSelection, 'WITHDRAWAL_INDEPENDENT_SELECTION_REQUIRED');
  assert.equal(bundle?.schema, WITHDRAWAL_PROOF_SCHEMA, 'WITHDRAWAL_PROOF_SCHEMA');
  const selected = publicSelection(independentSelection);
  assert(isDeepStrictEqual(bundle.selection, selected), 'WITHDRAWAL_SELECTION_MISMATCH');
  const expected = makeWithdrawalProofPackage(bundle.evidence, selected);
  assert(isDeepStrictEqual(bundle, expected), 'WITHDRAWAL_PACKAGE_FIELDS');
  return verifyWithdrawalEffects(expected.evidence, selected);
}
