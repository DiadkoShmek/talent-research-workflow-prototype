import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWalkthrough, walkthroughDocument } from '../src/walkthrough.js';

test('readable walkthrough exposes a packet only at the approved step and attributes the script', () => {
  for (const lang of ['uk', 'en']) {
    for (let step = 0; step < 5; step++) {
      const html = renderWalkthrough(step, lang);
      assert.equal(html.includes('data-handoff-person='), step === 3);
      assert.match(html, /id="walkthrough-title" tabindex="-1"/);
      assert.match(html, /aria-current="step"/);
      assert.ok(html.includes(lang === 'uk' ? 'Рішення автоматично відтворює сценарій' : 'The script automatically replays decisions'));
    }
    assert.ok(renderWalkthrough(1, lang).includes(lang === 'uk' ? 'вебінар' : 'webinar'));
  }
});

test('offline walkthrough contains five distinct steps, no active controls or scripts, and unique ids', () => {
  for (const lang of ['uk', 'en']) {
    const html = walkthroughDocument(lang);
    assert.equal((html.match(/data-demo-step=/g) ?? []).length, 5);
    assert.doesNotMatch(html, /<script\b|<button\b|\son[a-z]+\s*=|<iframe\b|<img\b/i);
    assert.match(html, /default-src 'none'/);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal((html.match(/data-handoff-person=/g) ?? []).length, 1);
  }
  assert.throws(() => walkthroughDocument('invalid'), /language/);
});
