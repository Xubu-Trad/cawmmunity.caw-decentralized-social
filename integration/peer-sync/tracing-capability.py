"""Small local-child trace probe; no privilege changes or node execution."""
from pathlib import Path
import subprocess,sys,os,signal,json,hashlib,re
def check_tracing(output):
 output=Path(output);trace=output/'trace-probe.trace';data=output/'trace-probe.bin'
 child="import os,sys; f=os.open(sys.argv[1],os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600); assert os.pwrite(f,b'caw-trace-probe',0)==15; os.fsync(f); os.close(f)"
 # Same tracing family and injection setting used by the persistence driver.
 cmd=['strace','-f','-ttt','-yy','-e','trace=pwrite64,pwritev,write,writev,fsync,fdatasync,msync','-e','inject=pwrite64:delay_exit=100ms','-o',str(trace),sys.executable,'-c',child,str(data)]
 result={'schema':'caw-tracing-capability/1','passed':False,'scope':'local Python child only; not a guarantee that Reth tracing or recovery will succeed','nodeProcessesStarted':False}
 try:
  p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  try:stdout,stderr=p.communicate(timeout=10)
  except subprocess.TimeoutExpired:
   os.killpg(p.pid,signal.SIGKILL);stdout,stderr=p.communicate();result['reason']='TRACE_PROBE_TIMEOUT'
  (output/'trace-probe.stdout').write_bytes(stdout);(output/'trace-probe.stderr').write_bytes(stderr)
  result['exitCode']=p.returncode
  text=trace.read_text(errors='replace')if trace.exists()else ''
  result['observedDelayedPwrite']=bool(re.search(r'pwrite64\([^\n]*trace-probe\.bin[^\n]*= 15 \(DELAYED\)',text))
  result['observedSync']='fsync('in text and 'trace-probe.bin'in text
  result['payloadMatches']=data.exists()and data.read_bytes()==b'caw-trace-probe'
  result['passed']=p.returncode==0 and result['observedDelayedPwrite'] and result['observedSync'] and result['payloadMatches']
  if not result['passed']:result.setdefault('reason','TRACE_PROBE_UNAVAILABLE_OR_INCOMPLETE')
 except OSError as e:result['reason']='TRACE_PROBE_START_FAILED';result['errorType']=type(e).__name__
 (output/'trace-capability.json').write_text(json.dumps(result,indent=2)+'\n')
 files=[x for x in output.glob('trace-*')if x.is_file()]
 (output/'TRACE_PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[local-trace-probe] TRANSFORM="unprivileged local-child tracing capability check" SHA256={hashlib.sha256(x.read_bytes()).hexdigest()} SIZE={x.stat().st_size} PATH={x.name}'for x in files)+'\n')
 if not result['passed']:raise RuntimeError('TRACING_CAPABILITY_BLOCKED: see trace-capability.json; no test nodes started')
 return result
