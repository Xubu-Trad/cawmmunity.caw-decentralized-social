"""Exercise the automatic feed on a throwaway Anvil fork created by the runtime fixture."""
import json
import sys
import urllib.request
from playwright.sync_api import expect, sync_playwright

cfg = json.load(sys.stdin)
def rpc(method, args):
    data = json.dumps(dict(jsonrpc='2.0',id=1,method=method,params=args)).encode()
    req = urllib.request.Request(cfg['endpoint'],data,{'Content-Type':'application/json'})
    result = json.load(urllib.request.urlopen(req,timeout=5))
    assert 'error' not in result, result
    return result['result']

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    page.goto(cfg['url'])
    page.get_by_label('Your registered username').fill('reader01')
    page.get_by_role('button', name='Watch feed').click()
    card = page.locator('article').filter(has_text=cfg['hash'])
    expect(card).to_contain_text('5000.0 CAW',timeout=20000)
    height = rpc('eth_blockNumber',[])
    assert rpc('evm_revert',[cfg['parent']])
    expect(card).to_contain_text('No current payout verified.',timeout=20000)
    expect(card).not_to_contain_text('5000.0 CAW')
    for field,to in [('approve','token'),('stake','pool')]:
        h = rpc('eth_sendTransaction',[{'from':cfg['second'],'to':cfg[to],'data':cfg[field],'gas':'0x90000'}])
        assert rpc('eth_getTransactionReceipt',[h])['status']=='0x1'
    assert rpc('eth_sendRawTransaction',[cfg['raw']])==cfg['hash']
    assert rpc('eth_blockNumber',[])==height
    expect(card).to_contain_text('Re-mined in a different block',timeout=20000)
    expect(card).to_contain_text('1250.0 CAW')
    expect(card).to_contain_text('3750.0 CAW')
    expect(card).not_to_contain_text('5000.0 CAW')
    browser.close()
print('PASS · discovered, unresolved, and re-mined with updated payouts',flush=True)
