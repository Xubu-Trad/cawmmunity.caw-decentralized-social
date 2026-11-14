from pathlib import Path
import importlib.util,json,shutil,sys
from unittest.mock import patch
runner,source,manifest,out=map(Path,sys.argv[1:]);out.mkdir()
spec=importlib.util.spec_from_file_location('runner',runner);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);checks=[]
def reject(name,src,man,target,geth,expected):
 with patch.object(m.subprocess,'Popen',side_effect=AssertionError('NO_PROCESS_ALLOWED')):
  try:m.run(src,man,target,geth)
  except ValueError as e:assert str(e).startswith(expected),(name,str(e))
  else:raise AssertionError('accepted '+name)
 checks.append(name)
assert len(m.inputs(source,manifest))==64;checks.append('pinned64inputs accepted')
altered=out/'changed';shutil.copytree(source,altered);f=altered/'integration/local-console/post-authority-sequence.mjs';f.write_bytes(f.read_bytes()+b'\n');reject('modified verifier rejected',altered,manifest,out/'r1',out/'unused','INPUT_HASH')
changed=out/'manifest.json';changed.write_bytes(manifest.read_bytes()+b' ');reject('modified manifest rejected',source,changed,out/'r2',out/'unused','MANIFEST_IDENTITY')
linked=out/'linked';shutil.copytree(source,linked);f=linked/'integration/local-console/server.mjs';f.unlink();f.symlink_to(source/'integration/local-console/server.mjs');reject('symlinked input rejected',linked,manifest,out/'r3',out/'unused','INPUT_SYMLINK')
existing=out/'existing';existing.mkdir();(existing/'sentinel').write_text('preserve');reject('existing output preserved',source,manifest,existing,out/'unused','FRESH_EXTERNAL_OUTPUT_REQUIRED');assert(existing/'sentinel').read_text()=='preserve'
reject('output inside source rejected',source,manifest,source/'new-output',out/'unused','FRESH_EXTERNAL_OUTPUT_REQUIRED')
wrong=out/'wrong-geth';wrong.write_text('wrong');reject('wrong geth rejected',source,manifest,out/'r4',wrong,'GETH_IDENTITY')
(out/'result.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'scope':'Pre-execution controls; process starts forbidden.'},indent=2)+'\n');print((out/'result.json').read_text())
