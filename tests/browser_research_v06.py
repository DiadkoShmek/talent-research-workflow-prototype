"""Synthetic browser integration for the public-source human research loop."""

import argparse
from functools import partial
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright
from browser_smoke import ROOT, QuietHandler
from browser_research_v05 import API_PREFIX, REPOS, FIXTURES, downloaded_text


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--screenshots", action="store_true")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as p:
            launch = {"headless": True}
            if os.environ.get("SIGNAL_DESK_CHROMIUM"):
                launch["executable_path"] = os.environ["SIGNAL_DESK_CHROMIUM"]
            browser = p.chromium.launch(**launch)
            for label, width, height in (("desktop", 1440, 1000), ("mobile", 390, 844)):
                page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce", accept_downloads=True)
                errors, csp_errors, unexpected, api_calls = [], [], [], []
                mode = {"value": "ok"}
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on("console", lambda message: csp_errors.append(message.text)
                        if message.type == "error" and "Content Security Policy" in message.text else None)

                def route_request(route):
                    url = route.request.url
                    if url.startswith(base):
                        route.continue_()
                    elif url.startswith(API_PREFIX):
                        api_calls.append(url)
                        if mode["value"] == "rate":
                            route.fulfill(status=403, content_type="application/json", body='{"message":"API rate limit exceeded"}')
                            return
                        for repo in REPOS:
                            if url == f"{API_PREFIX}{repo}/commits?per_page=20":
                                route.fulfill(status=200, content_type="application/json", body=json.dumps(FIXTURES[repo]))
                                return
                        unexpected.append(url)
                        route.abort()
                    else:
                        unexpected.append(url)
                        route.abort()

                page.route("**/*", route_request)
                page.goto(base + "/?lang=uk")
                assert api_calls == []
                page.locator("#collect-research").click()
                expect(page.locator(".research-review-card")).to_have_count(2)
                assert page.locator(".research-review").evaluate("el => el.nextElementSibling.classList.contains('pilot-feedback') && el.nextElementSibling.nextElementSibling.classList.contains('research-raw-title')"), "Review and feedback must precede the full raw list"
                expect(page.locator("#download-follow-up")).to_be_disabled()
                first = page.locator('[data-review-lead="github:101"]')
                signal = first.locator("[data-review-evidence]").first
                signal.locator('[name="research-reason"]').fill("Inspected the public graph recovery diff.")
                signal.locator('[data-evidence-decision="relevant"]').click()
                expect(page.locator("#download-follow-up")).to_be_disabled()
                first = page.locator('[data-review-lead="github:101"]')
                first.locator('[name="lead-reason"]').fill("Check authorship and depth of the relevant work.")
                first.locator('[data-lead-decision="follow-up"]').click()
                expect(page.locator("#download-follow-up")).to_be_enabled()
                packet = json.loads(downloaded_text(page, "#download-follow-up-json"))
                assert packet["scope"] == "further-research-only-no-contact-or-candidate-approval"
                assert [lead["id"] for lead in packet["leads"]] == ["github:101"]
                assert len(packet["leads"][0]["evidence"]) == 1
                assert "synthetic-beta" not in json.dumps(packet)
                html = downloaded_text(page, "#download-follow-up")
                assert "synthetic-alpha" in html and "synthetic-beta" not in html
                assert "<script" not in html.lower()
                saved = json.loads(downloaded_text(page, "#download-review-session"))
                assert saved["schema"] == "signal-desk-research-review.v1"
                assert len(saved["actions"]) == 2
                if args.screenshots:
                    page.locator("#research-review-title").scroll_into_view_if_needed()
                    page.screenshot(path=str(ROOT / f"docs/screenshots/research-v06-{label}-viewport.png"))
                    page.locator('[data-review-lead="github:101"]').screenshot(path=str(ROOT / f"docs/screenshots/research-v06-{label}-review.png"))

                first = page.locator('[data-review-lead="github:101"]')
                first.locator("[data-review-evidence]").first.locator('[name="research-reason"]').fill("The author contribution is still unclear.")
                first.locator("[data-review-evidence]").first.locator('[data-evidence-decision="uncertain"]').click()
                expect(page.locator("#download-follow-up")).to_be_disabled()
                assert "Без рішення" in page.locator('[data-review-lead="github:101"]').inner_text()
                before_import = json.loads(downloaded_text(page, "#download-review-session"))
                page.once("dialog", lambda dialog: dialog.dismiss())
                page.locator("#research-file").set_input_files({"name": "saved-review.json", "mimeType": "application/json", "buffer": json.dumps(saved).encode()})
                assert json.loads(downloaded_text(page, "#download-review-session")) == before_import
                page.once("dialog", lambda dialog: dialog.accept())
                page.locator("#research-file").set_input_files({"name": "saved-review.json", "mimeType": "application/json", "buffer": json.dumps(saved).encode()})
                expect(page.locator("#download-follow-up")).to_be_enabled()
                restored = json.loads(downloaded_text(page, "#download-follow-up-json"))
                assert restored["sourceOrigin"] == "imported-file-unverified"

                # A failed source refresh is staged, never substituted for reviewed work.
                mode["value"] = "rate"
                page.locator("#collect-research").click()
                expect(page.locator(".research-attempt")).to_be_visible()
                failed = json.loads(downloaded_text(page, "#download-live-attempt"))
                assert failed["run"]["status"] == "failed" and failed["run"]["requests"] == 3
                assert json.loads(downloaded_text(page, "#download-review-session")) == saved
                expect(page.locator("#adopt-live-run")).to_be_disabled()

                # A successful new run also stages; cancellation keeps earlier decisions.
                mode["value"] = "ok"
                page.locator("#collect-research").click()
                expect(page.locator(".research-attempt")).to_be_visible()
                assert json.loads(downloaded_text(page, "#download-review-session")) == saved
                assert len(api_calls) == 9
                page.once("dialog", lambda dialog: dialog.dismiss())
                page.locator("#adopt-live-run").click()
                assert json.loads(downloaded_text(page, "#download-review-session")) == saved
                page.once("dialog", lambda dialog: dialog.accept())
                page.locator("#adopt-live-run").click()
                expect(page.locator(".research-review-card")).to_have_count(2)
                expect(page.locator("#download-follow-up")).to_be_disabled()
                assert "Дій у журналі: 0/100" in page.locator(".research-review-stats").inner_text()
                assert len(api_calls) == 9 and not unexpected
                assert not errors and not csp_errors, (errors, csp_errors)
                assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth + 1"), "horizontal overflow"
                page.close()
                print(f"PASS {width}px: public source review, scoped handoff, revocation, restore and fresh-run reset")
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
