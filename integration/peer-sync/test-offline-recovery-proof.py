from pathlib import Path
import sys,json,subprocess,tempfile,shutil
W=Path(__file__).resolve().parent;O=Path(sys.argv[4]).resolve();O.mkdir(exist_ok=False)
# Arguments: pinned source, saved evidence, runner summary, fresh output.
source=Path(sys.argv[1]).resolve();evidence=Path(sys.argv[2]).resolve();summary=Path(sys.argv[3]).resolve();rows=[]
for case in ['genuine','changed-header','missing-proof','false-summary','changed-reader','existing-output','changed-helper','missing-helper']:
 with tempfile.TemporaryDirectory() as td:
  d=Path(td);e=d/'evidence.json';s=d/'summary.json';e.write_bytes(evidence.read_bytes());s.write_bytes(summary.read_bytes());src=source
  if case=='changed-header':
   v=json.loads(e.read_text());v['header']['stateRoot']='0x'+'00'*32;e.write_text(json.dumps(v))
  if case=='missing-proof':
   v=json.loads(e.read_text());v['proof']['accountProof']=[];e.write_text(json.dumps(v))
  if case=='false-summary':
   v=json.loads(s.read_text());v['reproduction']['proof']['fields']=17;s.write_text(json.dumps(v))
  if case=='changed-reader':
   src=d/'source';shutil.copytree(source,src);f=src/'integration/core-baseline-v1/check-geth-header-proof.mjs';f.write_text(f.read_text()+'\n// changed\n')
  marker=d/'unexpected-helper-execution'
  if case in ['changed-helper','missing-helper']:
   src=d/'source';shutil.copytree(source,src);helper=src/'integration/peer-sync/traced-persistence-preflight.py'
   if case=='missing-helper':helper.unlink()
   else:helper.write_text('from pathlib import Path\nPath('+repr(str(marker))+').write_text("executed")\n'+helper.read_text())
  out=d/'out'
  if case=='existing-output':out.mkdir();(out/'keep').write_text('keep')
  q=subprocess.run([sys.executable,str(W/'verify-recovery-proof.py'),'--source',str(src),'--evidence',str(e),'--summary',str(s),'--output',str(out)],capture_output=True,text=True)
  ok=q.returncode==0;assert ok==(case=='genuine'),(case,q.stdout,q.stderr)
  if not ok:assert not(out/'verification.json').exists()
  if case in ['changed-helper','missing-helper']:assert not marker.exists() and not out.exists()
  if case=='existing-output':assert(out/'keep').read_text()=='keep'
  if case=='genuine':(O/'verification.json').write_bytes((out/'verification.json').read_bytes())
  rows.append({'case':case,'exit':q.returncode,'expectedAccepted':case=='genuine'})
(O/'tests.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows))

