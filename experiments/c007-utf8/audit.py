from pathlib import Path
import json,sys
old,new,vectors=map(lambda p:json.loads(Path(p).read_text()),sys.argv[1:])
for section,count in [('cases',18),('withdrawals',10),('windowCases',10)]:
 assert len(old[section])==len(new[section])==count
 for a,b in zip(old[section],new[section]):
  assert {k:v for k,v in a.items() if k!='executionGas'}=={k:v for k,v in b.items() if k!='executionGas'},a['label']
assert new['mainFinalAfterWithdrawals']==old['mainFinalAfterWithdrawals']
def check(row,raw):
 before,after=row['before'],row['after']
 if row['error']:
  assert before==after and row['textEvent'] is None
  return
 event=row['textEvent'];assert event and row['eventValidated']
 b=bytes.fromhex(event['dataHex']);n=len(raw)
 assert int.from_bytes(b[:32],'big')==32 and int.from_bytes(b[32:64],'big')==n
 assert len(b)==64+32*((n+31)//32) and b[64:64+n]==raw
 assert b[64+n:]==bytes(len(b)-64-n)
 assert len(event['topicsHex'])==3 and int(event['topicsHex'][1],16)==1
 assert int(event['topicsHex'][2],16)==int(before['postNonce1'])
 fee=5000*10**18;pool=int(before['stake2'])+int(before['stake3'])
 shares=[fee*int(before['stake'+str(i)])//pool for i in [2,3]]
 expected=dict(before)
 for k,d in [('credit1',-fee),('credit2',shares[0]),('credit3',shares[1]),('poolDust',fee-sum(shares)),('liabilities',sum(shares)-fee),('postNonce1',1)]:expected[k]=str(int(expected[k])+d)
 assert after==expected,row['label']
for a,b in zip(old['textCases'],new['textCases']):
 if a['label'] in ['signed_empty','signed_invalid_utf8']:
  assert b['error']=='revert' and b['before']==a['before']
 else:assert {k:v for k,v in a.items() if k!='executionGas'}=={k:v for k,v in b.items() if k!='executionGas'}
 check(b,bytes.fromhex(b['submittedHex']))
assert len(new['utf8Cases'])==len(vectors['cases'])==22
accepted=0
for row,v in zip(new['utf8Cases'],vectors['cases']):
 raw=bytes.fromhex(v['hex'])
 try: valid=0<len(raw)<=1680 and 1<=len(raw.decode('utf8','strict'))<=420
 except UnicodeDecodeError:valid=False
 assert (row['error'] is None)==valid==v['accepted']
 assert row['inputHex']==v['hex'] and row['expected']==v['expected']
 accepted+=int(valid);check(row,raw)
assert accepted==11
print('PASS: 18/10/10 regression records match except gas; 7 unchanged text results; 2 intended rejections; 22 UTF8 outcomes and event/accounting snapshots checked')
