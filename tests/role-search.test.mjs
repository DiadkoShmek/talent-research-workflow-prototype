import test from 'node:test';
import assert from 'node:assert/strict';
import { collectRoleSearch, validateRoleSearchReport, ROLE_SEARCH_LANES } from '../src/role-search.js?v=0.10.0';
import { validateResearchReport } from '../src/research.js?v=0.10.0';
import { createResearchReview, researchReviewAction, researchReviewPacket } from '../src/research-review.js?v=0.10.0';
import { fixtureInspection } from './inspection-fixture.mjs';
import { createPilotFeedback, recordPilotFeedback, viewPilotFeedback } from '../src/pilot-feedback.js?v=0.10.0';
import { inspectResearchSource } from '../src/source-inspection.js?v=0.10.0';

function row(lane, id, type = 'User', title = `fix: improve ${lane.term} recovery`) {
  const number = 1000 + id;
  return { number, title, user: { id, login: `sample-${id}`, type },
    html_url: `https://github.com/${lane.repo}/pull/${number}`,
    repository_url: `https://api.github.com/repos/${lane.repo}`,
    pull_request: { merged_at: new Date(Date.now() - 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z') } };
}
async function sampleReport() {
  const calls = [];
  const report = await collectRoleSearch(async url => {
    calls.push(url);
    const lane = ROLE_SEARCH_LANES.find(candidate => new URL(url).searchParams.get('q').includes(`repo:${candidate.repo}`));
    return new Response(JSON.stringify({ total_count: 10, incomplete_results: false, items: [
      row(lane, 101, 'Bot'), row(lane, 102, 'User', `docs: note ${lane.term} behavior`),
      row(lane, 100 + ROLE_SEARCH_LANES.indexOf(lane)),
    ] }));
  });
  return { report, calls };
}

test('role search reads four exact merged-PR queries and retains source-bound human work', async () => {
  const { report, calls } = await sampleReport();
  assert.equal(calls.length, 4);
  assert.equal(report.schema, 'signal-desk-research.v2');
  assert.equal(report.leads.length, 4);
  assert.equal(report.run.status, 'complete');
  assert.equal(report.lanes.every(lane => lane.scanned === 3 && lane.skipped === 2 && lane.observations === 1), true);
  assert.equal(report.lanes.every(lane => lane.scanned === lane.skipped + lane.rejected + lane.duplicates + lane.capped + lane.observations), true);
  for (const url of calls) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.github.com');
    assert.equal(parsed.pathname, '/search/issues');
    assert.match(parsed.searchParams.get('q'), /is:pr is:merged .* in:title updated:>=/);
  }
  assert.equal(validateResearchReport(structuredClone(report)).leads.length, 4);
  const evidence = report.leads[0].evidence[0];
  const checked = researchReviewAction(createResearchReview(report), { type: 'evidence', evidenceId: evidence.id,
    decision: 'relevant', reason: 'The merged PR merits closer code inspection.',
    inspection: fixtureInspection(report, evidence.id) });
  const selected = researchReviewAction(checked, { type: 'lead', leadId: report.leads[0].id,
    decision: 'follow-up', reason: 'Check individual ownership and role requirements.' });
  const packet = researchReviewPacket(selected, false);
  assert.equal(packet.leads[0].evidence[0].url, evidence.url);
  const feedback = recordPilotFeedback(createPilotFeedback(selected, false), { type: 'evaluate',
    leadId: report.leads[0].id, verdict: 'unclear', minutes: 5, assessorContext: 'builder',
    reason: 'The code change still needs a recruiter review.' });
  assert.equal(viewPilotFeedback(feedback).assessed, 1);
});

test('role lane accounts for duplicates and valid work beyond the two-account cap', async () => {
  const report = await collectRoleSearch(async url => {
    const lane = ROLE_SEARCH_LANES.find(candidate => new URL(url).searchParams.get('q').includes(`repo:${candidate.repo}`));
    const items = lane.id === 'agent-orchestration' ? [row(lane, 201), row(lane, 201), row(lane, 202), row(lane, 203)] : [];
    return new Response(JSON.stringify({ total_count: items.length, incomplete_results: false, items }));
  });
  assert.equal(report.lanes[0].scanned, 4);
  assert.equal(report.lanes[0].duplicates, 1);
  assert.equal(report.lanes[0].capped, 1);
  assert.equal(report.lanes[0].observations, 2);
  assert.equal(report.leads.length, 2);
});

test('merged PR detail binds the source, author ID and changed files', async () => {
  const { report } = await sampleReport();
  const source = report.leads[0].evidence[0];
  const calls = [];
  const result = await inspectResearchSource(report, source.id, async url => {
    calls.push(url);
    if (url.endsWith('/files?per_page=100')) return new Response(JSON.stringify([
      { filename: 'src/agent.ts', status: 'modified', additions: 8, deletions: 2, patch: '+retry agent checkpoint' },
      { filename: 'tests/agent.test.ts', status: 'added', additions: 3, deletions: 1, patch: '+expect recovery' }
    ]));
    return new Response(JSON.stringify({ number: source.number, html_url: source.url, merged: true,
      merged_at: source.mergedAt, user: { id: Number(report.leads[0].id.slice(7)) },
      additions: 11, deletions: 3, changed_files: 2 }));
  });
  assert.equal(calls.length, 2);
  assert.equal(result.kind, 'github-pr');
  assert.equal(result.association, 'same-github-id');
  assert.equal(result.files[1].testPath, true);
  await assert.rejects(() => inspectResearchSource(report, source.id, async url =>
    new Response(JSON.stringify(url.endsWith('/files?per_page=100') ? [] :
      { number: source.number, html_url: 'https://evil.example/pull/1', merged: true,
        merged_at: source.mergedAt, user: { id: 999 }, additions: 1, deletions: 1, changed_files: 0 }))), /invalid source detail/);
});

test('forged role queries, identity links and incomplete status are refused', async () => {
  const { report } = await sampleReport();
  const changedQuery = structuredClone(report);
  changedQuery.lanes[0].queryUrl = 'https://evil.example/search';
  assert.throws(() => validateRoleSearchReport(changedQuery), /invalid role search report/);
  const changedSource = structuredClone(report);
  changedSource.leads[0].evidence[0].url = 'https://evil.example/pull/1';
  assert.throws(() => validateResearchReport(changedSource), /invalid role search report/);
  const forgedStatus = structuredClone(report);
  forgedStatus.lanes[0].incomplete = true;
  assert.throws(() => validateResearchReport(forgedStatus), /invalid role search report/);
  const forgedAccounting = structuredClone(report);
  forgedAccounting.lanes[0].capped++;
  assert.throws(() => validateResearchReport(forgedAccounting), /invalid role search report/);
  const unsafeId = structuredClone(report);
  unsafeId.leads[0].id = 'github:9007199254740993';
  assert.throws(() => validateResearchReport(unsafeId), /invalid role search report/);
});
