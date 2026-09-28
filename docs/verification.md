# Verification record — 28 September 2026

## Published code release v0.6

Code revision `dda170c62eb13fb10f2c12f00a4cd67d08f8506c` passed [GitHub offline contracts](https://github.com/DiadkoShmek/talent-research-workflow-prototype/actions/runs/36444360217) and [Pages deployment](https://github.com/DiadkoShmek/talent-research-workflow-prototype/actions/runs/36444357940). Fifteen public application files matched local bytes, including the new review policy and renderer. A Chromium check on the **published page** at 1440 and 390 px used synthetic GitHub API fixtures and completed source assessment → explicit follow-up → selected-only JSON. It observed no pre-click API requests, exactly three on click, no unexpected external requests, JavaScript/CSP errors or horizontal overflow.

A separate **real public-page API pass** at 390 px made three actual GitHub GETs after the click and displayed six account IDs and responses from all three seeded lanes in about **0.52 seconds**. Six accounts are research leads, not qualified candidates; this one observed run is neither an availability promise nor a recruiting benchmark. The later verification-document commit changes no application code.

## Local v0.6 proof

- `npm test`: **47/47 passed**, including source-bound replay, forged action refusal, scoped follow-up packet, decision withdrawal, script injection and 100-action terminal gate.
- `npm run stress`: **200/200** synthetic fictional review/export/invalidation cycles passed. `python3 -m unittest discover -s tests -p 'test_*.py'`: **14/14** Python tests passed offline.
- Five Chromium scripts passed at **1440 and 390 px**: manual smoke, recipient handoff, terminal session, v0.5 research/recovery, and the v0.6 public-source review. The v0.6 scenario uses synthetic API fixtures and verifies a source decision, explicit follow-up, selected-only HTML/JSON, full-session export/restore, invalidation on source reassessment, fresh-run reset, no pre-click GitHub calls, no JavaScript/CSP errors and no horizontal overflow. Four checked-in v0.6 screenshots use only synthetic fixtures; desktop/mobile views were visually inspected.
- `git diff --check` passed. The private live account report remains outside this public repository. These local checks do **not** establish recruiter acceptance or accurate source interpretation. Deployment and a public-page check are recorded separately above.

## Published code release v0.5

Code revision `7b41504c9b19a58e89c57cc848ede0c2ac871036` passed [GitHub offline contracts](https://github.com/DiadkoShmek/talent-research-workflow-prototype/actions/runs/36441791486) and [Pages deployment](https://github.com/DiadkoShmek/talent-research-workflow-prototype/actions/runs/36441788089). All fourteen public application files matched local bytes. A subsequent public-page Chromium check at **390 px** observed no pre-click API requests, then three real GETs: **complete, six account IDs, ten observations, 533 ms**. JSON and continuation-note downloads, styled guided handoff and zero page overflow/JavaScript/CSP errors were confirmed. The later documentation update records this code-release proof without changing application bytes.

## Historical local v0.5 additions

- `npm test`: **44/44 passed**. Includes engine contracts and 200 synthetic cycles; guided replay and both languages; script attribution; full session replay; capped-state restoration; quota/observed-tab conflict; collection/parsing; inconsistent status/count/identity rejection; source-URL substitution and HTML injection tests; Markdown continuation export; exact handoff CSS hash against the site CSP.
- `python3 -m unittest discover -s tests -p test_research_pass_v1.py`: **8/8 passed** with injected responses and no live requests. This suite is for the new collector, not the historical Python handoff demo.
- `node --check src/app.js` and `git diff --check`: passed.
- **Actual public pass:** the Python CLI completed three unauthenticated GET requests at `2026-09-28T14:50:55Z`. 60 records examined; 17 known skipped rows (bot/organization/null author categories), zero malformed records; six distinct GitHub account IDs; ten retained commit associations. All three lanes returned `ok`. Measured collection time: **490 ms**, one run, excluding later source review. These are not six qualified or recruiter-accepted candidates.
- The actual Python output was accepted by the JS `validateResearchReport` in **Node**, then rendered into Ukrainian and English standalone HTML. Private data files are outside this repository. This proves cross-runtime acceptance of this run, not universal parity or browser fetch/CORS behavior.
- Independent read-only review checked app state replacement, original-project tracking, module identity, scripted attribution, export scope, source validation and public collection integration. Found and fixed malformed data being treated as empty; also repaired `failed` with usable observations by adding explicit lane `partial`. Both collectors reject impossible/future dates and conflicting duplicate commit ownership.
- CUA was unavailable. After Artur directly authorized local Playwright, **v0.5 browser checks passed at 1440 and 390 px**: `browser_smoke.py`, `browser_handoff.py`, `browser_session_limit.py`, and `browser_research_v05.py`. The new test intercepts GitHub with synthetic fixtures: three requests only on click, immutable-ID grouping, reports/continuation-note downloads, draft isolation, styled walkthrough packet, offline HTML, autosave/reload, valid report/session restoration after reset, and failed imports preserving state. Source/API parsing adversaries are also covered independently in Node/Python. An initial harness wait used eval blocked by the new CSP; it was replaced with locator assertions without weakening the policy.
- **Actual browser API pass:** at `2026-09-28T15:06:22Z`, Chromium loaded the local page and made exactly three real GitHub GET requests after the button click. Result: `complete`, all three lanes `ok`, six accounts, ten observations, **521 ms**. Actual JSON/HTML downloads succeeded; no JavaScript or CSP errors. This separately verifies the browser fetch/CORS path for one run. It is not an uptime promise or recruiting benchmark.
- Screenshots `research-v05-*` use synthetic API fixtures and are distinguished from the private screenshot of the actual public-source run. Private account reports, source review and live proof are kept outside the public repository.
- Local review measured synchronous session serialization around 185 ms at 2000 actions for a small fixture. It replays the full history after each accepted action; this is not a phone performance guarantee.
- `.github/workflows/verify.yml` runs offline contract checks with read-only permissions and pinned action revisions. It does not gate or deploy the separate GitHub Pages workflow; remote run status is separate evidence.
- These are local v0.5 proofs. Publishing must additionally establish the deployed revision, public asset bytes and behavior; v0.4 evidence below is historical.

### Release checks

1. Local core/browser scenarios passed at desktop and phone widths; inspect the deployed page again after release.
2. Local actual GitHub collection and explicit-click isolation passed. API failures and partial results have deterministic parser tests; availability remains external.
3. Saved research import, JSON/HTML/Markdown downloads, and full manual session restore passed in Chromium. Private real reports remain outside the public repository.
4. Browser autosave/reload and guided/manual draft isolation passed. Storage denial/quota/observed-tab conflict are covered with an injected Node storage adapter; concurrent real tabs are not a supported collaboration mode.
5. Existing handoff, event-cap and full smoke paths passed against v0.5. Inspect the release file list; keep real account reports and the private dossier outside the public repo.

## Historical v0.4 record

### Previously executed checks

- `npm test`: **19/19** Node engine tests passed. New v0.4 cases check that the recipient packet excludes another person's decision notes, overwritten reviews, and internal plan-change notes while retaining only the latest supporting decisions. Earlier cases cover plan changes, scope, archived identity conflicts, unique-person coverage, immutable state and the 2000-event terminal gate.
- `python3 tests/browser_handoff.py --screenshots`: **1440/390 px passed**. Added a rejected Petro note, approved Olena, and inspected the actual JSON and readable HTML downloads: the unrelated structured event and its note were absent. Opened the downloaded HTML offline and checked its evidence, unknowns, next human action, overflow and lack of external requests. Checked English labels/download, unsafe imported names/source text/reasons rendered as text, and no scripts or injected images in the output. Inspected the saved desktop and phone handoff screenshots.
- The same browser check imported `examples/webinar-rehearsal.json`: rejecting the webinar-only automation quote blocked approval and handoff; accepting it as a negative control enabled approval. This establishes that the engine follows human judgement, not that it understands the quality of evidence. Artur's own rehearsal has not been observed.
- `python3 tests/browser_session_limit.py`: **1440/390 px passed**. The local test seeds initial state through 2000 real engine actions, then runs the application rendering and reset. It verifies the terminal notice, disabled decision and handoff controls, visible history, absence of a download action, and a fresh reset. The seed is a test-only replacement of the app's initial state; no test hook is shipped in the application.
- `npm run stress` (v0.3 baseline): **200/200** complete local review → identity → approval → export → invalidation flows passed in 144 ms. This checks deterministic replay, not production throughput; that separate script was not rerun for v0.4. The current Node suite also contains 200 repeated synthetic sessions.
- `python3 tests/browser_smoke.py --screenshots`: Chromium at **1440 × 1000** and **390 × 844**. Verified review reasons, locked/unlocked approval, real JSON download, invalid future-date input preserving the current session, cutoff invalidation, identity conflict refusal, language switching, search, safe HTML rendering after JSON import, and reset behavior. The v0.3 browser pass also approved Olena, changed the active plan, saw approval and reviews reset, checked the missing automation evidence, confirmed inactive-channel counters, preserved archived identity holds, and showed only selected required criteria in coverage.
- The browser test asserted no page JavaScript errors, no outbound requests outside its temporary loopback server, and no document horizontal overflow at both widths. It also checked focus restoration after identity confirmation, reduced-motion mode, and the story/interaction DOM markers.
- Visual inspection of desktop and mobile screenshots informed larger phone labels and controls. This is not a full accessibility certification or cross-browser matrix.
- Six **legacy Python** tests passed in an earlier check. They were not rerun for v0.3 and do not establish browser behavior.

## Concrete defects found and repaired

1. A shared identity reference under two different person keys could pass twice. The engine now blocks all affected groups; a regression test attempts to review and approve both.
2. The UI described imported content as fictional. Imports are now labelled as user-supplied samples with unverified fictionality; arbitrary content is escaped before display.
3. Full re-rendering could lose keyboard focus. Controls with stable IDs regain focus; the browser test checks the identity control after transition.
4. An inactive channel was still showing current pending work; its current counters now read zero while archived availability remains separate.
5. The coverage table showed optional criteria after a plan change; it now shows only selected required criteria and counts unique active people once per criterion.
6. At the 2000-event cap, further decisions were blocked but prior approvals could still be exported. A capped session is now explicitly read-only: the engine refuses export, the view has no export packet, and the UI explains that displayed decisions are historical. Reset starts a fresh review without approvals.
7. The old recipient packet contained the entire session journal, including another person's notes. Schema v2 explicitly exports only the latest supporting decisions. The complete journal remains in `viewSession().events`. This scopes structured records; it does not automatically redact names or private details that a user puts inside a retained note or source document.

## Repeat the browser check

The application itself needs no browser automation dependency. For this optional development check, install Python Playwright and its Chromium using the normal Playwright setup, then run:

```bash
python3 tests/browser_smoke.py
```

`--screenshots` refreshes the checked-in screenshots. A locally installed Chromium can be selected with `SIGNAL_DESK_CHROMIUM`.

## What remains unproved

Source truth, real identity matching, authenticated human review, role suitability, broad real-world sourcing beyond the three fixed repositories, AI generation, production-grade shared storage, ATS writes and recruiting outcomes. The standard fixture's `asOf` is a fixed replay snapshot; date checks are relative to it, not the operating system clock. The event trail is self-attested local behavior.

No Figma file was requested or created. Browser checks for v0.5 and local v0.6 are recorded above. There is no claimed Figma-to-code verification.
