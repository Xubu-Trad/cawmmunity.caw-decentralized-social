"""Validate research observations and complete conflict coverage, not adoption."""
import json,re,hashlib,sys
from pathlib import Path
def validate(record,compiler_input,conflicts):
 source=compiler_input['sources']['DeployedCustodyStakeResearch.sol']['content']
 assert record['status']=='DRAFT_RESEARCH_NOT_ADOPTED'
 assert record['productionAccepted']is False
 assert hashlib.sha256(source.encode()).hexdigest()==record['sourceSha256']
 assert hashlib.sha256(conflicts.encode()).hexdigest()==record['conflictsSha256']
 patterns={'postFeeExpression':r'SIGNED_FEE = ([^;]+);','profileLabel':r'keccak256\("(CAW_C007_SYNTHETIC_POST_V1)"\)','domainName':r'keccak256\("(CAW C007 Synthetic Action)"\)','domainVersion':r'VERSION_HASH = keccak256\("([^"]+)"\)','textScalarLimit':r'if\(scalars>(\d+)\)','walletSignatureByteLimit':r'signature.length <= (\d+)','walletCallGas':r'staticcall\((\d+),','settlementAccountId':r'require\(req.accountId == (\d+), "ACCOUNT"\)'}
 observed={k:re.search(p,source)[1]for k,p in patterns.items()}
 assert record['observedConstants']==observed,'PARAMETER_DRIFT'
 expected=re.findall(r'^## (C-\d{3})\s*$',conflicts,re.M)
 assert len(expected)==16 and [x['id']for x in record['decisions']]==expected,'DECISION_COVERAGE'
 for d in record['decisions']:
  assert d['status']=='UNRESOLVED'and d['acceptanceEvidence']==[],'UNSUPPORTED_ADOPTION'
  section=conflicts.split('## '+d['id'],1)[1].split('\n## ',1)[0]
  assert d['sourceSectionSha256']==hashlib.sha256(section.encode()).hexdigest(),'DECISION_SOURCE'
 return {'observations':len(observed),'unresolvedDecisions':len(expected),'adoptionVerified':False,'productionAccepted':False}
if __name__=='__main__':
 print(json.dumps(validate(json.loads(Path(sys.argv[1]).read_text()),json.loads(Path(sys.argv[2]).read_text()),Path(sys.argv[3]).read_text())))
