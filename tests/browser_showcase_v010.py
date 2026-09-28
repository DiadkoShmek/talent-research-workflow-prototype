"""Bundled public snapshot, human decision and live rate-limit recovery."""

from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import parse_qs, urlparse
import json
import os
import sys

from playwright.sync_api import expect, sync_playwright
from browser_smoke import ROOT, QuietHandler
from browser_research_v05 import downloaded_text

MERGED = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")


def run():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as p:
            launch = {"headless": True}
            if os.environ.get("SIGNAL_DESK_CHROMIUM"):
                launch["executable_path"] = os.environ["SIGNAL_DESK_CHROMIUM"]
            browser = p.chromium.launch(**launch)
            for width, height in ((1440, 1000), (390, 844)):
                page = browser.new_page(viewport={"width": width, "height": height}, accept_downloads=True)
                api_calls, unexpected, errors = [], [], []
                mode = {"value": "rate"}
                page.on("pageerror", lambda error: errors.append(str(error)))

                def route_api(route):
                    url = route.request.url
                    parsed = urlparse(url)
                    if parsed.path != "/search/issues":
                        unexpected.append(url)
                        route.abort()
                        return
                    api_calls.append(url)
                    if mode["value"] == "rate":
                        route.fulfill(status=403, content_type="application/json", body="{}")
                        return
                    query = parse_qs(parsed.query).get("q", [""])[0]
                    items = []
                    if "repo:remotion-dev/remotion" in query:
                        items = [{"number": 9001,
                                  "title": "`@remotion/studio`: Fix timeline frame rendering during trim",
                                  "user": {"id": 90001, "login": "synthetic-demo", "type": "User"},
                                  "html_url": "https://github.com/remotion-dev/remotion/pull/9001",
                                  "repository_url": "https://api.github.com/repos/remotion-dev/remotion",
                                  "pull_request": {"merged_at": MERGED}},
                                 {"number": 9002,
                                  "title": "fix: timeline frame alignment during trim",
                                  "user": {"id": 90002, "login": "synthetic-screened", "type": "User"},
                                  "html_url": "https://github.com/remotion-dev/remotion/pull/9002",
                                  "repository_url": "https://api.github.com/repos/remotion-dev/remotion",
                                  "pull_request": {"merged_at": MERGED}}]
                    route.fulfill(status=200, content_type="application/json", body=json.dumps({
                        "total_count": len(items), "incomplete_results": False, "items": items}))

                page.route("https://api.github.com/**", route_api)
                page.goto(base + "/?lang=uk&showcase=1")
                expect(page.locator(".research-snapshot")).to_be_visible()
                expect(page.locator(".research-review-card")).to_have_count(8)
                expect(page.locator(".source-inspection-result")).to_have_count(2)
                expect(page.locator(".research-snapshot a[download]")).to_have_attribute(
                    "href", "docs/meeting-brief.uk.html")
                assert not api_calls
                assert "test-file path" not in page.locator('[data-review-evidence="github-pr:remotion-dev/remotion:11703"]').inner_text()
                assert "шлях тестового файла" in page.locator('[data-review-evidence="github-pr:remotion-dev/remotion:11703"]').inner_text()
                if "--screenshots" in sys.argv:
                    page.locator(".research-snapshot").evaluate("el => el.scrollIntoView({block: 'start'})")
                    page.wait_for_timeout(350)
                    page.screenshot(path=str(ROOT / "docs" / "screenshots" / f"showcase-v010-{width}-product.png"))

                ids = ("github-pr:remotion-dev/remotion:11763", "github-pr:remotion-dev/remotion:11703")
                lead_id = page.locator(f'[data-review-evidence="{ids[0]}"]').evaluate(
                    "el => el.closest('[data-review-lead]').getAttribute('data-review-lead')")
                for evidence_id in ids:
                    source = page.locator(f'[data-review-evidence="{evidence_id}"]')
                    source.locator('[name="research-reason"]').fill("Timeline files merit a closer human review.")
                    source.locator('[data-evidence-decision="relevant"]').click()
                lead = page.locator(f'[data-review-lead="{lead_id}"]')
                lead.locator('[name="lead-reason"]').fill("Check the individual design contribution and role context.")
                lead.locator('[data-lead-decision="follow-up"]').click()
                packet = json.loads(downloaded_text(page, "#download-follow-up-json"))
                assert len(packet["leads"]) == 1 and len(packet["leads"][0]["evidence"]) == 2
                assert packet["sourceOrigin"] == "imported-file-unverified"
                assert not api_calls

                page.locator("#collect-role-search").click()
                expect(page.locator(".research-attempt")).to_be_visible()
                assert len(api_calls) == 1
                assert page.locator(".research-review-card").count() == 8
                assert page.locator(".research-snapshot").count() == 1
                expect(page.locator("#adopt-live-run")).to_be_disabled()
                failed = json.loads(downloaded_text(page, "#download-live-attempt"))
                assert failed["run"]["status"] == "failed" and failed["run"]["requests"] == 1
                retained = json.loads(downloaded_text(page, "#download-follow-up-json"))
                assert len(retained["leads"][0]["evidence"]) == 2

                mode["value"] = "success"
                page.locator("#collect-role-search").click()
                expect(page.locator("#adopt-live-run")).to_be_enabled()
                assert len(api_calls) == 6
                assert "repo:remotion-dev/remotion" in parse_qs(urlparse(api_calls[1]).query)["q"][0]
                assert page.locator(".research-review-card").count() == 8
                page.locator("#adopt-live-run").click()
                expect(page.locator(".research-review-card")).to_have_count(1)
                assert page.locator(".research-snapshot").count() == 0
                screened = page.locator(".research-screened").first
                expect(screened).to_contain_text("Відсіяні з точним посиланням 1/1")
                screened.locator("summary").click()
                expect(screened).to_contain_text("fix: timeline frame alignment during trim")
                assert screened.locator("a").get_attribute("href") == "https://github.com/remotion-dev/remotion/pull/9002"
                expect(page.locator("#download-follow-up-json")).to_be_disabled()
                assert not unexpected and not errors
                assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth + 1")
                print(f"PASS {width}px: bundled sources, human packet, rate-stop preservation and explicit live adoption")
                page.close()
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
