"""Exercise the signing desk on a running disposable C-007 console at block 17."""
import argparse
import json
import time
from pathlib import Path
import urllib.request
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--console", required=True)
parser.add_argument("--rpc", required=True)
parser.add_argument("--submit", action="store_true", help="Publish once with the disposable controller and verify settlement after reloading")
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()

from urllib.parse import urlsplit
for url in [args.console, args.rpc]:
    parts = urlsplit(url)
    if (parts.scheme, parts.hostname) != ("http", "127.0.0.1") or parts.username or parts.password:
        parser.error("Expected two loopback URLs")
args.output.mkdir()
controller = "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf"

def rpc(method, params):
    allowed = {"eth_chainId", "eth_getBlockByNumber"}
    if args.submit:
        allowed.update(("eth_getTransactionCount", "eth_estimateGas", "eth_sendRawTransaction"))
    if method not in allowed:
        raise ValueError("Unexpected read method")
    payload = json.dumps(dict(jsonrpc="2.0", id=1, method=method, params=params)).encode()
    request = urllib.request.Request(args.rpc, payload, {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)["result"]

initial = rpc("eth_getBlockByNumber", ["latest", False])
if initial["number"] != "0x11" or initial["hash"] != "0xe9aeb5afbfbf5e54e0c8f40acc59281c1eb6f6235ded92bffa4f284ef47fbb3f":
    raise ValueError("Expected C-007 fixture at block 17")
if rpc("eth_getBlockByNumber", ["0x0", False])["hash"] != "0x6c383946adbe554271ffb1f227933d44864ce5f9a1633f3a646843a895903a9f":
    raise ValueError("Expected the pinned C-007 genesis")
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_timeout(20000)
        expect.set_options(timeout=15000)
        page.expose_function("readFixtureRpc", rpc)
        # Only the test page receives this public disposable fixture wallet.
        ethers = Path(__file__).resolve().parent / "node_modules/ethers/dist/ethers.umd.min.js"
        page.add_init_script(script=ethers.read_text() + """
        ;(() => {
          const signer = new ethers.Wallet(ethers.toBeHex(1, 32));
          const listeners = new EventTarget();
          window.fixtureMethods = [];
          window.ethereum = {
            on: (name, fn) => listeners.addEventListener(name, fn),
            removeListener: (name, fn) => listeners.removeEventListener(name, fn),
            request: async ({method, params = []}) => {
              window.fixtureMethods.push(method);
              if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [signer.address];
              if (method === 'eth_chainId' || method === 'eth_getBlockByNumber') return window.readFixtureRpc(method, params);
              if (method === 'eth_sendTransaction') {
                const tx = params[0];
                if (tx.chainId !== '0x7a69' || tx.from.toLowerCase() !== signer.address.toLowerCase() ||
                    tx.to !== '0xbff9228b938b3676578a88b5962abbd2709c9c46' || tx.value !== '0x0' ||
                    tx.data !== window.expectedPaidCall) throw Error('Wallet call differs from reviewed post');
                const read = window.readFixtureRpc;
                const [head,nonce,estimate] = await Promise.all([
                  read('eth_getBlockByNumber',['latest',false]), read('eth_getTransactionCount',[tx.from,'pending']),
                  read('eth_estimateGas',[{from:tx.from,to:tx.to,data:tx.data,value:tx.value}])
                ]);
                const priority = 1000000000n;
                const raw = await signer.signTransaction({type:2,chainId:31337,nonce:Number(BigInt(nonce)),
                  to:tx.to,value:0,data:tx.data,gasLimit:BigInt(estimate)+50000n,
                  maxPriorityFeePerGas:priority,maxFeePerGas:BigInt(head.baseFeePerGas)*2n+priority});
                return read('eth_sendRawTransaction',[raw]);
              }
              if (method !== 'eth_signTypedData_v4') throw Error('Unexpected wallet method ' + method);
              const typed = JSON.parse(params[1]);
              window.fixtureDigest = ethers.TypedDataEncoder.hash(typed.domain, {Post:typed.types.Post}, typed.message);
              const signature = await signer.signTypedData(typed.domain, {Post:typed.types.Post}, typed.message);
              const m=typed.message;
              const contract=new ethers.Interface(['function settleFixedPool1((uint256,uint256,uint256,uint256,uint256,bytes32,bytes32),bytes,bytes)']);
              window.expectedPaidCall=contract.encodeFunctionData('settleFixedPool1',[
                [m.accountId,m.epoch,m.nonce,m.validAfter,m.deadline,m.stakeRoot,m.textHash],
                signature,ethers.toUtf8Bytes(document.getElementById('paid-text').value)]);
              return signature;
            }
          };
        })();
        """)
        page.goto(args.console.rstrip("/") + "/#paid-post")
        expect(page.locator("#paid-prepare")).to_be_enabled()
        assert page.evaluate("window.fixtureMethods.length") == 0
        page.locator("#paid-text").fill("reviewed through the local signing desk")
        page.locator("#paid-start").fill("0")
        page.locator("#paid-end").fill("1000")
        page.locator("#paid-prepare").click()
        try:
            expect(page.locator("#paid-summary")).to_contain_text(controller)
        except AssertionError as error:
            raise AssertionError("Review status: " + page.locator("#paid-status").inner_text()) from error
        expect(page.locator("#paid-sign")).to_be_disabled()
        page.locator("#paid-connect").click()
        expect(page.locator("#paid-sign")).to_be_enabled()
        page.locator("#paid-sign").click()
        expect(page.locator("#paid-status")).to_contain_text("signature verified")
        digest = page.evaluate("window.fixtureDigest")
        expect(page.locator("#paid-result")).to_contain_text(digest)
        expect(page.locator("#paid-result")).to_contain_text(initial["hash"])
        expect(page.locator("#paid-result")).to_contain_text(controller)
        methods = page.evaluate("window.fixtureMethods")
        assert methods.count("eth_signTypedData_v4") == 1
        assert set(methods) <= {"eth_requestAccounts","eth_accounts","eth_chainId","eth_getBlockByNumber","eth_signTypedData_v4"}
        received = {}
        if args.submit:
            expect(page.locator("#paid-submit")).to_be_enabled()
            page.locator("#paid-submit").click()
            expect(page.locator("#paid-submission-status")).to_contain_text("returned a transaction hash")
            tx_hash = page.locator("#paid-recovery-hash").input_value()
            methods = page.evaluate("window.fixtureMethods")
            assert methods.count("eth_sendTransaction") == 1
            record = page.evaluate("JSON.parse(localStorage.getItem('caw.c007.paid-post.delivery.v1'))")
            (args.output/"saved-review.json").write_text(json.dumps(record["review"],indent=2)+"\n")
            request = {"review":record["review"], "hash":tx_hash, "calldataHash":record["calldataHash"]}
            (args.output/"receipt-request.json").write_text(json.dumps(request,indent=2)+"\n")
            page.reload()
            expect(page.locator("#paid-check-receipt")).to_be_enabled()
            assert page.evaluate("window.fixtureMethods") == []
            expect(page.locator("#paid-recovery-hash")).to_have_value(tx_hash)
            deadline = time.monotonic() + 45
            while True:
                with page.expect_response(lambda res: res.url.endswith("/api/paid-post/receipt")) as response:
                    page.locator("#paid-check-receipt").click()
                receipt = response.value.json()
                if receipt.get("status") == "settled":
                    break
                if receipt.get("status") != "pending" or time.monotonic() > deadline:
                    raise AssertionError(receipt)
                time.sleep(.5)
            expect(page.locator("#paid-submission-status")).to_contain_text("Receipt and balances verified")
            expect(page.locator("#paid-settlement")).to_contain_text(tx_hash)
            assert receipt["digest"] == digest and receipt["signer"] == controller
            assert receipt["calldataHash"] == request["calldataHash"] and receipt["text"] == record["review"]["intent"]["text"]
            assert receipt["settlement"] == {k:record["review"]["settlement"][k] for k in ("share2","share3","dust")} | {
                "fee":record["review"]["preview"]["typedData"]["message"]["fee"]}
            (args.output/"receipt.json").write_text(json.dumps(receipt,indent=2)+"\n")
            received = dict(transactionHash=tx_hash,settlementBlock=receipt["block"],calldataHash=request["calldataHash"],
                            settlement=receipt["settlement"],recoveredAfterReload=True)
        for width in (1440,390):
            page.set_viewport_size({"width":width,"height":1000})
            panel = page.locator("#paid-post")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            panel.screenshot(path=args.output / f"{'published-post' if args.submit else 'signing-desk'}-{width}.png", animations="disabled")
        page.locator("#paid-text").fill("edited after signing")
        expect(page.locator("#paid-result")).to_be_hidden()
        expect(page.locator("#paid-sign")).to_be_disabled()
        if not args.submit:
            assert rpc("eth_getBlockByNumber", ["latest",False])["hash"] == initial["hash"]
        outcome = dict(result="PASS", blockHash=initial["hash"], digest=digest, signer=controller,
                       wallet="injected disposable test provider", signatureRequests=1, transactionsSent=int(args.submit), **received)
        (args.output/"result.json").write_text(json.dumps(outcome,indent=2)+"\n")
        print(json.dumps(outcome))
    finally:
        browser.close()
