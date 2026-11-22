"""Rejected/limited design exploration. Never a production settlement policy."""
from pathlib import Path
from fractions import Fraction as F
import json, runpy, copy, sys
MAX=(1<<256)-1
def u256(v):
    if type(v) is not int or not 0<=v<=MAX: raise ValueError('uint256 range')
    return v

class Fixed:
    def __init__(self,scale):
        self.q=u256(scale)
        if not scale: raise ValueError('zero scale')
        self.index=0;self.total=0;self.accounts={};self.reserve=0;self.fees=0;self.paid=0
    def add(self,k,w):
        if k in self.accounts: raise ValueError('duplicate')
        w=u256(w);total=u256(self.total+w)
        self.accounts[k]=[w,self.index,0];self.total=total
    def pending(self,k):
        w,checkpoint,credit=self.accounts[k]
        return u256(credit+w*(self.index-checkpoint))
    def stake(self,k,w):
        w=u256(w);credit=self.pending(k);total=u256(self.total-self.accounts[k][0]+w)
        self.accounts[k]=[w,self.index,credit];self.total=total
    def post(self,k,fee):
        fee=u256(fee)
        if not fee:raise ValueError('zero fee')
        eligible=self.total-self.accounts[k][0]
        if not eligible:raise ValueError('zero pool')
        credit=self.pending(k)
        # Python evaluates this product exactly. A Solidity implementation would
        # need reviewed full-width mulDiv, not naive uint256 multiplication.
        delta,remainder=divmod(fee*self.q,eligible)
        index=u256(self.index+delta);reserve=u256(self.reserve+remainder)
        self.accounts[k]=[self.accounts[k][0],index,credit]
        self.index=index;self.reserve=reserve;self.fees+=fee
    def claim(self,k):
        credit=self.pending(k);amount,remainder=divmod(credit,self.q)
        self.accounts[k]=[self.accounts[k][0],self.index,remainder];self.paid+=amount
        return amount

def main():
    root=Path(__file__).resolve().parent
    Eager=runpy.run_path(str(root/'c007-reward-index-reference.py'))['Eager']
    trace=json.loads(Path(sys.argv[1]).read_text())['events']
    reports=[]
    for scale in [1,10**6,10**18]:
        a,b=Fixed(scale),Eager();cp={};ep={};maxerror=F(0)
        for k,w in enumerate([7,11,13]):a.add(k,w);b.add(k,w);cp[k]=ep[k]=0
        for kind,k,v in trace:
            if kind=='add':a.add(k,v);b.add(k,v);cp[k]=ep[k]=0
            elif kind=='stake':a.stake(k,v);b.stake(k,v)
            elif kind=='post':a.post(k,v);b.post(k,v)
            elif kind=='claim':cp[k]+=a.claim(k);ep[k]+=b.claim(k)
            else:raise AssertionError('unknown event')
            errors=[]
            for ident in a.accounts:
                earned=F(a.pending(ident),scale)+cp[ident]
                exact=b.rewards[ident]+ep[ident]
                error=exact-earned;assert error>=0
                errors.append(error);maxerror=max(maxerror,error)
            assert sum(errors,F(0))==F(a.reserve,scale)
            assert a.fees*scale==a.paid*scale+sum(a.pending(i) for i in a.accounts)+a.reserve
            assert a.total==sum(b.weights.values()) and a.fees==b.fees
        reports.append({'scale':str(scale),'transitions':len(trace),'input_fees':a.fees,
            'integer_claims':a.paid,'unallocated_reserve_base_units':str(F(a.reserve,scale)),
            'maximum_individual_lifetime_shortfall':str(maxerror)})
    # High eligible weight can turn every positive fee into reserve.
    x=Fixed(10**18);x.add(0,0);x.add(1,10**30)
    for _ in range(20):x.post(0,1)
    assert x.claim(1)==0 and x.reserve==20*x.q
    starvation={'fee_each':1,'actions':20,'eligible_weight':str(10**30),'scale':str(x.q),
        'recipient_claim':0,'unallocated_base_units':20}
    # Carrying the global reserve across membership changes changes who earns it.
    carry_example={'scale':10,'first_fee':1,'first_recipient_weight':11,
        'first_index_delta':10//11,'old_reserve':10,'replacement_recipient_weight':1,
        'next_fee':1,'new_recipient_reward_if_old_reserve_reused':(10+10)//1//10}
    assert carry_example['new_recipient_reward_if_old_reserve_reused']==2
    # Overflow must reject without mutating. This still creates a liveness limit.
    y=Fixed(1);y.add(0,0);y.add(1,1);y.post(0,MAX)
    before=copy.deepcopy(y.__dict__)
    try:y.post(0,1)
    except ValueError:pass
    else:raise AssertionError('index overflow accepted')
    assert y.__dict__==before and y.claim(1)==MAX
    # Intermediate overflow can occur even if the quotient fits.
    numerator=MAX*10**18;quotient=numerator//MAX
    assert numerator>MAX and quotient==10**18 and quotient<=MAX
    print(json.dumps({'status':'RESEARCH_NOT_ADOPTED','scales':reports,
        'zero_reward_counterexample':starvation,'cross_membership_carry_counterexample':carry_example,
        'index_overflow_rejected_atomically':True,'full_width_product_required':True,
        'limits':'Same-author Python reference; range-checked selected fields, not a Solidity implementation or comprehensive uint256 proof. Reserve handling and deployment policy remain unresolved.'},indent=2))

if __name__=='__main__':main()
