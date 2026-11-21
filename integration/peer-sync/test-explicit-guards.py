"""Mock process-boundary tests; no clients, chain or actual persistence run."""
from pathlib import Path
import sys,subprocess,tempfile,json,os
wrapper=Path(sys.argv[1]).resolve();results=[]
driver="""import sys,json,os
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--output')+1]);out.mkdir()
data={'service':{'allStopped':True},'result':{'matchingHeaders':29,'originalSourceStillStopped':True,'replacementPeerDifferentIdentity':True,'destinationFileImportUsed':False},'restart':{'identityPreserved':True,'peersBeforeReplacement':0,'targetAbsent':True},'write-window':{'completionMarkersBeforeKill':[]},'evidence':{}}
case=os.environ['CASE']
if case=='cleanup':data['service']['allStopped']=False
if case=='window':data['write-window']['completionMarkersBeforeKill']=['complete']
if case=='isolation':data['restart']['targetAbsent']=False
if case=='recovery':data['result']['matchingHeaders']=28
for k,v in data.items():(out/(k+'.json')).write_text(json.dumps(v))
"""
with tempfile.TemporaryDirectory() as td:
 d=Path(td);(d/'driver.py').write_text(driver);(d/'reader').write_text('fixture');(d/'expected').write_text('{}')
 node=d/'node';node.write_text('#!'+sys.executable+'\nimport json,os\np={"fields":16,"controls":["header root","header hash","wrong value","missing proof","altered node"],"headerBindingVerified":True,"chainAuthenticated":False,"finalityVerified":False}\nif os.environ["CASE"]=="proof":p["fields"]=15\nif os.environ["CASE"]=="scope":p["chainAuthenticated"]=True\nprint(json.dumps(p))\n');node.chmod(0o700)
 for optimized in [False,True]:
  for case in ['genuine','cleanup','window','isolation','recovery','proof','scope']:
   out=d/(case+str(optimized));env=dict(os.environ,CASE=case,PATH=str(d)+os.pathsep+os.environ['PATH'])
   cmd=[sys.executable]+(['-O'] if optimized else [])+[str(wrapper),'--driver',str(d/'driver.py'),'--geth','unused','--reth-command','unused','--fixture','unused','--output',str(out),'--reader',str(d/'reader'),'--expected',str(d/'expected')]
   p=subprocess.run(cmd,env=env,capture_output=True,text=True);accepted=p.returncode==0
   results.append({'optimized':optimized,'case':case,'accepted':accepted,'summaryWritten':(out/'reproduction.json').exists()})
   if accepted!=(case=='genuine') or (case!='genuine' and (out/'reproduction.json').exists()):
    print(json.dumps(results));raise SystemExit(1)
print(json.dumps({'cases':results,'scope':'mock process boundaries only'},indent=2))
