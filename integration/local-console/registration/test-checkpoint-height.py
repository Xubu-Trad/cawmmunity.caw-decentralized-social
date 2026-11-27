import json
import sys
from playwright.sync_api import expect, sync_playwright

case = json.load(sys.stdin)
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    page.goto(case['url'])
    page.locator('#files').set_input_files([
        dict(name=f'{i}.json', mimeType='application/json', buffer=json.dumps(f).encode())
        for i, f in enumerate(case['files'])
    ])
    page.locator('#pin').fill(case['head']['hash'])
    page.locator('#live').check()
    page.locator('#height').fill(case['head']['number'])
    verify = page.get_by_role('button', name='Verify feed')
    verify.click()
    expect(page.get_by_role('status')).to_contain_text(f"{case['count']} verified", timeout=20000)
    expect(page.locator('#results article')).to_have_count(case['count'])
    verify.click()
    expect(page.get_by_role('status')).to_have_text('Checkpoint hash or height changed. Recheck the feed.')
    expect(page.locator('#results')).to_be_empty()
    browser.close()
print(f"PASS final checkpoint height, {case['count']} post(s)")
