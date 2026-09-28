"""Terminal-session UI proof; Python Playwright and Chromium are optional dev tools.

The test replaces only the app's initial state with a fixture built through 2000
real engine transitions. Rendering, controls and reset use the application code.
No test hook or preloaded state is shipped to users.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from threading import Thread
import os

from playwright.sync_api import sync_playwright
from browser_smoke import ROOT, QuietHandler

INITIAL = 'let state = createSession(demoProject());'
EXHAUSTED = '''let state = createSession(demoProject());
for (const ev of viewSession(state).candidates.find(c=>c.personKey==='person-olena').evidence)
 state=transition(state,{type:'review',evidenceId:ev.id,decision:'accept',reviewer:'Browser fixture',reason:'Fixture source checked'});
state=transition(state,{type:'identity',personKey:'person-olena',confirmed:true,reviewer:'Browser fixture'});
state=transition(state,{type:'approve',personKey:'person-olena',reviewer:'Browser fixture'});
const repeat={type:'review',evidenceId:'obs-03::0',decision:'accept',reviewer:'Browser fixture',reason:'Fill bounded journal'};
const cap=viewSession(state).session.eventLimit;
for(let i=5;i<cap;i++)state=transition(state,repeat);
'''


def run():
    source=(ROOT/'src/app.js').read_text()
    assert source.count(INITIAL)==1
    seeded=source.replace(INITIAL,EXHAUSTED)
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as p:
            launch={'headless':True}
            if os.environ.get('SIGNAL_DESK_CHROMIUM'):
                launch['executable_path']=os.environ['SIGNAL_DESK_CHROMIUM']
            browser=p.chromium.launch(**launch)
            for width in (1440,390):
                page=browser.new_page(viewport={'width':width,'height':844},reduced_motion='reduce')
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.route('**/src/app.js*',lambda route:route.fulfill(status=200,content_type='text/javascript',body=seeded))
                page.goto(base+'/?lang=uk')
                assert page.locator('#session-limit').is_visible()
                assert 'історія' in page.locator('#session-limit').inner_text()
                for selector in ('#export-button','#approve-button','#identity-check','#apply-cutoff','#apply-plan'):
                    assert page.locator(selector).is_disabled(),selector
                for control in page.locator('[data-review-form] button').all():
                    assert control.is_disabled()
                assert page.locator('#download-packet').count()==0
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
                page.locator('#reset').click()
                assert page.locator('#session-limit').count()==0
                assert page.locator('#export-button').is_disabled()
                assert page.locator('.review-record').count()==0
                assert page.locator('#identity-check').is_enabled()
                assert not page.locator('#identity-check').is_checked()
                assert not errors,errors
                print(f'PASS {width}px: real exhausted engine fixture locks decisions/export, explains history, reset clears approvals')
                page.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__=='__main__':
    run()
