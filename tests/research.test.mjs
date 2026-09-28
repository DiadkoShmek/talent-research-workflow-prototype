import test from 'node:test';
import assert from 'node:assert/strict';
import { collectResearch, validateResearchReport, RESEARCH_LANES } from '../src/research.js';

const commit = (id, login, sha, repo = 'langchain-ai/langgraphjs', title = 'Add public workflow') => ({
  sha, author: { id, login, type: 'User' },
  commit: { message: title, committer: { date: '2026-09-27T10:30:00Z' } },
  html_url: `https://github.com/${repo}/commit/${sha}`
});
const response = (url, rows, init = {}) => new Response(JSON.stringify(rows), { status: 200, ...init });
const repoFromUrl = url => url.split('/repos/')[1].split('/commits?')[0];
const fetchFor = byRepo => async (url, options) => {
  assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error');
  assert.equal(options.method, 'GET');
  assert.match(url, /^https:\/\/api\.github\.com\/repos\//);
  const value = byRepo[repoFromUrl(url)];
  if (value instanceof Error) throw value;
  return value instanceof Response ? value : response(url, value);
};

test('explicit call only, three fixed requests, dedupe by immutable id and bound rows', async () => {
  const calls = [];
  const source = fetchFor({
    'langchain-ai/langgraphjs': [
      commit(1, 'same', 'a'.repeat(40)), commit(1, 'same', 'b'.repeat(40)),
      commit(1, 'same', 'c'.repeat(40)), commit(2, 'other', 'd'.repeat(40)), commit(3, 'third', 'e'.repeat(40))
    ],
    'vercel/ai': [commit(1, 'renamed', 'f'.repeat(40), 'vercel/ai')],
    'tldraw/tldraw': []
  });
  const report = await collectResearch(async (url, options) => { calls.push(url); return source(url, options); });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls, RESEARCH_LANES.map(lane => `https://api.github.com/repos/${lane.repo}/commits?per_page=20`));
  assert.equal(report.run.status, 'complete');
  assert.deepEqual(report.lanes.map(lane => lane.observations), [3, 1, 0]);
  assert.deepEqual(report.leads.map(lead => lead.id), ['github:1', 'github:2']);
  assert.equal(report.leads[0].handle, 'same');
  assert.equal(report.leads[0].evidence.length, 3);
  assert.equal(validateResearchReport(report), report);
});

test('missing author and bot are known skips; malformed row makes partial report', async () => {
  const report = await collectResearch(fetchFor({
    'langchain-ai/langgraphjs': [
      { ...commit(1, 'bot', 'a'.repeat(40)), author: { id: 1, login: 'bot', type: 'Bot' } },
      { ...commit(2, 'none', 'b'.repeat(40)), author: null },
      { unexpected: 'shape' },
      { ...commit(3, 'unsafe', 'c'.repeat(40)), html_url: 'https://evil.invalid/commit' },
      commit(4, 'email', 'd'.repeat(40), 'langchain-ai/langgraphjs', 'Email person@example.com')
    ], 'vercel/ai': [], 'tldraw/tldraw': []
  }));
  assert.equal(report.run.status, 'partial');
  assert.deepEqual([report.lanes[0].scanned, report.lanes[0].skipped, report.lanes[0].rejected], [5, 2, 3]);
  assert.equal(report.lanes[0].status, 'error');
  assert.deepEqual(report.leads, []);
  assert.doesNotMatch(JSON.stringify(report), /evil\.invalid|person@example\.com/);
});

test('HTTP failure and malformed response remain visible without leaking details', async () => {
  const report = await collectResearch(fetchFor({
    'langchain-ai/langgraphjs': new Response('private failure', { status: 403 }),
    'vercel/ai': { message: 'private API body' },
    'tldraw/tldraw': []
  }));
  assert.equal(report.run.status, 'partial');
  assert.deepEqual(report.lanes.map(lane => lane.status), ['error', 'error', 'empty']);
  assert.equal(report.lanes[0].error, 'HTTP 403');
  assert.equal(report.lanes[1].error, 'response is not a list');
  assert.doesNotMatch(JSON.stringify(report), /private/);
});

test('redirect and body size cap fail closed', async () => {
  const large = new Response('x'.repeat(2 * 1024 * 1024 + 1));
  const ordinary = fetchFor({ 'langchain-ai/langgraphjs': large, 'tldraw/tldraw': [] });
  const report = await collectResearch((url, options) => repoFromUrl(url) === 'vercel/ai'
    ? { redirected: true, ok: true, url: 'https://evil.invalid', headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) }
    : ordinary(url, options));
  assert.equal(report.run.status, 'partial');
  assert.equal(report.lanes[0].error, 'response exceeds size limit');
  assert.equal(report.lanes[1].error, 'redirect refused');
});

test('validator rejects forged status, URL, score and inconsistent counts', async () => {
  const report = await collectResearch(fetchFor({
    'langchain-ai/langgraphjs': [commit(1, 'coder', 'a'.repeat(40))], 'vercel/ai': [], 'tldraw/tldraw': []
  }));
  const forgedStatus = structuredClone(report); forgedStatus.run.status = 'failed';
  assert.throws(() => validateResearchReport(forgedStatus), /invalid research report/);
  const forgedUrl = structuredClone(report); forgedUrl.leads[0].evidence[0].url = 'https://evil.invalid';
  assert.throws(() => validateResearchReport(forgedUrl), /invalid research report/);
  const forgedCount = structuredClone(report); forgedCount.lanes[0].observations = 4;
  assert.throws(() => validateResearchReport(forgedCount), /invalid research report/);
  const forgedScore = structuredClone(report); forgedScore.leads[0].suitabilityScore = 99;
  assert.throws(() => validateResearchReport(forgedScore), /invalid research report/);
  const impossible = structuredClone(report); impossible.leads[0].evidence[0].committedAt = '2026-02-30T10:30:00Z';
  assert.throws(() => validateResearchReport(impossible), /invalid research report/);
  const future = structuredClone(report); future.leads[0].evidence[0].committedAt = '2099-09-27T10:30:00Z';
  assert.throws(() => validateResearchReport(future), /invalid research report/);
  const fractionalFuture = structuredClone(report);
  fractionalFuture.leads[0].evidence[0].committedAt = `${report.run.observedAt.slice(0, -1)}.000001Z`;
  assert.throws(() => validateResearchReport(fractionalFuture), /invalid research report/);
});

test('collector rejects impossible and future dates as malformed rows', async () => {
  const impossible = commit(1, 'bad-date', 'a'.repeat(40));
  impossible.commit.committer.date = '2026-02-30T10:30:00Z';
  const future = commit(2, 'future', 'b'.repeat(40));
  future.commit.committer.date = '2099-09-27T10:30:00Z';
  const report = await collectResearch(fetchFor({
    'langchain-ai/langgraphjs': [impossible, future], 'vercel/ai': [], 'tldraw/tldraw': []
  }));
  assert.equal(report.run.status, 'partial');
  assert.equal(report.lanes[0].rejected, 2);
  assert.deepEqual(report.leads, []);
});

test('three lanes with evidence and malformed rows are partial, not failed', async () => {
  const source = Object.fromEntries(RESEARCH_LANES.map((lane, index) => [lane.repo, [
    commit(index + 1, `coder${index}`, `${index + 1}`.repeat(40), lane.repo), { broken: true }
  ]]));
  const report = await collectResearch(fetchFor(source));
  assert.equal(report.run.status, 'partial');
  assert.deepEqual(report.lanes.map(lane => lane.status), ['partial', 'partial', 'partial']);
  assert.equal(report.leads.length, 3);
});

test('same commit attributed to different IDs is rejected in collector and validator', async () => {
  const report = await collectResearch(fetchFor({
    'langchain-ai/langgraphjs': [commit(1, 'one', 'a'.repeat(40)), commit(2, 'two', 'a'.repeat(40))],
    'vercel/ai': [], 'tldraw/tldraw': []
  }));
  assert.equal(report.lanes[0].status, 'partial');
  assert.equal(report.lanes[0].rejected, 1);
  assert.equal(report.leads.length, 1);
  const forged = structuredClone(report);
  forged.leads.push({ ...structuredClone(forged.leads[0]), id: 'github:2', handle: 'two', profileUrl: 'https://github.com/two' });
  assert.throws(() => validateResearchReport(forged), /invalid research report/);
});
