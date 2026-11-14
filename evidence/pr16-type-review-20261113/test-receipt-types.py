from pathlib import Path
import subprocess,json,copy,difflib,sys
D=Path(sys.argv[1]).resolve();O=Path(sys.argv[2]).resolve();O.mkdir();results=[]
ret=json.loads((D/'retained/execution-trace.json').read_text());ind=json.loads((D/'independent-run.json').read_text())
for side in ['retained','independent']:
 for name,value in [('string','malformed'),('array',['malformed'])]:
  lane=O/(side+'-'+name);lane.mkdir();r=copy.deepcopy(ret);i=copy.deepcopy(ind)
  trace=r if side=='retained' else i
  row=next(x for x in trace['local_calls'] if x['label']=='deposit_2.receipt0');row['response']=value;row['raw_response']=json.dumps(value)
  (lane/'retained.json').write_text(json.dumps(r));(lane/'independent.json').write_text(json.dumps(i))
  for variant in ['original','patched']:
   f=D/('compare_traces_original.py' if variant=='original' else 'compare_traces.py');out=lane/(variant+'.json')
   p=subprocess.run(['python3',str(f),'--retained-trace',str(lane/'retained.json'),'--independent-trace',str(lane/'independent.json'),'--retained-summary',str(D/'retained/execution-summary.json'),'--out',str(out)],capture_output=True,text=True)
   (lane/(variant+'.log')).write_text(p.stdout+p.stderr)
   assert p.returncode==1
   if variant=='original':assert not out.exists() and 'AttributeError' in p.stderr
   else:
    v=json.loads(out.read_text());assert v['verdict']=='FAIL';assert 'invalid receipt response envelope' in v['checks'][0]['detail'];assert 'Traceback' not in p.stderr
   results.append(dict(side=side,input=name,variant=variant,exit=p.returncode,structured=out.exists()))
p=subprocess.run(['python3',str(D/'test_compare_traces.py')],capture_output=True,text=True,timeout=120);(O/'pr16-regressions.log').write_text(p.stdout+p.stderr);assert p.returncode==0
(O/'pr16-type-results.json').write_text(json.dumps(results,indent=2)+'\n')
a=(D/'compare_traces_original.py').read_text();b=(D/'compare_traces.py').read_text();(O/'pr16-type-guard.patch').write_text(''.join(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile='a/compare_traces.py',tofile='b/compare_traces.py')))
print('4 original crashes reproduced; 4 controlled structured rejections; existing22 pass')
