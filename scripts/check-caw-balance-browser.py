#!/usr/bin/env python3
"""Exercise the downloadable CAW reader offline with Chromium and its normal CSP."""
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "public/caw-balance.html"
ADDRESS = "0x000000000000000000000000000000000000dEaD"
CAW = "0xf3b9569f82b18aef890de263b84189bd33ebe452"
HOSTS = {"ethereum-rpc.publicnode.com", "eth.drpc.org"}
HEADER = {"number": "0x42", "hash": "0x" + "11" * 32,
          "stateRoot": "0x" + "ab" * 32, "timestamp": "0x1"}
AT_HASH = {"blockHash": HEADER["hash"], "requireCanonical": True}
BALANCE = 10**18 + 1


def check(browser, runtime, case, message):
    context = browser.new_context(service_workers="block")
    page = context.new_page()
    counts = Counter()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def respond(route):
        request = route.request
        host = urlsplit(request.url).hostname
        if host not in HOSTS or request.method != "POST":
            errors.append(f"Unexpected request: {request.method} {request.url}")
            route.abort()
            return
        body = request.post_data_json
        method, params = body["method"], body["params"]
        counts[host, method] += 1
        control = host == "eth.drpc.org"
        if method == "eth_chainId" and params == []:
            value = "0x2" if control and case == "chain" else "0x1"
        elif method == "eth_getBlockByNumber" and params in (["finalized", False], ["0x42", False]):
            value = dict(HEADER)
            if control and case == "header" and params[0] == "0x42":
                value["stateRoot"] = "0x" + "ef" * 32
        elif method == "eth_getCode" and params == [CAW, AT_HASH]:
            value = "0x" + "00" * 2278 if control and case == "runtime" else runtime
        elif method == "eth_call" and params == [{"to": CAW, "data": "0x70a08231" + ADDRESS[2:].lower().zfill(64)}, AT_HASH]:
            if control and case == "failure":
                route.fulfill(status=503, body="")
                return
            value = f"0x{BALANCE + int(control and case == 'disagree'):064x}"
        else:
            errors.append(f"Unexpected RPC parameters: {method} {params}")
            route.abort()
            return
        route.fulfill(json={"jsonrpc": "2.0", "id": body["id"], "result": value})

    try:
        context.route("https://**/*", respond)
        page.goto(PAGE.as_uri())
        assert not counts and not errors, (counts, errors)
        holder = page.locator("#holder")
        holder.fill(ADDRESS)
        page.get_by_role("button", name="Check balance").click()
        expect(page.locator("#status")).to_have_text(message)
        result = page.locator("#result")
        if case == "agree":
            expect(result).to_be_visible()
            expect(result.locator('[data-value="amount"]')).to_have_text("1.000000000000000001 CAW")
            expect(result.locator('[data-value="hash"]')).to_have_text(HEADER["hash"])
            expected = Counter({(host, method): count for host in HOSTS for method, count in
                                (("eth_chainId", 1), ("eth_getBlockByNumber", 3), ("eth_call", 1), ("eth_getCode", 1))})
            assert counts == expected, counts
            holder.fill("")
            expect(page.locator("#status")).to_have_text("Ready for lookup.")
            expect(result.locator('[data-value="amount"]')).to_have_text("")
        expect(result).to_be_hidden()
        assert not errors, errors
    finally:
        context.close()


def main():
    fixture = json.loads((ROOT / "reference/fixtures/caw-token-publicnode.json").read_bytes())
    runtime, = [call["response"]["result"] for call in fixture["calls"] if call["label"] == "runtime"]
    cases = {
        "agree": "Both providers agree at the block shown.",
        "disagree": "The providers returned different CAW balances.",
        "chain": "dRPC is on a different chain.",
        "header": "The providers disagree about the selected block.",
        "runtime": "The deployed code differs from the pinned CAW contract.",
        "failure": "dRPC could not complete eth_call. Try again.",
    }
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            for case, message in cases.items():
                check(browser, runtime, case, message)
                print("PASS", case)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
