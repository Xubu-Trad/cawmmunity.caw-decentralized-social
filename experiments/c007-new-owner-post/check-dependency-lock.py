"""Offline gate for this experiment's dependency selection; not a CVE audit."""
import json,re,sys
EXPECTED={'@ethereumjs/common':'10.1.3','@ethereumjs/evm':'10.1.3','@ethereumjs/util':'10.1.3','ethers':'6.16.0','solc':'0.8.30'}
def check(lock):
 if lock.get('lockfileVersion')!=3:raise ValueError('LOCK_VERSION')
 packages=lock['packages']
 if packages[''].get('dependencies')!=EXPECTED:raise ValueError('DIRECT_SELECTION')
 rows=[]
 for path,p in packages.items():
  if not path:continue
  if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?',p.get('version','')):raise ValueError('VERSION')
  if not p.get('resolved','').startswith('https://registry.npmjs.org/'):raise ValueError('REGISTRY')
  if not re.fullmatch(r'sha512-[A-Za-z0-9+/]+={0,2}',p.get('integrity','')):raise ValueError('INTEGRITY')
  if p.get('hasInstallScript') or p.get('link'):raise ValueError('INSTALL_OR_LINK')
  rows.append({'path':path,'version':p['version'],'integrity':p['integrity']})
 for name,version in EXPECTED.items():
  if packages.get('node_modules/'+name,{}).get('version')!=version:raise ValueError('RESOLVED_DIRECT_VERSION')
 return rows
if __name__=='__main__':
 with open(sys.argv[1],encoding='utf-8')as f:rows=check(json.load(f))
 print(json.dumps({'packages':len(rows),'selectionChecksPassed':True,'vulnerabilityAssessment':False}))
