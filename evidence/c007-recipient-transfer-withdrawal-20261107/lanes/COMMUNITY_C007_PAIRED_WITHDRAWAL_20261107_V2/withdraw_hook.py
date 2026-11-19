WITHDRAW_AMOUNT = 100 * UNIT
NOT_OWNER = "0x" + keccak(b"NotAccountOwner()")[:4].hex()

def raw_revert_call(tx):
    global calls
    assert calls < 512
    assert proc.poll() is None
    assert owns_listener(proc.pid)

    calls += 1
    body = json.dumps({
        "jsonrpc": "2.0", "id": calls,
        "method": "eth_call",
        "params": [tx, "latest"]
    }, separators=(",", ":")).encode("ascii")

    assert len(body) < 24000

    connection = http.client.HTTPConnection(
        "127.0.0.1", PORT, timeout=3
    )
    try:
        connection.request("POST", "/", body, {
            "Content-Type": "application/json",
            "Accept-Encoding": "identity"
        })
        response = connection.getresponse()
        data = response.read(32769)
        assert response.status == 200
        assert len(data) <= 32768

        item = json.loads(data)
        assert item["id"] == calls
        assert item["jsonrpc"] == "2.0"
        assert "result" not in item

        error = item.get("error")
        assert isinstance(error, dict)
        assert str(error.get("data", "")).lower() == NOT_OWNER
        return error
    finally:
        connection.close()

def send_reverted(tx, label):
    txhash = rpc("eth_sendTransaction", [tx])
    assert len(txhash) == 66

    receipt = None
    for _ in range(10):
        receipt = rpc("eth_getTransactionReceipt", [txhash])
        if receipt is not None:
            break
        time.sleep(0.1)

    assert receipt is not None
    assert receipt["transactionHash"] == txhash
    assert receipt["status"] == "0x0"
    assert receipt["logs"] == []
    assert receipt["to"].lower() == probe
    assert receipt["from"].lower() == B
    assert int(receipt["gasUsed"], 16) <= 4000000

    transactions.append({
        "label": label,
        "request": tx,
        "receipt": receipt
    })
    return receipt

def run_withdrawal(label, owner, epoch, posted_state):
    assert label in ("control", "treatment")
    assert auth(2) == {"owner": owner, "epoch": epoch}
    assert snapshot() == posted_state

    data = calldata(
        build["contracts"]["CawPaidActionProbe"][
            "methodIdentifiers"
        ]["withdraw(uint256,uint256,uint256)"],
        2, epoch, WITHDRAW_AMOUNT
    )

    tx = {
        "from": B,
        "to": probe,
        "data": data,
        "gas": "0x3d0900",
        "gasPrice": "0x174876e800",
        "value": "0x0"
    }

    assert int(uint(TOKEN, "totalSupply()")) == sum(MINT.values())

    if label == "control":
        assert owner == A and epoch == 0
        error = raw_revert_call(tx)
        receipt = send_reverted(tx, "control_B_withdraw_rejected")

        assert snapshot() == posted_state
        assert auth(2) == {"owner": A, "epoch": 0}

        return {
            "status": "0x0",
            "expected_revert": NOT_OWNER,
            "dry_error": error,
            "request": tx,
            "receipt": receipt,
            "state_unchanged": True
        }

    assert label == "treatment"
    assert owner == B and epoch == 1
    assert posted_state["credits"][1] - STAKES[2] >= WITHDRAW_AMOUNT

    assert rpc("eth_call", [tx, "latest"]) == "0x"
    assert snapshot() == posted_state

    receipt = send(B, probe, data, "treatment_B_withdraw")
    assert receipt["status"] == "0x1"
    assert len(receipt["logs"]) == 2

    after = snapshot()
    expected = dict(posted_state)
    expected["credits"] = posted_state["credits"][:]
    expected["credits"][1] -= WITHDRAW_AMOUNT
    expected["totalCredits"] -= WITHDRAW_AMOUNT
    expected["vault"] -= WITHDRAW_AMOUNT
    expected["balanceB"] += WITHDRAW_AMOUNT

    assert after == expected
    assert sum(after["credits"]) == after["totalCredits"]
    assert after["vault"] == after["totalCredits"] + after["poolDust"]
    assert int(uint(TOKEN, "totalSupply()")) == sum(MINT.values())

    check_event(
        receipt["logs"][0],
        TOKEN,
        "Transfer(address,address,uint256)",
        [probe, B],
        [WITHDRAW_AMOUNT]
    )
    check_event(
        receipt["logs"][1],
        probe,
        "Withdrawn(uint256,address,uint256,uint256,uint256)",
        [2, B],
        [WITHDRAW_AMOUNT, after["credits"][1], 1]
    )

    assert auth(2) == {"owner": B, "epoch": 1}

    return {
        "status": "0x1",
        "request": tx,
        "receipt": receipt,
        "after": after,
        "amount": str(WITHDRAW_AMOUNT),
        "recipient_balance_delta": (
            after["balanceB"] - posted_state["balanceB"]
        ),
        "vault_delta": (
            after["vault"] - posted_state["vault"]
        ),
        "events_verified": True,
        "accounting_conserved": True
    }
