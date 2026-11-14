"""Mocked platform boundary tests; native Linux execution is not claimed."""
from pathlib import Path
import importlib.util,sys,json,hashlib,contextlib
from unittest.mock import patch
from types import SimpleNamespace
if not __debug__:raise RuntimeError('OPTIMIZED_PYTHON_UNSUPPORTED')
script,out=(Path(x).resolve()for x in sys.argv[1:]);assert not out.exists()
spec=importlib.util.spec_from_file_location('comparison',script);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.resource_preflight(out);out.mkdir();cases=[]
def run(name,release='6.8.0-generic',free=2*1024**3,mem='MemAvailable: 786432 kB',mounted=True,system='Linux',expect=None,host_free=None):
 def disk(p):return SimpleNamespace(free=host_free if str(p)=='/mnt/c'and host_free is not None else free)
 with contextlib.ExitStack()as stack:
  for target,value in [('platform.system',lambda:system),('platform.release',lambda:release),('shutil.disk_usage',disk),('os.path.ismount',lambda p:mounted)]:stack.enter_context(patch.object(m.os.path if target=='os.path.ismount' else getattr(m,target.split('.')[0]),target.split('.')[-1],value))
  stack.enter_context(patch.object(Path,'read_text',lambda p:mem))
  if expect:
   try:m.resource_preflight(out/'new-result')
   except (RuntimeError,ValueError)as e:assert expect in str(e),(name,str(e))
   else:raise AssertionError(name+' accepted')
  else:
   result=m.resource_preflight(out/'new-result');assert len(result['disks'])==(2 if 'microsoft'in release.lower()else 1)
 cases.append(name)
run('native_exact_threshold_accepts')
run('wsl_checks_both_filesystems',release='6.6-microsoft-standard-WSL2')
run('native_low_disk_rejects',free=2*1024**3-1,expect='DISK_FLOOR')
run('wsl_low_host_rejects',release='6.6-microsoft',host_free=2*1024**3-1,expect='DISK_FLOOR')
run('wsl_low_destination_rejects',release='6.6-microsoft',free=2*1024**3-1,host_free=3*1024**3,expect='DISK_FLOOR')
run('wsl_missing_mount_rejects',release='6.6-microsoft',mounted=False,expect='WSL_HOST_DRIVE_UNAVAILABLE')
run('low_memory_rejects',mem='MemAvailable: 786431 kB',expect='MEMORY_FLOOR')
run('missing_memory_rejects',mem='MemFree: 9999999 kB',expect='MEMORY_OBSERVATION_UNAVAILABLE')
run('wrong_memory_units_rejects',mem='MemAvailable: 9999999 MB',expect='MEMORY_OBSERVATION_UNAVAILABLE')
run('duplicate_memory_rejects',mem='MemAvailable: 9999999 kB\nMemAvailable: 9999999 kB',expect='MEMORY_OBSERVATION_UNAVAILABLE')
run('non_linux_rejects',system='Darwin',expect='LINUX_REQUIRED')
(out/'result.json').write_text(json.dumps({'passed':len(cases),'cases':cases,'platformTestsMocked':True,'nativeLinuxExecutionPerformed':False},indent=2)+'\n')
(out/'PROVENANCE.txt').write_text(f'PARENTS=[{script}] TRANSFORM="mocked platform/resource boundaries" SHA256={hashlib.sha256((out/"result.json").read_bytes()).hexdigest()} SIZE={(out/"result.json").stat().st_size} PATH={out/"result.json"}\n')
print(json.dumps({'passed':len(cases),'cases':cases}))
