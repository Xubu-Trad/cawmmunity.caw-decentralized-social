"""Read the followed feed in a new browser at a previously captured checkpoint."""
from pathlib import Path
import subprocess

from playwright.sync_api import expect, sync_playwright

HERE = Path(__file__).resolve().parent


def check_receiver_feed(endpoint, pin, tx_hash, credits):
    from contextlib import ExitStack

    with ExitStack() as stack:
        portal = subprocess.Popen(['node', str(HERE / 'checkpoint-portal.mjs'), endpoint],
                                  stdout=subprocess.PIPE, text=True)
        def close_portal():
            if portal.poll() is None:
                portal.terminate()
            portal.wait(timeout=10)
        stack.callback(close_portal)
        # Wait for this process to bind the port, including failure if already in use.
        if not portal.stdout.readline().startswith('Open http://'):
            raise RuntimeError('Test portal did not open its listener')
        url = 'http://127.0.0.1:34742/checkpoint/following'
        pw = stack.enter_context(sync_playwright())
        browser = pw.chromium.launch()
        stack.callback(browser.close)
        page = browser.new_page()
        page.goto(url)
        page.get_by_label('Your registered username').fill('reader01')
        page.locator('summary').click()
        page.get_by_label('Checkpoint height (hex)').fill(pin['height'])
        field = page.get_by_label('Checkpoint hash')
        field.fill(pin['hash'])
        button = page.get_by_role('button', name='Watch feed')
        button.click()
        expect(page.locator('#status')).to_contain_text('supplied checkpoint '+pin['height']+' · '+pin['hash'], timeout=30000)
        card = page.locator('article').filter(has_text=tx_hash)
        expect(card.locator('h2')).to_have_text('hunter01')
        expect(card.locator('blockquote')).to_have_text('post before branch replacement')
        expect(card.locator('p')).to_have_text([tx_hash, *credits])
        rendered = page.locator('#items article').all_inner_texts()
        field.fill('0x'+'00'*32)
        button.click()
        expect(page.locator('#status')).to_contain_text('Node disagrees with the supplied checkpoint')
        expect(page.locator('#items')).to_be_empty()
    return rendered
