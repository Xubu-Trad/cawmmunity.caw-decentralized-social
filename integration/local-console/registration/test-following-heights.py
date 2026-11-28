import sys
from playwright.sync_api import expect, sync_playwright

url, scenario, post_hash = sys.argv[1:]
errors = dict(selected='Selected head height', final='Head changed during recheck',
              publication='Publication height', poll='Selected head height')
errors.update({'omit-post':'omitted a publication event', 'omit-follow':'omitted a follow event'})
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    page.goto(url)
    page.get_by_label('Your registered username').fill('reader01')
    page.get_by_role('button', name='Watch feed').click()
    if scenario == 'poll':
        expect(page.locator('#items')).to_contain_text('Current payouts', timeout=20000)
    expect(page.locator('#status')).to_contain_text(errors[scenario], timeout=20000)
    expect(page.locator('#items')).to_be_empty()
    if scenario == 'omit-post':
        recovered = page.locator('article').filter(has_text=post_hash)
        expect(recovered).to_contain_text('5000.0 CAW', timeout=20000)
    browser.close()
print('PASS following height:', scenario)
