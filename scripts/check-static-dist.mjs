import { lstatSync, openSync, fstatSync, readSync, closeSync, opendirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ASSETS } from './build.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function need(ok, code) {
  if (!ok) { const error = new Error('Static recovery rejected: ' + code); error.code = 'STATIC_RECOVERY_' + code; throw error; }
}
function readBounded(path, limit) {
  const info = lstatSync(path);
  need(info.isFile() && !info.isSymbolicLink(), 'REGULAR_FILE');
  need(info.size <= limit, 'SIZE');
  const fd = openSync(path, 'r');
  try {
    need(fstatSync(fd).isFile(), 'REGULAR_FILE');
    const bytes = Buffer.alloc(limit + 1); let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
    need(length <= limit, 'SIZE');
    return bytes.subarray(0, length);
  } finally { closeSync(fd); }
}

// Reads only a fixed asset set. Never executes received scripts or fetches URLs.
// The verifier code, trust source of the retained pin and a non-concurrently-
// modified local filesystem are caller assumptions, not authenticated here.
export function checkStaticDirectory(directory, expectedManifestSha256) {
  need(arguments.length === 2 && typeof directory === 'string' && directory.length > 0, 'ARGUMENTS');
  need(typeof expectedManifestSha256 === 'string' && /^[0-9a-f]{64}$/.test(expectedManifestSha256), 'PIN');
  const root = resolve(directory), info = lstatSync(root);
  need(info.isDirectory() && !info.isSymbolicLink(), 'DIRECTORY');
  const allowed = new Set([...ASSETS, 'SHA256SUMS.txt']);
  const dir = opendirSync(root); let count = 0;
  try {
    let entry;
    while ((entry = dir.readSync()) !== null) {
      need(++count <= allowed.size && allowed.has(entry.name), 'ENTRY_SET');
    }
  } finally { dir.closeSync(); }
  need(count === allowed.size, 'ENTRY_SET');
  const manifest = readBounded(join(root, 'SHA256SUMS.txt'), 4096);
  need(hash(manifest) === expectedManifestSha256, 'PIN_MISMATCH');
  const lines = manifest.toString('utf8').split('\n');
  need(lines.length === ASSETS.length + 1 && lines.at(-1) === '', 'MANIFEST');
  let bytes = manifest.length;
  for (let i = 0; i < ASSETS.length; i++) {
    const name = ASSETS[i];
    need(lines[i].length === 66 + name.length && /^[0-9a-f]{64}  /.test(lines[i]) && lines[i].slice(66) === name, 'MANIFEST');
    const asset = readBounded(join(root, name), (name === 'caw-symbol.png' ? 2 : 1) * 1024 * 1024);
    need(hash(asset) === lines[i].slice(0, 64), 'ASSET_HASH');
    bytes += asset.length;
  }
  return Object.freeze({ manifestPinMatched: true, assetHashesMatched: true,
    files: allowed.size, bytes, manifestSha256: expectedManifestSha256,
    originAuthenticated: false, hostedContentVerified: false, protocolVerified: false, productionAccepted: false });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    need(process.argv.length === 4, 'ARGUMENTS');
    process.stdout.write(JSON.stringify(checkStaticDirectory(process.argv[2], process.argv[3])) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ accepted: false, error: error.code || 'STATIC_RECOVERY_IO' }) + '\n');
    process.exitCode = 1;
  }
}
