"""Integer decision examples only: no EVM, signature, deployment or scale proof."""
import json

FEE = 5000 * 10**18

def allocation(stakes, owners, payer, exclusion):
    assert exclusion in ('account', 'owner')
    assert len(stakes) == len(owners) == 3 and payer in (0, 1, 2)
    assert all(type(x) is int and x >= 0 for x in stakes)
    weights = [s if (i != payer if exclusion == 'account' else owners[i] != owners[payer]) else 0
               for i, s in enumerate(stakes)]
    total = sum(weights)
    if total == 0:
        return {'outcome': 'no-eligible-stake', 'allocations': ['0']*3, 'dust': '0', 'charged': '0'}
    amounts = [FEE*s//total for s in weights]
    dust = FEE-sum(amounts)
    assert sum(amounts)+dust == FEE
    return {'outcome': 'allocated', 'allocations': list(map(str, amounts)), 'dust': str(dust), 'charged': str(FEE)}

def compare():
    owners = ['owner-a', 'owner-a', 'owner-b']
    stakes = [10, 1, 2]
    account = allocation(stakes, owners, 0, 'account')
    owner = allocation(stakes, owners, 0, 'owner')
    assert account['allocations'] == ['0', str(FEE//3), str(2*FEE//3)]
    assert account['dust'] == '1'
    assert owner['allocations'] == ['0', '0', str(FEE)] and owner['dust'] == '0'
    changed_payer = allocation([11, 1, 2], owners, 0, 'account')
    assert changed_payer == account
    only_same_owner = {
        mode: allocation([10, 1, 0], owners, 0, mode) for mode in ('account', 'owner')}
    assert only_same_owner['account']['charged'] == str(FEE)
    assert only_same_owner['owner']['charged'] == '0'
    return {
        'schema': 'caw-candidate-economic-comparison/1',
        'scope': 'three-account integer examples; owner exclusion is an unimplemented alternative',
        'feeBaseUnits': str(FEE), 'owners': owners, 'stakesBaseUnits': list(map(str, stakes)),
        'payerAccountId': 1,
        'accountExclusion': account, 'ownerExclusionAlternative': owner,
        'payerStakeChange': {'before': '10', 'after': '11', 'allocationUnchanged': True,
                            'signedStakeVectorChanges': True, 'signatureOrHashEvaluated': False},
        'onlyAnotherAccountOfSameOwnerStakes': only_same_owner,
        'productionAccepted': False, 'contractExecuted': False, 'specificationDecisionMade': False,
        'limitations': ['No scalable accounting algorithm', 'Address equality is not proof of human identity',
                        'Does not evaluate pending-action ordering or public mempool liveness',
                        'Owner exclusion is a comparison, not a proposed identity oracle']}

if __name__ == '__main__':
    print(json.dumps(compare(), indent=2))
