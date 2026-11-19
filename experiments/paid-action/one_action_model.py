"""Proposed account-entitlement transition oracle; not Solidity or authentication.

Caller/authorized_owner labels are trusted test inputs, not verified signatures.
States are copied and recipients enumerated: O(accounts), not scalable settlement.
Existing accounts and synthetic wallet balances are supplied by the test fixture.
"""
from copy import deepcopy
from dataclasses import dataclass

MAX = 2**256 - 1
FEE = 5000 * 10**18


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def uint(value):
    require(type(value) is int and 0 <= value <= MAX, 'UINT256')
    return value


@dataclass
class Account:
    owner: str
    epoch: int = 0
    credit: int = 0
    stake: int = 0
    nonce: int = 0


@dataclass
class State:
    accounts: dict
    wallets: dict
    vault: int = 0
    dust: int = 0
    messages: int = 0


@dataclass(frozen=True)
class Intent:
    account: int
    epoch: int
    nonce: int
    valid_after: int
    deadline: int
    stakes: tuple
    text: bytes


def validate(state):
    require(bool(state.accounts), 'ACCOUNTS')
    for key, a in state.accounts.items():
        require(type(key) is int and key > 0, 'ACCOUNT_ID')
        require(type(a.owner) is str and bool(a.owner), 'OWNER')
        for value in (a.epoch, a.credit, a.stake, a.nonce):
            uint(value)
        require(a.stake <= a.credit, 'LOCKED_CREDIT')
    for owner, value in state.wallets.items():
        require(type(owner) is str and bool(owner), 'WALLET')
        uint(value)
    for value in (state.vault, state.dust, state.messages):
        uint(value)
    require(state.vault == sum(a.credit for a in state.accounts.values()) + state.dust,
            'CONSERVATION')


def stake_state(state):
    """Exact tuple oracle, NOT a hash, serialization or signed commitment design."""
    return tuple((i, a.stake) for i, a in sorted(state.accounts.items()))


def authority(state, account, owner, epoch):
    require(type(account) is int and account in state.accounts, 'ACCOUNT')
    a = state.accounts[account]
    uint(epoch)
    require(a.owner == owner, 'OWNER')
    require(a.epoch == epoch, 'EPOCH')
    return a


def direct(state, operation, account, caller, epoch, amount=None, new_owner=None):
    """Return next state; rejected and successful calls leave input untouched.

    Synthetic transfers debit/credit wallet labels without calling a token. Registry
    transfer is also a trusted modeled operation, not an ERC-721 implementation.
    """
    validate(state)
    out = deepcopy(state)
    a = authority(out, account, caller, epoch)
    if operation == 'transfer':
        require(type(new_owner) is str and bool(new_owner), 'OWNER')
        a.epoch = uint(a.epoch + 1)
        a.owner = new_owner
    elif operation == 'cancel':
        uint(amount)
        require(amount > a.nonce, 'NONCE_ADVANCE')
        a.nonce = amount
    else:
        uint(amount)
        require(amount > 0, 'AMOUNT')
        if operation == 'deposit':
            require(out.wallets.get(caller, 0) >= amount, 'WALLET_FUNDS')
            out.wallets[caller] -= amount
            out.vault = uint(out.vault + amount)
            a.credit = uint(a.credit + amount)
        elif operation == 'withdraw':
            require(a.credit - a.stake >= amount, 'AVAILABLE_CREDIT')
            a.credit -= amount
            out.vault -= amount
            out.wallets[caller] = uint(out.wallets.get(caller, 0) + amount)
        elif operation == 'stake':
            require(a.credit - a.stake >= amount, 'AVAILABLE_CREDIT')
            a.stake = uint(a.stake + amount)
        elif operation == 'unstake':
            require(a.stake >= amount, 'STAKE')
            a.stake -= amount
        else:
            raise ValueError('OPERATION')
    validate(out)
    return out


def post(state, intent, authorized_owner, now):
    """Apply a supplied owner authorization label; no signature/domain verification.

    The multiplication uses Python's exact integers. This is a mathematical payout
    oracle, not a proof that a Solidity intermediate fits uint256.
    """
    validate(state)
    a = authority(state, intent.account, authorized_owner, intent.epoch)
    for value in (intent.nonce, intent.valid_after, intent.deadline, now):
        uint(value)
    require(a.nonce == intent.nonce, 'NONCE')
    require(intent.valid_after < intent.deadline and
            intent.valid_after <= now < intent.deadline, 'WINDOW')
    require(intent.stakes == stake_state(state), 'STAKE_STATE')
    require(type(intent.text) is bytes and 0 < len(intent.text) <= 1680, 'TEXT')
    try:
        text = intent.text.decode('utf-8', errors='strict')
    except UnicodeDecodeError:
        raise ValueError('TEXT') from None
    require(len(text) <= 420, 'TEXT')
    require(a.credit - a.stake >= FEE, 'AVAILABLE_CREDIT')
    eligible = sum(x.stake for i, x in state.accounts.items() if i != intent.account)
    require(eligible > 0, 'NO_ELIGIBLE_STAKE')
    allocations = {i: FEE * x.stake // eligible if i != intent.account else 0
                   for i, x in state.accounts.items()}
    dust = FEE - sum(allocations.values())
    out = deepcopy(state)
    out.accounts[intent.account].credit -= FEE
    out.accounts[intent.account].nonce = uint(a.nonce + 1)
    out.messages = uint(out.messages + 1)
    for i, amount in allocations.items():
        out.accounts[i].credit = uint(out.accounts[i].credit + amount)
    out.dust = uint(out.dust + dust)
    validate(out)
    return out, {'allocations': allocations, 'dust': dust, 'text': intent.text}
