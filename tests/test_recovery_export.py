"""Finite retained-fixture export checks. No chain, network or Node execution."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('exporter', ROOT / 'scripts/export-recovery-fixture.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class RecoveryExportTests(unittest.TestCase):
    def test_repeatable_and_inventory_matches(self):
        import json
        with tempfile.TemporaryDirectory() as tmp:
            a, b = Path(tmp) / 'a', Path(tmp) / 'b'
            self.assertEqual(exporter.export(a), exporter.export(b))
            for path in a.rglob('*'):
                if path.is_file():
                    self.assertEqual(path.read_bytes(), (b / path.relative_to(a)).read_bytes())
            manifest = json.loads((a / 'INVENTORY.json').read_bytes())
            for name, item in manifest['files'].items():
                data = (a / name).read_bytes()
                self.assertEqual(item, {'sha256': exporter.digest(data), 'size': len(data)})

    def test_existing_destination_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'existing'
            target.mkdir()
            (target / 'sentinel').write_bytes(b'retained evidence')
            with self.assertRaises(FileExistsError):
                exporter.export(target)
            self.assertEqual(list(target.iterdir()), [target / 'sentinel'])
            self.assertEqual((target / 'sentinel').read_bytes(), b'retained evidence')

    def test_wrong_capture_rejected_before_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'experiments/paid-signed-body-acquisition'
            source.mkdir(parents=True)
            (source / 'body-captures.json').write_bytes(b'{}')
            with self.assertRaisesRegex(ValueError, 'CAPTURE_PIN_MISMATCH'):
                exporter.export(root / 'output', root)
            self.assertFalse((root / 'output').exists())

    def test_wrong_trace_rejected_before_output(self):
        import gzip
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'experiments/paid-signed-body-acquisition'
            source.mkdir(parents=True)
            (source / 'body-captures.json').write_bytes(
                (ROOT / 'experiments/paid-signed-body-acquisition/body-captures.json').read_bytes())
            (source / 'execution-trace.json.gz').write_bytes(gzip.compress(b'{}'))
            with self.assertRaisesRegex(ValueError, 'TRACE_PIN_MISMATCH'):
                exporter.export(root / 'output', root)
            self.assertFalse((root / 'output').exists())


if __name__ == '__main__':
    unittest.main()
