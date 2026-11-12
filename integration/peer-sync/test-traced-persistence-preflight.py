from pathlib import Path
import importlib.util,tempfile,shutil,json,argparse
spec=importlib.util.spec_from_file_location('preflight',Path(__file__).with_name('traced-persistence-preflight.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--source',required=True,type=Path);p.add_argument('--manifest',required=True,type=Path);a=p.parse_args()
with tempfile.TemporaryDirectory(prefix='caw-preflight-')as d:
 root=Path(d)/'source';shutil.copytree(a.source,root);manifest=Path(d)/'manifest.json';shutil.copyfile(a.manifest,manifest)
 assert m.verify_inputs(root,manifest)['matchedInputs']==17;results=['genuine inputs accepted']
 name=next(iter(json.loads(manifest.read_text())['files']));f=root/name;original=f.read_bytes()
 def reject(label):
  try:m.verify_inputs(root,manifest)
  except (ValueError,FileNotFoundError):results.append(label);return
  raise AssertionError('FALSE_ACCEPT '+label)
 f.write_bytes(original+b'x');reject('changed input rejected');f.unlink();reject('missing input rejected');f.write_bytes(original)
 original_manifest=manifest.read_bytes();obj=json.loads(original_manifest);obj['files'][name]['sha256']='0'*64;manifest.write_text(json.dumps(obj));reject('repinned inventory rejected');manifest.write_bytes(original_manifest)
 outside=Path(d)/'outside';outside.write_bytes(original);f.unlink();f.symlink_to(outside);reject('external symlink rejected')
 f.unlink();f.write_bytes(original)
 for added in ['integration/peer-sync/tracing-capability.py','integration/peer-sync/run-header-sync-early-trace.py']:
  q=root/added;v=q.read_bytes();q.write_bytes(v+b'\n# changed');reject(added+' mutation rejected');q.write_bytes(v)
 print(json.dumps({'checks':len(results),'results':results}))
