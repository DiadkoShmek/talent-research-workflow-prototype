# Security boundaries — local v0.5

This is a static interview prototype. These are implemented controls and their limits, not a production security certification.

| Boundary | Control | Remaining limit |
|---|---|---|
| Public GitHub → research report | Three fixed HTTPS endpoints; GET only; browser credentials omitted; redirects refused; response cap 2 MiB; bounded records; explicit malformed/partial/failure states | API attribution and public text can be wrong. GitHub `User` is an account type, not proof of a human or independent authorship. No arbitrary-URL crawler. |
| Research JSON → page / exported HTML | Exact schema, canonical source URLs, consistent counts, immutable account IDs, strict dates, escaped text; no HTML execution | A coherent edited file can fabricate observations and timestamps. Imported provenance remains unverified. |
| Manual decisions → restored session | Original project and actions replayed through the engine; 2 MiB / 2000-action caps; no trusted imported approval bit | Replay establishes rule consistency, not reviewer identity, authenticity or truth. |
| Browser → local storage | Store errors do not discard current in-memory work; malformed prior storage and observed other-tab changes are not overwritten | Same-origin storage is readable by scripts on that origin; no encryption or authentication. Conflict detection is not atomic multi-tab coordination. |
| Review → recipient | Existing schema v2 includes only latest supporting decisions; session backup is a separate, explicitly fuller file | User-entered source text or retained notes can still include private material. Recipient scoping is not automatic redaction. |
| Rendered page → external execution | Index CSP permits same-origin scripts/styles, the exact SHA-256 hash of the existing inline handoff stylesheet, GitHub API connections and local/data images; no general inline styles/scripts, eval, forms or objects; no referrer | Chromium v0.5 checks exercised CSP on the page, guided packet and offline downloads; this is not a cross-browser security audit. A meta CSP cannot supply hosting-level frame-ancestor protection or defend against malicious allowed scripts. |
| Offline report | Escaped content, canonical links, no scripts; CSP `default-src 'none'` with inline styles only | Opening a source link intentionally leaves the file; the file is not authenticated. |

## Network and authority

The manual example, guided replay and storage code do not call external APIs. Public collection runs only after its button or the Python `--live` flag. No credentials are read; no company systems, messaging or personal email fields are used. The browser collector has a 10-second abort; Python uses a 10-second socket timeout (not a strict wall-clock deadline for a slow streamed response). API availability and anonymous rate limits can prevent a run.

Collected accounts are research leads. No automatic hiring, rejection, contact, suitability scoring, protected-trait inference or eligibility decision is implemented. A recent commit may be a release chore or a coauthored change; inspecting the full source is necessary before drawing narrower technical conclusions.

## Executed proof and release gate

Run `npm test` and `python3 -m unittest discover -s tests -p test_research_pass_v1.py`. Tests exercise unsafe source URLs and markup, contradictory counts/statuses, malformed and future dates, duplicate attribution, API failure, replay limits, quota errors and observed storage conflicts. A separate contract test binds the exact handoff stylesheet bytes to the site CSP hash; changing those styles requires updating that digest. These checks do not replace a browser/CORS/storage/download check.

The prepared GitHub workflow runs these offline checks with read-only repository permissions, no persisted checkout credentials and pinned action revisions. The code-release run passed in GitHub; see the linked verification record. It neither deploys nor enforces the separate Pages release path. See [the verification record](verification.md) for actual evidence and remaining gates.
