"""Extend the pinned mode experiment with two mined fixture post attempts.

Writer-supplied raw envelopes are retained, not independently acquired bodies.
No new transport permission, wallet policy or production authority is added.
"""
from pathlib import Path
import hashlib,copy

def mined(writer,result,label,calldata,accepted):
 if label=='valid':return
 before=writer.state(label+'.mined_before');parent=writer.header(label+'.parent')
 row=writer.send(label+'.mined',writer.base_actor,writer.probe,calldata,
  success=accepted,error=None if accepted else 'InvalidSignature()')
 end=writer.header(label+'.mined_end');after=writer.state(label+'.mined_after')
 assert end['parentHash']==parent['hash'],'MINED_PARENT'
 assert end['transactions']==[row['receipt']['transactionHash']],'SINGLE_TRANSACTION'
 if not accepted:assert before==after,'REJECTED_ACCOUNTING'
 else:
  assert int(after['nonces'][0])==int(before['nonces'][0])+1,'POST_NONCE'
  assert int(after['messageCount'])==int(before['messageCount'])+1,'POST_MESSAGE'
 result.setdefault('mined',[]).append({'label':label,'parent':parent,'header':end,
  'before':before,'after':after,'row':copy.deepcopy(row),'submission':copy.deepcopy(writer.signed_submissions[-1])})

if __name__=='__main__':
 path=Path(__file__).resolve().parent/'run_wallet_state.py';raw=path.read_bytes()
 assert hashlib.sha256(raw).hexdigest()=='b53b902e949b40d9e7e0502d544f9364d2c2c4370ba38464801090df941c3907','RUNNER_PIN'
 text=raw.decode()
 old="            result['submissions'] = copy.deepcopy(writer.signed_submissions)"
 new="                writer.base_actor=A\n                mined(writer,result,label,calldata,accepted)\n"+old
 assert text.count(old)==1,'TRANSFORM_COUNT';text=text.replace(old,new)
 exec(compile(text,str(path)+'[mined-post-extension]','exec'),{'__name__':'__main__','__file__':str(path),'mined':mined})
