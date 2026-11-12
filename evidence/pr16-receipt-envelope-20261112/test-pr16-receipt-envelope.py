"""Offline PR16 receipt-response regression; supply the pinned reproduction directory."""
from pathlib import Path
import sys,tempfile,runpy,json,copy,subprocess,difflib,hashlib
source=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(exist_ok=False)
old=(source/'compare_traces.py').read_text()
needle='    rpc_problems = []\n'
addition='''    rpc_problems = []
    # A receipt service error is not a successful not-yet-mined response.
    for trace_name, trace in [("retained", ret), ("independent", ind)]:
        for call in trace["local_calls"]:
            if (call.get("request") or {}).get("method") != RECEIPT_METHOD:
                continue
            response = call.get("response")
            if (not isinstance(response, dict) or "error" in response
                    or "result" not in response):
                rpc_problems.append(f"{trace_name}: invalid receipt response envelope")
'''
assert old.count(needle)==1
new=old.replace(needle,addition)
(out/'receipt-envelope.patch').write_text(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/compare_traces.py',tofile='b/compare_traces.py')))
results=[]
with tempfile.TemporaryDirectory() as td:
 d=Path(td)
 for f in source.iterdir():
  if f.name not in ['compare_traces.py','test_compare_traces.py']: (d/f.name).symlink_to(f,target_is_directory=f.is_dir())
 (d/'compare_traces.py').write_text(new);(d/'test_compare_traces.py').write_text((source/'test_compare_traces.py').read_text())
 p=subprocess.run([sys.executable,str(d/'test_compare_traces.py')],capture_output=True,text=True)
 (out/'existing-tests.log').write_text(p.stdout+p.stderr);assert p.returncode==0
 m=runpy.run_path(str(d/'test_compare_traces.py'));orig=json.loads(m['INDEPENDENT_TRACE'].read_text())
 for kind in ['genuine','error_without_result','error_with_null','missing_result']:
  t=copy.deepcopy(orig)
  if kind!='genuine':
   c=next(c for c in t['local_calls'] if c.get('request',{}).get('method')=='eth_getTransactionReceipt' and 'result' in c.get('response',{}) and c['response']['result'] is None)
   if kind!='error_with_null':c['response'].pop('result')
   if kind.startswith('error'):c['response']['error']={'code':-32000,'message':'synthetic unavailable receipt service'}
   c['raw_response']=json.dumps(c['response'])
  f=d/'mutation.json';f.write_text(json.dumps(t));code=m['run_checker'](m['RETAINED_SUMMARY'],f,d/'comparison.json');expected=0 if kind=='genuine' else 1
  results.append({'case':kind,'exit':code,'expected':expected});assert code==expected
(out/'result.json').write_text(json.dumps({'base':'aba275b8239289ed63de331961207c6a13f47f41','existingSuiteExit':p.returncode,'cases':results,'scope':'proposed offline comparator correction, no EVM rerun'},indent=2)+'\n')
print((out/'result.json').read_text())
