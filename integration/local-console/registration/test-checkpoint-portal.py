"""Browser checks against the local checkpoint portal. Optionally use its connected replay node."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--live', action='store_true')
args = parser.parse_args()
samples = Path(__file__).resolve().parent / 'samples'
packet = json.loads((samples/'peer-check/located.json').read_text())
with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto('http://127.0.0.1:34742/checkpoint')
    status = page.get_by_role('status')
    page.get_by_role('button', name='Try published example').click()
    expect(status).to_contain_text('1 verified · 0 unresolved')
    for amount in ('2000.0', '3000.0', '5000.0'):
        expect(page.locator('li').filter(has_text=amount+' CAW')).to_have_count(1)
    # Withhold the replacement receipt. The original proof still authenticates the changed block.
    packet['observed'] = None
    page.locator('#files').set_input_files([
        dict(name='archive.json', mimeType='application/json', buffer=(samples/'branch-check/archive.json').read_bytes()),
        dict(name='packet.json', mimeType='application/json', buffer=json.dumps(packet).encode())])
    expect(page.locator('#results')).to_be_empty()
    page.get_by_role('button', name='Verify feed').click()
    expect(status).to_contain_text('0 verified · 1 unresolved')
    expect(page.locator('#results')).to_contain_text('No current payout verified.')
    expect(page.locator('li')).to_have_count(0)
    if args.live:
        page.locator('#live').check()
        page.locator('#height').fill(packet['checkpointHeight'])
        page.get_by_role('button', name='Verify feed').click()
        expect(status).to_contain_text('1 verified · 0 unresolved')
        expect(page.locator('li').filter(has_text='3000.0 CAW')).to_have_count(1)
    page.locator('#pin').fill('0x'+'00'*32)
    page.get_by_role('button', name='Verify feed').click()
    expect(status).to_contain_text('Checkpoint mismatch')
    expect(page.locator('#results')).to_be_empty()
    browser.close()
print('Browser payout, unresolved, and stale-result checks passed.')
