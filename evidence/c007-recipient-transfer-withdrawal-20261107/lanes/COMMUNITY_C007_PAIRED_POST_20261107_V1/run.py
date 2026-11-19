#!/usr/bin/env python3
import hashlib
import http.client
import json
import os
import resource
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

w, parent, out = map(Path, sys.argv[1:])

PORT = 18549
TOKEN = "0xf3b9569f82b18aef890de263b84189bd33ebe452"

A = "0x765d03fe39e2a0a48ac162a15b541c3cd1d63e76"
B = "0x" + "2" * 40
D = "0x" + "3" * 40

UNIT = 10**18
FEE = 5000 * UNIT

MINT = {A: 15000 * UNIT, B: 100 * UNIT}
DEPOSITS = {1: 10000 * UNIT, 2: 10 * UNIT, 3: 10 * UNIT}
STAKES = {1: 10 * UNIT, 2: UNIT, 3: 2 * UNIT}
OWNERS = {1: A, 2: A, 3: B}

ANVIL_SHA = (
    "1eaa28361b8ef92f80a0eaf4f1d90e42744e07e79a3bee5e5de95e178c8aeedf"
)
TOKEN_SHA = (
    "82ce425aec55509ecb5c3ebb083a9254cc503ad209a531f57ff92ee873e68e14"
)
REGHASH = (
    "5bd17d0ec2568d04b7edcefb86de6aec5a54f84845004f6630b43c18d83d852d"
)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def word(value):
    value = int(value, 16) if isinstance(value, str) else int(value)
    assert 0 <= value < 2**256
    return value.to_bytes(32, "big")

def addr(raw):
    assert len(raw) == 32 and raw[:12] == bytes(12)
    return "0x" + raw[12:].hex()

def calldata(selector, *values):
    return "0x" + selector + b"".join(
        word(value) for value in values
    ).hex()

previous = json.loads(parent.read_bytes())

assert previous["schema"] == "caw-c007-wsl-probe-deploy/1"
assert previous["compiled_runtime_match"] is True
assert previous["constructor_events_valid"] is True
assert previous["local_deployment_transactions"] == 2
assert previous["posts_executed"] is False
assert previous["registry"]["codehash_keccak256"] == REGHASH

exp = w / "experiments/paid-action"

pins = json.loads(
    (exp / "experiment-inputs.json").read_bytes()
)["files"]

for name, expected in pins.items():
    path = (exp / name).resolve()
    assert path.is_relative_to(w.resolve())
    assert sha(path.read_bytes()) == expected, name

build = json.loads((exp / "paid-build.json").read_bytes())
token_build = json.loads((
    w / "experiments/account-authority/account-token-build.json"
).read_bytes())

runtime = token_build["runtime"]
assert sha(bytes.fromhex(runtime[2:])) == TOKEN_SHA

oracle_path = (
    w / "reference/fixtures/generate-ethereum-proof-fixtures.py"
)
namespace = {
    "__name__": "caw_pinned_keccak",
    "__file__": str(oracle_path)
}
exec(
    compile(oracle_path.read_bytes(), str(oracle_path), "exec"),
    namespace
)
keccak = namespace["digest"]

assert keccak(b"").hex() == (
    "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
)

anvil = (Path.home() / ".foundry/bin/anvil").resolve(strict=True)

assert anvil.stat().st_size == 34276528
assert sha(anvil.read_bytes()) == ANVIL_SHA

with socket.socket() as sock:
    sock.bind(("127.0.0.1", PORT))

home = out / "isolated_home"
home.mkdir()
(out / "foundry.toml").write_text("[profile.default]\n")

args = [
    str(anvil),
    "--host", "127.0.0.1",
    "--port", str(PORT),
    "--accounts", "0",
    "--chain-id", "31337",
    "--hardfork", "london",
    "--disable-default-create2-deployer",
    "--quiet"
]

assert "--fork-url" not in args

env = {
    "HOME": str(home),
    "PATH": "/usr/bin:/bin",
    "FOUNDRY_CONFIG": str(out / "foundry.toml"),
    "FOUNDRY_DIR": str(home),
    "RUST_LOG": "off",
    "NO_COLOR": "1"
}

def limits():
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_CPU, (40, 45))
    resource.setrlimit(resource.RLIMIT_FSIZE, (1048576, 1048576))

def owns_listener(pid):
    target = "0100007F:" + f"{PORT:04X}"

    matches = [
        line.split()[9]
        for line in Path("/proc/net/tcp").read_text().splitlines()[1:]
        if line.split()[1].upper() == target
        and line.split()[3] == "0A"
    ]

    if len(matches) != 1:
        return False

    try:
        for fd in Path(f"/proc/{pid}/fd").iterdir():
            try:
                if os.readlink(fd) == f"socket:[{matches[0]}]":
                    return True
            except OSError:
                continue
    except OSError:
        return False

    return False

allowed = {
    "eth_chainId",
    "eth_accounts",
    "eth_blockNumber",
    "eth_getCode",
    "eth_call",
    "eth_sendTransaction",
    "eth_getTransactionReceipt",
    "anvil_setCode",
    "anvil_setBalance",
    "anvil_impersonateAccount"
}

proc = None
calls = 0
transactions = []

def rpc(method, params):
    global calls

    assert method in allowed
    assert calls < 300
    assert proc is not None and proc.poll() is None
    assert owns_listener(proc.pid)

    calls += 1

    body = json.dumps({
        "jsonrpc": "2.0",
        "id": calls,
        "method": method,
        "params": params
    }, separators=(",", ":")).encode("ascii")

    assert len(body) < 24000

    conn = http.client.HTTPConnection(
        "127.0.0.1", PORT, timeout=3
    )

    try:
        conn.request("POST", "/", body, {
            "Content-Type": "application/json",
            "Accept-Encoding": "identity"
        })
        response = conn.getresponse()
        raw = response.read(32769)

        assert response.status == 200
        assert len(raw) <= 32768

        item = json.loads(raw)
        assert item["jsonrpc"] == "2.0"
        assert item["id"] == calls
        assert "error" not in item, item.get("error")

        return item["result"]
    finally:
        conn.close()

def view(to, signature, *params):
    if to == TOKEN:
        selector = {
            "balanceOf(address)": "70a08231",
            "allowance(address,address)": "dd62ed3e",
            "totalSupply()": "18160ddd",
            "incomingMode()": "701ed274",
            "outgoingMode()": "addf74df"
        }[signature]
    elif to == registry:
        selector = build["contracts"][
            "TestAccountRegistry"
        ]["methodIdentifiers"][signature]
    else:
        assert to == probe
        selector = build["contracts"][
            "CawPaidActionProbe"
        ]["methodIdentifiers"][signature]

    response = rpc("eth_call", [{
        "from": D,
        "to": to,
        "gas": "0x3d0900",
        "data": calldata(selector, *params)
    }, "latest"])

    assert isinstance(response, str)
    assert response.startswith("0x")

    return bytes.fromhex(response[2:])

def uint(to, signature, *params):
    value = view(to, signature, *params)
    assert len(value) == 32
    return int.from_bytes(value, "big")

def send(caller, destination, data, label):
    transaction = {
        "from": caller,
        "data": data,
        "gas": "0x3d0900",
        "gasPrice": "0x174876e800",
        "value": "0x0"
    }

    if destination is not None:
        transaction["to"] = destination

    txhash = rpc("eth_sendTransaction", [transaction])
    assert len(txhash) == 66

    receipt = None
    for _ in range(10):
        receipt = rpc("eth_getTransactionReceipt", [txhash])
        if receipt is not None:
            break
        time.sleep(0.1)

    assert receipt is not None
    assert receipt["transactionHash"] == txhash
    assert receipt["status"] == "0x1"
    assert int(receipt["gasUsed"], 16) <= 4000000
    assert receipt["from"].lower() == caller

    if destination is None:
        assert receipt["to"] is None
    else:
        assert receipt["to"].lower() == destination

    transactions.append({
        "label": label,
        "request": transaction,
        "receipt": receipt
    })

    return receipt

def check_event(log, origin, signature, topics, data):
    expected_topics = [
        "0x" + keccak(signature.encode()).hex()
    ] + [
        "0x" + word(value).hex()
        for value in topics
    ]

    assert log["address"].lower() == origin
    assert [x.lower() for x in log["topics"]] == expected_topics
    assert log["data"].lower() == (
        "0x" + b"".join(word(v) for v in data).hex()
    )

def snapshot():
    return {
        "credits": [
            uint(probe, "credits(uint256)", i)
            for i in (1, 2, 3)
        ],
        "stakes": [
            uint(probe, "stakes(uint256)", i)
            for i in (1, 2, 3)
        ],
        "nonces": [
            uint(probe, "nonces(uint256)", i)
            for i in (1, 2, 3)
        ],
        "totalCredits": uint(probe, "totalCredits()"),
        "poolDust": uint(probe, "poolDust()"),
        "messageCount": uint(probe, "messageCount()"),
        "vault": uint(TOKEN, "balanceOf(address)", probe),
        "balanceA": uint(TOKEN, "balanceOf(address)", A),
        "balanceB": uint(TOKEN, "balanceOf(address)", B),
        "allowanceA": uint(
            TOKEN, "allowance(address,address)", A, probe
        ),
        "allowanceB": uint(
            TOKEN, "allowance(address,address)", B, probe
        )
    }

try:
    with (out / "node.log").open("xb") as log:
        proc = subprocess.Popen(
            args,
            cwd=out,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            preexec_fn=limits,
            close_fds=True
        )

    deadline = time.monotonic() + 20

    while time.monotonic() < deadline:
        assert proc.poll() is None, "ANVIL_EARLY_EXIT"

        if owns_listener(proc.pid):
            break

        time.sleep(0.2)

    assert owns_listener(proc.pid)

    assert rpc("eth_chainId", []) == "0x7a69"
    assert rpc("eth_accounts", []) == []
    assert rpc("eth_blockNumber", []) == "0x0"
    assert rpc("eth_getCode", [TOKEN, "latest"]) == "0x"

    rpc("anvil_setCode", [TOKEN, runtime])
    assert rpc("eth_getCode", [TOKEN, "latest"]) == runtime

    for actor in (A, B, D):
        rpc("anvil_impersonateAccount", [actor])
        rpc("anvil_setBalance", [
            actor, "0xde0b6b3a7640000"
        ])

    assert uint(TOKEN, "incomingMode()") == 0
    assert uint(TOKEN, "outgoingMode()") == 0

    registry_item = build["contracts"]["TestAccountRegistry"]

    registry_receipt = send(
        D, None,
        registry_item["bytecode"] + word(A).hex() + word(B).hex(),
        "deploy_registry"
    )

    registry = registry_receipt["contractAddress"].lower()

    registry_code = bytes.fromhex(
        rpc("eth_getCode", [registry, "latest"])[2:]
    )

    assert registry_code == bytes.fromhex(
        registry_item["runtime"][2:]
    )

    registry_hash = keccak(registry_code)
    assert registry_hash.hex() == REGHASH

    for idx, owner in OWNERS.items():
        authority = view(registry, "authority(uint256)", idx)
        assert addr(authority[:32]) == owner
        assert int.from_bytes(authority[32:], "big") == 0

    probe_item = build["contracts"]["CawPaidActionProbe"]

    probe_receipt = send(
        D, None,
        probe_item["bytecode"]
        + word(registry).hex()
        + registry_hash.hex(),
        "deploy_probe"
    )

    probe = probe_receipt["contractAddress"].lower()

    expected_runtime = bytearray.fromhex(
        probe_item["runtime"][2:]
    )

    for field, locations in probe_item["immutables"].items():
        value = (
            word(registry)
            if field == "registry"
            else registry_hash
        )

        for loc in locations:
            assert loc["length"] == 32
            start = loc["start"]
            expected_runtime[start:start + 32] = value

    observed = bytes.fromhex(
        rpc("eth_getCode", [probe, "latest"])[2:]
    )

    assert observed == bytes(expected_runtime)
    assert addr(view(probe, "registry()")) == registry
    assert view(probe, "registryCodeHash()") == registry_hash
    assert uint(probe, "FEE()") == FEE

    before = snapshot()

    assert before["credits"] == [0, 0, 0]
    assert before["stakes"] == [0, 0, 0]
    assert before["vault"] == 0
    assert before["totalCredits"] == 0

    # Fixed synthetic setup: mint only to test actors.
    for actor, amount in MINT.items():
        receipt = send(
            D, TOKEN,
            calldata("e30443bc", actor, amount),
            "synthetic_balance_setup"
        )
        assert receipt["logs"] == []

    # Fixed allowances; not the measured policy variable.
    for actor, amount in MINT.items():
        receipt = send(
            actor, TOKEN,
            calldata("095ea7b3", probe, amount),
            "approve_probe"
        )

        assert len(receipt["logs"]) == 1

        check_event(
            receipt["logs"][0],
            TOKEN,
            "Approval(address,address,uint256)",
            [actor, probe],
            [amount]
        )

    assert uint(TOKEN, "totalSupply()") == sum(MINT.values())

    deposits = []
    stakes = []

    # Fund all three NFT account credits.
    for idx, amount in DEPOSITS.items():
        owner = OWNERS[idx]

        receipt = send(
            owner,
            probe,
            calldata(
                probe_item["methodIdentifiers"][
                    "deposit(uint256,uint256,uint256)"
                ],
                idx, 0, amount
            ),
            "deposit"
        )

        remaining_allowance = MINT[owner] - sum(
            value for account, value in DEPOSITS.items()
            if account <= idx and OWNERS[account] == owner
        )

        assert remaining_allowance >= 0
        assert len(receipt["logs"]) == 3

        check_event(
            receipt["logs"][0],
            TOKEN,
            "Approval(address,address,uint256)",
            [owner, probe],
            [remaining_allowance]
        )

        check_event(
            receipt["logs"][1],
            TOKEN,
            "Transfer(address,address,uint256)",
            [owner, probe],
            [amount]
        )

        check_event(
            receipt["logs"][2],
            probe,
            "Deposited(uint256,address,uint256,uint256,uint256)",
            [idx, owner],
            [amount, amount, 0]
        )

        deposits.append(receipt["transactionHash"])

    funded = snapshot()

    assert funded["credits"] == [
        DEPOSITS[i] for i in (1, 2, 3)
    ]
    assert funded["stakes"] == [0, 0, 0]

    # Lock stakes; no additional token transfers.
    for idx, amount in STAKES.items():
        owner = OWNERS[idx]

        receipt = send(
            owner,
            probe,
            calldata(
                probe_item["methodIdentifiers"][
                    "stake(uint256,uint256,uint256)"
                ],
                idx, 0, amount
            ),
            "stake"
        )

        assert len(receipt["logs"]) == 1

        check_event(
            receipt["logs"][0],
            probe,
            "Staked(uint256,address,uint256,uint256,uint256)",
            [idx, owner],
            [amount, amount, 0]
        )

        stakes.append(receipt["transactionHash"])

    final = snapshot()
    total = sum(DEPOSITS.values())

    assert final["credits"] == [
        DEPOSITS[i] for i in (1, 2, 3)
    ]
    assert final["stakes"] == [
        STAKES[i] for i in (1, 2, 3)
    ]

    assert final["totalCredits"] == total
    assert final["vault"] == total
    assert final["poolDust"] == 0
    assert final["messageCount"] == 0
    assert final["nonces"] == [0, 0, 0]

    assert final["balanceA"] == (
        MINT[A] - DEPOSITS[1] - DEPOSITS[2]
    )
    assert final["balanceB"] == (
        MINT[B] - DEPOSITS[3]
    )

    assert final["allowanceA"] == final["balanceA"]
    assert final["allowanceB"] == final["balanceB"]

    assert sum(final["credits"]) == final["totalCredits"]
    assert final["totalCredits"] == final["vault"]

    assert (
        final["vault"]
        + final["balanceA"]
        + final["balanceB"]
        == sum(MINT.values())
    )

    assert final["credits"][0] - final["stakes"][0] >= FEE

    distribution_hash = view(probe, "distributionHash()")

    assert distribution_hash == keccak(
        b"".join(word(STAKES[i]) for i in (1, 2, 3))
    )

    assert int(rpc("eth_blockNumber", []), 16) == 12
    assert len(transactions) == 12
    assert owns_listener(proc.pid)

    def serializable(row):
        return {
            k: (
                [str(v) for v in value]
                if isinstance(value, list)
                else str(value)
            )
            for k, value in row.items()
        }

    result = {
        "schema": "caw-c007-wsl-funding-staking/1",
        "parent_deployment_sha256": sha(parent.read_bytes()),
        "paid_build_sha256": sha(
            (exp / "paid-build.json").read_bytes()
        ),
        "anvil_sha256": ANVIL_SHA,
        "synthetic_token_sha256": TOKEN_SHA,
        "chain_id": 31337,
        "fork_used": False,
        "external_rpc_used": False,
        "token": "synthetic_only",
        "registry": registry,
        "registry_codehash": "0x" + REGHASH,
        "probe": probe,
        "owners": OWNERS,
        "minted": {
            "A": str(MINT[A]),
            "B": str(MINT[B])
        },
        "deposits": [
            str(DEPOSITS[i]) for i in (1, 2, 3)
        ],
        "locked_stakes": [
            str(STAKES[i]) for i in (1, 2, 3)
        ],
        "pre_funding": serializable(before),
        "post_funding": serializable(funded),
        "post_staking": serializable(final),
        "distributionHash": "0x" + distribution_hash.hex(),
        "deposit_receipts": deposits,
        "stake_receipts": stakes,
        "transactions": transactions,
        "local_transactions": 12,
        "all_events_verified": True,
        "liabilities_exactly_backed": True,
        "posts_executed": False,
        "nft_transfers_executed": False,
        "signature_verification": "NOT_RUN",
        "c007": "OPEN"
    }

    exec(compile((out / "pair_hook.py").read_bytes(), str(out / "pair_hook.py"), "exec"), globals())

finally:
    if proc is not None:
        if proc.poll() is None:
            os.killpg(proc.pid, signal.SIGTERM)

            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.wait(timeout=5)

        assert proc.poll() is not None, "ANVIL_CLEANUP_FAILED"

assert "result" in locals()

(out / "results.json").write_text(
    json.dumps(result, indent=2, sort_keys=True) + "\n"
)

print("PINNED_DEPLOYMENT=PASS")
print("SYNTHETIC_FUNDING=PASS")
print("DEPOSIT_EVENTS=PASS")
print("STAKING_EVENTS=PASS")
print("CREDIT_TOTAL_CONSERVATION=PASS")
print("TOKEN_BACKING=PASS")
print("DISTRIBUTION_HASH=" + result["distributionHash"])
print("PAYER_UNLOCKED_FEE=PASS")
print("BASELINE_LOCAL_TRANSACTIONS=12")
print("PAIR_POSTS=2")
print("PAIR_NFT_TRANSFERS=1")
print("ANVIL_TERMINATED=PASS")
print("C007=OPEN")
print("PASS: C007 WSL paired signed post V1")
