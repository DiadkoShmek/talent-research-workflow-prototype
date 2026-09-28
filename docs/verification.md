# Verification record — 28 September 2026

## Published v0.8 role-search release

Code revision `9e177d77ea855ea5e716fea5457a6d2234fc48cf` passed [offline contracts](https://github.com/DiadkoShmek/talent-research-workflow-prototype/actions/runs/36452452136) and [Pages deployment](https://github.com/DiadkoShmek/talent-research-workflow-prototype/actions/runs/36452450885). **23 public application and v0.8 screenshot files** matched the local release bytes; the private byte receipt remains outside this repository. The screenshots use synthetic API fixtures.

On the **published page at 390 px**, a fixture-backed pass observed no pre-click GitHub reads; four role-search requests after the click; two explicit PR detail/file requests; four cards; no JavaScript/CSP errors or horizontal overflow. A separate actual public-page click made four live GitHub search GETs, returned **7 GitHub IDs across 4/4 responsive lanes in 2.38 seconds**, and observed no page errors or overflow. These are public integration and availability observations for one run, not seven qualified candidates, a measured recruiter benefit or a repeatability guarantee.

## Local v0.8 role-search proof

The primary browser path now searches four role-derived public GitHub merged-PR lanes in selected repositories; the earlier recent-commit pass remains as a comparison. It records exact query URLs and skip/reject/incomplete counts, then lets a reviewer inspect the exact PR and its files, make a source-bound decision, export selected follow-up and record local feedback. This is a bounded technical-work discovery demonstration, not a whole-market OSINT system or a candidate-quality claim.

- `npm test`: **58/58 passed**. Python offline suite: **14/14 passed**. `npm run stress`: **200/200** synthetic manual-engine cycles. `node --check` on the app and new collector plus `git diff --check` passed.
- Seven Chromium scripts passed at **1440 and 390 px**: manual smoke, handoff, session cap, v0.5 collection, v0.6 review, v0.7 source inspection/feedback and v0.8 role search. The v0.8 fixture asserts no pre-click API calls, four exact search requests, two explicit PR detail/file requests, a source-ID conflict withdrawing follow-up, selected-only packet, saved v2 review restoration, feedback export, no JavaScript errors and no horizontal overflow.
- A **live Node public-API run** after final title screening and accounting returned four responsive lanes and seven distinct GitHub IDs in **2,054 ms**. The four lanes scanned 7/20/20/20 API rows and retained 2/2/2/1 account IDs; every scanned row is counted as retained, skipped, malformed, duplicate or beyond the per-lane cap. This is one collection observation, not a recruiter-reviewed result or an availability benchmark. The private JSON is outside the public repository.
- An earlier actual local Chromium click after title screening returned seven cards across four lanes and read an exact PR detail plus files with no JavaScript error or phone-width overflow. The screenshot and public-account details remain in the private dossier.
- The browser screenshots use only synthetic fixtures. Real account reports and the actual-page screenshot remain in the private dossier.

## Local v0.7 source and feedback proof

The browser now reads an exact public commit only after a second click. It checks the returned SHA and canonical commit URL, bounds response bytes, file count and diff excerpts, and compares the numeric GitHub author ID with the saved lead. A conflicting ID is recorded in the review action log, withdraws an earlier follow-up and blocks a later positive assessment of that source. The separate pilot-feedback snapshot records local outcomes and manually entered review minutes; it starts empty and makes no claim that A-Players evaluated a profile.

- `npm test`: **54/54 passed**. `npm run stress`: **200/200** synthetic manual-engine cycles. Python offline suite: **14/14 passed**. `node --check src/app.js` and `git diff --check` passed.
- Six Chromium scripts passed at **1440 and 390 px**: manual smoke, recipient handoff, terminal session, v0.5 research/recovery, v0.6 research review, and v0.7 exact-source/feedback. The v0.7 fixture checked no pre-click GitHub reads; three list calls, one exact detail read, an ID-conflict revocation, two bounded HTTP 403 retries, escaped diff text, retained draft text, selected-only handoff, evaluation save/restore on a fresh page, failed import preserving state, no JavaScript/CSP errors and no horizontal overflow. The v0.6 ordering assertion was extended to require review → feedback → raw list. Published screenshots use synthetic API fixtures.
- One local **actual GitHub browser pass** at 390 px returned six public-account cards, loaded one exact commit detail after a second click, and had zero page errors or horizontal overflow. A separate actual Node detail read confirmed SHA/URL and the linked numeric GitHub ID for one saved public source. These are availability and integration observations, not a recruiting benchmark or proof of personal authorship.
- Publication, public-file byte parity and published-page behavior for v0.7 are tracked separately from this local proof.

## Published v0.6.1 visibility correction

The review section now appears directly after the three source-lane results, before the complete raw account list. This removes a long mobile scroll before the main decision path. Versioned module URLs were advanced to `0.6.1` to avoid stale browser modules; the documented screenshot fixtures were refreshed. `npm test` passed **47/47** and the v0.5 and v0.6 browser scenarios passed at **1440/390 px**. The v0.6 browser test now asserts review-before-raw order. Code revision `80863d02141b539be0c0b84e93df1a38f02470e8` passed [offline contracts](https://github.com/DiadkoShmek/talent-research-workflow-prototype/actions/runs/36445079104) and [Pages deployment](https://github.com/DiadkoShmek/talent-research-workflow-prototype/actions/runs/36445077955). Fifteen public application assets matched local bytes. On the published page at 1440/390 px, the review appeared before the raw list with three fixture-backed API reads only after a click, no JavaScript/CSP errors or horizontal overflow. A separate live public-page click at 390 px made three actual GitHub GETs, showed six research cards and no JavaScript errors. The later document-only commit changes no application bytes.

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

Source truth, real identity matching, authenticated human review, role suitability, broad real-world sourcing beyond the four selected repositories, AI generation, production-grade shared storage, ATS writes and recruiting outcomes. The standard fixture's `asOf` is a fixed replay snapshot; date checks are relative to it, not the operating system clock. The event trail is self-attested local behavior.

No Figma file was requested or created. Browser checks for v0.5 and local v0.6 are recorded above. There is no claimed Figma-to-code verification.
