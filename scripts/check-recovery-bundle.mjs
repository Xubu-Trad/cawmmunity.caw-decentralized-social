import { openSync, closeSync, fstatSync, readSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';
import { RECOVERY_FILES, inspectPinnedRecoveryBundle, verifyRecoverySelectionPin } from '../reference/recovery-bundle.mjs';

// No caller-controlled member paths, network requests or environment lookup.
// The local filesystem and pinned reader code remain the caller's trust boundary.
function readBounded(path, limit) {
  const fd = openSync(path, 'r');
  try {
    if (!fstatSync(fd).isFile()) throw new Error('REGULAR_FILE_REQUIRED');
    const buffer = Buffer.alloc(limit + 1); let count = 0;
    while (count < buffer.length) {
      const n = readSync(fd, buffer, count, buffer.length - count, null);
      if (!n) break; count += n;
    }
    if (count > limit) throw new Error('FILE_LIMIT');
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, count));
  } finally { closeSync(fd); }
}
export function checkRecoveryDirectory(directory, selectionPath, expectedSelectionSha256) {
  const selectionText = readBounded(resolve(selectionPath), 16384);
  verifyRecoverySelectionPin(selectionText, expectedSelectionSha256);
  const parts = Object.create(null);
  for (const file of RECOVERY_FILES) parts[file] = readBounded(resolve(directory, file), 1048576);
  const result = inspectPinnedRecoveryBundle(parts, selectionText, expectedSelectionSha256);
  // Emit explicit boundaries, not the potentially large/private input history.
  const { checked, ...summary } = result;
  summary.successfulPostCount = checked.post_history.successfulPostCount;
  return summary;
}
// Compare resolved filesystem identities so linked entry paths cannot silently
// bypass the CLI. Resolve both sides for --preserve-symlinks-main as well.
// Importing the module must remain safe when argv[1] is absent or not a file.
export function isRecoveryCliInvocation(entryPath) {
  if (typeof entryPath !== 'string' || !entryPath) return false;
  try {
    return realpathSync(entryPath) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}
if (isRecoveryCliInvocation(process.argv[1])) {
  try {
    if (process.argv.length !== 5) throw new Error('usage: node scripts/check-recovery-bundle.mjs BUNDLE_DIRECTORY SEPARATE_SELECTION_JSON RETAINED_SELECTION_SHA256');
    process.stdout.write(JSON.stringify(checkRecoveryDirectory(process.argv[2], process.argv[3], process.argv[4])) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ accepted: false, error: error.code || error.message }) + '\n');
    process.exitCode = 1;
  }
}
