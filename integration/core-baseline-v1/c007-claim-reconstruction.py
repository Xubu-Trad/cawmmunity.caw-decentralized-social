"""Synthetic journal replay. Caller-selected digest is NOT chain authentication."""
from pathlib import Path
import runpy,json,hashlib,copy
m=runpy.run_path(str(Path(__file__).with_name('c007-snapshot-claims.py')))
Claims,Record,DOMAIN,build,digest=(m[k] for k in ['Claims','Record','DOMAIN','build','digest'])
def encode(v):
    if isinstance(v,bytes):return {'hex':v.hex()}
    if isinstance(v,(list,tuple)):return [encode(x) for x in v]
    if isinstance(v,dict):return {k:encode(x) for k,x in v.items()}
    return v
def decode(v):
    if isinstance(v,dict):
        if set(v)=={'hex'}:return bytes.fromhex(v['hex'])
        return {k:decode(x) for k,x in v.items()}
    if isinstance(v,list):return [decode(x) for x in v]
    return v
def pack(events):return json.dumps({'schema':'caw-synthetic-claim-journal/1','events':encode(events)},sort_keys=True,separators=(',',':')).encode()
def sha(raw):return hashlib.sha256(raw).hexdigest()
def replay(raw,expected):
    if type(raw) is not bytes or len(raw)>4*1024**2 or sha(raw)!=expected:raise ValueError('selection')
    data=json.loads(raw)
    if set(data)!={'schema','events'} or data['schema']!='caw-synthetic-claim-journal/1':raise ValueError('schema')
    if not isinstance(data['events'],list) or len(data['events'])>32:raise ValueError('event limit')
    ledger=Claims()
    for event in decode(data['events']):
        if set(event)!={'op','args'}:raise ValueError('event schema')
        args=event['args']
        if event['op']=='admit':ledger.admit_fixture(Record(*args[0]),*args[1:])
        elif event['op']=='claim':ledger.claim(*args)
        else:raise ValueError('operation')
        ledger.check()
    return ledger
def state(ledger):
    return {'credits':dict(ledger.credits),'budgets':dict(ledger.remaining),
        'claimed':sorted(ledger.claimed),'records':sorted(ledger.records)}
class Reader:
    def __init__(self):self.active=None;self.expected=None;self.current=None;self.pending={}
    def select(self,expected):
        self.current=None;self.pending.clear();self.active=None;self.expected=None
        if type(expected) is not str or len(expected)!=64 or any(c not in '0123456789abcdef' for c in expected):raise ValueError('selection')
        self.active=object();self.expected=expected;return self.active
    def prepare(self,token,raw):
        if token is not self.active or token is None:raise ValueError('stale selection')
        if len(self.pending)>=4:raise ValueError('pending limit')
        candidate=state(replay(raw,self.expected));ticket=object();self.pending[ticket]=candidate;return ticket
    def commit(self,ticket):
        if ticket not in self.pending:raise ValueError('stale preparation')
        self.current=self.pending.pop(ticket);self.pending.clear()
    def view(self):return copy.deepcopy(self.current)

def main():
    wa={1:2,2:3,3:5};wb={1:2,2:1,3:7}
    ra,ta,pa=build(wa);rb,tb,pb=build(wb)
    a=Record(*DOMAIN,1,0,0,5,ra,ta);b=Record(*DOMAIN,1,0,1,7,rb,tb);ka,kb=digest(a),digest(b)
    ad=lambda r,w,p:{'op':'admit','args':[r,w[1],p[1]]}
    cl=lambda key,k,w,p:{'op':'claim','args':[key,k,w[k],p[k],w[1],p[1]]}
    aa,ab=ad(a,wa,pa),ad(b,wb,pb)
    a2,a3,b2,b3=cl(ka,2,wa,pa),cl(ka,3,wa,pa),cl(kb,2,wb,pb),cl(kb,3,wb,pb)
    full=pack([aa,a2,ab,b2,a3,b3]);replacement=pack([aa,a3]);prefix=pack([aa])
    expected=state(replay(full,sha(full)))
    r=Reader()
    def install(raw):
        token=r.select(sha(raw));assert r.view() is None
        r.commit(r.prepare(token,raw));return r.view()
    assert install(full)==expected
    orphaned=install(replacement)
    assert orphaned['records']==[ka] and orphaned['credits']=={3:4}
    assert (ka,2) not in orphaned['claimed'] and all(x[0]!=kb for x in orphaned['claimed'])
    # A removed claim can be applied once on the new selected branch.
    reapplied=install(pack([aa,a3,a2]));assert sum(reapplied['credits'].values())==5
    assert install(full)==expected and install(full)==expected
    assert install(prefix)['credits']=={} and r.view()['budgets']=={ka:5}
    rejected=[]
    def bad(label,fn):
        try:fn()
        except (ValueError,TypeError):rejected.append(label)
        else:raise AssertionError('accepted '+label)
    token=r.select(sha(full));prepared=r.prepare(token,full)
    replacement_token=r.select(sha(replacement))
    bad('stale prepared branch',lambda:r.commit(prepared));assert r.view() is None
    bad('stale selection token',lambda:r.prepare(token,full));assert r.view() is None
    bad('history changed under selected digest',lambda:r.prepare(replacement_token,full));assert r.view() is None
    for label,events in [('orphan claim without admission',[aa,b3]),('duplicate claim',[aa,a2,a2]),('claim before admission',[a2,aa]),('duplicate admission',[aa,aa])]:
        raw=pack(events);t=r.select(sha(raw));bad(label,lambda:t and r.prepare(t,raw));assert r.view() is None
    install(full)
    bad('malformed new selection',lambda:r.select('not-a-digest'));assert r.view() is None
    assert install(full)==expected
    output=r.view();output['credits'][2]=999;assert r.view()==expected
    print(json.dumps({'status':'RESEARCH_NOT_ADOPTED','full_journal_sha256':sha(full),
        'replacement_sha256':sha(replacement),'full_credits':expected['credits'],
        'replacement_credits':orphaned['credits'],'reapplied_credits':reapplied['credits'],
        'rejected':rejected,'fresh_replay_matches_reselection':True,'returned_view_is_detached':True,
        'limits':'Synthetic journal selection, no Ethereum event ABI, receipt/header/body validation, canonicality, real token escrow or production rollback.'},indent=2))
if __name__=='__main__':main()
