#!/usr/bin/env node
import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import { parseBoundedJson } from '../../public/bounded-json.mjs';
import {
  MAX_WITHDRAWAL_PACKAGE_BYTES, MAX_WITHDRAWAL_SELECTION_BYTES, verifyWithdrawalProofPackage,
} from './withdrawal-proof-package.mjs';

function readJsonFile(path, limit) {
  if (!fs.lstatSync(path).isFile()) throw Error('Expected a regular JSON file.');
  const { O_RDONLY, O_NONBLOCK, O_NOFOLLOW } = fs.constants;
  const fd = fs.openSync(path, O_RDONLY | (O_NONBLOCK ?? 0) | (O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw Error('Expected a regular JSON file.');
    if (stat.size > limit) throw Error('JSON file exceeds ' + limit + ' bytes.');
    // Read one extra byte to detect growth after fstat, without an unbounded
    // allocation or read. A short file also fails if it changes during use.
    const buffer = Buffer.alloc(stat.size + 1);
    let used = 0;
    while (used < buffer.length) {
      const count = fs.readSync(fd, buffer, used, buffer.length - used, null);
      if (!count) break;
      used += count;
    }
    if (used !== stat.size) throw Error('JSON file changed size during the read.');
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, used));
    return parseBoundedJson(text, limit);
  } finally {
    fs.closeSync(fd);
  }
}

try {
  if (process.argv.length !== 4) {
    throw Error('Usage: node verify-withdrawal-package.mjs proof-package.json independently-selected-withdrawal.json');
  }
  const selection = readJsonFile(process.argv[3], MAX_WITHDRAWAL_SELECTION_BYTES);
  const bundle = readJsonFile(process.argv[2], MAX_WITHDRAWAL_PACKAGE_BYTES);
  console.log(JSON.stringify(verifyWithdrawalProofPackage(bundle, selection), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
