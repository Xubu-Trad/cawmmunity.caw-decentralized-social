#!/usr/bin/env node
import { readJsonFile } from './read-proof-file.mjs';
import { BOUNDED_JSON_LIMITS } from '../../public/bounded-json.mjs';
import { inspectExecutionHeaderChain } from '../../reference/ethereum-execution-header.mjs';
import {
  MAX_WITHDRAWAL_PACKAGE_BYTES, MAX_WITHDRAWAL_SELECTION_BYTES, verifyWithdrawalProofPackage,
} from './withdrawal-proof-package.mjs';


try {
  if (![4, 6].includes(process.argv.length)) {
    throw Error('Usage: node verify-withdrawal-package.mjs proof-package.json independently-selected-withdrawal.json [headers.json trusted-checkpoint-hash]');
  }
  const selection = readJsonFile(process.argv[3], MAX_WITHDRAWAL_SELECTION_BYTES);
  const bundle = readJsonFile(process.argv[2], MAX_WITHDRAWAL_PACKAGE_BYTES);
  let result = verifyWithdrawalProofPackage(bundle, selection);
  if (process.argv.length === 6) {
    const headers = readJsonFile(process.argv[4], BOUNDED_JSON_LIMITS.maxBytes);
    const chain = inspectExecutionHeaderChain(headers, {
      schema: 'caw-execution-header-chain-selection/1', profile: 'shanghai-17',
      startHash: selection.startHash, endHash: process.argv[5],
    });
    if (chain.headers[1].hash !== selection.endHash) throw Error('Withdrawal block missing at expected height.');
    result = { withdrawal: result, checkpoint: { hash: chain.endHash, headerCount: chain.headerCount,
      withdrawalAncestryVerified: true, finalityVerified: false } };
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
