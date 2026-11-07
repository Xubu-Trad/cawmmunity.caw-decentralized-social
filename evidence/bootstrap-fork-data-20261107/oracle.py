#!/usr/bin/env python3
import hashlib
import re
from pathlib import Path

D = Path("evidence/consensus-capella-bootstrap")

EXPECTED = {
    "config.yaml": "4a8e4e5d0fd4961b87ea5d1ff8ce3a28240ab6e2184eea754acccf50131f4a1a",
    "meta.yaml": "bcff01d2477f557370c2013028934f90e1b0ae8bcd2f4833adcbb509119dbc29",
}

def read_checked(name):
    data = (D / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != EXPECTED[name]:
        raise ValueError("SOURCE_HASH_MISMATCH")
    return data.decode("ascii")

config = read_checked("config.yaml")
meta = read_checked("meta.yaml")

def field(text, pattern):
    matches = re.findall(pattern, text, re.M)
    if len(matches) != 1:
        raise ValueError("FIELD_SCHEMA")
    return matches[0]

def verify(c, m):
    if len(m.splitlines()) != 4 or not m.endswith("\n"):
        raise ValueError("METADATA_SCHEMA")

    if "PRESET_BASE: 'minimal'\n" not in c:
        raise ValueError("UNSUPPORTED_PRESET")

    field(c, r"^CAPELLA_FORK_EPOCH: (0)$")

    version = field(
        c, r"^CAPELLA_FORK_VERSION: (0x[0-9a-f]{8})$"
    )
    genesis = field(
        m, r"^genesis_validators_root: '(0x[0-9a-f]{64})'$"
    )
    field(
        m, r"^trusted_block_root: '(0x[0-9a-f]{64})'$"
    )
    bootstrap = field(
        m, r"^bootstrap_fork_digest: '(0x[0-9a-f]{8})'$"
    )
    store = field(
        m, r"^store_fork_digest: '(0x[0-9a-f]{8})'$"
    )

    root = hashlib.sha256(
        bytes.fromhex(version[2:])
        + bytes(28)
        + bytes.fromhex(genesis[2:])
    ).digest()

    digest = "0x" + root[:4].hex()

    if bootstrap != digest or store != digest:
        raise ValueError("FORK_DIGEST_MISMATCH")

    return root.hex(), digest

root, digest = verify(config, meta)

expected_root = (
    "856842be987cb7f12d34e84282045bdf"
    "06fb0c6a88889e41b889ca90dd583c92"
)

if root != expected_root or digest != "0x856842be":
    raise SystemExit("STOP: official fixture mismatch")

print("PASS 1: pinned fixture")

cases = [
    (
        "changed fork version",
        config.replace(
            "CAPELLA_FORK_VERSION: 0x03000001",
            "CAPELLA_FORK_VERSION: 0x03000002", 1
        ), meta
    ),
    (
        "changed genesis root",
        config,
        meta.replace(
            "0x0a08c27fe4ece2483f9e581f78c66379a06f96e9c24cd1390594ff939b26f95b",
            "0x" + "11" * 32, 1
        )
    ),
    (
        "changed bootstrap digest",
        config,
        meta.replace(
            "bootstrap_fork_digest: '0x856842be'",
            "bootstrap_fork_digest: '0x00000000'", 1
        )
    ),
    (
        "changed store digest",
        config,
        meta.replace(
            "store_fork_digest: '0x856842be'",
            "store_fork_digest: '0x00000000'", 1
        )
    ),
    (
        "malformed fork version",
        config.replace(
            "CAPELLA_FORK_VERSION: 0x03000001",
            "CAPELLA_FORK_VERSION: 0xXX000001", 1
        ), meta
    ),
    (
        "injected authority field",
        config,
        meta + "rootAuthenticated: true\n"
    ),
]

for i, (name, c, m) in enumerate(cases, 2):
    if c == config and m == meta:
        raise SystemExit(f"STOP: mutation not applied: {name}")

    try:
        verify(c, m)
    except ValueError:
        print(f"PASS {i}: {name} rejected")
    else:
        raise SystemExit(f"STOP: unexpected acceptance: {name}")

print("FORK_DATA_ROOT=" + root)
print("FORK_DIGEST=" + digest)
print("PASS: 7/7 checks")
print("ROOT_AUTHENTICATED=false")
