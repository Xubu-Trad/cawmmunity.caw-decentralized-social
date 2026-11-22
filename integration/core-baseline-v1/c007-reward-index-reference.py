"""Research only: rational reward index versus eager per-recipient allocation.

Weights are supplied inputs, not proven custody. Fees are external inputs, not
signed account debits. No production rounding policy or token is implemented.
"""
from fractions import Fraction as F
import copy
import json
import random

class Index:
    def __init__(self):
        self.index=F(0); self.total=0; self.accounts={}; self.fees=0; self.paid=0

    def add(self, ident, weight):
        if ident in self.accounts or type(weight) is not int or weight < 0:
            raise ValueError('account/weight')
        self.accounts[ident]=[weight,self.index,F(0)]
        self.total+=weight

    def settle(self, ident):
        a=self.accounts[ident]
        a[2]+=a[0]*(self.index-a[1]); a[1]=self.index

    def stake(self, ident, weight):
        if type(weight) is not int or weight < 0: raise ValueError('weight')
        self.settle(ident)
        a=self.accounts[ident]; self.total+=weight-a[0]; a[0]=weight

    def post(self, payer, fee):
        if type(fee) is not int or fee <= 0: raise ValueError('fee')
        eligible=self.total-self.accounts[payer][0]
        if eligible <= 0: raise ValueError('zero pool')
        self.settle(payer)
        self.index+=F(fee,eligible)
        self.accounts[payer][1]=self.index  # payer gets no part of its own fee
        self.fees+=fee

    def pending(self, ident):
        a=self.accounts[ident]
        return a[2]+a[0]*(self.index-a[1])

    def claim(self, ident):
        self.settle(ident)
        amount=self.accounts[ident][2].numerator//self.accounts[ident][2].denominator
        self.accounts[ident][2]-=amount; self.paid+=amount
        return amount

class Eager:
    def __init__(self):
        self.weights={}; self.rewards={}; self.fees=0; self.paid=0
    def add(self, ident, weight):
        self.weights[ident]=weight; self.rewards[ident]=F(0)
    def stake(self, ident, weight): self.weights[ident]=weight
    def post(self, payer, fee):
        recipients=[k for k in self.weights if k != payer]
        denominator=sum(self.weights[k] for k in recipients)
        if denominator == 0: raise ValueError('zero pool')
        for k in recipients: self.rewards[k]+=F(fee*self.weights[k],denominator)
        self.fees+=fee
    def claim(self, ident):
        amount=self.rewards[ident].numerator//self.rewards[ident].denominator
        self.rewards[ident]-=amount; self.paid+=amount
        return amount

def compare(a,b):
    assert a.total==sum(b.weights.values())
    assert a.fees==b.fees and a.paid==b.paid
    assert all(a.pending(k)==b.rewards[k] and a.pending(k)>=0 for k in b.weights)
    assert sum((a.pending(k) for k in a.accounts),F(0))+a.paid==a.fees

def main():
    a,b=Index(),Eager(); rng=random.Random(7007); events=[]; claims=0
    for k,w in enumerate([7,11,13]): a.add(k,w); b.add(k,w)
    maxbits=0
    for step in range(480):
        keys=list(a.accounts); kind=rng.choice(['post','post','stake','claim','add'])
        ident=rng.choice(keys)
        if kind=='add':
            ident=len(keys); value=rng.randrange(0,101)
            a.add(ident,value); b.add(ident,value)
            assert a.pending(ident)==0  # new accounts cannot claim past fees
        elif kind=='stake':
            value=rng.randrange(0,101); a.stake(ident,value); b.stake(ident,value)
        elif kind=='claim':
            value=a.claim(ident); assert value==b.claim(ident); claims+=value
        else:
            value=rng.randrange(1,1001); a.post(ident,value); b.post(ident,value)
        compare(a,b)
        maxbits=max(maxbits,a.index.numerator.bit_length(),a.index.denominator.bit_length())
        events.append([kind,ident,value])
    # Zero-pool and invalid writes must leave the candidate unchanged.
    z=Index();z.add(0,3); failures=0
    for action in [lambda:z.post(0,1),lambda:z.post(0,0),lambda:z.stake(0,-1),lambda:z.add(0,2)]:
        before=copy.deepcopy(z.__dict__)
        try:action()
        except ValueError:pass
        else:raise AssertionError('negative accepted')
        assert before==z.__dict__;failures+=1
    # Mutation controls demonstrate that the oracle detects two key mistakes.
    mutants=[]
    x,y=Index(),Eager()
    for k,w in enumerate([1,2]):x.add(k,w);y.add(k,w)
    x.post(0,3);y.post(0,3);x.accounts[0][1]=F(0)
    try:compare(x,y)
    except AssertionError:mutants.append('payer checkpoint omitted')
    x,y=Index(),Eager()
    for k,w in enumerate([1,2]):x.add(k,w);y.add(k,w)
    x.post(0,3);y.post(0,3)
    x.total+=2;x.accounts[1][0]=4;y.stake(1,4)
    try:compare(x,y)
    except AssertionError:mutants.append('stake changed before settling past rewards')
    assert len(mutants)==2
    assert maxbits>256  # measured reason this exact-rational model cannot be ported literally
    print(json.dumps({'status':'RESEARCH_NOT_ADOPTED','seed':7007,'events':events,
        'compared_transitions':len(events),'accounts':len(a.accounts),'input_fees':a.fees,
        'integer_claims':claims,'remaining_fractional_entitlement':str(F(a.fees-claims)),
        'maximum_index_component_bits':maxbits,'uint256_literal_port_blocked':True,
        'atomic_rejections':failures,'mutants_detected':mutants,
        'limits':'Same-author Python models, exact rational arithmetic. No custody, signed debit, EVM gas bounds, NFT transfer, proof acquisition or adopted rounding policy.'},indent=2))

if __name__=='__main__': main()
