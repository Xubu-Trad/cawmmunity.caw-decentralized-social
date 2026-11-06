"""Discriminate the analytical counter boundary against the existing model."""
import copy
import runpy
import unittest
from fractions import Fraction
from pathlib import Path

B = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'experiments/paid-action/staking_budget.py'))
budget, M = B['budget'], B['MODEL']


class BudgetTests(unittest.TestCase):
    def test_global_remainder_matches_eager_accounting(self):
        for eligible in (1, 3, 17, 10**18 + 3):
            a = M['Fixed']([1, eligible]); a.post(0, 5000 * 10**18)
            report = budget(5000 * 10**18, eligible)
            self.assertEqual(int(report['unassignedScaledPerPost']), a.unassigned)
            self.assertEqual(a.pending(1) + a.unassigned, a.funded)
            self.assertLess(Fraction(report['unassignedBaseUnitsPerPost']), Fraction(eligible, M['Q']))

    def test_index_boundary_matches_model_and_next_post_rejects_unchanged(self):
        a = M['Fixed']([1, 3]); fee = 7
        delta = fee * M['Q'] // 3
        # Consistent injected state; not a historically executed lifetime.
        a.index = M['INDEX_CAP'] - 2 * delta
        a.debt = [s * a.index for s in a.stakes]
        self.assertEqual(budget(fee, 3, a.index)['postsBeforeCounterCap'], '2')
        a.post(0, fee); a.post(0, fee); before = copy.deepcopy(vars(a))
        with self.assertRaisesRegex(ValueError, 'INDEX_CAP'): a.post(0, fee)
        self.assertEqual(vars(a), before)

    def test_funding_counter_is_separately_limiting(self):
        scaled = 7 * M['Q']
        r = budget(7, 3, funded=M['MAX'] - scaled)
        self.assertEqual(r['postsBeforeCounterCap'], '1')
        self.assertEqual(r['limitingCounters'], ['funded'])
        self.assertFalse(budget(7, 3, funded=M['MAX'])['admitted'])

    def test_zero_increment_is_not_unlimited_capacity(self):
        self.assertEqual(budget(1, M['STAKE_CAP'])['reason'], 'ZERO_INCREMENT')
        with self.assertRaisesRegex(ValueError, 'ZERO_INCREMENT'):
            M['Fixed']([1, M['STAKE_CAP']]).post(0, 1)

    def test_invalid_inputs(self):
        for args in [(True, 1), (0, 1), (1, 0), (-1, 1), (1, M['TOTAL_CAP'] + 1),
                     (M['MAX'] // M['Q'] + 1, 1), (1, 1, M['INDEX_CAP'] + 1)]:
            with self.assertRaises(ValueError): budget(*args)


if __name__ == '__main__': unittest.main()
