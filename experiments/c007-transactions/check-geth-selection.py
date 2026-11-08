from pathlib import Path
import importlib.util,sys,tempfile,hashlib,json,subprocess,shutil
script,inputs,blocks,out=map(Path,sys.argv[1:]);assert not out.exists();out.mkdir()
assert shutil.disk_usage('/mnt/c').free>=2*1024**3
assert int(next(x.split()[1]for x in Path('/proc/meminfo').read_text().splitlines()if x.startswith('MemAvailable:')))>=768*1024
spec=importlib.util.spec_from_file_location('compare',script);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
cases=[]
assert len(m.selected_inputs(inputs,blocks))==4;cases.append('frozen_inputs_accepted')
for name in m.INPUT_DIGESTS:
 p=blocks if name=='blocks.json'else inputs/name
 changed=out/('altered-'+name);changed.write_bytes(p.read_bytes()+b' ')
 try:m.load_selected(changed,m.INPUT_DIGESTS[name])
 except ValueError as e:assert str(e)=='SELECTED_INPUT_DIGEST';cases.append('changed_'+name+'_rejected')
 else:raise AssertionError('accepted changed input')
p=out/'truncated.json';p.write_bytes(b'{')
try:m.load_selected(p,m.INPUT_DIGESTS['genesis.json'])
except ValueError as e:assert str(e)=='SELECTED_INPUT_DIGEST';cases.append('truncated_rejected')
else:raise AssertionError('accepted truncation')
p=out/'oversize.json'
with p.open('wb')as f:f.truncate(8*1024**2+1)
try:m.load_selected(p,'0'*64)
except ValueError as e:assert str(e)=='SELECTED_INPUT_SIZE';cases.append('oversize_rejected')
else:raise AssertionError('accepted oversize')
p=subprocess.run([sys.executable,'-O',str(script)],capture_output=True,text=True,timeout=10)
assert p.returncode!=0 and 'OPTIMIZED_PYTHON_UNSUPPORTED' in p.stderr;cases.append('optimized_mode_rejected_before_argument_processing')
(out/'result.json').write_text(json.dumps({'cases':cases,'passed':len(cases),'fixtureAuthentication':False},indent=2)+'\n')
(out/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[{script},{inputs},{blocks}] TRANSFORM="selected input regression" SHA256={hashlib.sha256(p.read_bytes()).hexdigest()} SIZE={p.stat().st_size} PATH={p}'for p in out.iterdir()if p.is_file())+'\n')
print(json.dumps({'passed':len(cases),'cases':cases}))
