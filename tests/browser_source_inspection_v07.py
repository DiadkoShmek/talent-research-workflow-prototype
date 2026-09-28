"""One click opens a bounded GitHub commit preview next to the review decision."""

from functools import partial
from http.server import ThreadingHTTPServer
import argparse
import json
import os
from threading import Thread

from playwright.sync_api import expect, sync_playwright
from browser_smoke import ROOT, QuietHandler
from browser_research_v05 import API_PREFIX, REPOS, FIXTURES, downloaded_text


def detail(repo, sha, author_id):
    return {
        "sha": sha,
        "html_url": f"https://github.com/{repo}/commit/{sha}",
        "author": {"id": author_id, "login": "synthetic-alpha"},
        "stats": {"additions": 12, "deletions": 3},
        "files": [
            {"filename": "src/agent.ts", "status": "modified", "additions": 10, "deletions": 2,
             "patch": "@@ -1 +1 @@\n+safe agent change\n+contact test@example.com\n+<img src=x onerror=alert(1)>"},
            {"filename": "tests/agent.test.ts", "status": "added", "additions": 2, "deletions": 1,
             "patch": "@@ -0 +1 @@\n+test case"},
        ],
    }


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
            for width, height in ((1440, 1000), (390, 844)):
                page = browser.new_page(viewport={"width": width, "height": height}, accept_downloads=True)
                errors, csp_errors, unexpected, list_calls, detail_calls = [], [], [], [], []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on("console", lambda message: csp_errors.append(message.text)
                        if message.type == "error" and "Content Security Policy" in message.text else None)

                def route_request(route):
                    url = route.request.url
                    if url.startswith(base):
                        route.continue_()
                        return
                    if url.startswith(API_PREFIX):
                        for repo in REPOS:
                            if url == f"{API_PREFIX}{repo}/commits?per_page=20":
                                list_calls.append(url)
                                route.fulfill(status=200, content_type="application/json", body=json.dumps(FIXTURES[repo]))
                                return
                            for row in FIXTURES[repo]:
                                if url == f"{API_PREFIX}{repo}/commits/{row['sha']}":
                                    detail_calls.append(url)
                                    if row["author"]["id"] == 202:
                                        route.fulfill(status=403, body="rate limit")
                                    else:
                                        author_id = 999 if repo == "vercel/ai" else row["author"]["id"]
                                        route.fulfill(status=200, content_type="application/json", body=json.dumps(detail(repo, row["sha"], author_id)))
                                    return
                    unexpected.append(url)
                    route.abort()

                page.route("**/*", route_request)
                page.goto(base + "/?lang=uk")
                assert not list_calls and not detail_calls
                page.locator("#collect-research").click()
                expect(page.locator(".research-review-card")).to_have_count(2)
                assert len(list_calls) == 3 and not detail_calls
                card = page.locator('[data-review-lead="github:101"]')
                source = card.locator("[data-review-evidence]").first
                source.locator('[name="research-reason"]').fill("DRAFT_SURVIVES_SOURCE_READ")
                source.locator("[data-inspect-source]").click()
                expect(page.locator('[data-review-lead="github:101"] [data-review-evidence]').first.locator(".source-inspection-result")).to_be_visible()
                source = page.locator('[data-review-lead="github:101"] [data-review-evidence]').first
                assert source.locator('[name="research-reason"]').input_value() == "DRAFT_SURVIVES_SOURCE_READ"
                assert len(detail_calls) == 1
                result = source.locator(".source-inspection-result")
                assert "+12 / −3" in result.inner_text()
                assert "tests/agent.test.ts" in result.inner_text()
                assert "Числовий GitHub ID" in result.inner_text()
                result.locator("details").first.locator("summary").click()
                assert "[email hidden]" in result.inner_text()
                assert "test@example.com" not in result.inner_text()
                assert source.locator("img").count() == 0
                if args.screenshots:
                    source.scroll_into_view_if_needed()
                    page.screenshot(path=str(ROOT / f"docs/screenshots/research-v07-{width}-inspection.png"))

                # A newly discovered ID conflict withdraws a previously selected handoff.
                second = page.locator('[data-review-lead="github:101"] [data-review-evidence]').nth(1)
                second.locator('[name="research-reason"]').fill("The public diff seemed worth a follow-up.")
                second.locator('[data-evidence-decision="relevant"]').click()
                card = page.locator('[data-review-lead="github:101"]')
                card.locator('[name="lead-reason"]').fill("Check actual authorship and role fit.")
                card.locator('[data-lead-decision="follow-up"]').click()
                expect(page.locator("#download-follow-up-json")).to_be_enabled()
                second = page.locator('[data-review-lead="github:101"] [data-review-evidence]').nth(1)
                second.locator("[data-inspect-source]").click()
                expect(second.locator(".source-inspection-result")).to_be_visible()
                assert "Конфлікт" in second.inner_text()
                expect(second.locator('[data-evidence-decision="relevant"]')).to_be_disabled()
                expect(page.locator("#download-follow-up-json")).to_be_disabled()

                # A failed GitHub read has bounded retries and leaves the exact source link available.
                blocked = page.locator('[data-review-lead="github:202"] [data-review-evidence]').first
                blocked.locator("[data-inspect-source]").click()
                expect(blocked.locator("[role='alert']")).to_contain_text("HTTP 403")
                blocked.locator("[data-inspect-source]").click()
                expect(blocked.locator("[data-inspect-source]")).to_be_disabled()
                assert "github.com" in blocked.locator("a").first.get_attribute("href")

                # Human decision remains distinct from ephemeral diff preview.
                source = page.locator('[data-review-lead="github:101"] [data-review-evidence]').first
                source.locator('[data-evidence-decision="relevant"]').click()
                card = page.locator('[data-review-lead="github:101"]')
                card.locator('[name="lead-reason"]').fill("Check authorship and role fit with a recruiter.")
                card.locator('[data-lead-decision="follow-up"]').click()
                packet = json.loads(downloaded_text(page, "#download-follow-up-json"))
                assert "test@example.com" not in json.dumps(packet)
                assert "safe agent change" not in json.dumps(packet)
                assert [lead["id"] for lead in packet["leads"]] == ["github:101"]
                page.locator("#start-pilot-feedback").click()
                feedback_card = page.locator('[data-pilot-lead="github:101"]')
                feedback_card.locator('[name="pilot-minutes"]').fill("7")
                feedback_card.locator('[name="pilot-reason"]').fill("The exact source was worth one more research pass.")
                feedback_card.locator('[data-pilot-record]').click()
                assert "Оцінено: 1/1" in page.locator(".pilot-feedback-stats").inner_text()
                if args.screenshots:
                    page.locator("#pilot-feedback-title").scroll_into_view_if_needed()
                    page.screenshot(path=str(ROOT / f"docs/screenshots/research-v07-{width}-feedback.png"))
                saved_feedback = json.loads(downloaded_text(page, "#download-pilot-feedback"))
                assert saved_feedback["actions"][0]["assessorContext"] == "builder"
                assert saved_feedback["actions"][0]["minutes"] == 7
                assert saved_feedback["source"]["scope"] == "further-research-only-no-contact-or-candidate-approval"
                assert "test@example.com" not in json.dumps(saved_feedback)
                page.locator("#pilot-feedback-file").set_input_files({"name": "bad.json", "mimeType": "application/json", "buffer": b'{"schema":"wrong"}'})
                assert "Оцінено: 1/1" in page.locator(".pilot-feedback-stats").inner_text()
                fresh_page = browser.new_page(viewport={"width": width, "height": height}, accept_downloads=True)
                fresh_page.route("**/*", route_request)
                fresh_page.goto(base + "/?lang=uk")
                fresh_page.locator("#pilot-feedback-file").set_input_files({"name": "saved.json", "mimeType": "application/json", "buffer": json.dumps(saved_feedback).encode()})
                assert "Оцінено: 1/1" in fresh_page.locator(".pilot-feedback-stats").inner_text()
                assert fresh_page.locator('[data-pilot-lead="github:101"]').count() == 1
                assert fresh_page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth + 1")
                fresh_page.close()
                assert len(detail_calls) == 4 and not unexpected and not errors and not csp_errors, (detail_calls, unexpected, errors, csp_errors)
                assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth + 1")
                page.close()
                print(f"PASS {width}px: exact diff, conflict revocation, retry cap, scoped packet and local feedback restore")
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
