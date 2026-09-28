# Evidence and limits

This is an independent interview prototype. Its built-in example uses invented people and source text. A user can import a local JSON example; the application cannot verify whether imported content is fictional. It has no relationship with A-Players' internal systems.

## What a live demonstration can establish

The browser workbench can demonstrate whether the review rule is coherent and inspectable: a reviewer sees a proposed finding, confirms identity, reviews claims individually, changes the freshness cutoff, approves or revokes a handoff, and sees a local export change. Automated tests can establish deterministic outcomes for those local actions. This is **workflow behavior**, not proof that claims are true or that recruiters save time.

The older Python command-line demo is a separate reference. Its tests and 200 repeated runs apply to `research_handoff.py`, not automatically to the browser engine. Browser behavior should be reported as verified only after its own tests and an actual UI run.

An in-session search plan can change the objective text, selected required criteria, and which existing sample channels participate. This filters already-collected observations, changes the computed queue and clears previous reviews, identity confirmations, and approvals. A channel switch does not start or stop real-world searching. The tool does not interpret the objective, discover sources, or establish that one channel performs better in real recruiting. Known identity conflicts remain blocked even when the conflicting observation is in an inactive channel.

Each session is limited to 2000 recorded actions. At that limit, previous decisions remain visible as history, but new decisions and handoff export are blocked. Reset starts a new session with no reviews or approvals. This local limit and reset do not provide durable storage or recovery.

## Trust and privacy boundaries

| Boundary | Present behavior | Unknown or future work |
| --- | --- | --- |
| Candidate data | Built-in fictional fixture; local JSON import allowed with fictionality unverified | Legal basis, consent, retention, deletion, access controls for real people |
| Sources | Embedded source text; imported references must begin with `synthetic://`; quotes must occur in text | Fetching, source availability, ownership, citation integrity, truth of imported content |
| Identity | Declared grouping, collision hold within a group or across groups sharing one identity reference, and in-session human confirmation | Reliable real-person matching and correction |
| Review | In-session actions | Authenticated reviewer, durable audit trail, training and quality checks |
| Storage | Memory cleared on reload; local HTML and JSON snapshot downloads | Encrypted persistence, backups, retention, retraction of an already shared file |
| External systems | None | TeamTailor mapping, credentials, rate limits, idempotency, retries, rollback |
| Internal knowledge | None | Brain schema, permission scope, sensitive client information |

The observation date is a recency signal only. The demo uses a supplied fixed `asOf` snapshot (2026-09-28 in the standard example) to refuse later observations; it does not use the computer's current date for this rule. Source snippets and accepted reviews are not independent proof of truth, skill, consent, or fit. In the [fictional webinar example](../examples/webinar-rehearsal.json), accepting a quote about training attendance can satisfy the automation criterion even though the source does not establish hands-on implementation. The human reviewer owns that semantic judgment. The tool does not infer protected traits, psychological traits, or suitability scores. It does not contact, reject, or hire anyone. The export is a local demonstration snapshot, not a TeamTailor write or consent record.

The recipient packet uses `signal-desk-handoff.v2` and includes only current accepted fresh evidence for selected required criteria and the latest supporting review, identity and approval decisions. The full in-session journal stays in the workbench; global plan/cutoff events and plan-change reasons do not enter the packet. The readable HTML card and JSON are local downloads. The HTML has no script and escapes displayed text, but embedded source text and free-form reasons can mention other people. There is no automatic redaction, privacy certification, authenticated reviewer identity, or way to retract a file after download. Inspect the card before sharing it.

Channel counts describe local review state: fresh accepted, rejected, and pending claims, with stale claims separately. An inactive channel has zero current review workload; its archived sample availability is a separate field. Contribution to a handoff requires accepted fresh evidence for a selected required criterion. One person may appear in several channels, so these counts are not additive successes. Coverage shows selected required criteria and counts unique active people with a fresh proposed claim or fresh accepted claim; neither count means a recruiter accepted the person.

## Outcome claims needing a pilot

The [public role brief](https://aplayers.na.teamtailor.com/jobs/617015-talent-engineer-ai-automation-a-players) expresses a desired shorter time to first qualified candidate and more high-signal interviews. This prototype has no baseline, live search, recruiter usage, ATS data, or hiring outcome. It cannot establish speed improvement, accuracy, recruiter acceptance, interview conversion, or revenue impact.

The first real test should compare one permitted search with its baseline and record speed **and** quality: time to first recruiter-accepted profile, review minutes per accepted profile, duplicates, missing fields, stale or wrong claims, and acceptance rate. A faster queue that sends more weak or uncheckable profiles is a failure. See the [Ukrainian pilot plan](pilot-plan.uk.md).
