import test from 'node:test';
import assert from 'node:assert/strict';
import { collectRoleSearchV3, validateRoleSearchReportV3, ROLE_SEARCH_LANES_V3 } from '../src/role-search.js?v=0.9.0';
import { validateResearchReport } from '../src/research.js?v=0.9.0';
import { createResearchReview, researchReviewAction, researchReviewPacket } from '../src/research-review.js?v=0.9.0';
import { createPilotFeedback, viewPilotFeedback } from '../src/pilot-feedback.js?v=0.9.0';

const dayAgo = () => new Date(Date.now() - 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
function row(lane, number, userId, title) {
  return { number, title, user: { id: userId, login: `sample-${userId}`, type: 'User' },
    html_url: `https://github.com/${lane.repo}/pull/${number}`,
    repository_url: `https://api.github.com/repos/${lane.repo}`,
    pull_request: { merged_at: dayAgo() } };
}
const titleFor = lane => lane.id === 'video-timeline'
  ? '`@remotion/studio`: Fix timeline frame rendering during trim'
  : lane.id === 'agent-recovery' ? 'fix(agent): recover agent execution state'
  : `fix(${lane.term}): preserve ${lane.term} execution state`;

async function sampleReport() {
  const calls = [];
  const report = await collectRoleSearchV3(async url => {
    calls.push(url);
    const q = new URL(url).searchParams.get('q');
    const index = ROLE_SEARCH_LANES_V3.findIndex(lane => q.includes(`repo:${lane.repo}`));
    const lane = ROLE_SEARCH_LANES_V3[index];
    const first = 101 + index * 10;
    return new Response(JSON.stringify({ total_count: 3, incomplete_results: false, items: [
      row(lane, 5000 + index * 10, first, titleFor(lane)),
      row(lane, 5001 + index * 10, first, titleFor(lane)),
      row(lane, 5002 + index * 10, first + 1, titleFor(lane))
    ] }));
  });
  return { report, calls };
}

test('five role lanes retain repeated PR evidence with one account identity and a human follow-up', async () => {
  const { report, calls } = await sampleReport();
  assert.equal(calls.length, 5);
  assert.equal(report.schema, 'signal-desk-research.v3');
  assert.equal(report.run.requests, 5);
  assert.equal(report.run.plannedRequests, 5);
  assert.equal(report.leads.length, 10);
  assert.equal(report.lanes.every(lane => lane.observations === 3 && lane.leadIds.length === 2), true);
  assert.equal(report.lanes.reduce((sum, lane) => sum + lane.observations, 0), 15);
  assert.equal(validateResearchReport(structuredClone(report)).leads.length, 10);
  const remotion = report.leads.find(lead => lead.hypothesisIds.includes('video-timeline') && lead.evidence.length === 2);
  assert.equal(remotion.evidence.length, 2);
  assert.equal(remotion.evidence.every(item => item.repository === 'remotion-dev/remotion'), true);
  let review = createResearchReview(report);
  for (const source of remotion.evidence) review = researchReviewAction(review, { type: 'evidence',
    evidenceId: source.id, decision: 'relevant', reason: 'Inspect the exact timeline code and test changes.' });
  review = researchReviewAction(review, { type: 'lead', leadId: remotion.id,
    decision: 'follow-up', reason: 'Check the individual contribution and editing background.' });
  const packet = researchReviewPacket(review, false);
  assert.equal(packet.leads[0].evidence.length, 2);
  assert.equal(viewPilotFeedback(createPilotFeedback(review, false)).total, 1);
});

test('HTTP 403 stops later searches and records actual request count', async () => {
  let calls = 0;
  const report = await collectRoleSearchV3(async () => {
    calls++;
    if (calls === 3) { const error = new Error('HTTP failure'); error.publicStatus = 403; throw error; }
    return new Response(JSON.stringify({ total_count: 0, incomplete_results: false, items: [] }));
  });
  assert.equal(calls, 3);
  assert.equal(report.run.requests, 3);
  assert.equal(report.run.status, 'partial');
  assert.equal(report.lanes[2].error, 'HTTP 403');
  assert.equal(report.lanes[3].error, 'not requested after HTTP 403/429');
  assert.equal(report.lanes[4].scanned, 0);
  assert.equal(validateRoleSearchReportV3(structuredClone(report)).run.requests, 3);
});

test('v3 refuses forged source grouping, accounting and rate-stop history', async () => {
  const { report } = await sampleReport();
  const wrongTitle = structuredClone(report);
  wrongTitle.leads.find(lead => lead.hypothesisIds.includes('video-timeline')).evidence[0].title = 'Add documentation';
  assert.throws(() => validateResearchReport(wrongTitle), /invalid role search report/);
  const wrongCount = structuredClone(report);
  wrongCount.lanes[4].observations++;
  assert.throws(() => validateResearchReport(wrongCount), /invalid role search report/);
  const wrongRequestCount = structuredClone(report);
  wrongRequestCount.run.requests = 4;
  assert.throws(() => validateResearchReport(wrongRequestCount), /invalid role search report/);
  const ignoredRateStop = await collectRoleSearchV3(async () =>
    new Response(JSON.stringify({ total_count: 0, incomplete_results: false, items: [] })));
  ignoredRateStop.lanes[2] = { ...ignoredRateStop.lanes[2], status: 'error', error: 'HTTP 403',
    scanned: 0, skipped: 0, rejected: 0, duplicates: 0, capped: 0,
    observations: 0, leadIds: [], totalCount: 0, incomplete: false };
  ignoredRateStop.run.status = 'partial';
  assert.throws(() => validateResearchReport(ignoredRateStop), /invalid role search report/);
  const movedSource = structuredClone(report);
  movedSource.leads[0].evidence.push(movedSource.leads[1].evidence[0]);
  assert.throws(() => validateResearchReport(movedSource), /invalid role search report/);
});
