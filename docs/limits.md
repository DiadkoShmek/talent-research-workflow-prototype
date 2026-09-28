# What this prototype proves and does not prove

## Implemented

- Exact local input shape for a role brief and proposed source findings.
- Duplicate grouping by a declared synthetic person key.
- Evidence-date and missing-criterion visibility.
- An identity-conflict hold and mock human-approved local export.
- A readable review queue and summary counts.

## Tested

- One cross-channel duplicate collapses to one person while retaining both sources.
- Stale or missing must-have evidence does not enter the ready queue.
- A conflicting identity blocks mock approval.
- An unknown criterion or repeated record ID fails intake.
- A mock handoff requires an explicit approval and complete referenced evidence.
- Two hundred repeated runs produce the same local result.

## Not implemented or measured

- Live candidate discovery or semantic search.
- A real model call or prompt evaluation.
- Verification that a source exists or a claim is true.
- Reliable identity matching from real-world names and profiles.
- Candidate data consent, privacy, retention, or deletion policies.
- TeamTailor, Gmail, LinkedIn, Clay, or any other provider integration.
- Real human authentication for review decisions.
- Actual funnel analytics, recruiter time savings, interview conversion, or hiring outcomes.

All people, sources, and approvals in the fixtures are fictional. The artifact is for discussing an integration seam, not evaluating real candidates. It is not affiliated with or endorsed by A-Players.
