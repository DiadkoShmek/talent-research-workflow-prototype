"""Offline contracts for the bounded public research pass."""

from datetime import datetime, timezone
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import json
import tempfile
import unittest
from urllib.error import HTTPError


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "research_pass.py"
SPEC = spec_from_file_location("research_pass", SCRIPT)
research_pass = module_from_spec(SPEC)
SPEC.loader.exec_module(research_pass)
NOW = lambda: datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc)


def commit(user_id=11, login="coder", *, sha="a" * 40, title="Add agent workflow", kind="User"):
    return {
        "sha": sha,
        "author": {"id": user_id, "login": login, "type": kind},
        "commit": {"message": title, "committer": {"date": "2026-09-27T10:30:00Z"}},
    }


def injected_fetch(responses):
    def fetch(url):
        repo = url.split("/repos/", 1)[1].split("/commits?", 1)[0]
        value = responses[repo]
        if isinstance(value, Exception):
            raise value
        return value
    return fetch


class ResearchPassTests(unittest.TestCase):
    def test_valid_rows_drop_bots_null_authors_and_untrusted_urls(self):
        rows = [
            commit(),
            commit(12, "github-actions", sha="b" * 40, kind="Bot"),
            {**commit(13, "missing", sha="c" * 40), "author": None},
            commit(14, "bad/name", sha="d" * 40),
            commit(15, "other", sha="not-a-sha"),
            {**commit(16, "unsafe", sha="e" * 40), "html_url": "https://attacker.example/unsafe"},
            commit(17, "email", sha="f" * 40, title="Contact person@example.com now"),
        ]
        report = research_pass.collect(injected_fetch({
            "langchain-ai/langgraphjs": rows,
            "vercel/ai": [],
            "tldraw/tldraw": [],
        }), now=NOW)
        self.assertEqual(report["run"]["status"], "partial")
        self.assertEqual([lane["status"] for lane in report["lanes"]], ["partial", "empty", "empty"])
        self.assertEqual((report["lanes"][0]["scanned"], report["lanes"][0]["skipped"], report["lanes"][0]["rejected"]), (7, 2, 4))
        self.assertEqual(report["lanes"][0]["observations"], 1)
        self.assertEqual(len(report["leads"]), 1)
        lead = report["leads"][0]
        self.assertEqual(lead["id"], "github:11")
        self.assertEqual(lead["profileUrl"], "https://github.com/coder")
        self.assertEqual(lead["evidence"][0]["url"], "https://github.com/langchain-ai/langgraphjs/commit/" + "a" * 40)
        self.assertEqual(len(lead["unknowns"]), 4)
        self.assertNotIn("attacker.example", json.dumps(report))

    def test_dedupe_immutable_id_across_lanes_and_bound_accounts_commits(self):
        first_lane = [
            commit(1, "same", sha=f"{n:040x}") for n in range(1, 4)
        ] + [commit(2, "second", sha="a" * 40), commit(3, "third", sha="b" * 40)]
        report = research_pass.collect(injected_fetch({
            "langchain-ai/langgraphjs": first_lane,
            "vercel/ai": [commit(1, "renamed", sha="c" * 40), commit(4, "fourth", sha="d" * 40)],
            "tldraw/tldraw": [],
        }), now=NOW)
        self.assertEqual([lead["id"] for lead in report["leads"]], ["github:1", "github:2", "github:4"])
        self.assertEqual([lane["observations"] for lane in report["lanes"]], [3, 2, 0])
        same = report["leads"][0]
        self.assertEqual(same["handle"], "same")
        self.assertEqual(same["hypothesisIds"], ["agent-orchestration", "ts-agent-tooling"])
        self.assertEqual(len(same["evidence"]), 3)
        self.assertEqual(report["lanes"][0]["leadIds"], ["github:1", "github:2"])

    def test_http_failure_makes_partial_report_and_does_not_leak_body(self):
        error = HTTPError("https://api.github.com/x", 403, "secret body", None, None)
        report = research_pass.collect(injected_fetch({
            "langchain-ai/langgraphjs": [commit()],
            "vercel/ai": error,
            "tldraw/tldraw": [],
        }), now=NOW)
        self.assertEqual(report["run"]["status"], "partial")
        self.assertEqual(report["lanes"][1]["error"], "HTTP 403")
        self.assertNotIn("secret body", json.dumps(report))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            research_pass.write_report(path, report)
            self.assertEqual(json.loads(path.read_text())["run"]["status"], "partial")

    def test_malformed_response_and_invalid_rows_do_not_become_leads(self):
        report = research_pass.collect(injected_fetch({
            "langchain-ai/langgraphjs": {"message": "rate limited"},
            "vercel/ai": [commit(title="\x00bad"), commit(22, "valid", sha="f" * 40, title="Word " * 80)],
            "tldraw/tldraw": [],
        }), now=NOW)
        self.assertEqual(report["run"]["status"], "partial")
        self.assertEqual(report["lanes"][0]["error"], "response is not a list")
        self.assertEqual(len(report["leads"]), 1)
        title = report["leads"][0]["evidence"][0]["title"]
        self.assertLessEqual(len(title), 160)
        self.assertLessEqual(len(title.split()), 25)

    def test_all_failures_are_failed_and_help_does_not_fetch(self):
        report = research_pass.collect(injected_fetch({repo: RuntimeError("private detail") for _, _, repo in research_pass.LANES}), now=NOW)
        self.assertEqual(report["run"]["status"], "failed")
        self.assertEqual(len(report["leads"]), 0)
        self.assertNotIn("private detail", json.dumps(report))
        self.assertEqual(research_pass.main([]), 0)

    def test_nonempty_all_malformed_is_error_not_successful_empty(self):
        report = research_pass.collect(injected_fetch({
            "langchain-ai/langgraphjs": [{"unexpected": "shape"}],
            "vercel/ai": [],
            "tldraw/tldraw": [],
        }), now=NOW)
        lane = report["lanes"][0]
        self.assertEqual(report["run"]["status"], "partial")
        self.assertEqual((lane["status"], lane["scanned"], lane["skipped"], lane["rejected"]), ("error", 1, 0, 1))
        self.assertEqual(report["leads"], [])

    def test_invalid_calendar_and_future_commit_dates_are_rejected(self):
        impossible = commit(1, "impossible", sha="a" * 40)
        impossible["commit"]["committer"]["date"] = "2026-02-30T10:30:00Z"
        future = commit(2, "future", sha="b" * 40)
        future["commit"]["committer"]["date"] = "2026-09-29T10:30:00Z"
        fractional_future = commit(3, "fractional", sha="c" * 40)
        fractional_future["commit"]["committer"]["date"] = "2026-09-28T12:00:00.000001Z"
        report = research_pass.collect(injected_fetch({
            "langchain-ai/langgraphjs": [impossible, future, fractional_future],
            "vercel/ai": [],
            "tldraw/tldraw": [],
        }), now=NOW)
        self.assertEqual(report["run"]["status"], "partial")
        self.assertEqual(report["lanes"][0]["rejected"], 3)
        self.assertEqual(report["leads"], [])

    def test_three_mixed_lanes_are_partial_and_duplicate_commit_owner_rejected(self):
        responses = {}
        for index, (_, _, repo) in enumerate(research_pass.LANES):
            responses[repo] = [commit(index + 1, f"coder{index}", sha=f"{index + 1:040x}"), {"broken": True}]
        report = research_pass.collect(injected_fetch(responses), now=NOW)
        self.assertEqual(report["run"]["status"], "partial")
        self.assertEqual([lane["status"] for lane in report["lanes"]], ["partial"] * 3)
        self.assertEqual(len(report["leads"]), 3)
        shared = commit(1, "one", sha="a" * 40)
        duplicate = commit(2, "two", sha="a" * 40)
        report = research_pass.collect(injected_fetch({
            "langchain-ai/langgraphjs": [shared, duplicate], "vercel/ai": [], "tldraw/tldraw": [],
        }), now=NOW)
        self.assertEqual(report["lanes"][0]["status"], "partial")
        self.assertEqual(report["lanes"][0]["rejected"], 1)
        self.assertEqual(len(report["leads"]), 1)


if __name__ == "__main__":
    unittest.main()
