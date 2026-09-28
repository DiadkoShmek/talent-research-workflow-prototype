import test from 'node:test';
import assert from 'node:assert/strict';
import { collectResearch } from '../src/research.js?v=0.7.0';
import { createResearchReview, researchReviewAction, researchReviewPacket, researchReviewView, restoreResearchReview } from '../src/research-review.js?v=0.7.0';
import { researchFollowUpDocument } from '../src/research-review-view.js?v=0.7.0';

async function report() {
  const rows = {
    'langchain-ai/langgraphjs': [row(101, 'test-one', 'a', 'Review graph recovery')],
    'vercel/ai': [row(101, 'test-one', 'b', 'Review streamed tool events')],
    'tldraw/tldraw': [row(202, 'test-two', 'c', 'Review editor state')]
  };
  return collectResearch(async url => new Response(JSON.stringify(rows[url.split('/repos/')[1].split('/commits?')[0]])));
}
function row(id, login, char, title) {
  return { sha: char.repeat(40), author: { id, login, type: 'User' },
    commit: { message: title, committer: { date: '2026-09-20T10:00:00Z' } } };
}
const evidence = 'github-commit:langchain-ai/langgraphjs:' + 'a'.repeat(40);
const second = 'github-commit:vercel/ai:' + 'b'.repeat(40);
const review = (evidenceId, decision, reason = 'Inspected the public diff and its scope.') =>
  ({ type: 'evidence', evidenceId, decision, reason });
const lead = (leadId, decision, reason = 'Check authorship, scope and role requirements.') =>
  ({ type: 'lead', leadId, decision, reason });

test('one inspected public source and explicit follow-up make only a scoped research packet', async () => {
  const start = createResearchReview(await report());
  assert.equal(researchReviewPacket(start), null);
  assert.throws(() => researchReviewAction(start, lead('github:101', 'follow-up')), /invalid research review/);
  const checked = researchReviewAction(start, review(evidence, 'relevant'));
  assert.equal(researchReviewPacket(checked), null);
  const sent = researchReviewAction(checked, lead('github:101', 'follow-up'));
  const packet = researchReviewPacket(sent, false);
  assert.equal(packet.schema, 'signal-desk-research-follow-up.v1');
  assert.equal(packet.scope, 'further-research-only-no-contact-or-candidate-approval');
  assert.equal(packet.sourceOrigin, 'same-browser-public-api-read-self-attested');
  assert.equal(packet.leads.length, 1);
  assert.equal(packet.leads[0].id, 'github:101');
  assert.deepEqual(packet.leads[0].evidence.map(item => item.id), [evidence]);
  assert.equal(packet.leads[0].nextResearchReason, 'Check authorship, scope and role requirements.');
  assert.ok(!JSON.stringify(packet).includes('test-two'));
  assert.ok(!JSON.stringify(packet).includes(second));
  assert.equal(start.actions.length, 0, 'transitions preserve prior revisions');
  checked.actions[0].reason = 'Altered after the next revision.';
  assert.equal(packet.leads[0].evidence[0].reviewReason, 'Inspected the public diff and its scope.');
  assert.equal(researchReviewPacket(sent).leads[0].evidence[0].reviewReason, 'Inspected the public diff and its scope.');

  const changed = researchReviewAction(sent, review(evidence, 'uncertain', 'The diff does not establish individual contribution.'));
  assert.equal(researchReviewPacket(changed), null, 'new evidence decision revokes handoff');
  assert.equal(researchReviewView(changed).leadDecisions.size, 0);
  assert.throws(() => researchReviewAction(changed, lead('github:101', 'follow-up')), /invalid research review/);
  const recertified = researchReviewAction(researchReviewAction(changed, review(second, 'relevant')), lead('github:101', 'follow-up'));
  assert.deepEqual(researchReviewPacket(recertified).leads[0].evidence.map(item => item.id), [second]);
});

test('restore replays only valid source-bound actions and a different run starts clean', async () => {
  const original = createResearchReview(await report());
  const reviewed = researchReviewAction(original, review(evidence, 'relevant'));
  const copy = restoreResearchReview(reviewed);
  copy.actions[0].reason = 'Changed locally after restore.';
  assert.notEqual(copy.actions[0].reason, reviewed.actions[0].reason);
  const wrongSource = structuredClone(reviewed);
  wrongSource.actions[0].evidenceId = 'github-commit:vercel/ai:' + 'f'.repeat(40);
  assert.throws(() => restoreResearchReview(wrongSource), /invalid research review/);
  const invented = structuredClone(reviewed);
  invented.actions.push({ ...lead('github:202', 'follow-up'), approved: true });
  assert.throws(() => restoreResearchReview(invented), /invalid research review/);
  const swapped = structuredClone(reviewed);
  swapped.report = await collectResearch(async () => new Response('[]'));
  assert.throws(() => restoreResearchReview(swapped), /invalid research review/);
  assert.equal(createResearchReview(swapped.report).actions.length, 0);
});

test('a recorded GitHub ID conflict withdraws prior handoff and cannot be overridden', async () => {
  const start = createResearchReview(await report());
  const sent = researchReviewAction(researchReviewAction(start, review(second, 'relevant')),
    lead('github:101', 'follow-up'));
  assert.deepEqual(researchReviewPacket(sent).leads[0].evidence.map(item => item.id), [second]);
  const conflicted = researchReviewAction(sent, { type: 'source-conflict', evidenceId: second });
  assert.equal(researchReviewPacket(conflicted), null);
  assert.equal(researchReviewView(conflicted).leadDecisions.has('github:101'), false);
  assert.equal(researchReviewView(restoreResearchReview(conflicted)).conflictedEvidence.has(second), true);
  assert.throws(() => researchReviewAction(conflicted, review(second, 'relevant')), /invalid research review/);
  assert.throws(() => researchReviewAction(conflicted, { type: 'source-conflict', evidenceId: second }), /invalid research review/);
  assert.throws(() => researchReviewAction(conflicted, lead('github:101', 'follow-up')), /invalid research review/);
  const other = researchReviewAction(researchReviewAction(conflicted, review(evidence, 'relevant')),
    lead('github:101', 'follow-up'));
  assert.deepEqual(researchReviewPacket(other).leads[0].evidence.map(item => item.id), [evidence]);
});

test('malformed reasons, forged authority, action cap and script injection fail closed', async () => {
  const start = createResearchReview(await report());
  for (const reason of ['short', ' xxxxxxxxx', '<script>\u0000</script>', 'x'.repeat(401)])
    assert.throws(() => researchReviewAction(start, review(evidence, 'relevant', reason)), /invalid research review/);
  const forged = structuredClone(start);
  forged.approved = true;
  assert.throws(() => researchReviewView(forged), /invalid research review/);
  let many = start;
  for (let i = 0; i < 99; i++) many = researchReviewAction(many, review(evidence, 'relevant'));
  many = researchReviewAction(many, lead('github:101', 'follow-up'));
  assert.equal(researchReviewView(many).exhausted, true);
  assert.equal(researchReviewPacket(many), null);
  assert.throws(() => researchReviewAction(many, lead('github:101', 'hold')), /invalid research review/);

  const selected = researchReviewAction(researchReviewAction(start, review(evidence, 'relevant', '<img src=x onerror=alert(1)> inspected in diff.')),
    lead('github:101', 'follow-up', 'Investigate <script>alert(1)</script> author claim.'));
  const html = researchFollowUpDocument(selected);
  assert.doesNotMatch(html, /<script\b|<img\b/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /test-two/);
});
