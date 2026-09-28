import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, demoProject, exportHandoff, transition, viewSession } from '../src/engine.js?v=0.9.0';
import { MAX_SESSION_BYTES, restoreSession, serializeSession } from '../src/session-file.js';

const reviewer = 'Synthetic session reviewer';
function buildApproved() {
  const origin = demoProject();
  let state = createSession(origin);
  state = transition(state, { type: 'review', evidenceId: 'obs-03::0', decision: 'reject', reviewer, reason: 'Unrelated private review' });
  state = transition(state, { type: 'setPlan', objective: { uk: 'Перевірити операційну роботу', en: 'Verify operations work' },
    requiredCriterionIds: ['operations'], activeHypothesisIds: ['founder-ops'], reason: 'Narrow the search', reviewer });
  state = transition(state, { type: 'setCutoff', cutoff: '2026-09-01' });
  state = transition(state, { type: 'review', evidenceId: 'obs-01::0', decision: 'accept', reviewer, reason: 'Source directly supports operations' });
  state = transition(state, { type: 'identity', personKey: 'person-olena', confirmed: true, reviewer });
  state = transition(state, { type: 'approve', personKey: 'person-olena', reviewer });
  state = transition(state, { type: 'revoke', personKey: 'person-olena', reviewer });
  state = transition(state, { type: 'approve', personKey: 'person-olena', reviewer });
  return { origin, state };
}

test('roundtrip replays actual decisions across plan and cutoff revisions', () => {
  const { origin, state } = buildApproved();
  const envelope = serializeSession(origin, state);
  assert.equal(envelope.schema, 'signal-desk-session.v1');
  assert.deepEqual(envelope.actions.map(a => a.type),
    ['review', 'setPlan', 'setCutoff', 'review', 'identity', 'approve', 'revoke', 'approve']);
  assert.equal(envelope.actions[1].reason, 'Narrow the search');
  assert.equal(envelope.actions[2].cutoff, '2026-09-01');
  assert.ok(!Object.hasOwn(envelope, 'approved'));
  assert.ok(!Object.hasOwn(envelope, 'snapshot'));
  const restored = restoreSession(JSON.parse(JSON.stringify(envelope)));
  assert.deepEqual(restored.originProject, viewSession(createSession(origin)).project);
  assert.deepEqual(viewSession(restored.state), viewSession(state));
  assert.deepEqual(exportHandoff(restored.state), exportHandoff(state));
  assert.equal(envelope.actions[0].reason, 'Unrelated private review'); // Full session backup, not recipient handoff.
});

test('wrong origin and malformed action cannot manufacture a matching session', () => {
  const { origin, state } = buildApproved();
  const before = viewSession(state);
  const mismatch = demoProject();
  mismatch.findings[0].source.text.uk += ' Змінений запис.';
  assert.throws(() => serializeSession(mismatch, state), /origin project does not reproduce/);
  const file = serializeSession(origin, state);
  const tampered = structuredClone(file);
  tampered.actions[3].evidenceId = 'missing::0';
  assert.throws(() => restoreSession(tampered), /action 3 rejected/);
  const forged = structuredClone(file);
  forged.actions[3].approved = true;
  assert.throws(() => restoreSession(forged), /unexpected fields/);
  const extra = { ...file, approved: true };
  assert.throws(() => restoreSession(extra), /unexpected fields/);
  assert.deepEqual(viewSession(state), before);
  assert.equal(file.actions[3].evidenceId, 'obs-01::0');
});

test('schema, size, and action-count limits reject bad files', () => {
  const { origin, state } = buildApproved();
  const file = serializeSession(origin, state);
  assert.equal(MAX_SESSION_BYTES, 2 * 1024 * 1024);
  assert.throws(() => restoreSession({ ...file, schema: 'signal-desk-session.v2' }), /unknown schema/);
  assert.throws(() => restoreSession({ ...file, snapshot: { approved: true } }), /unexpected fields/);
  assert.throws(() => restoreSession({ ...file, actions: Array(2001).fill(file.actions[0]) }), /action limit exceeded/);
  assert.throws(() => restoreSession({ ...file, actions: [], padding: 'x'.repeat(MAX_SESSION_BYTES) }), /unexpected fields/);
  const oversizedProject = structuredClone(file);
  oversizedProject.project.title.uk = 'x'.repeat(MAX_SESSION_BYTES);
  assert.throws(() => restoreSession(oversizedProject), /size limit/);
});

test('read-only event cap survives session replay without exporting the capped revision', () => {
  const origin = demoProject();
  let state = createSession(origin);
  const limit = viewSession(state).session.eventLimit;
  for (let i = 0; i < limit; i++) state = transition(state, {
    type: 'review', evidenceId: 'obs-03::0', decision: 'reject', reviewer, reason: 'Synthetic cap replay'
  });
  const file = serializeSession(origin, state);
  const restored = restoreSession(file).state;
  assert.deepEqual(viewSession(restored).session, viewSession(state).session);
  assert.equal(viewSession(restored).exportPacket, null);
  assert.throws(() => transition(restored, { type: 'review', evidenceId: 'obs-03::0', decision: 'reject', reviewer, reason: 'One more' }), /event limit reached/);
  assert.throws(() => exportHandoff(restored), /session event limit reached/);
});
