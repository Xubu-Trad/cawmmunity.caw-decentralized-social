from pathlib import Path
import json,sys
history,out=map(Path,sys.argv[1:])
assert not out.exists()
out.mkdir()
r=json.loads(history.read_text())
def save(n,obj):
 with (out/n).open('x') as f:json.dump(obj,f,indent=2);f.write('\n')
fixtures={}
fee=5000*10**18
for row in r['cases']:
 name=row['fixture']
 if name in fixtures:continue
 before=row['before'];after=dict(before)
 pool=int(before['stake2'])+int(before['stake3'])
 a2=fee*int(before['stake2'])//pool if pool else 0
 a3=fee*int(before['stake3'])//pool if pool else 0
 dust=fee-a2-a3
 if name in ['main','oneUnit']:
  for k,delta in [('credit1',-fee),('credit2',a2),('credit3',a3),('liabilities',-dust),('poolDust',dust),('postNonce1',1)]:after[k]=str(int(after[k])+delta)
  recorded=next(x for x in r['cases'] if x['fixture']==name and x['expected']=='OK')
  assert after==recorded['after']
 fixtures[name]={'before':before,'after':after,'allocation2':str(a2),'allocation3':str(a3),'newDust':str(dust)}
save('derived-fixtures.json',{'schema':'derived-from-retained-c007-records/1','fixtures':fixtures})
save('derived-window.json',{'schema':'caw-c007-signed-window-oracle/1','cases':[{'label':x['label'],'validAfter':x['validAfter'],'deadline':x['deadline'],'timestamp':x['blockTimestamp'],'signatureMode':x['signatureMode'],'expected':x['expected']} for x in r['windowCases']]})
cases=[]
for x in r['textCases']:
 expected={'signed_empty':'TEXT_LENGTH','signed_invalid_utf8':'UTF8'}.get(x['label'],x['expected'])
 cases.append({'label':x['label'],'signedHex':x['signedHex'],'submittedHex':x['submittedHex'],'signer':2 if x['label']=='wrong_signer' else 1,'expected':expected})
save('derived-text.json',{'schema':'caw-c007-text-vectors/1','cases':cases})
