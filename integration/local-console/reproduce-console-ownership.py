#!/usr/bin/env python3
"""Reproduce a pinned, disposable console ownership flow. Never use real funds."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, os, shutil, signal, subprocess, sys
PIN='e0fa16d3a6f10cc9a88dfde0d130598273005f06'
MANIFEST_SHA='192922b2ecae732f7d25a29a08d6f795b62658237f3aa0d5f44f5164854a18c4'
GETH_SHA='45335929e149413c9f680209c87fa14adc5750387da6f5f30b7b2bd24d2d54ea'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def inputs(source, manifest):
 if digest(manifest)!=MANIFEST_SHA:raise ValueError('MANIFEST_IDENTITY')
 data=json.loads(manifest.read_text())
 if data['commit']!=PIN or data['schema']!='caw-console-ownership-inputs/1':raise ValueError('SOURCE_PIN')
 paths=[]
 if source.is_symlink():raise ValueError('INPUT_SYMLINK')
 for row in data['files']:
  relative=PurePosixPath(row['path'])
  if relative.is_absolute() or '..'in relative.parts or str(relative)!=row['path']:raise ValueError('INPUT_PATH')
  p=source
  for part in relative.parts:
   p=p/part
   if p.is_symlink():raise ValueError('INPUT_SYMLINK')
  if not p.is_file() or p.stat().st_size!=row['size'] or digest(p)!=row['sha256']:raise ValueError('INPUT_HASH '+row['path'])
  paths.append(row['path'])
 if len(paths)!=len(set(paths)):raise ValueError('DUPLICATE_INPUT')
 return paths

def run(source,manifest,output,geth):
 source=Path(source);manifest=Path(manifest);output=Path(output);geth=Path(geth)
 paths=inputs(source,manifest)
 if output.exists() or output.is_symlink() or output.resolve().is_relative_to(source.resolve()):raise ValueError('FRESH_EXTERNAL_OUTPUT_REQUIRED')
 if os.name!='posix' or not Path('/proc/meminfo').exists():raise ValueError('LINUX_REQUIRED')
 if not geth.is_file() or digest(geth)!=GETH_SHA:raise ValueError('GETH_IDENTITY')
 if sys.flags.optimize:raise ValueError('ASSERTIONS_REQUIRED')
 mem=int(next(x for x in Path('/proc/meminfo').read_text().splitlines()if x.startswith('MemAvailable:')).split()[1])
 if mem<1024**2:raise ValueError('MEMORY_GUARD')
 for root in [output.parent]+([Path('/mnt/c')]if Path('/mnt/c').exists()else[]):
  if shutil.disk_usage(root).free<2*1024**3:raise ValueError('DISK_GUARD')
 env=os.environ.copy()
 for key in ['NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME']:env.pop(key,None)
 node=subprocess.check_output(['node','--version'],env=env,text=True).strip();npm=subprocess.check_output(['npm','--version'],env=env,text=True).strip()
 if node!='v20.20.2':raise ValueError('NODE_VERSION')
 output.mkdir();src=output/'src';src.mkdir();records=[]
 def save(name,value):(output/name).write_text(json.dumps(value,indent=2)+'\n')
 for path in paths:
  p=src/path;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/path,p)
 inputs(src,manifest)
 package=src/'evidence/console-safe-transfer-20261113'
 shutil.copyfile(package/'mine-safe-transfer.py',output/'mine-safe-transfer.py');shutil.copyfile(package/'lane.mjs',output/'lane.mjs')
 shutil.copyfile(package/'post-authority-sequence-before-safe.mjs',src/'integration/local-console/post-authority-sequence-before-safe.mjs')
 env.update(GETH_BIN=str(geth.resolve()),npm_config_cache=str((output/'npm-cache').resolve()),NO_PROXY='127.0.0.1',no_proxy='127.0.0.1')
 def execute(name,args,timeout):
  with (output/(name+'.log')).open('wb')as log:
   proc=subprocess.Popen(args,cwd=output,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   try:code=proc.wait(timeout=timeout)
   except subprocess.TimeoutExpired:
    os.killpg(proc.pid,signal.SIGTERM)
    try:proc.wait(timeout=15)
    except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
    code=124
  (output/(name+'.exit')).write_text(str(code)+'\n');records.append({'step':name,'exit':code});save('steps.json',records)
  if code:raise RuntimeError('STEP_FAILED '+name)
 save('environment.json',{'sourceCommit':PIN,'manifestSha256':MANIFEST_SHA,'node':node,'npm':npm,'gethSha256':GETH_SHA,'freshDependencies':True,'independentOperator':False})
 try:
  execute('npm-ci',['npm','ci','--prefix',str(src/'integration/local-console'),'--ignore-scripts','--no-audit','--no-fund'],180)
  execute('fresh-console',[sys.executable,str(output/'mine-safe-transfer.py'),'positive'],300)
  execute('safe-controls',['node',str(src/'integration/local-console/test-safe-owner.mjs'),str(output/'private/positive/owner-post-evidence.json')],60)
  inputs(src,manifest)
  if not json.loads((output/'private/positive/shutdown.json').read_text())['stopped']:raise RuntimeError('NODE_NOT_STOPPED')
  checks=json.loads((output/'private/positive/console-checks.json').read_text());negative=json.loads((output/'safe-controls.log').read_text())
  save('result.json',{'status':'PASS','sourceCommit':PIN,'sourceFiles':len(paths),'freshConsoleChecks':checks['passed'],'safeTransferChecks':negative['passed'],'sourceUnchanged':True,'scope':'Fresh dependency install, mined local console flow and controls. Same-operator unless separately reproduced; no second-engine run, browser interaction or public-chain claim.'})
 except BaseException as error:
  save('result.json',{'status':'FAIL','errorType':type(error).__name__,'error':str(error),'sourceCommit':PIN});raise
 finally:
  files=[p for p in output.rglob('*')if p.is_file()and not any(x in p.relative_to(output).parts for x in ['node_modules','npm-cache','data','src'])and p.name!='PROVENANCE.txt']
  (output/'PROVENANCE.txt').write_text('\n'.join(f'PARENTS=[{PIN},{MANIFEST_SHA}] TRANSFORM="pinned fresh console reproduction" SHA256={digest(p)} SIZE={p.stat().st_size} PATH={p.relative_to(output).as_posix()}'for p in sorted(files))+'\n')
 return output
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True,type=Path);p.add_argument('--manifest',type=Path,default=Path(__file__).with_name('ownership-reproduction-inputs.json'));p.add_argument('--output',required=True,type=Path);p.add_argument('--geth',required=True,type=Path);a=p.parse_args();run(a.source,a.manifest,a.output,a.geth)

