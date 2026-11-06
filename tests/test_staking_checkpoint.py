import copy
import runpy
import unittest
from pathlib import Path

N = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'experiments/paid-action/staking_checkpoint.py'))
M, Checkpoint = N['M'], N['Checkpoint']


def source():
    a = M['Fixed']([1, 3, 7, 0])
    a.post(0, 17); a.post(1, 19); a.claim(2); a.set_stake(3, 5); a.post(2, 23)
    return a


def normalize(a, batch):
    c = Checkpoint(a)
    while c.cursor < c.count: c.step(c.cursor, batch)
    return c.finish()


class CheckpointTests(unittest.TestCase):
    def test_preserves_entitlement_fraction_and_conservation(self):
        a = source(); before = copy.deepcopy(vars(a))
        for batch in (1, 2, 64):
            b = normalize(a, batch)
            self.assertEqual([a.pending(i) for i in range(4)], [b.pending(i) for i in range(4)])
            self.assertEqual((a.funded, a.paid, a.unassigned), (b.funded, b.paid, b.unassigned))
            self.assertEqual(b.funded, b.paid + b.unassigned + sum(b.pending(i) for i in range(4)))
            self.assertEqual(b.index, 0)
        self.assertEqual(vars(a), before)

    def test_following_operations_match_unnormalized_reference(self):
        a = source(); b = normalize(a, 2)
        for n in range(40):
            i = n % 4
            if n % 3 == 0:
                self.assertEqual(a.claim(i), b.claim(i))
            elif n % 3 == 1:
                a.set_stake(i, n + 1); b.set_stake(i, n + 1)
            else:
                a.post(i, n + 7); b.post(i, n + 7)
            self.assertEqual([a.pending(j) for j in range(4)], [b.pending(j) for j in range(4)])
            self.assertEqual((a.funded,a.paid,a.unassigned), (b.funded,b.paid,b.unassigned))

    def test_partial_duplicate_and_invalid_batch_refuse(self):
        c = Checkpoint(source()); c.step(0, 1)
        with self.assertRaisesRegex(ValueError, 'INCOMPLETE'): c.finish()
        for cursor, batch, error in [(0,1,'CURSOR'), (2,1,'CURSOR'), (1,0,'BATCH_LIMIT'), (1,65,'BATCH_LIMIT'), (1,True,'BATCH_LIMIT')]:
            before = copy.deepcopy(vars(c._target))
            with self.assertRaisesRegex(ValueError, error): c.step(cursor,batch)
            self.assertEqual(vars(c._target),before); self.assertEqual(c.cursor,1)
        c.step(1,64)
        with self.assertRaisesRegex(ValueError, 'COMPLETE'): c.step(4,1)

    def test_source_and_finished_output_are_detached(self):
        a = source(); expected = [a.pending(i) for i in range(4)]; c = Checkpoint(a)
        a.post(0, 100); c.step(0,64); b = c.finish()
        self.assertEqual([b.pending(i) for i in range(4)], expected)
        b.claim(1); self.assertEqual([c.finish().pending(i) for i in range(4)],expected)

    def test_naive_reset_is_a_negative_control(self):
        a = source(); broken = copy.deepcopy(a); broken.index = 0; broken.debt = [0]*4
        self.assertNotEqual([a.pending(i) for i in range(4)], [broken.pending(i) for i in range(4)])

    def test_normalization_does_not_reset_lifetime_funding_limit(self):
        a = source(); a.funded = M['MAX']; b = normalize(a,64)
        # Injected counter boundary; not a claimed reachable execution history.
        before = copy.deepcopy(vars(b))
        with self.assertRaisesRegex(ValueError, 'UINT256'): b.post(0,1)
        self.assertEqual(vars(b),before)


if __name__ == '__main__': unittest.main()
