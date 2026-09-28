# Architecture

## Owner and seam

The core is a research-to-review contract. It accepts a human-defined role brief and proposed findings from multiple sourcing hypotheses, then emits one local review queue. A separate mock human decision may produce a local handoff file. Neither the reviewer nor an ATS is automated here.

The proposed seam is between Talent Partners' existing research/judgment and Operations' shared systems. Public sources suggest both sides exist; the exact internal gap requires a live search and team input.

## Data flow and contracts

1. `fixtures/brief.json`: role ID, title, required criteria, and a freshness cutoff. A real scorecard would be co-owned by a Talent Partner.
2. `fixtures/findings.json`: one proposal per source observation. Every claim has a criterion ID, snippet, source reference, and observation date. Four hypotheses are represented by synthetic examples; no live discovery occurs.
3. `research_handoff.build_review_queue`: rejects malformed records, duplicate record IDs, unknown criteria, and invalid dates. Groups by declared `person_key`; conflicting display names hold that identity. A criterion counts as present only when an associated observation meets the configured date cutoff.
4. Review queue: `ready_for_human_source_check`, `needs_more_evidence`, or `hold_identity_conflict`. “Ready” means enough referenced claims to **inspect**, not that the candidate is qualified.
5. `approved_handoff`: accepts a mock human decision fixture; only explicitly approved ready entries enter a local JSON export. No TeamTailor call is made.

## Failure behavior

| Input or state | Result |
| --- | --- |
| Unknown criterion, malformed record, duplicate record ID | Fail with `ContractError` |
| Two display names under one declared identity | Hold identity; approval blocked |
| Missing or stale evidence for a must-have | Needs more evidence; approval blocked |
| No human decision or explicit rejection | No handoff |
| Proposed source text that sounds convincing | Still requires human source inspection |

The prototype intentionally does not infer truth from a pasted snippet. Source fetching, provenance checks, identity resolution, permitted retention, and client-specific requirements are future contracts, not hidden capabilities.

## Pilot sequence after access

- **Weeks 1–2:** shadow one live search; map existing scorecard, source channels, review decisions, current ATS fields, and baseline times. Test 3–4 sourcing hypotheses offline without changing the live process.
- **Week 3:** run a small, consented or suitably sanitized research sample; ask a Talent Partner to mark useful, wrong, stale, and duplicate results. Revise the scorecard and intake contract.
- **Week 4:** if the team approves, try one controlled handoff path into TeamTailor or a manual import. Compare review time, accepted profiles, duplication, and missing fields to the baseline. Stop or revise if quality drops.

The posting's 2–3 day time-to-first-qualified-candidate target is a **three-month target**, not a promise made by this synthetic pilot.

## Stress and production boundary

`python3 stress.py` executes the same local contract 200 times and checks deterministic output. This tests repeatability of the small pure path, not throughput, provider behavior, real-world accuracy, privacy compliance, or production safety. A real integration would need authentication, scoped permissions, API error handling, idempotency, audit trails, data retention, human review identity, and rollback before any write.
