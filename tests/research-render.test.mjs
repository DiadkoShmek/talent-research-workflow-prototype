import test from 'node:test';
import assert from 'node:assert/strict';
import { collectResearch } from '../src/research.js';
import { renderResearch, researchDocument } from '../src/research-view.js';

async function fixture(title = 'Fix graph recovery') {
  return collectResearch(async url => new Response(JSON.stringify(url.includes('langgraphjs') ? [{
    sha: 'a'.repeat(40), author: { id: 123, login: 'test-researcher', type: 'User' },
    commit: { message: title, committer: { date: '2026-09-27T10:00:00Z' } }
  }] : [])));
}

test('untrusted source text stays text in both languages and in script-free recipient HTML', async () => {
  const report = await fixture('<img src=x onerror=alert(1)>');
  for (const lang of ['uk', 'en']) {
    const html = researchDocument(report, lang);
    assert.doesNotMatch(html, /<script\b|<img\b|<iframe\b|<input\b|<button\b/i);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /default-src 'none'/);
    assert.match(html, /https:\/\/github.com\/langchain-ai\/langgraphjs\/commit\/a{40}/);
    assert.ok(html.includes(lang === 'uk' ? 'походження файлу не підтверджено' : 'file origin is unverified'));
    assert.ok(html.includes(lang === 'uk' ? 'Потребує перевірки' : 'Needs research'));
    assert.doesNotMatch(html, /data-handoff-person=/);
  }
});

test('error text is escaped, a failed request is never presented as an empty successful source', async () => {
  const report = await collectResearch(async () => { throw new Error('secret network details'); });
  const html = renderResearch(report, 'uk', { error: '<script>alert(1)</script>' });
  assert.match(html, /Збір не вдався/);
  assert.match(html, /Дані не отримано/);
  assert.doesNotMatch(html, /<script\b|secret network details|Акаунтів не виявлено/);
  assert.match(html, /&lt;script&gt;/);
});

test('recipient renderer rejects a substituted source host and inconsistent identity links', async () => {
  const report = await fixture();
  const forgedSource = structuredClone(report);
  forgedSource.leads[0].evidence[0].url = 'javascript:alert(1)';
  assert.throws(() => researchDocument(forgedSource), /invalid research report/);
  const forgedProfile = structuredClone(report);
  forgedProfile.leads[0].profileUrl = 'https://github.com/another-person';
  assert.throws(() => renderResearch(forgedProfile), /invalid research report/);
});
