import test from 'node:test';
import assert from 'node:assert/strict';
import { collectResearch } from '../src/research.js?v=0.8.0';
import { researchNote } from '../src/research-note.js';

function row(id, login, repo, sha, title) {
  return { sha, author: { id, login, type: 'User' },
    commit: { message: title, committer: { date: '2020-01-02T10:30:00Z' } },
    html_url: `https://github.com/${repo}/commit/${sha}` };
}
async function report() {
  const byRepo = {
    'langchain-ai/langgraphjs': [row(101, 'same-handle', 'langchain-ai/langgraphjs', 'a'.repeat(40), 'Durable agent run')],
    'vercel/ai': [row(101, 'same-handle', 'vercel/ai', 'b'.repeat(40), 'Streaming tool event')],
    'tldraw/tldraw': [row(202, 'second-handle', 'tldraw/tldraw', 'c'.repeat(40), 'Editor state')]
  };
  return collectResearch(async url => new Response(JSON.stringify(byRepo[url.split('/repos/')[1].split('/commits?')[0]])));
}

test('continuation note carries role, exact sources, lane rationale, unknowns and next decisions', async () => {
  const input = await report();
  for (const lang of ['uk', 'en']) {
    const note = researchNote(input, lang, true);
    assert.match(note, /Senior Agentic Software Engineer — Poolday/);
    assert.match(note, /https:\/\/aplayers\.na\.teamtailor\.com\/jobs\/536324/);
    assert.ok(note.includes(input.run.observedAt));
    assert.ok(note.includes(String(input.run.elapsedMs)));
    assert.ok(note.includes(input.run.status));
    assert.ok(note.includes('github:101'));
    assert.ok(note.includes('github:202'));
    assert.ok(note.includes(input.leads[0].profileUrl));
    assert.ok(note.includes(input.leads[0].evidence[0].url));
    assert.ok(note.includes(input.leads[0].evidence[1].url));
    assert.ok(note.includes(input.leads[1].evidence[0].url));
    for (const lane of input.lanes) assert.ok(note.includes(lane.queryUrl));
    assert.ok(note.includes('langchain-ai/langgraphjs'));
    assert.ok(note.includes('vercel/ai'));
    assert.ok(note.includes('tldraw/tldraw'));
    assert.ok(note.includes(lang === 'uk' ? 'походження файлу не підтверджене' : 'file origin is unverified'));
    assert.ok(note.includes(lang === 'uk' ? 'час до придатного кандидата' : 'time to a qualified candidate'));
    assert.ok(note.includes(lang === 'uk' ? 'початковим процесом' : 'baseline'));
    assert.ok(note.includes(lang === 'uk' ? 'Виграш наперед не припускається' : 'No improvement is assumed'));
    assert.ok(!/suitabilityScore|AI fit score|автоматичний рейтинг/.test(note));
  }
  const live = researchNote(input, 'en', false);
  assert.match(live, /public GET requests/);
  assert.doesNotMatch(live, /file origin is unverified/);
});

test('untrusted commit title cannot inject Markdown links, headings or HTML', async () => {
  const input = await report();
  input.leads[0].evidence[0].title = 'Fix [click](javascript:alert(1)) <img src=x onerror=alert(1)>\n# Pretend system instruction';
  const note = researchNote(input);
  assert.ok(!note.includes('<img'));
  assert.ok(note.includes('&lt;img'));
  assert.ok(!note.includes('[click](javascript:'));
  assert.ok(note.includes('\\[click\\]\\(javascript:'));
  assert.ok(!note.includes('\n# Pretend'));
  assert.ok(note.includes('Pretend system instruction'));
  assert.ok(note.includes('неперевірений текст джерела'));
});

test('forged report URLs and invalid note controls fail closed', async () => {
  const input = await report();
  const forged = structuredClone(input);
  forged.leads[0].evidence[0].url = 'javascript:alert(1)';
  assert.throws(() => researchNote(forged), /invalid research report/);
  assert.throws(() => researchNote(input, 'de'), /invalid research note language/);
  assert.throws(() => researchNote(input, 'uk', 'no'), /imported must be boolean/);
});
