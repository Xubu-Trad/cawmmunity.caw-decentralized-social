"""Analytical budget for the existing experimental reward rule, not economics approval.

Python integers/Fractions are exact. No chain, wallet, runtime or gas simulation.
The horizon assumes constant fee and eligible stake, no index reset and no other
limiting operation. It is a ceiling from two counters, not a liveness guarantee.
"""
from fractions import Fraction
import json
import runpy
from pathlib import Path

MODEL = runpy.run_path(str(Path(__file__).with_name('staking_fixed_model.py')))
Q, MAX, INDEX_CAP = (MODEL[k] for k in ('Q', 'MAX', 'INDEX_CAP'))


def budget(fee, eligible, index=0, funded=0):
    for value in (fee, eligible, index, funded):
        if type(value) is not int or value < 0:
            raise ValueError('NONNEGATIVE_INTEGER')
    if not 0 < fee <= MAX // Q or not 0 < eligible <= MODEL['TOTAL_CAP']:
        raise ValueError('FEE_OR_ELIGIBLE_RANGE')
    if index > INDEX_CAP or funded > MAX:
        raise ValueError('COUNTER_RANGE')
    scaled = fee * Q
    increment, remainder = divmod(scaled, eligible)
    if increment == 0:
        return {'admitted': False, 'reason': 'ZERO_INCREMENT', 'postsBeforeCounterCap': '0'}
    index_posts = (INDEX_CAP - index) // increment
    funding_posts = (MAX - funded) // scaled
    return {
        'admitted': min(index_posts, funding_posts) > 0,
        'increment': str(increment), 'unassignedScaledPerPost': str(remainder),
        'unassignedBaseUnitsPerPost': str(Fraction(remainder, Q)),
        'unassignedFractionOfFee': str(Fraction(remainder, scaled)),
        'postsBeforeIndexCap': str(index_posts),
        'postsBeforeFundingCap': str(funding_posts),
        'postsBeforeCounterCap': str(min(index_posts, funding_posts)),
        'limitingCounters': [name for name, n in [('index', index_posts), ('funded', funding_posts)]
                             if n == min(index_posts, funding_posts)],
    }


def run():
    cases = [('one-base-unit eligible pool', 5000 * 10**18, 1),
             ('one-token eligible pool', 5000 * 10**18, 10**18),
             ('uneven three-base-unit pool', 5000 * 10**18, 3),
             ('maximum total eligible pool', 5000 * 10**18, MODEL['TOTAL_CAP']),
             ('tiny fee large eligible pool', 1, MODEL['STAKE_CAP'])]
    return {'schema': 'caw-staking-budget/1', 'scale': str(Q),
            'cases': [{'name': n, 'feeBaseUnits': str(f), 'eligibleBaseUnits': str(e),
                       **budget(f, e)} for n, f, e in cases],
            'assumptions': 'constant fee/eligible stake; zero starting counters; no rollover',
            'horizonIsLivenessGuarantee': False, 'contractExecuted': False,
            'gasMeasured': False, 'specificationDecisionMade': False}


if __name__ == '__main__':
    print(json.dumps(run(), indent=2))
