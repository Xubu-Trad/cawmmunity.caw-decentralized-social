"""Offline transfer controls, using an already verified local input fixture."""
import argparse,importlib.util,json,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--fixture',type=Path,required=True);a=p.parse_args()
s=importlib.util.spec_from_file_location('acquire',Path(__file__).with_name('acquire-persistence-inputs.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def clean(url,maximum):
 name=url[len(m.BASE):].split('/',1)[1]
 return (a.fixture/name).read_bytes()[:maximum]
results=[]
with tempfile.TemporaryDirectory(prefix='caw-acquire-')as d:
 root=Path(d);ok=root/'good';result=m.acquire(ok,clean);assert result['verifiedFiles']==20;results.append('genuine 20-file set accepted')
 def reject(name,fetch):
  dest=root/name
  try:m.acquire(dest,fetch)
  except BaseException as e:
   assert isinstance(e,(ValueError,OSError,KeyboardInterrupt)),repr(e)
   report=json.loads((dest/'ACQUISITION.json').read_text());assert report['status']=='blocked'
   assert not (dest/'integration/peer-sync/reproduce-traced-persistence.py').exists()
   results.append(name+' rejected; failure preserved');return
  raise AssertionError('FALSE_ACCEPT '+name)
 reject('altered',lambda u,n:bytes([clean(u,n)[0]^1])+clean(u,n)[1:])
 reject('truncated',lambda u,n:clean(u,n)[:-1])
 reject('oversized',lambda u,n:clean(u,n)+b'x')
 def unavailable(u,n):raise OSError('controlled unavailable source')
 reject('unavailable',unavailable)
 def interrupt(u,n):raise KeyboardInterrupt('controlled interruption')
 reject('interrupted',interrupt)
 original=(ok/'ACQUISITION.json').read_bytes()
 try:m.acquire(ok,lambda *args:(_ for _ in ()).throw(AssertionError('should not fetch')))
 except FileExistsError:pass
 else:raise AssertionError('reused output accepted')
 assert (ok/'ACQUISITION.json').read_bytes()==original;results.append('existing output preserved without fetch')
print(json.dumps({'checks':len(results),'results':results,'scope':'offline acquisition controls; no node execution'}))
