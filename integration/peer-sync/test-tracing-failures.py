import sys
if sys.flags.optimize:
    raise SystemExit("OPTIMIZED_PYTHON_UNSUPPORTED: run without -O, -OO or PYTHONOPTIMIZE")
from pathlib import Path
import argparse,os,sys,subprocess,json,time
p=argparse.ArgumentParser()
for n in ['driver','fixture','reth-command','output']:p.add_argument('--'+n,required=True,type=Path)
a=p.parse_args();O=a.output;O.mkdir(exist_ok=False);results=[]
for case in ['missing-tool','timeout']:
 bindir=O/(case+'-bin');bindir.mkdir();out=O/case
 if case=='timeout':
  stub=bindir/'strace'
  stub.write_text('#!'+sys.executable+'\nimport subprocess,sys,time,os,json\nfrom pathlib import Path\np=subprocess.Popen([sys.executable,"-c","import time; time.sleep(120)"])\nPath(os.environ["PROBE_PIDS"]).write_text(json.dumps([os.getpid(),p.pid]))\ntime.sleep(120)\n');stub.chmod(0o700)
 start=time.monotonic()
 q=subprocess.run([sys.executable,str(a.driver.resolve()),'--geth','/nonexistent/MUST_NOT_START_GETH','--reth-command',str(a.reth_command.resolve()),'--fixture',str(a.fixture.resolve()),'--output',str(out.resolve())],env={**os.environ,'PATH':str(bindir.resolve()),'PROBE_PIDS':str((O/'timeout-pids.json').resolve())},capture_output=True,timeout=25)
 elapsed=time.monotonic()-start;(O/(case+'.log')).write_bytes(q.stdout+q.stderr)
 assert q.returncode!=0 and b'TRACING_CAPABILITY_BLOCKED'in q.stderr
 v=json.loads((out/'trace-capability.json').read_text());assert not v['passed']and not(out/'genesis.json').exists()and not(out/'source-data').exists()
 expected='TRACE_PROBE_START_FAILED'if case=='missing-tool'else'TRACE_PROBE_TIMEOUT';assert v['reason']==expected
 if case=='missing-tool':assert v['errorType']=='FileNotFoundError'
 states=[]
 if case=='timeout':
  assert 9<=elapsed<25
  for pid in json.loads((O/'timeout-pids.json').read_text()):
   f=Path('/proc')/str(pid)/'stat'
   state=f.read_text().rsplit(')',1)[1].split()[0]if f.exists()else'absent'
   assert state in ['absent','Z'],(pid,state)
   states.append(state)
 results.append({'case':case,'reason':v['reason'],'rejectedBeforeNodeInitialization':True,'seconds':elapsed,'recordedProcessStates':states,'runningProbeProcessesRemain':False})
(O/'result.json').write_text(json.dumps({'cases':results,'scope':'controlled missing executable and timed-out tracer with descendant; no test nodes started'},indent=2)+'\n');print(json.dumps(results))
