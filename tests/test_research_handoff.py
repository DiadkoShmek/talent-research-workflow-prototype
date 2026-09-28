import copy
import json
import unittest

from research_handoff import ContractError, approved_handoff, build_review_queue
from run_demo import ROOT, read_fixture


class ResearchHandoffTests(unittest.TestCase):
    def setUp(self):
        self.brief = read_fixture("brief.json")
        self.findings = read_fixture("findings.json")

    def test_cross_channel_duplicate_is_one_person_with_both_sources(self):
        result = build_review_queue(self.brief, self.findings)
        self.assertEqual(result["summary"]["input_findings"], 6)
        self.assertEqual(result["summary"]["unique_people"], 5)
        self.assertEqual(result["summary"]["duplicate_findings_collapsed"], 1)
        candidate = result["queue"][0]
        self.assertEqual(candidate["person_key"], "synthetic-001")
        self.assertEqual(candidate["status"], "ready_for_human_source_check")
        self.assertEqual(len(candidate["hypotheses"]), 2)

    def test_missing_and_stale_evidence_do_not_enter_ready_queue(self):
        result = build_review_queue(self.brief, self.findings)
        by_key = {item["person_key"]: item for item in result["queue"]}
        self.assertEqual(by_key["synthetic-002"]["missing_criteria"], ["api"])
        self.assertEqual(by_key["synthetic-003"]["missing_criteria"], ["api", "python"])
        self.assertTrue(all(not item["fresh"] for item in by_key["synthetic-003"]["evidence"]))

    def test_identity_conflict_holds_even_when_criteria_are_present(self):
        findings = copy.deepcopy(self.findings)
        findings[1]["display_name"] = "Different Person"
        result = build_review_queue(self.brief, findings)
        self.assertEqual(result["queue"][0]["status"], "hold_identity_conflict")
        with self.assertRaises(ContractError):
            approved_handoff(result, {"synthetic-001": "approve"})

    def test_mock_handoff_requires_explicit_approval_and_complete_evidence(self):
        result = build_review_queue(self.brief, self.findings)
        self.assertEqual(approved_handoff(result, {}), [])
        handoff = approved_handoff(result, {"synthetic-001": "approve"})
        self.assertEqual(len(handoff), 1)
        self.assertEqual(handoff[0]["person_key"], "synthetic-001")
        with self.assertRaises(ContractError):
            approved_handoff(result, {"synthetic-002": "approve"})

    def test_unknown_criterion_and_duplicate_record_fail_before_queue(self):
        findings = copy.deepcopy(self.findings)
        findings[0]["claims"][0]["criterion_id"] = "imagined_skill"
        with self.assertRaises(ContractError):
            build_review_queue(self.brief, findings)
        findings = copy.deepcopy(self.findings)
        findings[1]["record_id"] = findings[0]["record_id"]
        with self.assertRaises(ContractError):
            build_review_queue(self.brief, findings)

    def test_checked_in_examples_match_executable_output(self):
        result = build_review_queue(self.brief, self.findings)
        handoff = approved_handoff(result, read_fixture("mock_human_decisions.json"))
        expected_queue = json.loads((ROOT / "examples" / "review_queue.json").read_text())
        expected_handoff = json.loads((ROOT / "examples" / "mock_approved_handoff.json").read_text())
        self.assertEqual(result, expected_queue)
        self.assertEqual(handoff, expected_handoff)


if __name__ == "__main__":
    unittest.main()
