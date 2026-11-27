import sys
from playwright.sync_api import expect, sync_playwright

url, scenario = sys.argv[1:]
errors = dict(selected='Selected head height', final='Head changed during recheck',
              publication='Publication height', poll='Selected head height')
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
    browser.close()
print('PASS following height:', scenario)
