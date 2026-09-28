# Evidence and limits

This is an independent interview prototype. Its built-in example uses invented people and source text. A user can import a local JSON example; the application cannot verify whether imported content is fictional. It has no relationship with A-Players' internal systems.

## What a live demonstration can establish

The browser workbench can demonstrate whether the review rule is coherent and inspectable: a reviewer sees a proposed finding, confirms identity, reviews claims individually, changes the freshness cutoff, approves or revokes a handoff, and sees a local export change. Automated tests can establish deterministic outcomes for those local actions. This is **workflow behavior**, not proof that claims are true or that recruiters save time.

The older Python command-line demo is a separate reference. Its tests and 200 repeated runs apply to `research_handoff.py`, not automatically to the browser engine. Browser behavior should be reported as verified only after its own tests and an actual UI run.

## Trust and privacy boundaries

| Boundary | Present behavior | Unknown or future work |
| --- | --- | --- |
| Candidate data | Built-in fictional fixture; local JSON import allowed with fictionality unverified | Legal basis, consent, retention, deletion, access controls for real people |
| Sources | Embedded source text; imported references must begin with `synthetic://`; quotes must occur in text | Fetching, source availability, ownership, citation integrity, truth of imported content |
| Identity | Declared grouping, collision hold within a group or across groups sharing one identity reference, and in-session human confirmation | Reliable real-person matching and correction |
| Review | In-session actions | Authenticated reviewer, durable audit trail, training and quality checks |
| Storage | Memory cleared on reload; optional local export | Encrypted persistence, backups, retention |
| External systems | None | TeamTailor mapping, credentials, rate limits, idempotency, retries, rollback |
| Internal knowledge | None | Brain schema, permission scope, sensitive client information |

The observation date is a recency signal only. The demo uses a supplied fixed `asOf` snapshot (2026-09-28 in the standard example) to refuse later observations; it does not use the computer's current date for this rule. Source snippets and accepted reviews are not independent proof of truth, skill, consent, or fit. The tool does not infer protected traits, psychological traits, or suitability scores. It does not contact, reject, or hire anyone. The export is a local demonstration file, not a TeamTailor write or consent record.

## Outcome claims needing a pilot

The [public role brief](https://aplayers.na.teamtailor.com/jobs/617015-talent-engineer-ai-automation-a-players) expresses a desired shorter time to first qualified candidate and more high-signal interviews. This prototype has no baseline, live search, recruiter usage, ATS data, or hiring outcome. It cannot establish speed improvement, accuracy, recruiter acceptance, interview conversion, or revenue impact.

The first real test should compare one permitted search with its baseline and record speed **and** quality: time to first recruiter-accepted profile, review minutes per accepted profile, duplicates, missing fields, stale or wrong claims, and acceptance rate. A faster queue that sends more weak or uncheckable profiles is a failure. See the [Ukrainian pilot plan](pilot-plan.uk.md).
