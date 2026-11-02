"""Exact-rational research model, NOT token accounting or deployable code.

Assumes account-ID exclusion and fixed weights during each post. All accounts
already exist; identity, authorization, signatures and transfers are out of scope.
"""
from fractions import Fraction
import json
import random

class Lazy:
    def __init__(self, stakes):
        self.stakes = list(stakes)
        self.total = sum(stakes)
        self.index = Fraction(0)
        self.credits = [Fraction(0) for _ in stakes]
        self.debt = [Fraction(0) for _ in stakes]
        self.last_post_accounts_written = 0

    def pending(self, i):
        return self.credits[i] + self.stakes[i]*self.index - self.debt[i]

    def settle(self, i):
        self.credits[i] = self.pending(i)
        self.debt[i] = self.stakes[i]*self.index

    def set_stake(self, i, value):
        assert type(value) is int and value >= 0
        self.settle(i)
        self.total += value-self.stakes[i]
        self.stakes[i] = value
        self.debt[i] = value*self.index

    def post(self, payer, fee):
        assert type(fee) is int and fee > 0
        eligible = self.total-self.stakes[payer]
        if eligible == 0:
            raise ValueError('NO_ELIGIBLE_STAKE')
        self.settle(payer)
        self.index += Fraction(fee, eligible)
        # The payer receives none of this increment. Other accounts settle lazily.
        self.debt[payer] = self.stakes[payer]*self.index
        self.last_post_accounts_written = 1

class Eager:
    def __init__(self, stakes):
        self.stakes = list(stakes)
        self.credits = [Fraction(0) for _ in stakes]

    def set_stake(self, i, value):
        self.stakes[i] = value

    def post(self, payer, fee):
        eligible = sum(s for i, s in enumerate(self.stakes) if i != payer)
        if eligible == 0:
            raise ValueError('NO_ELIGIBLE_STAKE')
        for i, stake in enumerate(self.stakes):
            if i != payer:
                self.credits[i] += Fraction(fee*stake, eligible)

def run():
    rows = []
    for size in (3, 8, 64, 256):
        rng = random.Random(161+size)
        initial = [1+i%7 for i in range(size)]
        lazy, eager = Lazy(initial), Eager(initial)
        paid = 0
        largest_bits = 0
        posts = 0
        for step in range(96):
            account = rng.randrange(size)
            if step % 3 == 0:
                value = rng.randrange(0, 19)
                lazy.set_stake(account, value); eager.set_stake(account, value)
            else:
                fee = 5000*10**18+step
                before = lazy.pending(account)
                lazy.post(account, fee); eager.post(account, fee)
                assert lazy.pending(account) == before, 'PAYER_REWARDED'
                assert lazy.last_post_accounts_written == 1
                paid += fee; posts += 1
            assert lazy.total == sum(eager.stakes)
            pending = [lazy.pending(i) for i in range(size)]
            assert pending == eager.credits, 'MODEL_DISAGREEMENT'
            assert sum(pending) == paid and all(x >= 0 for x in pending)
            for value in [lazy.index, *pending]:
                largest_bits = max(largest_bits, value.numerator.bit_length(), value.denominator.bit_length())
        rows.append({'accounts': size, 'operations': 96, 'posts': posts,
                     'logicalAccountsWrittenPerPost': 1, 'maxRationalBitsObserved': largest_bits,
                     'exactEntitlementsMatch': True})
    lone = Lazy([1, 0, 0])
    before = (lone.total, lone.index, list(lone.credits), list(lone.debt))
    try:
        lone.post(0, 1)
    except ValueError as e:
        assert str(e) == 'NO_ELIGIBLE_STAKE'
    else:
        raise AssertionError('ZERO_POOL_ACCEPTED')
    assert before == (lone.total, lone.index, lone.credits, lone.debt)
    fee = 5000*10**18
    old = [2*(fee*w//3) for w in (1, 2)]
    deferred = [int(Fraction(2*fee*w, 3)) for w in (1, 2)]
    assert old != deferred
    assert 2*fee-sum(old) == 2 and 2*fee-sum(deferred) == 1
    return {'schema':'caw-rational-staking-model/1', 'cases':rows,
            'zeroPoolRejectsWithoutMutation':True,
            'roundingCounterexample':{'fee':str(fee),'posts':2,'recipientWeights':[1,2],
                'perPostFloor':list(map(str,old)), 'floorAtClaim':list(map(str,deferred)),
                'perPostDust':'2','deferredDust':'1'},
            'contractExecuted':False,'gasMeasured':False,'boundedIntegerDesign':False,
            'productionAccepted':False,'specificationDecisionMade':False}

if __name__ == '__main__':
    print(json.dumps(run(), indent=2))
