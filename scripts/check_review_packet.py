"""Check a review ZIP against an externally supplied digest, without executing it."""
import argparse
import hashlib
import json
from pathlib import PurePosixPath
import zipfile


def verify(path, expected):
    with open(path, 'rb') as f:
        digest = hashlib.file_digest(f, 'sha256').hexdigest()
    if digest != expected:
        raise ValueError('archive SHA-256 mismatch')
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        names = [i.filename for i in infos]
        if len(names) != len(set(names)):
            raise ValueError('duplicate archive members')
        for name in names:
            p = PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name:
                raise ValueError('unsafe member path')
        if sum(i.file_size for i in infos) > 200_000_000:
            raise ValueError('expanded archive exceeds review limit')
        manifests = [n for n in names if n.endswith('/SHA256_MANIFEST.json')]
        if len(manifests) != 1:
            raise ValueError('expected one root hash manifest')
        manifest = manifests[0]
        root = manifest.rsplit('/', 1)[0] + '/'
        raw = json.loads(z.read(manifest))
        rows = raw['files'] if 'files' in raw else [dict(path=p, sha256=h) for p, h in raw.items()]
        seen = set()
        for row in rows:
            relative = row['path']
            p = PurePosixPath(relative)
            if p.is_absolute() or '..' in p.parts or '\\' in relative or ':' in relative:
                raise ValueError('unsafe manifest path')
            name = root + relative
            if name in seen:
                raise ValueError('duplicate manifest entry')
            seen.add(name)
            data = z.read(name)
            if hashlib.sha256(data).hexdigest() != row['sha256']:
                raise ValueError('member SHA-256 mismatch: ' + relative)
            if 'size' in row and len(data) != row['size']:
                raise ValueError('member size mismatch: ' + relative)
        unlisted = sorted(n for n in names if not n.endswith('/') and n not in seen and n != manifest)
        return dict(archiveSha256=digest, matchedEntries=len(rows), unlistedMembers=unlisted,
                    executedArchiveCode=False, executionResultsVerified=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('sha256', help='digest obtained separately from the review comment')
    args = parser.parse_args()
    print(json.dumps(verify(args.archive, args.sha256), indent=2))
