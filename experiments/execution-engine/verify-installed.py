"""Compare a pinned pnpm installation with lockfile-integrity-checked npm archives.
No archive is extracted and no package script is executed.
"""
from pathlib import Path,PurePosixPath
import base64,hashlib,io,json,os,re,tarfile,urllib.request,sys

engine=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve()
assert not out.exists();out.mkdir(parents=True)
lock=(engine/'pnpm-lock.yaml').read_bytes()
assert hashlib.sha256(lock).hexdigest()=='fae68803a13e3cfa804cb872ca4872f65e844adb21c9d844fa5fb6804d0e6773','LOCK_CHANGED'
section=lock.decode().split('\npackages:\n',1)[1].split('\nsnapshots:',1)[0]
entries=re.findall(r"^  '?([^\n']+)'?:\n    resolution: \{integrity: (sha512-[A-Za-z0-9+/=]+)\}",section,re.M)
assert len(entries)==17,('PACKAGE_COUNT',len(entries))
rows=[]
for identity,integrity in entries:
 name,version=identity.rsplit('@',1)
 url='https://registry.npmjs.org/'+name+'/-/'+name.rsplit('/',1)[-1]+'-'+version+'.tgz'
 with urllib.request.urlopen(url,timeout=30) as response:
  assert response.url.startswith('https://registry.npmjs.org/')
  archive=response.read(20971521)
 assert len(archive)<=20971520,'ARCHIVE_LIMIT'
 assert 'sha512-'+base64.b64encode(hashlib.sha512(archive).digest()).decode()==integrity,'ARCHIVE_INTEGRITY'
 (out/(name.replace('/','_')+'-'+version+'.tgz')).write_bytes(archive)
 installed=engine/'node_modules/.pnpm'/(name.replace('/','+')+'@'+version)/'node_modules'/name
 expected={};total=0
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as tar:
  for member in tar:
   assert len(expected)<10000,'ENTRY_LIMIT'
   if member.isdir():continue
   assert member.isfile(),'ARCHIVE_SPECIAL_ENTRY'
   path=PurePosixPath(member.name)
   assert path.parts[0]=='package' and '..' not in path.parts and not path.is_absolute(),'ARCHIVE_PATH'
   rel='/'.join(path.parts[1:]);assert rel and rel not in expected,'DUPLICATE_PATH'
   total+=member.size;assert member.size<=8388608 and total<=67108864,'EXPANDED_LIMIT'
   content=tar.extractfile(member).read();assert len(content)==member.size
   p=installed.joinpath(*path.parts[1:]);assert p.is_file() and not p.is_symlink(),'INSTALLED_MISSING'
   assert p.stat().st_size==len(content),'INSTALLED_SIZE'
   digest=hashlib.sha256(content).hexdigest();assert hashlib.sha256(p.read_bytes()).hexdigest()==digest,'INSTALLED_BYTES'
   expected[rel]=digest
 actual=set()
 for directory,dirs,files in os.walk(installed,followlinks=False):
  assert not any((Path(directory)/d).is_symlink() or os.path.isjunction(Path(directory)/d) for d in dirs),'INSTALLED_LINK'
  for f in files:actual.add((Path(directory)/f).relative_to(installed).as_posix())
 assert set(expected)<=actual,'INSTALLED_MISSING'
 extras=[]
 for rel in sorted(actual-set(expected)):
  assert rel.startswith('node_modules/.bin/'),'UNEXPECTED_INSTALLATION_EXTRA'
  p=installed/rel;assert p.stat().st_size<=65536 and not p.is_symlink(),'EXTRA_LIMIT'
  extras.append({'path':rel,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'verifiedAgainstArchive':False})
 row={'name':name,'version':version,'integrity':integrity,'archiveSha256':hashlib.sha256(archive).hexdigest(),'files':len(expected),'bytes':total,'installationExtras':extras}
 rows.append(row);print(json.dumps(row),flush=True)
 result={'schema':'caw-installed-package-comparison/1','lockSha256':hashlib.sha256(lock).hexdigest(),'packages':rows,'packagePayloadComparisonComplete':len(rows)==17,'installationFullyAttested':False,'runtimeAttested':False,'resolutionGraphVerified':False,'productionAccepted':False}
 (out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
print('All 17 package payloads match pinned archives')
