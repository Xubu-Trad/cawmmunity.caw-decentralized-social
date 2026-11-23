"""Check the installed extension code in a fresh profile without opening a personal wallet."""
import argparse
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("extension", type=Path, help="Unpacked MetaMask extension directory containing manifest.json")
extension = parser.parse_args().extension.resolve()
manifest = json.loads((extension / "manifest.json").read_text())
with sync_playwright() as pw, tempfile.TemporaryDirectory() as profile:
    browser = pw.chromium.launch_persistent_context(
        profile, channel="chromium", headless=True,
        args=[f"--disable-extensions-except={extension}", f"--load-extension={extension}"],
    )
    page = browser.new_page()
    page.add_init_script("""window.metamaskDiscovery = new Promise(resolve => {
      addEventListener('eip6963:announceProvider', event => {
        if(event.detail.info.rdns==='io.metamask')resolve(event.detail.provider);
      });
    });""")
    page.goto("http://127.0.0.1:34736")
    page.locator("#wallet-choice option", has_text="MetaMask").wait_for(state="attached", timeout=45000)
    chain, accounts = page.evaluate("""()=>Promise.race([
      window.metamaskDiscovery.then(p=>Promise.all([p.request({method:'eth_chainId'}),p.request({method:'eth_accounts'})])),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('wallet RPC timeout')),20000))
    ])""")
    assert int(chain, 16) > 0 and accounts == []
    print(f"PASS MetaMask {manifest['version']} announced, chain {chain}, fresh profile has no authorized accounts")
    browser.close()
