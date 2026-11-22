import importlib.util,json,copy
from pathlib import Path
W=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('gate',W/'check-dependency-lock.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
lock=json.loads((W/'package-lock.json').read_text());assert len(m.check(lock))==32
key='node_modules/solc';cases=[]
for name,mutate in [('install_script',lambda x:x['packages'][key].update(hasInstallScript=True)),('missing_integrity',lambda x:x['packages'][key].pop('integrity')),('other_registry',lambda x:x['packages'][key].update(resolved='https://example.com/solc.tgz')),('version_drift',lambda x:x['packages'][key].update(version='0.8.31')),('direct_range',lambda x:x['packages']['']['dependencies'].update(solc='^0.8.30')),('linked_package',lambda x:x['packages'][key].update(link=True))]:
 x=copy.deepcopy(lock);mutate(x)
 try:m.check(x)
 except ValueError:cases.append(name)
 else:raise AssertionError(name)
import sys
out=Path(sys.argv[1]);out.mkdir(exist_ok=False)
(out/'result.json').write_text(json.dumps({'packages':32,'negativeControls':cases,'vulnerabilityAssessment':False},indent=2)+'\n');print((out/'result.json').read_text())
