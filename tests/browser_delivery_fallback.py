"""Browser counterexamples for failed app and archived-data delivery."""

from functools import partial
from http.server import ThreadingHTTPServer
from threading import Thread
import os
import sys

from playwright.sync_api import expect, sync_playwright
from browser_smoke import ROOT, QuietHandler


def run():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = os.environ.get("SIGNAL_DESK_BASE_URL", f"http://127.0.0.1:{server.server_port}").rstrip("/")
    try:
        with sync_playwright() as playwright:
            webkit = "--webkit" in sys.argv
            browser = (playwright.webkit if webkit else playwright.chromium).launch(headless=True)
            for width, height in ((1440, 1000), (390, 844)):
                for failure in ("archive-unavailable", "archive-corrupt", "app-unavailable"):
                    if webkit and width == 390:
                        phone = {key: value for key, value in playwright.devices["iPhone 13"].items()
                                 if key != "default_browser_type"}
                        phone["viewport"] = {"width": width, "height": height}
                        context = browser.new_context(**phone)
                    else:
                        context = browser.new_context(viewport={"width": width, "height": height})
                    page = context.new_page()
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    if failure == "archive-unavailable":
                        page.route("**/data/poolday-public-pass-2026-09-28.json",
                                   lambda route: route.fulfill(status=503, body="unavailable"))
                    elif failure == "archive-corrupt":
                        page.route("**/data/poolday-public-pass-2026-09-28.json",
                                   lambda route: route.fulfill(status=200, content_type="application/json",
                                                              body='{"schema":"forged"}'))
                    else:
                        page.route("**/src/app.js*", lambda route: route.abort())
                    page.goto(base + "/?lang=uk&showcase=1")
                    if failure.startswith("archive"):
                        expect(page.locator("#research-root .blocked-note")).to_be_visible()
                        expect(page.locator(".research-review-card")).to_have_count(0)
                        expect(page.locator("#workspace")).to_be_visible()
                        assert not errors, errors
                    pdf = page.locator('a[href="docs/meeting-brief.uk.pdf"]')
                    html = page.locator('a[href="docs/meeting-brief.uk.html"]')
                    expect(pdf).to_be_visible()
                    expect(html).to_be_visible()
                    if failure == "app-unavailable":
                        expect(page.locator(".startup-fallback h1")).to_have_text(
                            "Робочий стіл завантажується")
                        assert pdf.bounding_box()["height"] >= 44
                    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    print(f"PASS {'WebKit' if webkit else 'Chromium'} {width}px {failure}: visible PDF/HTML fallback, no overflow")
                    context.close()
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
