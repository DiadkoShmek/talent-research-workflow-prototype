import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderResearch } from '../src/research-view.js';

test('meeting fallback remains in initial HTML and research error view', () => {
  const entry = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const shell = entry.match(/<div id="app">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(shell, 'initial shell must exist before app JavaScript');
  assert.match(shell, /href="docs\/meeting-brief\.uk\.pdf"/);
  assert.match(shell, /href="docs\/meeting-brief\.uk\.html"/);

  const failedArchive = renderResearch(null, 'uk', { error: 'Знімок недоступний' });
  assert.match(failedArchive, /Знімок недоступний/);
  assert.match(failedArchive, /href="docs\/meeting-brief\.uk\.pdf"/);
  assert.match(failedArchive, /href="docs\/meeting-brief\.uk\.html"/);
  assert.match(failedArchive, /не містять живого пошуку чи записаних рішень/);
});
