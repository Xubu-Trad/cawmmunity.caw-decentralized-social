"""Independent ticket-enumeration arithmetic over a fixed research snapshot."""
from pathlib import Path
import runpy,json,sys,copy
tree=runpy.run_path(str(Path(__file__).with_name('c007-prefix-allocation.py')))
weights={1:2,2:3,3:5,4:0}
root,total,proofs=tree['build'](weights)
allocation=tree['oracle'](weights,1,5) # enumerate five tickets, not prefix floors

def check(report,fixture):
 assert fixture['root']=='0x'+root.hex() and fixture['total']==total
 for k,w in weights.items():
  f=fixture['accounts'][str(k)]
  assert f=={'weight':str(w),'hashes':['0x'+h.hex()for h,s in proofs[k]],'sums':[str(s)for h,s in proofs[k]]}
 assert len(report['claimRows'])==6 and report['markers']==6
 seen=set();credits={2:0,3:0,4:0};spent={}
 for row in report['claimRows']:
  k=int(row['account']);rid=row['recordId'];marker=(rid,k)
  assert k in credits and marker not in seen;seen.add(marker)
  assert int(row['weight'])==weights[k]
  assert int(row['amount'])==allocation[k]
  credits[k]+=allocation[k];spent[rid]=spent.get(rid,0)+allocation[k]
 assert len(spent)==2 and set(spent)==set(report['budgets'])
 assert all(n==5 for n in spent.values())
 assert report['credits']=={str(k):str(v)for k,v in credits.items()}
 assert all(v=='0'for v in report['budgets'].values())
 assert sum(credits.values())==int(report['final']['liability'])==10

if __name__=='__main__':
 if not __debug__:raise RuntimeError('assertions required')
 report=json.loads(Path(sys.argv[1]).read_text());fixture=json.loads(Path(sys.argv[2]).read_text());check(report,fixture)
 rejected=[]
 for label in ['amount','account','missing','duplicate']:
  changed=copy.deepcopy(report)
  if label=='amount':changed['claimRows'][0]['amount']='2'
  if label=='account':changed['claimRows'][0]['account']='3'
  if label=='missing':changed['claimRows'].pop()
  if label=='duplicate':changed['claimRows'][1]=copy.deepcopy(changed['claimRows'][0])
  try:check(changed,fixture)
  except AssertionError:rejected.append(label)
  else:raise AssertionError('mutation accepted')
 print(json.dumps({'status':'FIXED_SNAPSHOT_TICKET_ORACLE_MATCH','claims':6,'credits':{'2':2,'3':8,'4':0},'rejected':rejected,'limits':'Same-author different-language enumeration; no independent external review, execution or ownership proof.'},indent=2))
