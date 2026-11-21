"""Exact arithmetic decision examples, not a contract implementation or adopted policy."""
import json
from fractions import Fraction

def allocate(fee, weights):
    if type(fee) is not int or fee < 0 or not weights or any(type(w) is not int or w < 0 for w in weights):
        raise ValueError('nonnegative integer inputs required')
    total = sum(weights)
    if total == 0:
        raise ValueError('zero eligible pool has no proportional solution')
    exact = [Fraction(fee * w, total) for w in weights]
    credits = [x.numerator // x.denominator for x in exact]
    dust = fee - sum(credits)
    assert sum(credits) + dust == fee
    assert 0 <= dust < sum(w > 0 for w in weights)
    return {'credits': credits, 'dust': dust}

def main():
    cases = {
        'single_action': allocate(5, [1, 2]),
        'two_actions_individually': [allocate(5, [1, 2]), allocate(5, [1, 2])],
        'two_actions_batched': allocate(10, [1, 2]),
        'same_owner_second_account_eligible': allocate(10, [1, 1]),
        'same_owner_all_accounts_excluded': allocate(10, [1]),
        'before_stake_change': allocate(10, [1, 1]),
        'after_stake_change': allocate(10, [3, 1]),
    }
    assert cases['two_actions_batched']['credits'] != [2*x for x in cases['single_action']['credits']]
    assert cases['before_stake_change'] != cases['after_stake_change']
    checks = 0
    for fee in range(21):
        for a in range(6):
            for b in range(6):
                if a+b:
                    assert allocate(fee, [a,b])['credits'] == allocate(fee, [b,a])['credits'][::-1]
                    checks += 1
    rejected = []
    for fee, weights in [(1,[0,0]), (-1,[1]), (1,[-1,2]), (1,[]), (True,[1])]:
        try:
            allocate(fee, weights)
        except ValueError:
            rejected.append([fee, weights])
        else:
            raise AssertionError('invalid input accepted')
    print(json.dumps({'status':'ILLUSTRATIVE_NOT_ADOPTED','cases':cases,
        'small_domain_conservation_and_permutation_cases':checks,'invalid_inputs_rejected':rejected,
        'limits':'Python exact integers; no EVM execution, uint256 overflow proof, contract differential test or community acceptance.'}, indent=2))

if __name__ == '__main__':
    main()
