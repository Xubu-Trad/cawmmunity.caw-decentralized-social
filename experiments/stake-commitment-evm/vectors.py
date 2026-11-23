"""Derive deterministic cross-language cases from the retained Python kernel."""
import importlib.util, json, sys
from pathlib import Path

source = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location('stake_kernel', source)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
tree = m.Tree(bytes(range(32)))
for key, stake in [(0, 0), (1, 7), (2**255, 11), (2**256-1, 13)]:
    tree.set_account(key, stake)
cases = []
for key in [0, 1, 2**255, 2**256-1, 2]:
    present, stake, siblings = tree.proof(key)
    assert m.verify(tree.namespace, tree.root, tree.total, key, stake, present, siblings)
    words = [tree.namespace.hex(), tree.root.hex()] + [m.number(x).hex() for x in
             [tree.total, key, stake, int(present)]]
    for h, weight in siblings:
        words += [h.hex(), m.number(weight).hex()]
    cases.append({'account':str(key), 'present':present, 'words':words})
print(json.dumps({'schema':'caw-stake-evm-vectors/1','cases':cases},indent=2))
