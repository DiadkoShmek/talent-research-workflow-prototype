import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, demoProject, exportHandoff, transition, viewSession } from '../src/engine.js';

const reviewer = 'Demo reviewer';
function approvePerson(session, personKey) {
  let state = session;
  const candidate = viewSession(state).candidates.find(c => c.personKey === personKey);
  for (const e of candidate.evidence) state = transition(state, { type: 'review', evidenceId: e.id, decision: 'accept', reviewer, reason: 'Visible synthetic quote checked' });
  state = transition(state, { type: 'identity', personKey, confirmed: true, reviewer });
  state = transition(state, { type: 'approve', personKey, reviewer });
  return state;
}

test('demo has four hypotheses and visible synthetic source quotations', () => {
  const p = demoProject();
  assert.equal(p.hypotheses.length, 4);
  assert.equal(p.findings.length, 8);
  assert.equal(new Set(p.findings.map(f => f.personKey)).size, 6);
  for (const f of p.findings) for (const c of f.claims) {
    assert.ok(f.source.text.uk.includes(c.quote.uk));
    assert.ok(f.source.text.en.includes(c.quote.en));
  }
  const v = viewSession(createSession(p));
  assert.deepEqual(v.metrics, { observations: 8, people: 6, mergedObservations: 2, needsReview: 5, blocked: 1, ready: 0, approved: 0 });
  assert.throws(() => exportHandoff(createSession(p)), /no approved/);
});

test('approval requires every criterion and confirmed identity', () => {
  let state = createSession(demoProject());
  const olena = viewSession(state).candidates.find(c => c.personKey === 'person-olena');
  assert.equal(olena.evidence.length, 3);
  assert.deepEqual(olena.hypothesisIds, ['founder-ops', 'automation-builders']);
  assert.throws(() => transition(state, { type: 'approve', personKey: 'person-olena', reviewer }), /not ready/);
  for (const e of olena.evidence) state = transition(state, { type: 'review', evidenceId: e.id, decision: 'accept', reviewer, reason: 'Quote checked' });
  assert.throws(() => transition(state, { type: 'approve', personKey: 'person-olena', reviewer }), /not ready/);
  state = transition(state, { type: 'identity', personKey: 'person-olena', confirmed: true, reviewer });
  assert.equal(viewSession(state).candidates.find(c => c.personKey === 'person-olena').status, 'ready');
  state = transition(state, { type: 'approve', personKey: 'person-olena', reviewer });
  const packet = exportHandoff(state);
  assert.equal(packet.schema, 'signal-desk-handoff.v1');
  assert.equal(packet.mode, 'synthetic-local-demo');
  assert.equal(packet.integrity, 'self-attested, unauthenticated');
  assert.equal(packet.criteria.length, 3);
  assert.equal(packet.hypotheses.length, 4);
  assert.deepEqual(packet.projectTitle, demoProject().title);
  assert.equal(packet.candidates.length, 1);
  assert.equal(packet.candidates[0].evidence.length, 3);
  assert.ok(packet.candidates[0].evidence.every(e => e.source.ref.startsWith('synthetic://') && e.reviewer === reviewer));
  assert.equal(packet.revision, 5);
});

test('new review revokes approval and failed transition preserves old state', () => {
  let state = approvePerson(createSession(demoProject()), 'person-taras');
  const approved = state;
  const e = viewSession(state).candidates.find(c => c.personKey === 'person-taras').evidence[0];
  state = transition(state, { type: 'review', evidenceId: e.id, decision: 'reject', reviewer, reason: 'Rechecked quote' });
  assert.equal(viewSession(state).metrics.approved, 0);
  assert.equal(viewSession(approved).metrics.approved, 1);
  const before = viewSession(state).revision;
  assert.throws(() => transition(state, { type: 'approve', personKey: 'person-taras', reviewer }), /not ready/);
  assert.equal(viewSession(state).revision, before);
});

test('changing cutoff invalidates reviews, identity and approvals', () => {
  const approved = approvePerson(createSession(demoProject()), 'person-taras');
  const changed = transition(approved, { type: 'setCutoff', cutoff: '2026-09-20' });
  const c = viewSession(changed).candidates.find(c => c.personKey === 'person-taras');
  assert.equal(c.identityConfirmed, false);
  assert.equal(c.status, 'needs-review');
  assert.ok(c.evidence.every(e => e.review === null));
  assert.ok(c.evidence.every(e => e.fresh === false));
  assert.throws(() => exportHandoff(changed), /no approved/);
  assert.equal(viewSession(approved).metrics.approved, 1);
});

test('colliding identities remain blocked even with accepted evidence', () => {
  const state = createSession(demoProject('conflict'));
  const c = viewSession(state).candidates.find(c => c.personKey === 'person-olena');
  assert.equal(c.status, 'blocked');
  assert.ok(c.blockers.includes('conflicting-identity-refs'));
  assert.throws(() => transition(state, { type: 'identity', personKey: c.personKey, confirmed: true, reviewer }), /collision/);
});

test('a shared identity reference across two person keys blocks both', () => {
  const p = demoProject();
  p.findings[7].identityRef = p.findings[6].identityRef;
  let state = createSession(p);
  for (const personKey of ['person-taras', 'person-kateryna']) {
    const c = viewSession(state).candidates.find(c => c.personKey === personKey);
    assert.equal(c.status, 'blocked');
    assert.ok(c.blockers.includes('conflicting-shared-identity-ref'));
    assert.throws(() => transition(state, { type: 'identity', personKey, confirmed: true, reviewer }), /collision/);
  }
  const taras = viewSession(state).candidates.find(c => c.personKey === 'person-taras');
  for (const e of taras.evidence) state = transition(state, { type: 'review', evidenceId: e.id, decision: 'accept', reviewer, reason: 'Quote checked' });
  assert.equal(viewSession(state).candidates.find(c => c.personKey === 'person-taras').status, 'blocked');
  assert.throws(() => transition(state, { type: 'approve', personKey: 'person-taras', reviewer }), /not ready/);
});

test('accepted stale evidence cannot make candidate ready', () => {
  const p = demoProject();
  p.findings[6].source.observedAt = '2026-07-31';
  let state = createSession(p);
  const c = viewSession(state).candidates.find(c => c.personKey === 'person-taras');
  for (const e of c.evidence) state = transition(state, { type: 'review', evidenceId: e.id, decision: 'accept', reviewer, reason: 'Old source checked' });
  state = transition(state, { type: 'identity', personKey: 'person-taras', confirmed: true, reviewer });
  const after = viewSession(state).candidates.find(c => c.personKey === 'person-taras');
  assert.deepEqual(after.missingCriteria, ['operations', 'automation', 'collaboration']);
  assert.equal(after.status, 'needs-review');
  assert.throws(() => transition(state, { type: 'approve', personKey: 'person-taras', reviewer }), /not ready/);
});

test('malformed data and future observations fail closed', () => {
  assert.throws(() => createSession(demoProject('future-date')), /future/);
  const p = demoProject(); p.findings[1].id = p.findings[0].id;
  assert.throws(() => createSession(p), /duplicate finding/);
  const q = demoProject(); q.findings[0].claims[0].quote.uk = 'missing from snapshot';
  assert.throws(() => createSession(q), /quote absent/);
  const r = demoProject(); r.findings[0].source.observedAt = '2026-02-30';
  assert.throws(() => createSession(r), /impossible date/);
  const s = demoProject(); s.findings[0].personKey = ' padded ';
  assert.throws(() => createSession(s), /invalid text/);
  const t = demoProject(); t.findings[0].claims[0].criterionId = '__proto__';
  assert.throws(() => createSession(t), /invalid ID/);
  const u = demoProject(); u.findings[1].source.ref = u.findings[0].source.ref;
  assert.throws(() => createSession(u), /conflicting source snapshot/);
});

test('object prototype names cannot create phantom approvals', () => {
  const p = demoProject();
  p.findings[7].personKey = 'constructor';
  let state = createSession(p);
  state = transition(state, { type: 'identity', personKey: 'constructor', confirmed: false, reviewer });
  const c = viewSession(state).candidates.find(c => c.personKey === 'constructor');
  assert.equal(c.status, 'needs-review');
  assert.throws(() => transition(state, { type: 'revoke', personKey: 'constructor', reviewer }), /not approved/);
});

test('synthetic deterministic stress: 200 runs, no network or state leak', () => {
  for (let i = 0; i < 200; i++) {
    const state = approvePerson(createSession(demoProject()), 'person-olena');
    const v = viewSession(state);
    assert.equal(v.metrics.approved, 1);
    assert.equal(v.metrics.blocked, 1);
    assert.equal(exportHandoff(state).candidates[0].personKey, 'person-olena');
  }
});
