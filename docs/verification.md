# Verification record — 28 September 2026 (v0.3)

## Executed checks

- `npm test`: **16/16** Node engine tests passed. The v0.3 cases cover effective plan changes, selected required criteria, inactive channels, archived identity conflicts, source contribution, and unique-person criterion coverage, alongside the earlier review and export contract.
- `npm run stress`: **200/200** complete local review → identity → approval → export → invalidation flows passed in 144 ms. This checks deterministic replay, not production throughput.
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

## Repeat the browser check

The application itself needs no browser automation dependency. For this optional development check, install Python Playwright and its Chromium using the normal Playwright setup, then run:

```bash
python3 tests/browser_smoke.py
```

`--screenshots` refreshes the checked-in screenshots. A locally installed Chromium can be selected with `SIGNAL_DESK_CHROMIUM`.

## What remains unproved

Source truth, real identity matching, authenticated human review, role suitability, real sourcing, AI generation, persistent storage, ATS writes and recruiting outcomes. The standard fixture's `asOf` is a fixed replay snapshot; date checks are relative to it, not the operating system clock. The event trail is self-attested local behavior.

No Figma file was requested or created. Screenshots and browser interaction were checked directly; there is no claimed Figma-to-code verification.
