"""Public download and disconnected local-file proof in pinned Linux WebKit.

Build tests/Dockerfile.webkit. This host's Ubuntu 25.10 lacks runtime libraries
required by Playwright's fallback WebKit build. This is not iPhone Safari.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import sys
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = "https://diadkoshmek.github.io/talent-research-workflow-prototype/?lang=uk&showcase=1"


def run():
    with sync_playwright() as playwright:
        browser = playwright.webkit.launch(headless=True)
        phone = {key: value for key, value in playwright.devices["iPhone 13"].items()
                 if key != "default_browser_type"}
        phone["viewport"] = {"width": 390, "height": 844}
        if "--offline-only" in sys.argv:
            reading = browser.new_context(**phone, java_script_enabled=False)
            reader = reading.new_page()
            requests, errors = [], []
            reader.on("request", lambda request: requests.append(request.url))
            reader.on("pageerror", lambda error: errors.append(str(error)))
            target = (ROOT / "docs/meeting-brief.uk.html").as_uri()
            reader.goto(target)
            expect(reader.locator(".source")).to_have_count(2)
            expect(reader.locator("table tbody tr")).to_have_count(5)
            assert all(url == target for url in requests) and not errors
            assert reader.locator("body").evaluate("el => el.scrollWidth <= innerWidth + 1")
            reading.close()
            browser.close()
            print("PASS mobile-profile WebKit 390px: script-free brief without network")
            return
        context = browser.new_context(**phone, accept_downloads=True)
        page = context.new_page()
        calls, errors = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("https://api.github.com/**", lambda route: (calls.append(route.request.url), route.abort()))
        page.goto(URL, wait_until="networkidle")
        expect(page.locator(".research-snapshot")).to_be_visible()
        expect(page.locator(".research-review-card")).to_have_count(8)
        expect(page.locator(".source-inspection-result")).to_have_count(2)
        assert not calls and not errors
        assert page.locator("body").evaluate("el => el.scrollWidth <= innerWidth + 1")
        with TemporaryDirectory() as temp:
            Path(temp).chmod(0o755)
            target = Path(temp) / "meeting-brief.uk.html"
            with page.expect_download() as event:
                page.locator(".research-snapshot a[download]").click()
            event.value.save_as(target)
            assert target.read_bytes() == (ROOT / "docs/meeting-brief.uk.html").read_bytes()
            context.close()
            reading = browser.new_context(**phone, java_script_enabled=False)
            reader = reading.new_page()
            requests, read_errors = [], []
            reader.on("request", lambda request: requests.append(request.url))
            reader.on("pageerror", lambda error: read_errors.append(str(error)))
            reader.goto(target.as_uri())
            expect(reader.locator(".source")).to_have_count(2)
            expect(reader.locator("table tbody tr")).to_have_count(5)
            assert all(url == target.as_uri() for url in requests) and not read_errors
            assert reader.locator("body").evaluate("el => el.scrollWidth <= innerWidth + 1")
            reading.close()
        browser.close()
    print("PASS mobile-profile WebKit 390px: public archive, exact download, script-free brief")


if __name__ == "__main__":
    run()
