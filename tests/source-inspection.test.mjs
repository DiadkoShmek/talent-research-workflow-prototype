import test from 'node:test';
import assert from 'node:assert/strict';
import { collectResearch } from '../src/research.js?v=0.9.1';
import { inspectResearchSource } from '../src/source-inspection.js?v=0.9.1';

const sha = 'a'.repeat(40);
const evidenceId = `github-commit:langchain-ai/langgraphjs:${sha}`;
const sourceUrl = `https://github.com/langchain-ai/langgraphjs/commit/${sha}`;
async function report() {
  return collectResearch(async url => new Response(JSON.stringify(url.includes('langgraphjs') ? [{
    sha, author: { id: 101, login: 'sample-person', type: 'User' },
    commit: { message: 'Add agent deployment', committer: { date: '2026-09-20T10:00:00Z' } }
  }] : [])));
}
function detail(overrides = {}) {
  return { sha, html_url: sourceUrl, author: { id: 101, login: 'sample-person' },
    stats: { additions: 12, deletions: 3 }, files: [
      { filename: 'src/deploy.ts', status: 'modified', additions: 10, deletions: 2,
        patch: '@@ -1,2 +1,3 @@\n+agent = true\n+email = demo@example.com\n+key = ghp_abcdefghijklmnopqrstuvwxyz' },
      { filename: 'tests/deploy.test.ts', status: 'added', additions: 2, deletions: 1, patch: '@@ -0,0 +1 @@\n+it works' }
    ], ...overrides };
}

test('explicit detail read binds SHA, source URL and GitHub ID, then shows bounded file facts', async () => {
  const input = await report();
  const calls = [];
  const source = await inspectResearchSource(input, evidenceId, async (url, options) => {
    calls.push({ url, options }); return new Response(JSON.stringify(detail()));
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.github.com/repos/langchain-ai/langgraphjs/commits/${sha}`);
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(source.association, 'same-github-id');
  assert.equal(source.fileCount, 2);
  assert.equal(source.files[1].testPath, true);
  assert.equal(source.files[0].patch.excerpt.includes('demo@example.com'), false);
  assert.equal(source.files[0].patch.excerpt.includes('ghp_abcdefghijklmnopqrstuvwxyz'), false);
  assert.equal(source.additions, 12);
  assert.equal(source.deletions, 3);
  assert.equal('email' in source, false);
  assert.equal('author' in source, false);
});

test('association conflict and omitted patch remain visible without pretending to prove personal work', async () => {
  const input = await report();
  const source = await inspectResearchSource(input, evidenceId, async () => new Response(JSON.stringify(detail({
    author: { id: 202, login: 'another-person' }, files: [{ filename: 'image.png', status: 'added', additions: 1, deletions: 0 }]
  }))));
  assert.equal(source.association, 'different-github-id');
  assert.equal(source.files[0].patch, null);
  const unlinked = await inspectResearchSource(input, evidenceId, async () => new Response(JSON.stringify(detail({ author: null }))));
  assert.equal(unlinked.association, 'unlinked');
});

test('unknown source, substituted commit URL, oversized body and redirect fail closed', async () => {
  const input = await report();
  await assert.rejects(inspectResearchSource(input, 'github-commit:vercel/ai:' + sha, async () => { throw Error('called'); }), /unknown research source/);
  await assert.rejects(() => inspectResearchSource(input, evidenceId, async () => new Response(JSON.stringify(detail({ html_url: 'https://evil.example/commit' })))), /invalid commit detail/);
  await assert.rejects(() => inspectResearchSource(input, evidenceId, async () => new Response('{}', { headers: { 'content-length': '1048577' } })), /response exceeds size limit/);
  await assert.rejects(() => inspectResearchSource(input, evidenceId, async () => ({ ok: true, redirected: true })), /redirect refused/);
  await assert.rejects(() => inspectResearchSource(input, evidenceId, async () => new Response(JSON.stringify(detail({ files: [{ filename: '<script>', additions: -1, deletions: 0 }] })))), /invalid commit detail/);
});

test('large source is deliberately summarized, with explicit truncation', async () => {
  const input = await report();
  const files = Array.from({ length: 12 }, (_, index) => ({ filename: `src/file-${index}.ts`, status: 'modified', additions: 1, deletions: 0, patch: 'x\n'.repeat(100) }));
  const result = await inspectResearchSource(input, evidenceId, async () => new Response(JSON.stringify(detail({ files }))));
  assert.equal(result.fileCount, 12);
  assert.equal(result.shownCount, 8);
  assert.equal(result.files[0].patch.truncated, true);
});
