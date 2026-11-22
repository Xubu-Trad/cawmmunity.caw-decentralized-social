"""Verify a post in a fresh Chromium context using the reader's normal HTTP API."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


def run(browser, console, tx_hash, text, expected_source, output):
    reader = console.rstrip("/") + "/published-post.html"
    context = browser.new_context(service_workers="block", viewport={"width": 1280, "height": 880})
    try:
        assert context.storage_state() == {"cookies": [], "origins": []}
        context.add_init_script("""
          window.forbiddenReads = [];
          for (const name of ['ethereum', 'localStorage', 'sessionStorage', 'indexedDB']) {
            Object.defineProperty(window, name, {get() {
              window.forbiddenReads.push(name);
              throw Error('Fresh reader tried to access ' + name);
            }});
          }
        """)
        page = context.new_page()
        page.set_default_timeout(30000)
        requests = []
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda req: requests.append((req.url, req.post_data_json))
                if req.method == "POST" else None)
        expect.set_options(timeout=30000)
        with page.expect_response(lambda res: res.url.endswith("/api/paid-post/read")) as observed:
            page.goto(reader + "#" + tx_hash)
        response = observed.value
        report = response.json()
        assert response.ok and report["status"] == "settled" and report["hash"] == tx_hash, report
        assert report["source"] in {"recorded", "node"}
        if expected_source:
            assert report["source"] == expected_source, report["source"]
        result = page.locator("#reader-result")
        status = page.locator("#reader-status")
        field = page.get_by_label("Transaction hash", exact=True)
        expect(result).to_be_visible()
        assert page.locator("#reader-text").text_content() == text
        facts = page.locator("#reader-facts")
        expect(facts.locator("div").filter(has_text="Post authorization signer")).to_contain_text(report["signer"])
        if "submitter" in report:
            expect(facts.locator("div").filter(has_text="Transaction submitter")).to_contain_text(report["submitter"])
        expect(facts).to_contain_text("5000 mock")
        expect(status).to_contain_text("recorded evidence" if report["source"] == "recorded" else "research node")
        assert report["block"]["hash"] in page.locator("#reader-proof").text_content()
        assert requests == [(console.rstrip("/") + "/api/paid-post/read", {"hash": tx_hash})]
        assert not page.evaluate("window.forbiddenReads"), "reader consulted browser state"
        if output:
            output.mkdir(parents=True, exist_ok=False)
            (output/"result.json").write_text(json.dumps(report, indent=2)+"\n")
            page.screenshot(path=output/"published-post-reader.png", full_page=True)
        page.set_viewport_size({"width": 390, "height": 844})
        assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
        if output:
            page.screenshot(path=output/"published-post-reader-mobile.png", full_page=True)
        # A different hash on the real backend must never retain the first post.
        unknown = "0x" + ("0" if tx_hash != "0x" + "0"*64 else "f")*64
        verify_button = page.get_by_role("button", name="Verify post")
        field.fill(unknown)
        expect(result).to_be_hidden()
        verify_button.click()
        expect(status).to_contain_text(re.compile("no receipt|unverified", re.IGNORECASE))
        expect(result).to_be_hidden()
        # Reload the shared fragment in a new document with no publisher data.
        page.goto(reader + "#" + tx_hash)
        expect(result).to_be_visible()
        page.reload()
        expect(result).to_be_visible()
        assert page.locator("#reader-text").text_content() == text
        # Browser response controls; these responses are deliberately supplied by the test.
        for substituted, expected in [
            (dict(report, hash=unknown), "different transaction"),
            (dict(report, status="reverted"), "reverted"),
            (dict(report, settlement={}), "unverified"),
            (dict(report, source="unrecognized"), "Unknown evidence source"),
            ({k: v for k, v in report.items() if k != "source"}, "Unknown evidence source"),
            (dict(report, settlement=dict(report["settlement"], share3="0")), "fixed post fee"),
        ]:
            def substitute(route):
                route.fulfill(json=substituted)
            page.route("**/api/paid-post/read", substitute)
            verify_button.click()
            expect(status).to_contain_text(expected)
            expect(result).to_be_hidden()
            assert page.locator("#reader-text").text_content() == ""
            page.unroute("**/api/paid-post/read", substitute)
        # Edit while a request is in flight; its late result must not reappear.
        pending = []
        page.route("**/api/paid-post/read", lambda route: pending.append(route))
        with page.expect_request(lambda req: req.url.endswith("/api/paid-post/read")):
            verify_button.click()
        field.fill("bad hash")
        assert pending
        pending[0].fulfill(json=report)
        verify_button.click()
        expect(status).to_contain_text("64 hexadecimal digits")
        expect(result).to_be_hidden()
        assert not page.evaluate("window.forbiddenReads")
        assert not errors, errors
        print(f"PASS: {tx_hash}, block {int(report['block']['number'], 16)}, {report['source']} evidence, exact post and fee.")
        print("Fresh reader, reload, unknown hash, six substituted responses and an interrupted lookup passed.")
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--console", required=True)
    parser.add_argument("--hash", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--source", choices=("recorded", "node"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    origin = urlsplit(args.console)
    if origin.scheme != "http" or origin.hostname != "127.0.0.1" or origin.username or origin.password or origin.path not in ("", "/") or origin.query or origin.fragment:
        parser.error("Expected the reader's loopback HTTP origin.")
    if not re.fullmatch("0x[0-9a-fA-F]{64}", args.hash):
        parser.error("Expected a 32-byte transaction hash.")
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            run(browser, args.console, args.hash.lower(), args.text, args.source, args.output)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
