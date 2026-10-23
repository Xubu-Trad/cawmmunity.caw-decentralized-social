"""Transport-free boundary checks for the additional read-only proof scope."""
import importlib.util,unittest
from pathlib import Path
from types import SimpleNamespace
spec=importlib.util.spec_from_file_location('state_scope_test',Path(__file__).with_name('state_node.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
KEYS=['0x'+f'{i:064x}' for i in range(4)]
class Scope(unittest.TestCase):
 def node(self):
  n=object.__new__(m.SignedNode);n.phase='read-left';n.generation=4;n._lease_active=False;n._body_active=False
  n._proof_permission=None;n._scope=SimpleNamespace(read_config={'addresses':{'registry':'0x'+'11'*20},'end_block_number':12})
  return n
 def test_direct_request_refused(self):
  n=self.node()
  with self.assertRaisesRegex(RuntimeError,'STATE_READ_SCOPE'):n._params('eth_getProof',[])
 def test_one_request_consumes_scope(self):
  n=self.node();calls=[]
  def rpc(label,method,params):
   n._params(method,params);calls.append(params)
   with self.assertRaisesRegex(RuntimeError,'STATE_READ_SCOPE'):n._params(method,params)
   return {'observed':True}
  n.rpc=rpc;self.assertEqual(n.endpoint_proof(KEYS),{'observed':True});self.assertEqual(len(calls),1);self.assertIsNone(n._proof_permission)
 def test_mutated_parameters_refused_and_cleared(self):
  for index,value in [(0,'0x'+'22'*20),(1,list(reversed(KEYS))),(2,'0xd')]:
   n=self.node()
   def rpc(label,method,params):
    params[index]=value;n._params(method,params)
   n.rpc=rpc
   with self.assertRaisesRegex(RuntimeError,'STATE_READ_SCOPE'):n.endpoint_proof(KEYS)
   self.assertIsNone(n._proof_permission)
 def test_retired_generation_refused(self):
  n=self.node()
  def rpc(label,method,params):n.generation+=1;n._params(method,params)
  n.rpc=rpc
  with self.assertRaisesRegex(RuntimeError,'STATE_READ_SCOPE'):n.endpoint_proof(KEYS)
  self.assertIsNone(n._proof_permission)
 def test_wrong_phase_nested_scope_and_keys_refused(self):
  for field,value in [('phase','write-left'),('_lease_active',True),('_body_active',True)]:
   n=self.node();setattr(n,field,value)
   with self.assertRaisesRegex(RuntimeError,'STATE_READ_SCOPE'):n.endpoint_proof(KEYS)
  for keys in [KEYS[:3],[KEYS[0]]*4,KEYS[:3]+['0x1']]:
   with self.assertRaisesRegex(RuntimeError,'STATE_KEYS'):self.node().endpoint_proof(keys)
 def test_transport_failure_clears_scope(self):
  n=self.node()
  def rpc(*args):raise RuntimeError('transport-failure')
  n.rpc=rpc
  with self.assertRaisesRegex(RuntimeError,'transport-failure'):n.endpoint_proof(KEYS)
  self.assertIsNone(n._proof_permission)
if __name__=='__main__':unittest.main()
