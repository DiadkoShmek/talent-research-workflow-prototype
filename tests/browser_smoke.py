"""Optional real-browser proof. Needs Python Playwright and its Chromium.
Run: python3 tests/browser_smoke.py [--screenshots]
The app itself has no package dependency. This serves a temporary loopback server.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import json
import os

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshots', action='store_true')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    checks = []
    try:
        with sync_playwright() as p:
            launch = {'headless': True}
            if os.environ.get('SIGNAL_DESK_CHROMIUM'):
                launch['executable_path'] = os.environ['SIGNAL_DESK_CHROMIUM']
            browser = p.chromium.launch(**launch)
            for label, width, height in [('desktop',1440,1000),('mobile',390,844)]:
                page = browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce')
                errors, external = [], []
                page.on('pageerror', lambda error: errors.append(str(error)))
                def route_request(route):
                    if route.request.url.startswith(base) or route.request.url.startswith(('blob:', 'data:')):
                        route.continue_()
                    else:
                        external.append(route.request.url)
                        route.abort()
                page.route('**/*', route_request)
                page.goto(base)
                page.wait_for_selector('.workbench')
                assert page.locator('[data-story-beat]').count() == 3
                assert page.locator('[data-signature-moment="evidence-gate"]').count() == 1
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
                if args.screenshots:
                    page.screenshot(path=str(ROOT/f'docs/screenshots/{label}.png'), full_page=True)
                assert page.locator('#approve-button').is_disabled()
                for evidence_id in ['obs-01::0','obs-01::1','obs-02::0']:
                    card = page.locator(f'[data-evidence="{evidence_id}"]')
                    card.locator('summary').click()
                    card.locator('input[name="reason"]').fill(f'Перевірено зміст прикладу {evidence_id}')
                    card.locator('button[value="accept"]').click()
                assert page.locator('#approve-button').is_disabled()
                page.locator('#identity-check').check()
                assert page.evaluate('document.activeElement.id') == 'identity-check'
                assert page.locator('#approve-button').is_enabled()
                page.locator('#approve-button').click()
                page.locator('#export-button').click()
                with page.expect_download() as info:
                    page.locator('#download-packet').click()
                packet = json.loads(Path(info.value.path()).read_text())
                assert len(packet['candidates']) == 1
                assert len(packet['candidates'][0]['evidence']) == 3
                assert len(packet['events']) == 5
                assert packet['schema'] == 'signal-desk-handoff.v2'
                assert len(packet['criteria']) == 3
                page.locator('#scenario').select_option('future-date')
                assert page.locator('#scenario').input_value() == 'standard'
                assert 'Пакет (1)' in page.locator('#export-button').inner_text()
                page.locator('#cutoff').fill('2026-09-20')
                page.locator('#apply-cutoff').click()
                assert page.locator('#approve-button').is_disabled()
                assert page.locator('#export-button').is_disabled()
                assert not page.locator('#identity-check').is_checked()
                assert page.locator('.review-record').count() == 0
                page.locator('#scenario').select_option('conflict')
                assert page.locator('#identity-check').is_disabled()
                assert page.locator('#approve-button').is_disabled()
                page.locator('[data-lang="en"]').click()
                assert page.locator('html').get_attribute('lang') == 'en'
                assert 'Evidence first.' in page.locator('h1').inner_text()
                page.locator('#scenario').select_option('standard')
                page.locator('#search').fill('no-such-person')
                assert page.locator('.candidate-list .candidate').count() == 0
                page.locator('#search').fill('')
                assert page.locator('.candidate-list .candidate').count() == 6
                with page.expect_download() as info:
                    page.locator('#download-project').click()
                project = json.loads(Path(info.value.path()).read_text())
                project['findings'][0]['name'] = '<img src=x onerror="window.injected=true">'
                project['findings'][1]['name'] = project['findings'][0]['name']
                page.locator('#project-file').set_input_files({'name':'sample.json','mimeType':'application/json','buffer':json.dumps(project).encode()})
                page.wait_for_function("document.querySelector('.ribbon').textContent.includes('User-supplied')")
                assert page.locator('#scenario').input_value() == 'imported'
                assert not page.evaluate('window.injected === true')
                assert page.locator('.detail h3 img').count() == 0
                page.locator('#reset').click()
                assert 'User-supplied' in page.locator('.ribbon').inner_text()
                assert '<img' in page.locator('.detail h3').inner_text()
                page.locator('#start-tour').click()
                assert page.locator('.tour').count() == 1
                assert 'Олена' in page.locator('.detail h3').inner_text()
                page.locator('#end-tour').click()
                # A changed search plan must govern the same review engine.
                for evidence_id in ['obs-01::0','obs-01::1','obs-02::0']:
                    card = page.locator(f'[data-evidence="{evidence_id}"]')
                    if not card.locator('details').evaluate('(n)=>n.open'):
                        card.locator('summary').click()
                    card.locator('input[name="reason"]').fill('Reviewed for the plan-change experiment')
                    card.locator('button[value="accept"]').click()
                page.locator('#identity-check').check()
                page.locator('#approve-button').click()
                assert page.locator('[data-hypothesis="automation-builders"] .channel-outcome strong').inner_text() == '1'
                page.locator('#search-plan > summary').click()
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
                page.locator('input[name="hypothesis"][value="automation-builders"]').uncheck()
                page.locator('#plan-reason').fill('Test what the automation channel contributes')
                page.locator('#apply-plan').click()
                assert page.locator('#export-button').is_disabled()
                assert not page.locator('#identity-check').is_checked()
                assert page.locator('.review-record').count() == 0
                assert page.locator('[data-evidence="obs-02::0"]').count() == 0
                assert page.locator('.candidate').count() == 5
                assert page.locator('[data-hypothesis="automation-builders"] .channel-numbers').inner_text().count('0') == 4
                page.locator('input[name="hypothesis"][value="community-ops"]').uncheck()
                page.locator('input[name="criterion"][value="automation"]').uncheck()
                page.locator('#plan-reason').fill('Narrow the experiment while retaining known identity conflicts')
                page.locator('#apply-plan').click()
                assert page.locator('.coverage-row[data-criterion]').count() == 2
                assert page.locator('[data-criterion="automation"]').count() == 0
                page.locator('[data-person="person-iryna"]').click()
                assert page.locator('#identity-check').is_disabled()
                assert page.locator('#approve-button').is_disabled()
                # Empty selections cannot replace the current plan.
                for box in page.locator('input[name="criterion"]').all(): box.uncheck()
                page.locator('#plan-reason').fill('Invalid empty criteria experiment')
                page.locator('#apply-plan').click()
                assert 'plan requires' in page.locator('#notice').inner_text()
                assert page.locator('.coverage-row[data-criterion]').count() == 2
                page.locator('#scenario').select_option('standard')
                page.locator('#search-plan').evaluate('(n)=>n.open=false')
                page.evaluate('window.scrollTo(0,0)')
                if args.screenshots and label == 'desktop':
                    page.goto(base+'/?lang=en')
                    page.wait_for_selector('.workbench')
                    page.screenshot(path=str(ROOT/'docs/screenshots/desktop-preview.png'))
                    page.locator('#search-plan > summary').click()
                    page.locator('#search-plan').screenshot(path=str(ROOT/'docs/screenshots/search-plan.png'))
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
                assert not errors, errors
                assert not external, external
                checks.append(f'{label} {width}px: review, identity, approval, download, plan scope/invalidation, archived conflicts, coverage, import escaping, language, overflow and no external calls PASS')
                page.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print('\n'.join(checks))

if __name__ == '__main__': run()
