"""Interoperability experiment with Python's standard tar reader; not a trust root."""
from pathlib import Path
import hashlib, io, json, re, sys, tarfile

def verify(archive, expected_directory, output_directory):
    assert archive.stat().st_size <= 32 * 1024 * 1024
    data = archive.read_bytes()
    manifest = (expected_directory / 'SHA256SUMS.txt').read_bytes()
    assert len(manifest) <= 4096
    names = []
    for line in manifest.decode('ascii').splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  ([a-zA-Z0-9._-]{1,99})', line)
        assert match and match[2] not in ('.', '..') and match[2] not in names
        names.append(match[2])
        assert hashlib.sha256((expected_directory / match[2]).read_bytes()).hexdigest() == match[1]
    names.append('SHA256SUMS.txt')
    expected = {name: (expected_directory / name).read_bytes() for name in names}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:') as stream:
        members = stream.getmembers()
        assert [m.name for m in members] == names
        recovered = {}
        for member in members:
            assert member.isfile() and not member.linkname and not member.pax_headers
            assert member.uid == member.gid == member.mtime == 0
            assert member.mode == 0o644 and not member.uname and not member.gname
            assert member.size == len(expected[member.name])
            body = stream.extractfile(member).read(member.size + 1)
            assert body == expected[member.name]
            recovered[member.name] = body
    # No tarfile extraction API: only already-validated fixed plain filenames.
    output_directory.mkdir(exist_ok=False)
    for name, body in recovered.items():
        with (output_directory / name).open('xb') as output:
            output.write(body)
    return {'files': len(recovered), 'archiveSha256': hashlib.sha256(data).hexdigest(),
            'manifestSha256': hashlib.sha256(manifest).hexdigest(),
            'reader': 'Python standard-library tarfile', 'independentOperator': False}

if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit('usage: test-static-archive.py ARCHIVE TRUSTED_BUILD NEW_OUTPUT_DIRECTORY')
    print(json.dumps(verify(*(Path(p).resolve() for p in sys.argv[1:]))))
