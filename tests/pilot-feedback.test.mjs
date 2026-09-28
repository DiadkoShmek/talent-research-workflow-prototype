import test from 'node:test';
import assert from 'node:assert/strict';
import { collectResearch } from '../src/research.js?v=0.8.0';
import { createResearchReview, researchReviewAction } from '../src/research-review.js?v=0.8.0';
import { createPilotFeedback, recordPilotFeedback, restorePilotFeedback, viewPilotFeedback } from '../src/pilot-feedback.js?v=0.8.0';

async function selectedReview() {
  const sha = 'a'.repeat(40);
  const row = { sha, author: { id: 101, login: 'synthetic-user', type: 'User' },
    commit: { message: 'Improve graph recovery', committer: { date: '2026-09-20T10:00:00Z' } } };
  const report = await collectResearch(async url => new Response(JSON.stringify(url.includes('langgraphjs') ? [row] : [])));
  const start = createResearchReview(report);
  const checked = researchReviewAction(start, { type: 'evidence', evidenceId: `github-commit:langchain-ai/langgraphjs:${sha}`,
    decision: 'relevant', reason: 'The diff shows a relevant recovery change.' });
  return researchReviewAction(checked, { type: 'lead', leadId: 'github:101', decision: 'follow-up',
    reason: 'Check personal authorship and role requirements.' });
}

test('feedback records a bounded human outcome for a selected source snapshot', async () => {
  const review = await selectedReview();
  const start = createPilotFeedback(review, false);
  assert.equal(viewPilotFeedback(start).assessed, 0);
  const action = { type: 'evaluate', leadId: 'github:101', verdict: 'useful-next-step', minutes: 7,
    assessorContext: 'builder', reason: 'The source was useful enough to inspect further.' };
  const assessed = recordPilotFeedback(start, action);
  const view = viewPilotFeedback(assessed);
  assert.deepEqual({ assessed: view.assessed, total: view.total, useful: view.useful, minutes: view.minutes, complete: view.complete },
    { assessed: 1, total: 1, useful: 1, minutes: 7, complete: true });
  assert.equal(start.actions.length, 0);
  const revised = recordPilotFeedback(assessed, { ...action, verdict: 'not-useful', minutes: 11,
    reason: 'The source did not establish the requested experience.' });
  assert.equal(viewPilotFeedback(revised).useful, 0);
  assert.equal(viewPilotFeedback(revised).minutes, 11);
  assert.equal(viewPilotFeedback(restorePilotFeedback(revised)).assessed, 1);
  assert.equal(revised.source.scope, 'further-research-only-no-contact-or-candidate-approval');
});

test('feedback rejects fabricated authority, unknown IDs, bad times and source URL changes', async () => {
  const start = createPilotFeedback(await selectedReview());
  const action = { type: 'evaluate', leadId: 'github:101', verdict: 'useful-next-step', minutes: 5,
    assessorContext: 'recruiter-reported', reason: 'A person stated this was worth further review.' };
  for (const changed of [{ ...action, leadId: 'github:999' }, { ...action, minutes: 0 },
    { ...action, minutes: 241 }, { ...action, verdict: 'hired' }, { ...action, approved: true }])
    assert.throws(() => recordPilotFeedback(start, changed), /invalid pilot feedback/);
  const forged = structuredClone(start);
  forged.source.leads[0].profileUrl = 'https://evil.example/synthetic-user';
  assert.throws(() => restorePilotFeedback(forged), /invalid pilot feedback/);
  const hacked = structuredClone(start);
  hacked.source.leads[0].evidence[0].url = 'javascript:alert(1)';
  assert.throws(() => restorePilotFeedback(hacked), /invalid pilot feedback/);
  const extra = structuredClone(start);
  extra.recruiterApproved = true;
  assert.throws(() => restorePilotFeedback(extra), /invalid pilot feedback/);
});
