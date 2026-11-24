"""Exercise registration wallet selection without prompting a real extension."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parent
genesis = "0x" + "11" * 32
address = lambda digit: "0x" + digit * 40
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for legacy_only in (False, True):
        page = browser.new_page()
        def serve(route):
            path = route.request.url.split("://portal.test/")[1]
            if path == "config":
                route.fulfill(json={"genesis": genesis, "registry": address("3"), "token": address("4")})
            elif path in ("wallet.mjs", "ethers.mjs"):
                file = root / ("wallet.mjs" if path == "wallet.mjs" else "../node_modules/ethers/dist/ethers.js")
                route.fulfill(path=file, content_type="text/javascript")
            elif path == "":
                route.fulfill(path=root / "wallet.html", content_type="text/html")
            else:
                route.fulfill(status=404, body="")
        page.route("http://portal.test/**", serve)
        page.add_init_script("""
          function candidate(digit) {
            const events = {};
            return {requests: [], on(event, fn){events[event]=fn}, change(){events.accountsChanged([])},
              async request({method}) {
                this.requests.push(method);
                if(method==='eth_chainId')return '0x539';
                if(method==='eth_getBlockByNumber')return {hash:'0x'+'11'.repeat(32)};
                if(['eth_requestAccounts','eth_accounts'].includes(method))return ['0x'+digit.repeat(40)];
                throw Error(method);
              }};
          }
          window.first=candidate('1');window.second=candidate('2');window.ethereum=first;
        """)
        if not legacy_only:
            page.add_init_script("""
              addEventListener('eip6963:requestProvider',()=>{
                window.announce=(provider,name)=>dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{provider,info:{name}}}));
                announce(first,'First');announce(second,'Second');announce(first,'First');
              });
            """)
        page.goto("http://portal.test/")
        chooser = page.locator("#wallet-choice")
        expect(chooser.locator("option")).to_have_count(1 if legacy_only else 2)
        page.locator("#connect").click()
        expect(page.locator("#account")).to_have_text(address("1"))
        if not legacy_only:
            chooser.select_option(index=1)
            expect(page.locator("#account")).to_be_empty()
            expect(page.locator("#review")).to_be_disabled()
            page.locator("#connect").click()
            expect(page.locator("#account")).to_have_text(address("2"))
            page.evaluate("first.change(); announce(first,'Updated')")
            expect(page.locator("#account")).to_have_text(address("2"))
            assert chooser.input_value() == "1"
            page.evaluate("second.change()")
            expect(page.locator("#account")).to_be_empty()
        page.close()
    browser.close()
print("PASS: registration wallet choice, duplicate announcement, account invalidation, legacy fallback")
