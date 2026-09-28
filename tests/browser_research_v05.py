"""v0.5 integration gate for research, guided handoff, and manual recovery.

Requires Python Playwright and Chromium:
    python3 tests/browser_research_v05.py [--screenshots]

GitHub API calls are fulfilled from fixed local fixtures; this test does not
depend on API availability, rate limits, or real professional accounts.
"""

import argparse
from functools import partial
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread

from playwright.sync_api import expect, sync_playwright
from browser_smoke import ROOT, QuietHandler


API_PREFIX = "https://api.github.com/repos/"
REPOS = ("langchain-ai/langgraphjs", "vercel/ai", "tldraw/tldraw")


def commit(user_id, login, repo, sha, title):
    return {
        "sha": sha,
        "author": {"id": user_id, "login": login, "type": "User"},
        "commit": {"message": title, "committer": {"date": "2026-09-20T10:30:00Z"}},
        "html_url": f"https://github.com/{repo}/commit/{sha}",
    }


FIXTURES = {
    "langchain-ai/langgraphjs": [commit(101, "synthetic-alpha", "langchain-ai/langgraphjs", "a" * 40, "Test graph run recovery")],
    "vercel/ai": [commit(101, "synthetic-alpha", "vercel/ai", "b" * 40, "Test streamed tool events")],
    "tldraw/tldraw": [commit(202, "synthetic-beta", "tldraw/tldraw", "c" * 40, "Test editor state")],
}


def downloaded_text(page, selector):
    with page.expect_download() as result:
        page.locator(selector).click()
    return Path(result.value.path()).read_text(encoding="utf-8")


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("--screenshots", action="store_true")
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as p, TemporaryDirectory() as directory:
            launch = {"headless": True}
            if os.environ.get("SIGNAL_DESK_CHROMIUM"):
                launch["executable_path"] = os.environ["SIGNAL_DESK_CHROMIUM"]
            browser = p.chromium.launch(**launch)
            for label, width, height in (("desktop", 1440, 1000), ("mobile", 390, 844)):
                page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce", accept_downloads=True)
                errors, csp_errors, unexpected, api_calls = [], [], [], []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on("console", lambda message: csp_errors.append(message.text)
                        if message.type == "error" and ("Content Security Policy" in message.text or "Refused to" in message.text) else None)

                def route_request(route):
                    url = route.request.url
                    if url.startswith(base):
                        route.continue_()
                        return
                    if url.startswith(API_PREFIX):
                        api_calls.append(url)
                        for repo in REPOS:
                            if url == f"{API_PREFIX}{repo}/commits?per_page=20":
                                route.fulfill(status=200, content_type="application/json", body=json.dumps(FIXTURES[repo]))
                                return
                    unexpected.append(url)
                    route.abort()

                page.route("**/*", route_request)
                page.goto(base + "/?lang=uk")
                page.locator("#collect-research").wait_for()
                assert api_calls == [], "GitHub requests started before explicit collection"

                # A pending human note survives research-only refreshes and guided steps.
                card = page.locator('[data-evidence="obs-01::0"]')
                card.locator("summary").click()
                card.locator('input[name="reason"]').fill("DRAFT_UNSUBMITTED_NOTE")
                page.locator("#collect-research").click()
                page.locator("#download-research").wait_for()
                assert len(api_calls) == 3 and set(api_calls) == {
                    f"{API_PREFIX}{repo}/commits?per_page=20" for repo in REPOS
                }
                assert "DRAFT_UNSUBMITTED_NOTE" == page.locator('[data-evidence="obs-01::0"] input[name="reason"]').input_value()
                summary = page.locator("#research-root .research-summary")
                assert "2" in summary.inner_text(), "Two GitHub IDs should remain after duplicate grouping"
                assert page.locator(".research-lead").count() == 2
                assert page.locator('[data-research-lead="github:101"] li').count() == 2
                assert page.locator('[data-research-lead="github:202"] li').count() == 1
                assert page.locator("#research-root").inner_text().count("synthetic-alpha") >= 1
                page.locator("#collect-research").click()
                expect(page.locator("#collect-research")).to_be_enabled()
                expect(page.locator(".research-lead")).to_have_count(2)
                assert len(api_calls) == 6, "Explicit refresh should make exactly three new requests"
                assert "DRAFT_UNSUBMITTED_NOTE" == page.locator('[data-evidence="obs-01::0"] input[name="reason"]').input_value()

                brief = downloaded_text(page, "#download-research")
                report = json.loads(downloaded_text(page, "#download-research-json"))
                assert report["schema"] == "signal-desk-research.v1"
                assert report["role"]["title"] == "Senior Agentic Software Engineer — Poolday"
                assert report["run"]["requests"] == 3
                assert len(report["leads"]) == 2
                assert "synthetic-alpha" in brief and "synthetic-beta" in brief
                assert "signal-desk-handoff.v2" not in brief
                assert "<script" not in brief.lower()
                continuation = downloaded_text(page, "#download-research-note")
                assert "Senior Agentic Software Engineer — Poolday" in continuation
                assert "github:101" in continuation and "github:202" in continuation
                assert all(f"{API_PREFIX}{repo}/commits?per_page=20" in continuation for repo in REPOS)
                assert all(item["url"] in continuation for lead in report["leads"] for item in lead["evidence"])
                assert "Виграш наперед не припускається" in continuation
                assert "Brain" in continuation and "ATS" in continuation
                assert "DRAFT_UNSUBMITTED_NOTE" not in continuation
                if args.screenshots:
                    page.locator("#research-heading").scroll_into_view_if_needed()
                    page.screenshot(path=str(ROOT / f"docs/screenshots/research-v05-{label}-viewport.png"))
                    page.locator(".research-lead").first.screenshot(path=str(ROOT / f"docs/screenshots/research-v05-{label}-lead.png"))

                # A corrupted research import retains the previously collected report.
                malformed_report = {**report, "run": {**report["run"], "status": "failed"}}
                page.locator("#research-file").set_input_files({
                    "name": "bad-research.json", "mimeType": "application/json", "buffer": json.dumps(malformed_report).encode()
                })
                assert page.locator(".research-lead").count() == 2
                assert "Файл дослідження відхилено" in page.locator("#research-root").inner_text()
                assert "DRAFT_UNSUBMITTED_NOTE" == page.locator('[data-evidence="obs-01::0"] input[name="reason"]').input_value()

                page.locator("#open-walkthrough").click()
                for step in range(1, 4):
                    page.locator("#walkthrough-next").click()
                    assert page.locator(f'[data-demo-step="{step}"]').count() == 1
                    assert "DRAFT_UNSUBMITTED_NOTE" == page.locator('[data-evidence="obs-01::0"] input[name="reason"]').input_value()
                page.locator(".walkthrough-packet > summary").click()
                handoff = page.locator('[data-demo-step="3"] .handoff')
                assert handoff.locator('[data-handoff-person="person-olena"]').count() == 1
                assert handoff.locator("[data-handoff-evidence]").count() == 3
                assert "Що ще невідомо" in handoff.inner_text()
                assert handoff.locator(".handoff-card").evaluate("node => getComputedStyle(node).backgroundColor") != "rgba(0, 0, 0, 0)"

                offline_html = downloaded_text(page, "#download-walkthrough")
                assert "Content-Security-Policy" in offline_html
                assert "<script" not in offline_html.lower()
                offline_path = Path(directory) / f"walkthrough-{label}.html"
                offline_path.write_text(offline_html, encoding="utf-8")
                offline = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
                offline_errors, offline_csp, offline_network = [], [], []
                offline.on("pageerror", lambda error: offline_errors.append(str(error)))
                offline.on("console", lambda message: offline_csp.append(message.text)
                           if message.type == "error" and ("Content Security Policy" in message.text or "Refused to" in message.text) else None)
                offline.on("request", lambda request: offline_network.append(request.url)
                           if request.url.startswith(("http:", "https:")) else None)
                offline.goto(offline_path.as_uri())
                assert offline.locator('[data-demo-step="3"] [data-handoff-person="person-olena"]').count() == 1
                assert offline.locator('[data-demo-step="3"] [data-handoff-evidence]').count() == 3
                assert offline.locator('[data-demo-step="3"] .handoff-card').evaluate("node => getComputedStyle(node).paddingLeft") != "0px"
                assert not offline.evaluate("document.documentElement.scrollWidth > innerWidth")
                assert not offline_errors and not offline_csp and not offline_network, (offline_errors, offline_csp, offline_network)
                offline.close()

                # Submitting a real manual decision autosaves it; reload replays that decision.
                page.locator('[data-evidence="obs-01::0"] button[value="accept"]').click()
                assert "DRAFT_UNSUBMITTED_NOTE" in page.locator('[data-evidence="obs-01::0"] .review-record').inner_text()
                assert page.evaluate("localStorage.getItem('signal-desk.session.v1') !== null")
                saved = json.loads(downloaded_text(page, "#download-session"))
                assert saved["schema"] == "signal-desk-session.v1"
                assert any(action.get("reason") == "DRAFT_UNSUBMITTED_NOTE" for action in saved["actions"])
                before_reload = len(api_calls)
                page.reload()
                page.locator('[data-evidence="obs-01::0"] .review-record').wait_for()
                assert "DRAFT_UNSUBMITTED_NOTE" in page.locator('[data-evidence="obs-01::0"] .review-record').inner_text()
                assert len(api_calls) == before_reload, "Reload unexpectedly collected from GitHub"
                assert page.locator(".research-lead").count() == 0, "Research report should need explicit download/import"

                # A saved research report can be reopened without altering manual decisions.
                page.locator("#research-file").set_input_files({
                    "name": "research.json", "mimeType": "application/json", "buffer": json.dumps(report).encode()
                })
                expect(page.locator(".research-lead")).to_have_count(2)
                assert "походження файлу не підтверджено" in page.locator("#research-root").inner_text()
                assert "DRAFT_UNSUBMITTED_NOTE" in page.locator('[data-evidence="obs-01::0"] .review-record').inner_text()

                # A full session file recovers a submitted decision after a deliberate reset.
                page.locator("#reset").click()
                assert page.locator('[data-evidence="obs-01::0"] .review-record').count() == 0
                page.locator("#session-file").set_input_files({
                    "name": "session.json", "mimeType": "application/json", "buffer": json.dumps(saved).encode()
                })
                assert "DRAFT_UNSUBMITTED_NOTE" in page.locator('[data-evidence="obs-01::0"] .review-record').inner_text()

                # Malformed full-session import cannot replace the working state.
                forged_session = {**saved, "approved": True}
                page.locator("#session-file").set_input_files({
                    "name": "bad-session.json", "mimeType": "application/json", "buffer": json.dumps(forged_session).encode()
                })
                assert "DRAFT_UNSUBMITTED_NOTE" in page.locator('[data-evidence="obs-01::0"] .review-record').inner_text()
                assert "Файл сесії відхилено" in page.locator("#notice").inner_text()
                assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
                assert not errors and not csp_errors and not unexpected, (errors, csp_errors, unexpected)
                print(f"PASS {width}px: explicit bounded research, separate reports, guided handoff, draft continuity, autosave/reload, safe failed imports")
                page.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    run()
