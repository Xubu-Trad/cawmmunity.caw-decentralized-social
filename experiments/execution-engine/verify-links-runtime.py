"""Read-only pinned pnpm link graph and exact Node release-checksum comparison."""
from pathlib import Path
import hashlib,json,re,sys,urllib.request
engine=Path(sys.argv[1]).resolve();runtime=Path(sys.argv[2]).resolve();out=Path(sys.argv[3]).resolve()
assert not out.exists();out.mkdir(parents=True)
lock=(engine/'pnpm-lock.yaml').read_bytes();assert hashlib.sha256(lock).hexdigest()=='fae68803a13e3cfa804cb872ca4872f65e844adb21c9d844fa5fb6804d0e6773'
snap=lock.decode().split('\nsnapshots:\n',1)[1]
graph={};current=None;dependencies=False
for line in snap.splitlines():
 if not line.strip():continue
 m=re.fullmatch(r"  '?([^\s'][^']*?)'?:(?: \{\})?",line)
 if m:current=m[1];graph[current]={};dependencies=False;continue
 if line=='    dependencies:':dependencies=True;continue
 if line.startswith('    ') and not line.startswith('      '):dependencies=False
 if dependencies:
  m=re.fullmatch(r"      '?([^']+?)'?: (\S+)",line)
  assert m,('UNSUPPORTED_LOCK_LINE',line);graph[current][m[1]]=m[2]
assert len(graph)==17
def package(name,version):return engine/'node_modules/.pnpm'/(name.replace('/','+')+'@'+version)/'node_modules'/name
edges=[]
for identity,deps in graph.items():
 name,version=identity.rsplit('@',1);base=package(name,version)
 p=json.loads((base/'package.json').read_text());assert p['name']==name and p['version']==version
 assert set(p.get('dependencies',{}))==set(deps),'DECLARATION_MISMATCH'
 for dep,v in deps.items():
  assert dep+'@'+v in graph,'UNKNOWN_TARGET'
  link=engine/'node_modules/.pnpm'/(name.replace('/','+')+'@'+version)/'node_modules'/dep
  assert link.resolve(strict=True)==package(dep,v).resolve(strict=True),'LINK_TARGET'
  edges.append({'from':identity,'to':dep+'@'+v})
for name,version in json.loads((engine/'package.json').read_text())['dependencies'].items():
 assert (engine/'node_modules'/name).resolve(strict=True)==package(name,version).resolve(strict=True),'ROOT_LINK'
 edges.append({'from':'experiment-root','to':name+'@'+version})
result={'schema':'caw-links-runtime/1','packages':17,'edges':edges,'declaredLinksMatch':True,'conditionalExportsVerified':False,'loadedModulesAttested':False,'runtimeChecksumMatched':False,'releaseSignatureVerified':False,'productionAccepted':False}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
url='https://nodejs.org/dist/v24.20.0/SHASUMS256.txt'
with urllib.request.urlopen(url,timeout=30) as response:
 assert response.url==url;checksums=response.read(131073)
assert len(checksums)<=131072,'CHECKSUM_LIMIT';(out/'SHASUMS256.txt').write_bytes(checksums)
matches=re.findall(r'^([a-f0-9]{64})\s+win-x64/node.exe$',checksums.decode(),re.M);assert len(matches)==1,'RUNTIME_RELEASE_ENTRY'
with runtime.open('rb') as f:actual=hashlib.file_digest(f,'sha256').hexdigest()
assert actual==matches[0]=='5c976096e04e5c2c1f091938926234cc9fbebfe9787ddd149351b3b0ecc707b5','RUNTIME_CHECKSUM'
result.update(runtimeChecksumMatched=True,runtimeSha256=actual,runtimeRelease='24.20.0',checksumSource=url,checksumDocumentSha256=hashlib.sha256(checksums).hexdigest())
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'packages':17,'edges':len(edges),'runtimeChecksumMatched':True,'releaseSignatureVerified':False}))
