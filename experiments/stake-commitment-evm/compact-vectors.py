"""Derive compact proof vectors/default table from the pinned research kernel."""
import importlib.util, json, sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('kernel', Path(sys.argv[1]))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
trees = []
small = m.Tree(bytes(range(32)))
for k, s in [(0, 0), (1, 7), (2**255, 11), (2**256-1, 13)]:
    small.set_account(k, s)
trees += [(small, k, 'sparse') for k in [0, 1, 2**255, 2**256-1, 2]]
dense = m.Tree(bytes(range(32)))
dense.set_account(0, 0)
for height in range(256):
    dense.set_account(1 << height, 1)
trees.append((dense, 0, 'all_nondefault'))
empty = m.Tree(bytes(range(32)))
trees.append((empty, 0, 'all_default'))
cases = []
for tree, key, label in trees:
    present, stake, proof = tree.proof(key)
    assert m.verify(tree.namespace, tree.root, tree.total, key, stake, present, proof)
    header = [tree.namespace.hex(), tree.root.hex()] + [m.number(n).hex() for n in
              [tree.total, key, stake, int(present)]]
    pairs = [[h.hex(), m.number(s).hex()] for h, s in proof]
    heights = [h for h in range(256) if proof[h] != m.EMPTY[h]]
    cases.append({'label':label+'_'+str(key), 'header':header, 'siblings':pairs,
                  'bitmap':str(sum(1 << h for h in heights)),
                  'compact':[pairs[h] for h in heights]})
print(json.dumps({'schema':'caw-compact-stake-vectors/1',
                  'defaults':[h.hex() for h,s in m.EMPTY[:256]], 'cases':cases},indent=2))
