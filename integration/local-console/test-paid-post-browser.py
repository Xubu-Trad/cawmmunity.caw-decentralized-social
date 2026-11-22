"""Exercise the signing desk on a running disposable C-007 console at block 17."""
import argparse
import json
from pathlib import Path
import urllib.request
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--console", required=True)
parser.add_argument("--rpc", required=True)
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
    if method not in ("eth_chainId", "eth_getBlockByNumber"):
        raise ValueError("Unexpected read method")
    payload = json.dumps(dict(jsonrpc="2.0", id=1, method=method, params=params)).encode()
    request = urllib.request.Request(args.rpc, payload, {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)["result"]

initial = rpc("eth_getBlockByNumber", ["latest", False])
assert initial["number"] == "0x11"
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
              if (method !== 'eth_signTypedData_v4') throw Error('Unexpected wallet method ' + method);
              const typed = JSON.parse(params[1]);
              window.fixtureDigest = ethers.TypedDataEncoder.hash(typed.domain, {Post:typed.types.Post}, typed.message);
              return signer.signTypedData(typed.domain, {Post:typed.types.Post}, typed.message);
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
        for width in (1440,390):
            page.set_viewport_size({"width":width,"height":1000})
            panel = page.locator("#paid-post")
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            panel.screenshot(path=args.output / f"signing-desk-{width}.png", animations="disabled")
        page.locator("#paid-text").fill("edited after signing")
        expect(page.locator("#paid-result")).to_be_hidden()
        expect(page.locator("#paid-sign")).to_be_disabled()
        assert rpc("eth_getBlockByNumber", ["latest",False])["hash"] == initial["hash"]
        outcome = dict(result="PASS", blockHash=initial["hash"], digest=digest, signer=controller,
                       wallet="injected disposable test provider", signatureRequests=1, transactionsSent=0)
        (args.output/"result.json").write_text(json.dumps(outcome,indent=2)+"\n")
        print(json.dumps(outcome))
    finally:
        browser.close()
