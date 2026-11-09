"""Proposed integer apportionment on frozen stake-tree encoding. Not adopted."""
import hashlib,json,copy
MAX=(1<<256)-1; NS=bytes.fromhex('11'*32)
def uint(n):
    if type(n) is not int or not 0<=n<=MAX:raise ValueError('uint256')
    return n.to_bytes(32,'big')
def H(b):return hashlib.sha256(b).digest()
def leaf(k,w):return (H(b'\x01'+uint(k)+uint(w)),w)
def branch(a,b):
    uint(a[1]+b[1])
    return (H(b'\x02'+a[0]+uint(a[1])+b[0]+uint(b[1])),a[1]+b[1])
def wrap(n):return H(b'CAW_STAKE_TREE_RESEARCH_V1\0'+NS+n[0]+uint(n[1]))
def build(weights):
    empty=[(H(b'\0'),0)]
    for _ in range(256):empty.append(branch(empty[-1],empty[-1]))
    levels=[{k:leaf(k,w) for k,w in weights.items()}]
    for height in range(256):
        prev=levels[-1]
        levels.append({k:branch(prev.get(k*2,empty[height]),prev.get(k*2+1,empty[height])) for k in {i//2 for i in prev}})
    top=levels[-1].get(0,empty[256]);proofs={}
    for k in weights:
        proofs[k]=[levels[h].get((k>>h)^1,empty[h]) for h in range(256)]
    return wrap(top),top[1],proofs
def verify(root,total,k,w,proof):
    if len(proof)!=256:raise ValueError('proof length')
    uint(k);node=leaf(k,w);prefix=0
    for h,sibling in enumerate(proof):
        if len(sibling[0])!=32:raise ValueError('hash')
        if (k>>h)&1:prefix+=sibling[1];node=branch(sibling,node)
        else:node=branch(node,sibling)
    if wrap(node)!=root or node[1]!=total:raise ValueError('root/total')
    return prefix
def allocation(root,total,payer,pw,pp,k,w,kp,fee):
    uint(fee);verify(root,total,payer,pw,pp)
    prefix=verify(root,total,k,w,kp)
    if total==pw:raise ValueError('zero pool')
    if k==payer:return 0
    start=prefix-(pw if payer<k else 0);den=total-pw
    return fee*(start+w)//den-fee*start//den
def oracle(weights,payer,fee):
    out={k:0 for k in weights};den=sum(w for k,w in weights.items() if k!=payer)
    start=0
    for k,w in sorted(weights.items()):
        if k==payer:continue
        for ticket in range(1,fee+1):
            if start*fee < ticket*den <= (start+w)*fee:out[k]+=1
        start+=w
    return out
def main():
    checks=0;snapshots=[{1:2,2:3,3:5,4:7},{0:0,1:1,2:2,MAX:3},{1:0,2:0,3:1}]
    roots=[]
    for weights in snapshots:
        root,total,proof=build(weights);roots.append(root.hex())
        for k,w in weights.items():assert verify(root,total,k,w,proof[k])==sum(v for i,v in weights.items() if i<k)
        for payer,pw in weights.items():
            if total==pw:continue
            for fee in range(1,22):
                actual={k:allocation(root,total,payer,pw,proof[payer],k,w,proof[k],fee) for k,w in weights.items()}
                assert actual==oracle(weights,payer,fee)
                assert sum(actual.values())==fee and actual[payer]==0;checks+=1
    weights={1:1,2:2,3:3};root,total,p=build(weights);bad=[]
    variants=[('sibling sum', [(x[0],x[1]+1) if i==0 else x for i,x in enumerate(p[2])]),
              ('sibling hash',[(b'\0'*32,x[1]) if i==0 else x for i,x in enumerate(p[2])]),
              ('short proof',p[2][:-1])]
    for name,pf in variants:
        try:verify(root,total,2,2,pf)
        except ValueError:bad.append(name)
        else:raise AssertionError('bad proof accepted')
    newer,nt,np=build({1:1,2:2,3:4})
    try:allocation(newer,nt,1,1,p[1],2,2,np[2],5)
    except ValueError:bad.append('payer proof from different snapshot')
    else:raise AssertionError('mixed snapshots accepted')
    for name,k,w,t in [('wrong account',4,2,total),('wrong weight',2,3,total),('wrong total',2,2,total+1)]:
        try:verify(root,t,k,w,p[2])
        except ValueError:bad.append(name)
        else:raise AssertionError('bad binding accepted')
    # Concrete order dependence: same participant A (weight1), B(weight2).
    first=oracle({0:0,1:1,2:2},0,5)
    second=oracle({0:0,1:2,2:1},0,5)
    assert first[1]==1 and second[2]==2
    # A owns weights1 and1; moving one share across B changes combined rewards.
    contiguous=oracle({0:0,1:1,2:1,3:1},0,1)
    assert contiguous[1]+contiguous[2]==0 and contiguous[1]+contiguous[3]==1
    extreme={1:0,2:MAX-1,3:1};er,et,ep=build(extreme)
    shares=[allocation(er,et,1,0,ep[1],k,extreme[k],ep[k],MAX) for k in [2,3]]
    assert sum(shares)==MAX and max(shares)<=MAX
    print(json.dumps({'status':'RESEARCH_NOT_ADOPTED','tree_depth':256,'snapshot_roots':roots,
        'allocation_cases':checks,'rejected_proof_variants':bad,
        'order_counterexample':{'A_first':first[1],'A_last':second[2],'fee':5,'A_weight':1,'B_weight':2},
        'account_position_counterexample':{'fee':1,'three_equal_weight_accounts':contiguous,'A_accounts_1_and_2':0,'A_accounts_1_and_3':1},
        'max_uint256_fee_conserved':True,
        'limits':'Frozen tree hash/namespace encoding reused in Python; no deployed proof verifier, custody debit, claim nullifier, NFT entitlement or gas certification.'},indent=2))
if __name__=='__main__':main()
