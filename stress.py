"""Bounded deterministic pressure check of the local decision contract."""

from run_demo import read_fixture
from research_handoff import approved_handoff, build_review_queue


def main() -> None:
    brief = read_fixture("brief.json")
    findings = read_fixture("findings.json")
    decisions = read_fixture("mock_human_decisions.json")
    baseline = build_review_queue(brief, findings)
    for _ in range(200):
        current = build_review_queue(brief, findings)
        if current != baseline or len(approved_handoff(current, decisions)) != 1:
            raise SystemExit("contract drift under repeated local execution")
    print("PASS: 200 identical offline runs; one mock human-approved handoff each")


if __name__ == "__main__":
    main()
