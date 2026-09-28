"""Five-lane browser pass with repeated PR evidence, source conflict and restore."""

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

API = "https://api.github.com"
MERGED = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
SOURCES = [
    ("langchain-ai/langgraphjs", 6000, 101, "fix(agent): isolate agent execution by thread"),
    ("vercel/ai", 6001, 102, "fix(tool): preserve streamed tool call ordering"),
    ("tldraw/tldraw", 6002, 103, "fix(editor): keep shape positions during resize"),
    ("triggerdotdev/trigger.dev", 6003, 104, "fix(agent): restore transcript after recovery"),
    ("remotion-dev/remotion", 6004, 105, "`@remotion/studio`: Fix timeline media flicker while trimming"),
    ("remotion-dev/remotion", 6005, 105, "`@remotion/studio`: Add ripple and source-only timeline trims"),
]


def row(repo, number, user_id, title):
    return {"number": number, "title": title,
            "user": {"id": user_id, "login": f"synthetic-{user_id}", "type": "User"},
            "html_url": f"https://github.com/{repo}/pull/{number}",
            "repository_url": f"{API}/repos/{repo}",
            "pull_request": {"merged_at": MERGED}}


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
                search_calls, detail_calls, file_calls, unexpected, errors = [], [], [], [], []
                page.on("pageerror", lambda error: errors.append(str(error)))

                def route_request(route):
                    url = route.request.url
                    if url.startswith(base):
                        route.continue_()
                        return
                    parsed = urlparse(url)
                    if parsed.scheme == "https" and parsed.netloc == "api.github.com" and parsed.path == "/search/issues":
                        search_calls.append(url)
                        query = parse_qs(parsed.query).get("q", [""])[0]
                        for repo in dict.fromkeys(source[0] for source in SOURCES):
                            if f"repo:{repo}" in query:
                                items = [row(*source) for source in SOURCES if source[0] == repo]
                                route.fulfill(status=200, content_type="application/json", body=json.dumps({
                                    "total_count": len(items), "incomplete_results": False, "items": items}))
                                return
                    for repo, number, user_id, _ in SOURCES:
                        path = f"/repos/{repo}/pulls/{number}"
                        if parsed.netloc == "api.github.com" and parsed.path == path:
                            detail_calls.append(url)
                            route.fulfill(status=200, content_type="application/json", body=json.dumps({
                                "number": number, "html_url": f"https://github.com/{repo}/pull/{number}",
                                "merged": True, "merged_at": MERGED,
                                "user": {"id": 999 if number == 6001 else user_id},
                                "additions": 34, "deletions": 7, "changed_files": 2}))
                            return
                        if parsed.netloc == "api.github.com" and parsed.path == path + "/files":
                            file_calls.append(url)
                            route.fulfill(status=200, content_type="application/json", body=json.dumps([
                                {"filename": "src/timeline.ts", "status": "modified", "additions": 27, "deletions": 5,
                                 "patch": "+preserve exact timeline state"},
                                {"filename": "tests/timeline.test.ts", "status": "added", "additions": 7,
                                 "deletions": 2, "patch": "+expect timeline trim recovery"}]))
                            return
                    unexpected.append(url)
                    route.abort()

                page.route("**/*", route_request)
                page.goto(base + "/?lang=uk")
                assert not search_calls and not detail_calls
                page.locator("#collect-role-search").click()
                expect(page.locator(".research-review-card")).to_have_count(5)
                assert len(search_calls) == 5 and not detail_calls
                if "--screenshots" in sys.argv:
                    page.locator(".research-summary").scroll_into_view_if_needed()
                    page.screenshot(path=str(ROOT / "docs" / "screenshots" / f"research-v091-{width}-product.png"))
                video = page.locator('[data-review-lead="github:105"]')
                expect(video.locator('[data-review-evidence]')).to_have_count(2)
                for evidence in video.locator('[data-review-evidence]').all():
                    evidence.locator('[data-inspect-source]').click()
                    expect(evidence.locator('.source-inspection-result')).to_be_visible()
                    evidence.locator('[name="research-reason"]').fill("Timeline code and tests merit a closer human review.")
                    evidence.locator('[data-evidence-decision="relevant"]').click()
                    video = page.locator('[data-review-lead="github:105"]')
                video.locator('[name="lead-reason"]').fill("Check which timeline design choices were individual work.")
                video.locator('[data-lead-decision="follow-up"]').click()
                selected = json.loads(downloaded_text(page, "#download-follow-up-json"))
                assert [lead["id"] for lead in selected["leads"]] == ["github:105"]
                assert len(selected["leads"][0]["evidence"]) == 2
                assert {item["number"] for item in selected["leads"][0]["evidence"]} == {6004, 6005}

                other = page.locator('[data-review-lead="github:102"] [data-review-evidence]')
                other.locator('[name="research-reason"]').fill("The tool stream may be relevant after source inspection.")
                other.locator('[data-evidence-decision="relevant"]').click()
                card = page.locator('[data-review-lead="github:102"]')
                card.locator('[name="lead-reason"]').fill("Confirm tool design ownership in the public PR.")
                card.locator('[data-lead-decision="follow-up"]').click()
                other.locator('[data-inspect-source]').click()
                expect(other.locator('.source-inspection-result')).to_be_visible()
                after_conflict = json.loads(downloaded_text(page, "#download-follow-up-json"))
                assert [lead["id"] for lead in after_conflict["leads"]] == ["github:105"]
                expect(other.locator('[data-evidence-decision="relevant"]')).to_be_disabled()

                page.locator("#start-pilot-feedback").click()
                feedback = page.locator('[data-pilot-lead="github:105"]')
                feedback.locator('[name="pilot-minutes"]').fill("8")
                feedback.locator('[name="pilot-reason"]').fill("Two changes need a recruiter to judge individual scope.")
                feedback.locator('[data-pilot-record]').click()
                report = json.loads(downloaded_text(page, "#download-research-json"))
                assert report["schema"] == "signal-desk-research.v3"
                assert report["run"]["requests"] == 5 and len(report["lanes"]) == 5
                saved = json.loads(downloaded_text(page, "#download-review-session"))
                assert len(detail_calls) == 3 and len(file_calls) == 3 and not unexpected and not errors
                assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth + 1")
                page.close()

                restored = browser.new_page(viewport={"width": width, "height": height}, accept_downloads=True)
                restored_errors = []
                restored.on("pageerror", lambda error: restored_errors.append(str(error)))
                restored.goto(base + "/?lang=uk")
                restored.locator("#research-file").set_input_files({
                    "name": "role-v3-review.json", "mimeType": "application/json", "buffer": json.dumps(saved).encode()})
                expect(restored.locator(".research-review-card")).to_have_count(5)
                restored_packet = json.loads(downloaded_text(restored, "#download-follow-up-json"))
                assert len(restored_packet["leads"][0]["evidence"]) == 2
                assert restored_packet["sourceOrigin"] == "imported-file-unverified"
                assert not restored_errors
                restored.close()
                print(f"PASS {width}px: five-lane search, repeated PRs, conflict, selected handoff, feedback and restore")
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
