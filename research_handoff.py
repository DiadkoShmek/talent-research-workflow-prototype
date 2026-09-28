"""A small, offline research-to-human-review contract.

This module does not search the web, call an LLM, verify URLs, contact candidates,
or write to an ATS. Findings are untrusted proposals until a person checks them.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date


class ContractError(ValueError):
    pass


def _fields(value: object, expected: set[str], label: str) -> dict:
    if not isinstance(value, dict) or set(value) != expected:
        raise ContractError(f"{label}: expected exactly {sorted(expected)}")
    return value


def _nonempty(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"{label}: expected non-empty text")
    return value.strip()


def _date(value: object, label: str) -> date:
    try:
        return date.fromisoformat(_nonempty(value, label))
    except ValueError as exc:
        raise ContractError(f"{label}: expected ISO date YYYY-MM-DD") from exc


def validate_brief(brief: object) -> dict:
    brief = _fields(
        brief, {"role_id", "role_title", "criteria", "freshness_cutoff"}, "brief"
    )
    _nonempty(brief["role_id"], "role_id")
    _nonempty(brief["role_title"], "role_title")
    _date(brief["freshness_cutoff"], "freshness_cutoff")
    if not isinstance(brief["criteria"], list) or not brief["criteria"]:
        raise ContractError("criteria: expected a non-empty list")
    seen = set()
    for index, criterion in enumerate(brief["criteria"]):
        criterion = _fields(criterion, {"id", "label"}, f"criterion[{index}]")
        criterion_id = _nonempty(criterion["id"], f"criterion[{index}].id")
        _nonempty(criterion["label"], f"criterion[{index}].label")
        if criterion_id in seen:
            raise ContractError(f"duplicate criterion: {criterion_id}")
        seen.add(criterion_id)
    return brief


def validate_findings(findings: object, criterion_ids: set[str]) -> list[dict]:
    if not isinstance(findings, list):
        raise ContractError("findings: expected a list")
    seen_records = set()
    for index, finding in enumerate(findings):
        finding = _fields(
            finding,
            {
                "record_id", "person_key", "display_name", "hypothesis",
                "source_ref", "observed_at", "claims",
            },
            f"finding[{index}]",
        )
        record_id = _nonempty(finding["record_id"], f"finding[{index}].record_id")
        if record_id in seen_records:
            raise ContractError(f"duplicate record_id: {record_id}")
        seen_records.add(record_id)
        for field in ("person_key", "display_name", "hypothesis", "source_ref"):
            _nonempty(finding[field], f"finding[{index}].{field}")
        _date(finding["observed_at"], f"finding[{index}].observed_at")
        if not isinstance(finding["claims"], list) or not finding["claims"]:
            raise ContractError(f"finding[{index}].claims: expected non-empty list")
        for claim_index, claim in enumerate(finding["claims"]):
            claim = _fields(
                claim, {"criterion_id", "snippet"},
                f"finding[{index}].claim[{claim_index}]",
            )
            criterion_id = _nonempty(claim["criterion_id"], "criterion_id")
            _nonempty(claim["snippet"], "snippet")
            if criterion_id not in criterion_ids:
                raise ContractError(f"unknown criterion: {criterion_id}")
    return findings


def build_review_queue(brief: object, findings: object) -> dict:
    """Group proposed findings; require a human to inspect every source."""
    brief = validate_brief(brief)
    criterion_ids = {item["id"] for item in brief["criteria"]}
    findings = validate_findings(findings, criterion_ids)
    cutoff = _date(brief["freshness_cutoff"], "freshness_cutoff")
    groups: dict[str, list[dict]] = defaultdict(list)
    for finding in findings:
        groups[finding["person_key"]].append(finding)

    queue = []
    for person_key, records in sorted(groups.items()):
        names = sorted({record["display_name"] for record in records})
        evidence = []
        seen_evidence = set()
        for record in records:
            for claim in record["claims"]:
                identity = (record["source_ref"], claim["criterion_id"], claim["snippet"])
                if identity in seen_evidence:
                    continue
                seen_evidence.add(identity)
                evidence.append({
                    "criterion_id": claim["criterion_id"],
                    "snippet": claim["snippet"],
                    "source_ref": record["source_ref"],
                    "observed_at": record["observed_at"],
                    "hypothesis": record["hypothesis"],
                    "fresh": _date(record["observed_at"], "observed_at") >= cutoff,
                })
        evidence.sort(key=lambda item: (item["criterion_id"], item["source_ref"]))
        fresh_criteria = {item["criterion_id"] for item in evidence if item["fresh"]}
        missing = sorted(criterion_ids - fresh_criteria)
        if len(names) != 1:
            status = "hold_identity_conflict"
        elif missing:
            status = "needs_more_evidence"
        else:
            status = "ready_for_human_source_check"
        queue.append({
            "person_key": person_key,
            "display_name": names[0] if len(names) == 1 else None,
            "status": status,
            "missing_criteria": missing,
            "hypotheses": sorted({record["hypothesis"] for record in records}),
            "record_ids": sorted(record["record_id"] for record in records),
            "evidence": evidence,
        })

    return {
        "role_id": brief["role_id"],
        "summary": {
            "input_findings": len(findings),
            "unique_people": len(queue),
            "duplicate_findings_collapsed": len(findings) - len(queue),
            "ready_for_human_source_check": sum(
                item["status"] == "ready_for_human_source_check" for item in queue
            ),
            "needs_more_evidence": sum(
                item["status"] == "needs_more_evidence" for item in queue
            ),
            "identity_conflicts": sum(
                item["status"] == "hold_identity_conflict" for item in queue
            ),
        },
        "queue": queue,
    }


def approved_handoff(review_queue: dict, decisions: object) -> list[dict]:
    """Produce a local mock handoff only for explicit human-approved entries."""
    if not isinstance(decisions, dict):
        raise ContractError("decisions: expected person_key -> approve/reject mapping")
    known = {item["person_key"] for item in review_queue["queue"]}
    if set(decisions) - known:
        raise ContractError("decisions: unknown person_key")
    if any(decision not in {"approve", "reject"} for decision in decisions.values()):
        raise ContractError("decisions: use only approve or reject")
    handoff = []
    for item in review_queue["queue"]:
        if decisions.get(item["person_key"]) != "approve":
            continue
        if item["status"] != "ready_for_human_source_check":
            raise ContractError(f"approval blocked for {item['person_key']}: {item['status']}")
        handoff.append({
            "role_id": review_queue["role_id"],
            "person_key": item["person_key"],
            "display_name": item["display_name"],
            "source_refs": sorted({entry["source_ref"] for entry in item["evidence"]}),
            "state": "mock_human_approved_research_handoff",
        })
    return handoff
