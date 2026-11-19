"""Focused model tests; do not imply EVM/signature/production acceptance."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
from dataclasses import replace

path = Path(__file__).resolve().parents[1] / 'experiments/paid-action/one_action_model.py'
spec = importlib.util.spec_from_file_location('one_action_model', path)
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)
UNIT = 10**18


def fixture():
    s = m.State({1: m.Account('A'), 2: m.Account('A'), 3: m.Account('B')},
                {'A': 10*m.FEE, 'B': 10*m.FEE})
    for i, owner, deposit, stake in [(1, 'A', 4*m.FEE, 10*UNIT),
                                     (2, 'A', UNIT, UNIT), (3, 'B', 2*UNIT, 2*UNIT)]:
        s = m.direct(s, 'deposit', i, owner, 0, deposit)
        s = m.direct(s, 'stake', i, owner, 0, stake)
    return s


def intent(s):
    return m.Intent(1, s.accounts[1].epoch, s.accounts[1].nonce, 10, 20,
                    m.stake_state(s), b'one action')


class Transitions(unittest.TestCase):
    def reject(self, s, reason, call):
        before = copy.deepcopy(s)
        with self.assertRaisesRegex(ValueError, '^'+reason+'$'):
            call()
        self.assertEqual(s, before)

    def test_complete_synthetic_journey(self):
        s = fixture()
        before = copy.deepcopy(s)
        total = sum(s.wallets.values()) + s.vault
        s, event = m.post(s, intent(s), 'A', 10)
        self.assertEqual(event['allocations'], {1: 0, 2: 1666666666666666666666,
                                               3: 3333333333333333333333})
        self.assertEqual((event['dust'], s.accounts[1].nonce, s.messages), (1, 1, 1))
        s = m.direct(s, 'unstake', 2, 'A', 0, UNIT)
        amount = s.accounts[2].credit
        s = m.direct(s, 'withdraw', 2, 'A', 0, amount)
        self.assertEqual(s.accounts[2].credit, 0)
        self.assertEqual(sum(s.wallets.values()) + s.vault, total)
        self.assertEqual(before.accounts[1].nonce, 0)

    def test_recipient_transfer_and_withdrawal_branches(self):
        s = fixture(); request = intent(s)
        changed = m.direct(s, 'transfer', 2, 'A', 0, new_owner='B')
        control, ec = m.post(s, request, 'A', 11)
        treatment, et = m.post(changed, request, 'A', 11)
        self.assertEqual(ec, et)
        self.assertEqual([a.credit for a in control.accounts.values()],
                         [a.credit for a in treatment.accounts.values()])
        self.reject(control, 'OWNER', lambda: m.direct(control, 'withdraw', 2, 'B', 0, 100*UNIT))
        self.reject(treatment, 'OWNER', lambda: m.direct(treatment, 'withdraw', 2, 'A', 1, 100*UNIT))
        withdrawn = m.direct(treatment, 'withdraw', 2, 'B', 1, 100*UNIT)
        self.assertEqual(withdrawn.wallets['B'] - treatment.wallets['B'], 100*UNIT)
        self.assertEqual(treatment.vault - withdrawn.vault, 100*UNIT)

    def test_payer_transfer_return_rejects_old_epoch(self):
        s = fixture(); request = intent(s)
        s = m.direct(s, 'transfer', 1, 'A', 0, new_owner='B')
        s = m.direct(s, 'transfer', 1, 'B', 1, new_owner='A')
        self.reject(s, 'EPOCH', lambda: m.post(s, request, 'A', 11))

    def test_stake_restoration_and_explicit_cancel_are_distinct(self):
        s = fixture(); request = intent(s)
        changed = m.direct(s, 'stake', 1, 'A', 0, UNIT)
        self.reject(changed, 'STAKE_STATE', lambda: m.post(changed, request, 'A', 11))
        restored = m.direct(changed, 'unstake', 1, 'A', 0, UNIT)
        self.assertEqual(m.post(restored, request, 'A', 11)[0].accounts[1].nonce, 1)
        cancelled = m.direct(changed, 'cancel', 1, 'A', 0, 1)
        cancelled = m.direct(cancelled, 'unstake', 1, 'A', 0, UNIT)
        self.reject(cancelled, 'NONCE', lambda: m.post(cancelled, request, 'A', 11))

    def test_post_cancel_order(self):
        s = fixture(); request = intent(s)
        posted, _ = m.post(s, request, 'A', 11)
        after = m.direct(posted, 'cancel', 1, 'A', 0, 2)
        self.assertEqual((after.messages, after.accounts[1].credit),
                         (1, s.accounts[1].credit-m.FEE))
        cancelled = m.direct(s, 'cancel', 1, 'A', 0, 2)
        self.reject(cancelled, 'NONCE', lambda: m.post(cancelled, request, 'A', 11))

    def test_cancel_boundaries(self):
        s = fixture()
        for who, epoch, amount, error in [('B', 0, 1, 'OWNER'), ('A', 1, 1, 'EPOCH'),
                                         ('A', 0, 0, 'NONCE_ADVANCE'),
                                         ('A', 0, True, 'UINT256'), ('A', 0, m.MAX+1, 'UINT256')]:
            with self.subTest(error=error, amount=amount):
                self.reject(s, error, lambda: m.direct(s, 'cancel', 1, who, epoch, amount))
        s = m.direct(s, 'cancel', 1, 'A', 0, m.MAX)
        self.reject(s, 'NONCE_ADVANCE', lambda: m.direct(s, 'cancel', 1, 'A', 0, m.MAX-1))
        self.reject(s, 'UINT256', lambda: m.post(s, intent(s), 'A', 11))
        self.assertEqual(m.direct(s, 'withdraw', 1, 'A', 0, UNIT).vault, s.vault-UNIT)

    def test_replay_and_time_boundaries(self):
        s = fixture(); request = intent(s)
        for now in (9, 20):
            self.reject(s, 'WINDOW', lambda: m.post(s, request, 'A', now))
        posted, _ = m.post(s, request, 'A', 19)
        self.reject(posted, 'NONCE', lambda: m.post(posted, request, 'A', 19))

    def test_zero_pool_and_locked_withdrawal(self):
        s = fixture()
        for i in (2, 3):
            s = m.direct(s, 'unstake', i, s.accounts[i].owner, 0, s.accounts[i].stake)
        self.reject(s, 'NO_ELIGIBLE_STAKE', lambda: m.post(s, intent(s), 'A', 11))
        self.reject(s, 'AVAILABLE_CREDIT', lambda: m.direct(s, 'withdraw', 1, 'A', 0, s.accounts[1].credit))

    def test_utf8_boundaries(self):
        s = fixture(); request = intent(s)
        for text in ('a'*419, 'a'*420, '\U0001f426'*420):
            _, event = m.post(s, replace(request, text=text.encode()), 'A', 11)
            self.assertEqual(event['text'], text.encode())
        for text in (b'', b'a'*421, b'\xff', b'\xed\xa0\x80'):
            self.reject(s, 'TEXT', lambda: m.post(s, replace(request, text=text), 'A', 11))

    def test_arbitrary_registered_ids_and_population(self):
        for size in (4, 17, 65):
            s = m.State({10*i+1: m.Account('A', credit=2*m.FEE, stake=1)
                         for i in range(size)}, {})
            s.vault = size*2*m.FEE
            out, event = m.post(s, intent(s), 'A', 11)
            self.assertEqual(sum(event['allocations'].values()) + event['dust'], m.FEE)
            self.assertEqual(event['allocations'][1], 0)
            self.assertEqual(out.vault, s.vault)
            self.assertEqual(out.accounts[1].stake, 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
