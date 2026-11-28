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
    publication = rpc('eth_getTransactionReceipt', [cfg['hash']])
    assert publication['status'] == '0x1', publication
    height = publication['blockNumber']
    pinned = browser.new_page()
    pinned.goto(cfg['url'])
    pinned.get_by_label('Your registered username').fill('reader01')
    pinned.locator('summary').click()
    pinned.get_by_label('Checkpoint height (hex)').fill(height)
    original = publication['blockHash']
    assert rpc('eth_getBlockByNumber', [height, False])['hash'] == original
    pinned.get_by_label('Checkpoint hash').fill(original)
    pinned.get_by_role('button',name='Watch feed').click()
    expect(pinned.locator('#status')).to_contain_text('supplied checkpoint '+height,timeout=20000)
    expect(pinned.locator('#items')).to_contain_text(cfg['hash'])
    rpc('evm_mine',[])
    assert rpc('eth_blockNumber',[]) != height
    # Submit again after tip advancement to exercise reconstruction at the old block.
    pinned.get_by_role('button',name='Watch feed').click()
    expect(pinned.locator('#status')).to_contain_text(original,timeout=20000)
    assert rpc('evm_revert',[cfg['parent']])
    expect(card).to_contain_text('No current payout verified.',timeout=20000)
    expect(card).not_to_contain_text('5000.0 CAW')
    # Mine one block per setup transaction, then include the exact signed post
    # at its original height. RPC submission alone does not guarantee inclusion.
    rpc('evm_setAutomine', [False])
    try:
        for field, to in [('approve', 'token'), ('stake', 'pool')]:
            tx = rpc('eth_sendTransaction', [{
                'from': cfg['second'], 'to': cfg[to], 'data': cfg[field], 'gas': '0x90000'
            }])
            rpc('evm_mine', [])
            receipt = rpc('eth_getTransactionReceipt', [tx])
            assert receipt and receipt['status'] == '0x1', receipt
        assert int(rpc('eth_blockNumber', []), 16) + 1 == int(height, 16)
        assert rpc('eth_sendRawTransaction', [cfg['raw']]) == cfg['hash']
        rpc('evm_mine', [])
        replacement = rpc('eth_getTransactionReceipt', [cfg['hash']])
        assert replacement and replacement['status'] == '0x1', replacement
        assert replacement['blockNumber'] == height, replacement
        assert replacement['blockHash'] != original, replacement
        assert rpc('eth_getBlockByNumber', [height, False])['hash'] == replacement['blockHash']
    finally:
        rpc('evm_setAutomine', [True])
    expect(card).to_contain_text('Re-mined in a different block',timeout=20000)
    expect(card).to_contain_text('1250.0 CAW')
    expect(card).to_contain_text('3750.0 CAW')
    expect(card).not_to_contain_text('5000.0 CAW')
    # The replacement branch has the same height and signed post, but a different block hash.
    expect(pinned.locator('#status')).to_contain_text('Node disagrees with the supplied checkpoint',timeout=20000)
    expect(pinned.locator('#items')).to_be_empty()
    pinned.get_by_role('button',name='Watch feed').click()
    expect(pinned.locator('#status')).to_contain_text('Node disagrees with the supplied checkpoint',timeout=20000)
    expect(pinned.locator('#items')).to_be_empty()
    print(f"Re-mined {cfg['hash']} at {height}: {original} -> {replacement['blockHash']}; credits 1250 + 3750 CAW", flush=True)
    browser.close()
print('PASS · discovered, unresolved, and re-mined with updated payouts',flush=True)
