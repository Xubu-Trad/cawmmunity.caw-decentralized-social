import hashlib
import json
from pathlib import Path
import runpy
import tempfile
import unittest
import zipfile

verify = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/check_review_packet.py'))['verify']


class PacketChecks(unittest.TestCase):
    def packet(self, folder, payload=b'original', member='evidence/data', rows=None):
        path = Path(folder) / 'packet.zip'
        rows = rows if rows is not None else [{'path': 'data', 'size': 8, 'sha256': hashlib.sha256(b'original').hexdigest()}]
        with zipfile.ZipFile(path, 'w') as z:
            z.writestr(member, payload)
            z.writestr('evidence/SHA256_MANIFEST.json', json.dumps({'files': rows}))
            z.writestr('README.md', 'wrapper')
        return path, hashlib.sha256(path.read_bytes()).hexdigest()

    def test_reports_wrapper_without_execution(self):
        with tempfile.TemporaryDirectory() as d:
            result = verify(*self.packet(d))
            self.assertEqual(result['matchedEntries'], 1)
            self.assertEqual(result['unlistedMembers'], ['README.md'])
            self.assertFalse(result['executionResultsVerified'])

    def test_wrong_external_digest(self):
        with tempfile.TemporaryDirectory() as d:
            path, _ = self.packet(d)
            with self.assertRaisesRegex(ValueError, 'archive SHA'):
                verify(path, '0' * 64)

    def test_changed_payload_even_with_new_archive_digest(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError, 'member SHA'):
                verify(*self.packet(d, b'changed!'))

    def test_unsafe_path(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError, 'unsafe member'):
                verify(*self.packet(d, member='../data'))


if __name__ == '__main__':
    unittest.main()
