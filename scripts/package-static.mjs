import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectStatic } from './build.mjs';

// Fixed POSIX ustar metadata: regular files, mode 0644, uid/gid/mtime zero.
// Inputs come only from the trusted builder's fixed public asset list.
export async function createStaticArchive() {
  const entries = await collectStatic(), chunks = [];
  for (const { name, bytes } of entries) {
    if (!/^[a-zA-Z0-9._-]{1,99}$/.test(name)) throw new Error('ARCHIVE_NAME');
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'ascii');
    const octal = (value, offset, width) => {
      const text = value.toString(8);
      if (text.length >= width) throw new Error('ARCHIVE_SIZE');
      header.write(text.padStart(width - 1, '0') + '\0', offset, width, 'ascii');
    };
    octal(0o644, 100, 8); octal(0, 108, 8); octal(0, 116, 8);
    octal(bytes.length, 124, 12); octal(0, 136, 12);
    header.fill(32, 148, 156); header[156] = 48;
    header.write('ustar\0', 257, 6, 'ascii'); header.write('00', 263, 2, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    chunks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  const bytes = Buffer.concat(chunks);
  return { bytes, files: entries.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    manifestSha256: entries.at(-1).sha256 };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 3) throw new Error('ARCHIVE_ARGUMENTS');
    const archive = await createStaticArchive();
    // Never replace an existing archive, including a symlink at this path.
    await writeFile(resolve(process.argv[2]), archive.bytes, { flag: 'wx' });
    process.stdout.write(JSON.stringify({ files: archive.files, bytes: archive.bytes.length,
      archiveSha256: archive.sha256, manifestSha256: archive.manifestSha256,
      productionAccepted: false }) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ accepted: false, error: error.code || error.message }) + '\n');
    process.exitCode = 1;
  }
}
