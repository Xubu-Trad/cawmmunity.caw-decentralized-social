"""Bounded-integer reward research, not custody, Solidity or adopted economics."""
import copy
import json
import random

MAX = 2**256-1
Q = 2**64
STAKE_CAP = 2**96-1
TOTAL_CAP = 2**128-1
INDEX_CAP = MAX//STAKE_CAP

def require(ok, reason):
    if not ok:
        raise ValueError(reason)

def uint(value):
    require(type(value) is int and 0 <= value <= MAX, 'UINT256')
    return value

class Fixed:
    def __init__(self, stakes):
        require(len(stakes)>0 and all(type(s) is int and 0 <= s <= STAKE_CAP for s in stakes), 'STAKE')
        require(sum(stakes)<=TOTAL_CAP, 'TOTAL_STAKE')
        self.stakes=list(stakes); self.total=sum(stakes); self.index=0
        self.credit=[0]*len(stakes); self.debt=[0]*len(stakes)
        self.funded=0; self.paid=0; self.unassigned=0

    def pending(self, i):
        # Subtract debt before adding credit: do not create an unnecessary overflow.
        return uint(self.credit[i]+uint(self.stakes[i]*self.index-self.debt[i]))

    def set_stake(self, i, value):
        require(type(value) is int and 0<=value<=STAKE_CAP, 'STAKE')
        total=self.total-self.stakes[i]+value
        require(total<=TOTAL_CAP, 'TOTAL_STAKE')
        accrued=self.pending(i); debt=uint(value*self.index)
        self.credit[i]=accrued; self.debt[i]=debt
        self.total=total; self.stakes[i]=value

    def post(self, payer, fee):
        require(type(fee) is int and fee>0, 'FEE')
        scaled=uint(fee*Q)
        eligible=self.total-self.stakes[payer]
        require(eligible>0, 'NO_ELIGIBLE_STAKE')
        delta=scaled//eligible
        require(delta>0, 'ZERO_INCREMENT')
        index=self.index+delta
        require(index<=INDEX_CAP, 'INDEX_CAP')
        funded=uint(self.funded+scaled)
        dust=uint(self.unassigned+scaled-delta*eligible)
        accrued=self.pending(payer); debt=uint(self.stakes[payer]*index)
        # Commit only after every potentially rejecting calculation.
        self.index=index; self.funded=funded; self.unassigned=dust
        self.credit[payer]=accrued; self.debt[payer]=debt

    def claim(self, i):
        accrued=self.pending(i); whole=accrued//Q; remainder=accrued%Q
        paid=uint(self.paid+whole*Q)
        self.credit[i]=remainder; self.debt[i]=uint(self.stakes[i]*self.index)
        self.paid=paid
        return whole

class Eager:
    def __init__(self, stakes):
        self.stakes=list(stakes); self.rewards=[0]*len(stakes)
        self.unassigned=0; self.funded=0; self.paid=0
    def post(self, payer, fee):
        eligible=sum(s for i,s in enumerate(self.stakes) if i!=payer)
        increment=(fee*Q)//eligible
        allocated=0
        for i,s in enumerate(self.stakes):
            if i!=payer:
                amount=s*increment; self.rewards[i]+=amount; allocated+=amount
        self.unassigned+=fee*Q-allocated; self.funded+=fee*Q
    def claim(self, i):
        amount=self.rewards[i]//Q
        self.rewards[i]-=amount*Q; self.paid+=amount*Q
        return amount

def rejected_unchanged(model, callback, expected):
    before=copy.deepcopy(vars(model))
    try: callback()
    except ValueError as error: assert str(error)==expected
    else: raise AssertionError('EXPECTED_REJECTION')
    assert vars(model)==before, 'REJECTION_MUTATED_STATE'

def run():
    rows=[]
    for size in (3,8,64,256):
        stakes=[1+i%7 for i in range(size)]; a=Fixed(stakes); b=Eager(stakes)
        rng=random.Random(256+size); maximum_bits=0
        for step in range(160):
            i=rng.randrange(size)
            if step%4==0:
                stake=rng.randrange(19);a.set_stake(i,stake);b.stakes[i]=stake
            elif step%4==1:
                assert a.claim(i)==b.claim(i)
            else:
                before=a.pending(i);fee=5000*10**18+step
                a.post(i,fee);b.post(i,fee);assert a.pending(i)==before
            pending=[a.pending(j) for j in range(size)]
            assert pending==b.rewards, 'MODEL_DISAGREEMENT'
            assert (a.funded,a.paid,a.unassigned)==(b.funded,b.paid,b.unassigned)
            assert a.funded==a.paid+sum(pending)+a.unassigned, 'CONSERVATION'
            assert a.total==sum(a.stakes)
            values=[a.index,a.funded,a.paid,a.unassigned,*a.credit,*a.debt,*pending]
            assert all(0<=x<=MAX for x in values)
            maximum_bits=max(maximum_bits,*(x.bit_length() for x in values))
        rows.append({'accounts':size,'operations':160,'posts':80,'stakeChanges':40,'claims':40,
                     'maxStoredOrEntitlementBits':maximum_bits,'scaledAgreementAndConservation':True})
    a=Fixed([1,1,0]);rejected_unchanged(a,lambda:a.post(0,MAX//Q+1),'UINT256')
    rejected_unchanged(a,lambda:a.set_stake(0,STAKE_CAP+1),'STAKE')
    zero=Fixed([1,0,0]);rejected_unchanged(zero,lambda:zero.post(0,1),'NO_ELIGIBLE_STAKE')
    tiny=Fixed([1,STAKE_CAP,0]);rejected_unchanged(tiny,lambda:tiny.post(0,1),'ZERO_INCREMENT')
    # Inject a consistent zero-entitlement state near the index cap for a guard test.
    edge=Fixed([1,1,0]);edge.index=INDEX_CAP-1;edge.debt=[edge.index,edge.index,0]
    rejected_unchanged(edge,lambda:edge.post(0,1),'INDEX_CAP')
    # Claiming twice cannot pay twice; fractional entitlement remains owned by the account.
    c=Fixed([1,1,2]);c.post(0,5000*10**18);first=c.claim(1);rest=c.pending(1)
    assert c.claim(1)==0 and c.pending(1)==rest and 0<rest<Q
    return {'schema':'caw-fixed-reward-model/1','scale':str(Q),'stakeCap':str(STAKE_CAP),
            'totalStakeCap':str(TOTAL_CAP),'indexCap':str(INDEX_CAP),'cases':rows,
            'rejectionCases':5,'indexBoundaryIsInjectedNotHistorical':True,
            'repeatedClaimPaysZero':True,'retainedFractionScaled':str(rest),'firstClaimBaseUnits':str(first),
            'roundingPolicy':'floor global per-stake increment; retain per-account claim fraction; never redistribute global remainder',
            'contractExecuted':False,'gasMeasured':False,'custodyImplemented':False,
            'productionAccepted':False,'specificationDecisionMade':False}

if __name__=='__main__': print(json.dumps(run(),indent=2))
