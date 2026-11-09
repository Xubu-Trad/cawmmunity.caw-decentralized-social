"""Offline account-credit claims; no token escrow, signature or ownership policy."""
from pathlib import Path
from collections import namedtuple
import runpy,json,copy,itertools,hashlib
tree=runpy.run_path(str(Path(__file__).with_name('c007-prefix-allocation.py')))
build,verify,allocation,uint=(tree[k] for k in ['build','verify','allocation','uint'])
Record=namedtuple('Record','chain contract profile payer epoch nonce fee root total')
DOMAIN=(31337,bytes.fromhex('22'*20),bytes.fromhex('33'*32))
def digest(r):
    if len(r.contract)!=20 or len(r.profile)!=32 or len(r.root)!=32:raise ValueError('encoding')
    return hashlib.sha256(b'CAW_C007_CLAIM_RECORD_RESEARCH_V1\0'+uint(r.chain)+r.contract+r.profile+
        uint(r.payer)+uint(r.epoch)+uint(r.nonce)+uint(r.fee)+r.root+uint(r.total)).hexdigest()
def action(r):return (r.chain,r.contract,r.profile,r.payer,r.epoch,r.nonce)

class Claims:
    def __init__(self):
        self.records={};self.actions=set();self.remaining={};self.claimed=set();self.credits={};self.receipts=[]
    def admit_fixture(self,r,payer_weight,payer_proof):
        # Test-only admission. Real signed action/debit/authenticated root is absent.
        key=digest(r)
        if (r.chain,r.contract,r.profile)!=DOMAIN:raise ValueError('domain')
        if action(r) in self.actions or key in self.records:raise ValueError('duplicate action')
        if r.fee==0:raise ValueError('zero fee')
        verify(r.root,r.total,r.payer,payer_weight,payer_proof)
        if r.total==payer_weight:raise ValueError('zero pool')
        self.records[key]=r;self.actions.add(action(r));self.remaining[key]=r.fee
        return key
    def claim(self,key,k,w,proof,payer_weight,payer_proof):
        if key not in self.records:raise ValueError('unknown record')
        r=self.records[key]
        if k==r.payer:raise ValueError('payer')
        nullifier=(key,k)
        if nullifier in self.claimed:raise ValueError('duplicate claim')
        amount=allocation(r.root,r.total,r.payer,payer_weight,payer_proof,k,w,proof,r.fee)
        left=self.remaining[key]-amount
        if left<0:raise ValueError('budget')
        next_credit=self.credits.get(k,0)+amount;uint(next_credit)
        self.claimed.add(nullifier);self.remaining[key]=left;self.credits[k]=next_credit
        self.receipts.append((key,k,amount))
        return amount
    def check(self):
        for key,r in self.records.items():
            assert self.remaining[key]+sum(a for rid,k,a in self.receipts if rid==key)==r.fee
        assert sum(self.credits.values())==sum(a for rid,k,a in self.receipts)
        assert len(self.receipts)==len(self.claimed)

def main():
    wa={1:2,2:3,3:5,4:0};wb={1:2,2:1,3:7,4:0}
    ra,ta,pa=build(wa);rb,tb,pb=build(wb)
    a=Record(*DOMAIN,1,0,0,5,ra,ta);b=Record(*DOMAIN,1,0,1,7,rb,tb)
    ledger=Claims();ka=ledger.admit_fixture(a,wa[1],pa[1]);kb=ledger.admit_fixture(b,wb[1],pb[1])
    rejected=[]
    def reject(label,fn):
        before=copy.deepcopy(ledger.__dict__)
        try:fn()
        except ValueError:pass
        else:raise AssertionError('accepted '+label)
        assert ledger.__dict__==before
        rejected.append(label)
    reject('unknown record',lambda:ledger.claim('ff'*32,2,wa[2],pa[2],wa[1],pa[1]))
    reject('replacement fee cannot reuse action',lambda:ledger.admit_fixture(a._replace(fee=6),wa[1],pa[1]))
    reject('replacement snapshot cannot reuse action',lambda:ledger.admit_fixture(a._replace(root=rb,total=tb),wb[1],pb[1]))
    for field,value in [('chain',1),('contract',bytes.fromhex('44'*20)),('profile',bytes.fromhex('55'*32))]:
        reject('foreign '+field,lambda field=field,value=value:ledger.admit_fixture(a._replace(**{field:value}),wa[1],pa[1]))
    reject('current proof for earlier fee',lambda:ledger.claim(ka,2,wb[2],pb[2],wb[1],pb[1]))
    reject('old proof for later fee',lambda:ledger.claim(kb,2,wa[2],pa[2],wa[1],pa[1]))
    reject('wrong payer weight',lambda:ledger.claim(ka,2,wa[2],pa[2],3,pa[1]))
    reject('wrong recipient weight',lambda:ledger.claim(ka,2,4,pa[2],wa[1],pa[1]))
    reject('payer claim',lambda:ledger.claim(ka,1,wa[1],pa[1],wa[1],pa[1]))
    ledger.claim(ka,2,wa[2],pa[2],wa[1],pa[1])
    reject('duplicate claim',lambda:ledger.claim(ka,2,wa[2],pa[2],wa[1],pa[1]))
    ledger.claim(ka,4,wa[4],pa[4],wa[1],pa[1])
    reject('duplicate zero claim',lambda:ledger.claim(ka,4,wa[4],pa[4],wa[1],pa[1]))
    ledger.claim(ka,3,wa[3],pa[3],wa[1],pa[1])
    for k in [3,4,2]:ledger.claim(kb,k,wb[k],pb[k],wb[1],pb[1])
    ledger.check();assert ledger.remaining=={ka:0,kb:0} and sum(ledger.credits.values())==12
    # Claim order does not change per-record allocations or final credits.
    orders=0
    for order in itertools.permutations([2,3,4]):
        x=Claims();ak=x.admit_fixture(a,wa[1],pa[1]);bk=x.admit_fixture(b,wb[1],pb[1])
        for k in order:
            x.claim(bk,k,wb[k],pb[k],wb[1],pb[1]);x.claim(ak,k,wa[k],pa[k],wa[1],pa[1]);x.check()
        assert x.credits==ledger.credits and x.remaining==ledger.remaining;orders+=1
    # Every committed scalar/byte field changes the record identifier.
    changes={'chain':31338,'contract':bytes.fromhex('44'*20),'profile':bytes.fromhex('55'*32),
        'payer':2,'epoch':1,'nonce':2,'fee':6,'root':rb,'total':ta+1}
    assert all(digest(a._replace(**{k:v}))!=ka for k,v in changes.items())
    print(json.dumps({'status':'RESEARCH_NOT_ADOPTED','records':[ka,kb],
        'record_field_binding_checks':len(changes),'atomic_rejections':rejected,
        'claim_order_permutations':orders,'final_account_credits':ledger.credits,
        'final_unclaimed_budgets':ledger.remaining,'fee_input':12,'credited':sum(ledger.credits.values()),
        'limits':'Synthetic admission and account credits only. No signed debit, token backing, chain-root authentication, ownership withdrawal, reorg rollback or EVM execution.'},indent=2))

if __name__=='__main__':main()
