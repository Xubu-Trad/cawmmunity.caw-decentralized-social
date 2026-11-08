"""Independent full-tree reconstruction and bounded update/proof negatives."""
import copy
import hashlib
import importlib.util
from pathlib import Path
import random
import unittest
from unittest.mock import patch

path = Path(__file__).resolve().parents[1]/'experiments/paid-action/stake_commitment.py'
spec = importlib.util.spec_from_file_location('stake_commitment', path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
NS = bytes.fromhex('11'*32)


def rebuild(accounts, namespace):
    # Separate eager algorithm and serialization; deliberately does not call the
    # implementation's leaf, branch, envelope or EMPTY helpers.
    h = lambda b: hashlib.sha256(b).digest()
    n = lambda i: i.to_bytes(32, 'big')
    level = {i: (h(b'\x01'+n(i)+n(s)), s) for i, s in accounts.items()}
    empty = (h(b'\x00'), 0)
    for _ in range(256):
        parents = {}
        for i in {key//2 for key in level}:
            lh, ls = level.get(2*i, empty)
            rh, rs = level.get(2*i+1, empty)
            parents[i] = (h(b'\x02'+lh+n(ls)+rh+n(rs)), ls+rs)
        empty = (h(b'\x02'+empty[0]+n(0)+empty[0]+n(0)), 0)
        level = parents
    root, total = level.get(0, empty)
    return h(b'CAW_STAKE_TREE_RESEARCH_V1\0'+namespace+root+n(total)), total


class Commitment(unittest.TestCase):
    def tree(self):
        t = m.Tree(NS)
        for i, s in [(1, 10), (2, 1), (3, 2), (m.MAX, 0)]:
            t.set_account(i, s)
        return t

    def check(self, t, key):
        present, stake, siblings = t.proof(key)
        self.assertTrue(m.verify(NS, t.root, t.total, key, stake, present, siblings))

    def test_empty_zero_present_and_absent(self):
        t = m.Tree(NS); empty = t.root
        self.assertEqual((t.root, t.total), rebuild({}, NS))
        self.check(t, 0)
        t.set_account(0, 0)
        self.assertNotEqual(empty, t.root)
        self.assertEqual(t.total, 0)
        self.check(t, 0); self.check(t, 1)
        self.assertTrue(t.proof(0)[0]); self.assertFalse(t.proof(1)[0])

    def test_independent_rebuild_across_updates(self):
        t = m.Tree(NS); accounts = {}; rng = random.Random(20261108)
        keys = [0, 1, 2, 3, m.MAX, 1 << 255] + [rng.getrandbits(256) for _ in range(58)]
        for step in range(96):
            key = keys[step] if step < 64 else keys[rng.randrange(64)]
            stake = rng.randrange(1000)
            t.set_account(key, stake); accounts[key] = stake
            self.assertEqual((t.root, t.total), rebuild(accounts, NS))
            self.check(t, key)
            self.assertEqual(t.last_update, {'siblingReads': 256, 'nodeWrites': 257,
                                            'leafHashes': 1, 'branchHashes': 256})

    def test_order_restoration_and_stale_proof(self):
        t = self.tree(); old = t.root; proof = t.proof(2)
        u = m.Tree(NS)
        for key in reversed(list(t.accounts)):
            u.set_account(key, t.accounts[key])
        self.assertEqual(t.root, u.root)
        t.set_account(1, 11)
        self.assertNotEqual(t.root, old)
        with self.assertRaises(ValueError):
            m.verify(NS, t.root, t.total, 2, proof[1], proof[0], proof[2])
        t.set_account(1, 10)
        self.assertEqual(t.root, old)
        self.check(t, 2)

    def test_each_sibling_hash_mutation_rejected(self):
        t = self.tree(); present, stake, proof = t.proof(2)
        for i in range(256):
            changed = list(proof); h, s = changed[i]
            changed[i] = (bytes([h[0] ^ 1])+h[1:], s)
            with self.subTest(level=i), self.assertRaisesRegex(ValueError, 'ROOT_MISMATCH'):
                m.verify(NS, t.root, t.total, 2, stake, present, tuple(changed))

    def test_single_field_negatives(self):
        t = self.tree(); present, stake, proof = t.proof(2)
        base = [NS, t.root, t.total, 2, stake, present, proof]
        for index, value in [(0, bytes(32)), (1, bytes(32)), (2, t.total+1),
                             (3, 3), (4, stake+1), (5, False),
                             (6, proof[:-1]), (6, proof+(proof[0],))]:
            args = list(base); args[index] = value
            with self.subTest(field=index), self.assertRaises(ValueError):
                m.verify(*args)
        changed = list(proof); h, s = changed[0]; changed[0] = (h, s+1)
        with self.assertRaises(ValueError):
            m.verify(*base[:-1], tuple(changed))

    def test_overflow_and_invalid_updates_are_atomic(self):
        t = m.Tree(NS); t.set_account(0, m.MAX)
        for key, stake in [(1, 1), (-1, 0), (True, 0), (m.MAX+1, 0), (1, True), (1, -1)]:
            before = copy.deepcopy(vars(t))
            with self.subTest(key=key, stake=stake), self.assertRaises(ValueError):
                t.set_account(key, stake)
            self.assertEqual(vars(t), before)
        t.set_account(0, m.MAX-1); t.set_account(1, 1)
        self.assertEqual(t.total, m.MAX)

    def test_strict_proof_shapes(self):
        t = self.tree(); present, stake, proof = t.proof(2)
        for bad in [list(proof), None, (), (None,)+proof[1:],
                    ((b'x', 0),)+proof[1:], ((bytes(32), True),)+proof[1:]]:
            with self.subTest(proof_type=type(bad)), self.assertRaises(ValueError):
                m.verify(NS, t.root, t.total, 2, stake, present, bad)

    def test_instrumented_operation_counts(self):
        class Counted(dict):
            reads = 0
            writes = 0
            def get(self, *args):
                self.reads += 1
                return super().get(*args)
            def __setitem__(self, key, value):
                self.writes += 1
                return super().__setitem__(key, value)
        for size in (4, 17, 65):
            t = m.Tree(NS)
            for i in range(size):
                t.set_account(i, i)
            t.nodes = Counted(t.nodes)
            with patch.object(m, 'digest', wraps=m.digest) as hashing:
                t.set_account(1, 42)
                self.assertEqual(hashing.call_count, 257)
            self.assertEqual((t.nodes.reads, t.nodes.writes), (256, 257))
            t.nodes.reads = t.nodes.writes = 0
            t.proof(1)
            self.assertEqual((t.nodes.reads, t.nodes.writes), (256, 0))


if __name__ == '__main__':
    unittest.main(verbosity=2)
