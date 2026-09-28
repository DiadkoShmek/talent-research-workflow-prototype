"""Legacy v2 role-search import through inspection, review and local feedback."""

from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.parse import parse_qs, urlparse
import json
import os
import sys

from playwright.sync_api import expect, sync_playwright
from browser_smoke import ROOT, QuietHandler
from browser_research_v05 import downloaded_text

API = "https://api.github.com"
LANES = [
    ("langchain-ai/langgraphjs", "fix(langgraph): isolate concurrent agent invocations by thread"),
    ("vercel/ai", "fix(tool): preserve streamed tool call ordering"),
    ("tldraw/tldraw", "fix(editor): keep shape positions during resize"),
    ("triggerdotdev/trigger.dev", "fix(agent): restore transcript after recovery"),
]
MERGED_AT = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")


def item(repo, title, index):
    number = 5000 + index
    return {"number": number, "title": title,
            "user": {"id": 101 + index, "login": f"synthetic-{index}", "type": "User"},
            "html_url": f"https://github.com/{repo}/pull/{number}",
            "repository_url": f"{API}/repos/{repo}",
            "pull_request": {"merged_at": MERGED_AT}}


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
                query_calls, detail_calls, file_calls, unexpected, errors = [], [], [], [], []
                page.on("pageerror", lambda error: errors.append(str(error)))

                def route_request(route):
                    url = route.request.url
                    if url.startswith(base):
                        route.continue_()
                        return
                    parsed = urlparse(url)
                    if parsed.scheme == "https" and parsed.netloc == "api.github.com" and parsed.path == "/search/issues":
                        query_calls.append(url)
                        query = parse_qs(parsed.query).get("q", [""])[0]
                        for index, (repo, title) in enumerate(LANES):
                            if f"repo:{repo}" in query:
                                route.fulfill(status=200, content_type="application/json", body=json.dumps({
                                    "total_count": 1, "incomplete_results": False, "items": [item(repo, title, index)]}))
                                return
                    for index, (repo, title) in enumerate(LANES):
                        path = f"/repos/{repo}/pulls/{5000 + index}"
                        if parsed.netloc == "api.github.com" and parsed.path == path:
                            detail_calls.append(url)
                            route.fulfill(status=200, content_type="application/json", body=json.dumps({
                                "number": 5000 + index,
                                "html_url": f"https://github.com/{repo}/pull/{5000 + index}",
                                "merged": True, "merged_at": MERGED_AT,
                                "user": {"id": 999 if index == 1 else 101 + index},
                                "additions": 34, "deletions": 7, "changed_files": 2}))
                            return
                        if parsed.netloc == "api.github.com" and parsed.path == path + "/files":
                            file_calls.append(url)
                            route.fulfill(status=200, content_type="application/json", body=json.dumps([
                                {"filename": "src/agent.ts", "status": "modified", "additions": 27, "deletions": 5,
                                 "patch": "+restore checkpoint after tool error"},
                                {"filename": "tests/agent.test.ts", "status": "added", "additions": 7,
                                 "deletions": 2, "patch": "+expect resumed run"}]))
                            return
                    unexpected.append(url)
                    route.abort()

                page.route("**/*", route_request)
                page.goto(base + "/?lang=uk")
                assert not query_calls and not detail_calls and not file_calls
                legacy_report = page.evaluate("""async () => {
                    const { collectRoleSearch } = await import('./src/role-search.js?v=0.9.0');
                    return collectRoleSearch(fetch);
                }""")
                page.locator("#research-file").set_input_files({
                    "name": "legacy-role-v2.json", "mimeType": "application/json",
                    "buffer": json.dumps(legacy_report).encode()})
                expect(page.locator(".research-review-card")).to_have_count(4)
                assert len(query_calls) == 4 and not detail_calls
                assert all("is%3Apr" in url and "is%3Amerged" in url for url in query_calls)
                first = page.locator('[data-review-lead="github:101"] [data-review-evidence]').first
                first.locator("[data-inspect-source]").click()
                expect(first.locator(".source-inspection-result")).to_be_visible()
                assert "tests/agent.test.ts" in first.inner_text()
                assert len(detail_calls) == 1 and len(file_calls) == 1
                second = page.locator('[data-review-lead="github:102"] [data-review-evidence]').first
                second.locator('[name="research-reason"]').fill("Looks technically relevant for another pass.")
                second.locator('[data-evidence-decision="relevant"]').click()
                second_card = page.locator('[data-review-lead="github:102"]')
                second_card.locator('[name="lead-reason"]').fill("Verify individual authorship and scope.")
                second_card.locator('[data-lead-decision="follow-up"]').click()
                second = page.locator('[data-review-lead="github:102"] [data-review-evidence]').first
                second.locator("[data-inspect-source]").click()
                expect(second.locator(".source-inspection-result")).to_be_visible()
                expect(second.locator('[data-evidence-decision="relevant"]')).to_be_disabled()
                expect(page.locator("#download-follow-up-json")).to_be_disabled()
                first = page.locator('[data-review-lead="github:101"] [data-review-evidence]').first
                first.locator('[name="research-reason"]').fill("The merged change shows checkpoint recovery logic.")
                first.locator('[data-evidence-decision="relevant"]').click()
                first_card = page.locator('[data-review-lead="github:101"]')
                first_card.locator('[name="lead-reason"]').fill("Ask which part of the recovery was their own design.")
                first_card.locator('[data-lead-decision="follow-up"]').click()
                packet = json.loads(downloaded_text(page, "#download-follow-up-json"))
                assert [lead["id"] for lead in packet["leads"]] == ["github:101"]
                assert packet["leads"][0]["evidence"][0]["kind"] == "github-pr"
                page.locator("#start-pilot-feedback").click()
                feedback = page.locator('[data-pilot-lead="github:101"]')
                feedback.locator('[name="pilot-minutes"]').fill("6")
                feedback.locator('[name="pilot-reason"]').fill("The PR merits another human research step.")
                feedback.locator('[data-pilot-record]').click()
                assert "Оцінено: 1/1" in page.locator(".pilot-feedback-stats").inner_text()
                report = json.loads(downloaded_text(page, "#download-research-json"))
                assert report["schema"] == "signal-desk-research.v2" and len(report["lanes"]) == 4
                saved_review = json.loads(downloaded_text(page, "#download-review-session"))
                assert saved_review["report"]["schema"] == "signal-desk-research.v2"
                assert len(detail_calls) == 2 and len(file_calls) == 2 and not unexpected and not errors
                assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth + 1")
                page.close()

                restored_page = browser.new_page(viewport={"width": width, "height": height}, accept_downloads=True)
                restored_errors = []
                restored_page.on("pageerror", lambda error: restored_errors.append(str(error)))
                restored_page.goto(base + "/?lang=uk")
                restored_page.locator("#research-file").set_input_files({
                    "name": "role-review.json", "mimeType": "application/json",
                    "buffer": json.dumps(saved_review).encode()})
                expect(restored_page.locator(".research-review-card")).to_have_count(4)
                restored_packet = json.loads(downloaded_text(restored_page, "#download-follow-up-json"))
                assert [lead["id"] for lead in restored_packet["leads"]] == ["github:101"]
                assert restored_packet["sourceOrigin"] == "imported-file-unverified"
                expect(restored_page.locator('[data-review-lead="github:102"] [data-evidence-decision="relevant"]')).to_be_disabled()
                assert not restored_errors
                restored_page.close()
                print(f"PASS {width}px: v2 import, merged PR source proof, conflict withdrawal, feedback and no overflow")
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
