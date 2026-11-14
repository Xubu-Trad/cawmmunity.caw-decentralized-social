from pathlib import Path
import importlib.util
import json
import shutil
import sys
from unittest.mock import patch

runner, source, manifest, output = map(Path, sys.argv[1:])
spec=importlib.util.spec_from_file_location('console_reproduction',runner)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
output.mkdir();cases=[]
def rejects(name,src,man,out,expected):
    with patch.object(module.subprocess,'Popen',side_effect=AssertionError('PROCESS_MUST_NOT_START')):
        try:module.run(src,man,out)
        except ValueError as error:assert str(error).startswith(expected),(name,str(error))
        else:raise AssertionError('accepted '+name)
    cases.append(name)
    if expected!='FRESH_EXTERNAL_OUTPUT_REQUIRED':assert not out.exists()

altered=output/'changed-source';shutil.copytree(source,altered)
file=altered/'integration/local-console/verify-posting-history.mjs';raw=file.read_bytes();file.write_bytes(bytes([raw[0]^1])+raw[1:])
rejects('modified verifier rejected before execution',altered,manifest,output/'altered-result','INPUT_HASH')
changed=output/'changed-manifest.json';changed.write_bytes(manifest.read_bytes()+b' ')
rejects('modified manifest rejected before execution',source,changed,output/'manifest-result','MANIFEST_IDENTITY')
linked=output/'linked-source';linked.mkdir();shutil.copytree(source/'evidence',linked/'evidence');(linked/'integration').symlink_to(source/'integration');shutil.copytree(source/'reference',linked/'reference')
rejects('symlinked source rejected before execution',linked,manifest,output/'symlink-result','INPUT_SYMLINK')
existing=output/'existing-result';existing.mkdir();(existing/'sentinel').write_text('preserve')
rejects('existing output refused without overwrite',source,manifest,existing,'FRESH_EXTERNAL_OUTPUT_REQUIRED');assert(existing/'sentinel').read_text()=='preserve'
assert len(module.inputs(source,manifest))==53;cases.append('unmodified source validates')
value={'passed':len(cases),'checks':cases,'scope':'Pre-execution source selection and output preservation controls; process launch mocked to fail if reached.'}
(output/'result.json').write_text(json.dumps(value,indent=2)+'\n');print(json.dumps(value))
