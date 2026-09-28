import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderMeetingBrief } from '../scripts/build_meeting_brief.mjs';
import { SHOWCASE_SHA256 } from '../src/showcase.js?v=0.10.0';

const bytes = readFileSync(new URL('../data/poolday-public-pass-2026-09-28.json', import.meta.url));
const envelope = JSON.parse(bytes.toString('utf8'));

test('offline briefs are reproducible, script-free readings of the pinned public archive', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), SHOWCASE_SHA256);
  for (const lang of ['uk', 'en']) {
    const actual = readFileSync(new URL(`../docs/meeting-brief.${lang}.html`, import.meta.url), 'utf8');
    assert.equal(actual, renderMeetingBrief(envelope, lang));
    assert.match(actual, /remotion-dev\/remotion\/pull\/11763/);
    assert.match(actual, /remotion-dev\/remotion\/pull\/11703/);
    assert.match(actual, /8<\/strong>/);
    assert.match(actual, /14<\/strong>/);
    assert.match(actual, /script-src 'none'/);
    assert.match(actual, /connect-src 'none'/);
    assert.doesNotMatch(actual, /<script|\bonclick=|\bonerror=/i);
    assert.doesNotMatch(actual, /"patch"|"excerpt"/);
  }
});

test('untrusted archived filename stays text in the offline brief', () => {
  const changed = structuredClone(envelope);
  changed.inspections[0].files[0].filename = '<img src=x onerror=alert(1)>.tsx';
  const html = renderMeetingBrief(changed, 'uk');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
});
