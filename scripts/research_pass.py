#!/usr/bin/env python3
"""Bounded, read-only public GitHub observation pass for a human research queue."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import tempfile
import time
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


ROLE = {
    "title": "Senior Agentic Software Engineer — Poolday",
    "url": "https://aplayers.na.teamtailor.com/jobs/536324-senior-agentic-software-engineer-poolday",
}
LANES = (
    ("agent-orchestration", "Agent orchestration", "langchain-ai/langgraphjs"),
    ("ts-agent-tooling", "TypeScript tools and agents", "vercel/ai"),
    ("programmable-editor", "Programmable React editor", "tldraw/tldraw"),
)
UNKNOWNS = [
    "5+ professional years",
    "Europe eligibility",
    "availability and interest",
    "full role fit",
]
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
SHA_RE = re.compile(r"[0-9a-fA-F]{40}(?:[0-9a-fA-F]{24})?\Z")
LOGIN_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\Z")
DATE_RE = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)\Z")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("redirect refused")


def query_url(repo: str) -> str:
    # Repositories come only from the fixed allowlist above.
    return f"https://api.github.com/repos/{repo}/commits?per_page=20"


def fetch_public_commits(url: str) -> object:
    if url not in {query_url(repo) for _, _, repo in LANES}:
        raise ValueError("URL outside fixed GitHub API allowlist")
    request = Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "signal-desk-public-research/1.0",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="GET",
    )
    opener = build_opener(NoRedirect())
    with opener.open(request, timeout=10) as response:
        if response.headers.get("Content-Length"):
            try:
                if int(response.headers["Content-Length"]) > MAX_RESPONSE_BYTES:
                    raise ValueError("response exceeds size limit")
            except ValueError as exc:
                if str(exc) == "response exceeds size limit":
                    raise
                raise ValueError("invalid response size") from exc
        payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            raise ValueError("response exceeds size limit")
    return json.loads(payload.decode("utf-8"))


def _safe_date(value: object) -> bool:
    if not isinstance(value, str) or not DATE_RE.fullmatch(value):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _not_future(value: str, observed_at: str) -> bool:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) <= datetime.fromisoformat(observed_at.replace("Z", "+00:00"))


def _title(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    first_line = value.splitlines()[0].strip() if value else ""
    if not first_line or EMAIL_RE.search(first_line) or any(ord(c) < 32 or ord(c) == 127 for c in first_line):
        return None
    # An exact prefix of one public title: at most 160 characters and 25 words.
    excerpt = first_line[:160]
    matches = list(re.finditer(r"\S+", excerpt))
    if len(matches) > 25:
        excerpt = excerpt[: matches[24].end()]
    return excerpt


def _observation(row: object, repo: str, observed_at: str) -> tuple[int, str, dict] | None:
    if not isinstance(row, dict):
        return None
    author = row.get("author")
    if not isinstance(author, dict) or author.get("type") != "User":
        return None
    user_id, login = author.get("id"), author.get("login")
    if type(user_id) is not int or user_id <= 0 or not isinstance(login, str):
        return None
    if not LOGIN_RE.fullmatch(login) or login.lower().endswith("[bot]"):
        return None
    sha = row.get("sha")
    if not isinstance(sha, str) or not SHA_RE.fullmatch(sha):
        return None
    canonical_commit_url = f"https://github.com/{repo}/commit/{sha.lower()}"
    canonical_profile_url = f"https://github.com/{login}"
    if "html_url" in row and row["html_url"] != canonical_commit_url:
        return None
    if "html_url" in author and author["html_url"] != canonical_profile_url:
        return None
    commit = row.get("commit")
    if not isinstance(commit, dict):
        return None
    title = _title(commit.get("message"))
    committer = commit.get("committer")
    committed_at = committer.get("date") if isinstance(committer, dict) else None
    if title is None or not _safe_date(committed_at) or not _not_future(committed_at, observed_at):
        return None
    evidence = {
        "id": f"github-commit:{repo}:{sha.lower()}",
        "kind": "github-commit",
        "url": canonical_commit_url,
        "repository": repo,
        "title": title,
        "committedAt": committed_at,
        "observedAt": observed_at,
    }
    return user_id, login, evidence


def _known_skip(row: object) -> bool:
    """Known non-account commits are skips; schema drift is a rejection."""
    if not isinstance(row, dict):
        return False
    author = row.get("author")
    return ("author" in row and author is None) or (isinstance(author, dict) and author.get("type") in {"Bot", "Organization"})


def _error_label(exc: Exception) -> str:
    if isinstance(exc, HTTPError):
        return f"HTTP {exc.code}"
    if isinstance(exc, URLError):
        return "network error"
    if isinstance(exc, (TimeoutError, OSError)):
        return "network error"
    if isinstance(exc, (json.JSONDecodeError, UnicodeError)):
        return "invalid JSON response"
    if isinstance(exc, ValueError):
        allowed = {
            "redirect refused", "response exceeds size limit", "invalid response size",
            "URL outside fixed GitHub API allowlist", "response is not a list",
        }
        return str(exc) if str(exc) in allowed else "invalid response"
    return "request failed"


def collect(fetch: Callable[[str], object] = fetch_public_commits, *, now: Callable[[], datetime] | None = None) -> dict:
    """Fetch three fixed lanes concurrently; never infer qualification from activity."""
    clock = now or (lambda: datetime.now(timezone.utc))
    started = time.monotonic()
    observed_at = clock().astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    results: dict[str, object] = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {lane_id: pool.submit(fetch, query_url(repo)) for lane_id, _, repo in LANES}
        for lane_id, future in futures.items():
            try:
                results[lane_id] = future.result()
            except Exception as exc:  # Per-lane failure remains visible in the report.
                results[lane_id] = exc

    leads_by_id: dict[str, dict] = {}
    evidence_owner: dict[str, str] = {}
    lanes = []
    for lane_id, label, repo in LANES:
        lane = {
            "id": lane_id,
            "label": label,
            "repo": repo,
            "queryUrl": query_url(repo),
            "status": "empty",
            "scanned": 0,
            "skipped": 0,
            "rejected": 0,
            "observations": 0,
            "leadIds": [],
        }
        rows = results[lane_id]
        if isinstance(rows, Exception) or not isinstance(rows, list):
            lane["status"] = "error"
            lane["error"] = _error_label(rows if isinstance(rows, Exception) else ValueError("response is not a list"))
            lanes.append(lane)
            continue
        lane_counts: dict[str, int] = {}
        for row in rows[:20]:
            lane["scanned"] += 1
            if _known_skip(row):
                lane["skipped"] += 1
                continue
            parsed = _observation(row, repo, observed_at)
            if parsed is None:
                lane["rejected"] += 1
                continue
            user_id, login, evidence = parsed
            lead_id = f"github:{user_id}"
            if evidence["id"] in evidence_owner and evidence_owner[evidence["id"]] != lead_id:
                lane["rejected"] += 1
                continue
            if lead_id not in lane_counts and len(lane_counts) >= 2:
                continue
            if lane_counts.get(lead_id, 0) >= 2:
                continue
            lead = leads_by_id.get(lead_id)
            if lead is None:
                lead = {
                    "id": lead_id,
                    "handle": login,
                    "profileUrl": f"https://github.com/{login}",
                    "hypothesisIds": [],
                    "evidence": [],
                    "unknowns": list(UNKNOWNS),
                }
                leads_by_id[lead_id] = lead
            if evidence["id"] in {item["id"] for item in lead["evidence"]}:
                continue
            if lane_id not in lead["hypothesisIds"]:
                lead["hypothesisIds"].append(lane_id)
            lead["evidence"].append(evidence)
            evidence_owner[evidence["id"]] = lead_id
            lane_counts[lead_id] = lane_counts.get(lead_id, 0) + 1
        lane["observations"] = sum(lane_counts.values())
        lane["leadIds"] = list(lane_counts)
        if lane_counts:
            lane["status"] = "ok"
        if lane["rejected"]:
            lane["status"] = "partial" if lane["observations"] else "error"
            lane["error"] = f"{lane['rejected']} malformed rows rejected"
        lanes.append(lane)

    errors = sum(lane["status"] == "error" for lane in lanes)
    status = "failed" if errors == len(lanes) else "partial" if any(lane["status"] in {"error", "partial"} for lane in lanes) else "complete"
    return {
        "schema": "signal-desk-research.v1",
        "role": dict(ROLE),
        "run": {
            "observedAt": observed_at,
            "elapsedMs": round((time.monotonic() - started) * 1000),
            "requests": len(LANES),
            "mode": "public-api-read-only",
            "selectionNote": "Seeded-repository discovery in three fixed public repositories; API order is not a ranking or a whole-web search.",
            "status": status,
        },
        "lanes": lanes,
        "leads": list(leads_by_id.values()),
    }


def write_report(path: Path, report: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False) as temp:
            temp_name = temp.name
            temp.write(payload)
            temp.flush()
            os.fsync(temp.fileno())
        os.replace(temp_name, path)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="perform three read-only public GitHub API requests")
    parser.add_argument("--output", type=Path, help="write a JSON report atomically to this path")
    args = parser.parse_args(argv)
    if not args.live:
        parser.print_help()
        return 0
    if args.output is None:
        parser.error("--live requires --output")
    report = collect()
    write_report(args.output, report)
    print(f"{report['run']['status']}: {len(report['leads'])} public accounts; report: {args.output}")
    return 0 if report["run"]["status"] == "complete" else 2


if __name__ == "__main__":
    raise SystemExit(main())
