"""Recipient scope, readable offline file, unsafe text and weak-evidence rehearsal.
Run with Python Playwright; optionally add --screenshots.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import argparse
import json
import os

from playwright.sync_api import sync_playwright
from browser_smoke import ROOT, QuietHandler


def review(page, evidence_id, decision, reason):
    card=page.locator(f'[data-evidence="{evidence_id}"]')
    if not card.locator('details').evaluate('(n)=>n.open'):
        card.locator('summary').click()
    card.locator('input[name="reason"]').fill(reason)
    card.locator(f'button[value="{decision}"]').click()


def download(page, selector):
    with page.expect_download() as result:
        page.locator(selector).click()
    return Path(result.value.path()).read_text()


def run():
    parser=argparse.ArgumentParser()
    parser.add_argument('--screenshots',action='store_true')
    args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p, TemporaryDirectory() as directory:
            launch={'headless':True}
            if os.environ.get('SIGNAL_DESK_CHROMIUM'):
                launch['executable_path']=os.environ['SIGNAL_DESK_CHROMIUM']
            browser=p.chromium.launch(**launch)
            for label,width in [('desktop',1440),('mobile',390)]:
                errors,external=[],[]
                page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
                page.on('pageerror',lambda error:errors.append(str(error)))
                def route(route):
                    if route.request.url.startswith(base):route.continue_()
                    else:
                        external.append(route.request.url)
                        route.abort()
                page.route('**/*',route)
                page.goto(base+'/?lang=uk')
                page.locator('[data-person="person-petro"]').click()
                review(page,'obs-03::0','reject','PETRO_PRIVATE_NOTE must stay in the session journal')
                page.locator('[data-person="person-olena"]').click()
                for evidence_id in ('obs-01::0','obs-01::1','obs-02::0'):
                    review(page,evidence_id,'accept','У документі прикладу описана відповідна робота')
                page.locator('#identity-check').check()
                page.locator('#approve-button').click()
                assert 'Петро' in page.locator('.log').inner_text()
                page.locator('#export-button').click()
                panel=page.locator('#export-panel')
                assert panel.locator('[data-handoff-person]').count()==1
                assert panel.locator('[data-handoff-evidence]').count()==3
                assert 'Що ще невідомо' in panel.inner_text()
                assert 'Наступна дія людини' in panel.inner_text()
                assert not page.locator('#packet-json').evaluate('(n)=>n.open')
                packet_text=download(page,'#download-packet')
                packet=json.loads(packet_text)
                assert packet['schema']=='signal-desk-handoff.v2'
                assert packet['eventsScope']=='latest-supporting-decisions-only'
                assert len(packet['events'])==5
                assert 'PETRO_PRIVATE_NOTE' not in packet_text
                assert 'person-petro' not in packet_text
                html=download(page,'#download-readable')
                assert 'PETRO_PRIVATE_NOTE' not in html
                assert 'person-petro' not in html
                local=Path(directory)/f'handoff-{label}.html'
                local.write_text(html)
                offline=browser.new_page(viewport={'width':width,'height':900})
                offline.on('pageerror',lambda error:errors.append(str(error)))
                offline.on('request',lambda request:external.append(request.url) if request.url.startswith(('http:','https:')) else None)
                offline.goto(local.as_uri())
                assert offline.locator('[data-handoff-evidence]').count()==3
                assert 'Олена' in offline.locator('h3').inner_text()
                assert not offline.evaluate('document.documentElement.scrollWidth > innerWidth')
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
                if args.screenshots:
                    offline.screenshot(path=str(ROOT/f'docs/screenshots/handoff-{label}.png'),full_page=True)
                offline.close()
                if label=='desktop':
                    page.locator('[data-lang="en"]').click()
                    assert 'What remains unknown' in page.locator('#export-panel').inner_text()
                    assert '<html lang="en">' in download(page,'#download-readable')
                    page.locator('[data-lang="uk"]').click()

                # A human rejection blocks a weak quote; acceptance is not semantic proof.
                page.locator('#project-file').set_input_files(str(ROOT/'examples/webinar-rehearsal.json'))
                page.wait_for_function("document.querySelector('#scenario').value==='imported'")
                for evidence_id in ('obs-01::0','obs-01::1'):
                    review(page,evidence_id,'accept','Приклад описує цю частину роботи')
                review(page,'obs-02::0','reject','Вебінар не доводить власноручного впровадження')
                page.locator('#identity-check').check()
                assert page.locator('#approve-button').is_disabled()
                assert page.locator('#export-button').is_disabled()
                review(page,'obs-02::0','accept','Негативний контроль: людина помилково прийняла слабкий доказ')
                assert page.locator('#approve-button').is_enabled()
                page.locator('#approve-button').click()
                page.locator('#export-button').click()
                assert 'не встановлені' in page.locator('#export-panel').inner_text()

                # Imported strings remain text in both on-screen and downloaded cards.
                project=json.loads((ROOT/'examples/webinar-rehearsal.json').read_text())
                payload='<img src="https://example.invalid/x" onerror="window.injected=true">'
                for finding in project['findings']:
                    finding['name']=payload
                    finding['source']['title']={'uk':payload,'en':payload}
                    for language in ('uk','en'):
                        finding['source']['text'][language]+=' '+payload
                project['objective']={'uk':payload,'en':payload}
                project['id']='unsafe-text-sample'
                page.locator('#project-file').set_input_files({'name':'sample.json','mimeType':'application/json','buffer':json.dumps(project).encode()})
                page.wait_for_function("document.querySelector('#candidate-detail h3').textContent.startsWith('<img')")
                for evidence_id in ('obs-01::0','obs-01::1','obs-02::0'):
                    review(page,evidence_id,'accept',payload)
                page.locator('#identity-check').check()
                page.locator('#approve-button').click()
                page.locator('#export-button').click()
                assert page.locator('#export-panel img').count()==0
                assert not page.evaluate('window.injected === true')
                local.write_text(download(page,'#download-readable'))
                offline=browser.new_page(viewport={'width':width,'height':900})
                offline.on('request',lambda request:external.append(request.url) if request.url.startswith(('http:','https:')) else None)
                offline.goto(local.as_uri())
                assert offline.locator('img').count()==0
                assert offline.locator('script').count()==0
                assert not offline.evaluate('window.injected === true')
                assert payload in offline.locator('h3').inner_text()
                assert not offline.evaluate('document.documentElement.scrollWidth > innerWidth')
                offline.close()
                assert not errors,errors
                assert not external,external
                print(f'PASS {width}px: recipient scope, offline readable download, weak-evidence judgement, unsafe text, no external requests')
                page.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__=='__main__':run()
