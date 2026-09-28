"""Open the shipped meeting brief with networking and page JavaScript disabled."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os
import sys

ROOT = Path(__file__).resolve().parents[1]


def run():
    with sync_playwright() as p:
        options = {"headless": True}
        if os.environ.get("SIGNAL_DESK_CHROMIUM"):
            options["executable_path"] = os.environ["SIGNAL_DESK_CHROMIUM"]
        browser = p.chromium.launch(**options)
        for lang in ("uk", "en"):
            for width, height in ((1440, 1000), (390, 844)):
                context = browser.new_context(viewport={"width": width, "height": height}, java_script_enabled=False)
                context.set_offline(True)
                page = context.new_page()
                requests, errors = [], []
                page.on("request", lambda request: requests.append(request.url))
                page.on("pageerror", lambda error: errors.append(str(error)))
                file_url = (ROOT / f"docs/meeting-brief.{lang}.html").as_uri()
                page.goto(file_url)
                expect(page.locator("h1")).to_be_visible()
                expect(page.locator(".source")).to_have_count(2)
                expect(page.locator("table tbody tr")).to_have_count(5)
                assert page.locator("a[href*='/pull/11763']").count() == 1
                assert page.locator("a[href*='/pull/11703']").count() == 1
                assert requests == [file_url] and not errors
                assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth + 1")
                if "--screenshots" in sys.argv and lang == "uk":
                    page.screenshot(path=str(ROOT / "docs/screenshots" / f"meeting-brief-v0101-{width}.png"))
                print(f"PASS {lang} {width}px: offline, no script, two exact PRs, five lanes, no overflow")
                context.close()
        browser.close()


if __name__ == "__main__":
    run()
