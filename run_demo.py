"""Run the synthetic, offline interview demo. No network or ATS writes."""

import json
from pathlib import Path

from research_handoff import approved_handoff, build_review_queue


ROOT = Path(__file__).resolve().parent


def read_fixture(name: str):
    return json.loads((ROOT / "fixtures" / name).read_text(encoding="utf-8"))


def main() -> None:
    brief = read_fixture("brief.json")
    findings = read_fixture("findings.json")
    decisions = read_fixture("mock_human_decisions.json")
    review_queue = build_review_queue(brief, findings)
    handoff = approved_handoff(review_queue, decisions)
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    (out / "review_queue.json").write_text(
        json.dumps(review_queue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (out / "mock_approved_handoff.json").write_text(
        json.dumps(handoff, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps({"summary": review_queue["summary"], "mock_approved_handoffs": len(handoff)}, indent=2))
    print("Wrote out/review_queue.json and out/mock_approved_handoff.json")


if __name__ == "__main__":
    main()
