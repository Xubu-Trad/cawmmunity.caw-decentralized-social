"""Fixed-depth SHA-256 stake commitment research; no authority or settlement.

All account insertions/updates are trusted caller inputs. A root is a byte
commitment, not an authenticated registry, accepted profile or signature scheme.
"""
import hashlib

DEPTH = 256
MAX = 2**256 - 1
FORMAT = b'CAW_STAKE_TREE_RESEARCH_V1\0'


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def number(value):
    require(type(value) is int and 0 <= value <= MAX, 'UINT256')
    return value.to_bytes(32, 'big')


def digest(value):
    return hashlib.sha256(value).digest()


def leaf(account, stake, present):
    key = number(account)
    weight = number(stake)
    require(type(present) is bool, 'PRESENCE')
    require(present or stake == 0, 'ABSENT_STAKE')
    return (digest(b'\x01'+key+weight), stake) if present else (digest(b'\x00'), 0)


def branch(left, right):
    for h, weight in (left, right):
        require(type(h) is bytes and len(h) == 32, 'HASH')
        number(weight)
    total = left[1]+right[1]
    number(total)
    return (digest(b'\x02'+left[0]+number(left[1])+right[0]+number(right[1])), total)


EMPTY = [leaf(0, 0, False)]
for _ in range(DEPTH):
    EMPTY.append(branch(EMPTY[-1], EMPTY[-1]))
EMPTY = tuple(EMPTY)


def envelope(namespace, node):
    require(type(namespace) is bytes and len(namespace) == 32, 'NAMESPACE')
    require(type(node[0]) is bytes and len(node[0]) == 32, 'HASH')
    return digest(FORMAT+namespace+node[0]+number(node[1]))


class Tree:
    """At most 256 sibling reads + 257 staged node writes per set_account.

    Dict lookup cost/storage overhead is Python-dependent; counts are logical
    operations, not measured EVM gas. Memory grows with accounts and path nodes.
    No global state copy or recipient iteration occurs in set_account/proof.
    """
    def __init__(self, namespace):
        envelope(namespace, EMPTY[DEPTH])
        self.namespace = namespace
        self.nodes = {}
        self.accounts = {}
        self.last_update = None

    def node(self, height, index):
        return self.nodes.get((height, index), EMPTY[height])

    @property
    def total(self):
        return self.node(DEPTH, 0)[1]

    @property
    def root(self):
        return envelope(self.namespace, self.node(DEPTH, 0))

    def set_account(self, account, stake):
        current = leaf(account, stake, True)
        index = account
        staged = [(0, index, current)]
        for height in range(DEPTH):
            sibling = self.node(height, index ^ 1)
            current = branch(sibling, current) if index & 1 else branch(current, sibling)
            index >>= 1
            staged.append((height+1, index, current))
        # Every input/range check precedes mutation, including total overflow.
        for height, index, value in staged:
            self.nodes[(height, index)] = value
        self.accounts[account] = stake
        self.last_update = {'siblingReads': DEPTH, 'nodeWrites': DEPTH+1,
                            'leafHashes': 1, 'branchHashes': DEPTH}

    def proof(self, account):
        number(account)
        index = account
        siblings = []
        for height in range(DEPTH):
            siblings.append(self.node(height, index ^ 1))
            index >>= 1
        return account in self.accounts, self.accounts.get(account, 0), tuple(siblings)


def verify(namespace, expected_root, expected_total, account, stake, present, siblings):
    """Verify only byte equality to an explicitly supplied root/total/namespace.

    A successful absence proof is not account admission. Consumers must separately
    require presence and authenticate the root. No default trusted root exists.
    """
    require(type(expected_root) is bytes and len(expected_root) == 32, 'ROOT')
    number(expected_total)
    require(type(siblings) is tuple and len(siblings) == DEPTH, 'PROOF_DEPTH')
    current = leaf(account, stake, present)
    index = account
    for sibling in siblings:
        require(type(sibling) is tuple and len(sibling) == 2, 'PROOF_NODE')
        current = branch(sibling, current) if index & 1 else branch(current, sibling)
        index >>= 1
    require(current[1] == expected_total, 'TOTAL_MISMATCH')
    require(envelope(namespace, current) == expected_root, 'ROOT_MISMATCH')
    return True
