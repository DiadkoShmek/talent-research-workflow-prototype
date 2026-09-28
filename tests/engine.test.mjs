import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, demoProject, exportHandoff, transition, viewSession } from '../src/engine.js';

const reviewer = 'Demo reviewer';
function setPlan(state, overrides = {}) {
  const old = viewSession(state).plan;
  return transition(state, { type: 'setPlan', objective: old.objective,
    requiredCriterionIds: old.requiredCriterionIds, activeHypothesisIds: old.activeHypothesisIds,
    reason: 'Synthetic search brief changed', reviewer, ...overrides });
}
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
  assert.deepEqual(v.plan.objective, p.objective);
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
  const v = demoProject(); v.objective = { uk: '', en: 'Valid' };
  assert.throws(() => createSession(v), /invalid text/);
  const w = demoProject(); delete w.objective;
  assert.deepEqual(viewSession(createSession(w)).plan.objective, w.title);
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

test('plan change records reason, clears every gate and binds export to new policy', () => {
  const approved = approvePerson(createSession(demoProject()), 'person-taras');
  const changed = setPlan(approved, { requiredCriterionIds: ['collaboration', 'operations'], activeHypothesisIds: ['customer-ops'] });
  const v = viewSession(changed), c = v.candidates.find(c => c.personKey === 'person-taras');
  assert.deepEqual(v.plan.requiredCriterionIds, ['operations', 'collaboration']);
  assert.deepEqual(v.plan.activeHypothesisIds, ['customer-ops']);
  assert.equal(v.plan.reason, 'Synthetic search brief changed');
  assert.equal(v.metrics.approved, 0);
  assert.equal(c.identityConfirmed, false);
  assert.ok(c.evidence.every(e => e.review === null));
  assert.deepEqual(v.events.at(-1).before, viewSession(approved).plan);
  assert.deepEqual(v.events.at(-1).after, v.plan);
  assert.equal(v.events.at(-1).reviewer, reviewer);
  assert.equal(v.project.findings.length, 8);
  assert.throws(() => exportHandoff(changed), /no approved/);
  const reapproved = approvePerson(changed, 'person-taras');
  const packet = exportHandoff(reapproved);
  assert.deepEqual(packet.plan, viewSession(reapproved).plan);
  assert.deepEqual(packet.candidates[0].evidence.map(e => e.criterionId), ['operations', 'collaboration']);
});

test('invalid and equivalent plans fail without changing session', () => {
  const state = createSession(demoProject());
  const plan = viewSession(state).plan;
  assert.throws(() => setPlan(state, { activeHypothesisIds: [...plan.activeHypothesisIds].reverse() }), /unchanged/);
  assert.throws(() => setPlan(state, { requiredCriterionIds: [] }), /requires/);
  assert.throws(() => setPlan(state, { requiredCriterionIds: ['operations', 'operations'] }), /duplicate/);
  assert.throws(() => setPlan(state, { requiredCriterionIds: ['unknown'] }), /unknown/);
  assert.throws(() => setPlan(state, { activeHypothesisIds: ['unknown'] }), /unknown/);
  assert.throws(() => setPlan(state, { objective: { uk: '', en: 'x' } }), /invalid text/);
  assert.throws(() => setPlan(state, { reason: '' }), /invalid text/);
  assert.equal(viewSession(state).revision, 0);
  assert.deepEqual(viewSession(state).plan, plan);
});

test('active plan filters candidates and evidence but hidden identity conflict remains', () => {
  let state = setPlan(createSession(demoProject()), { activeHypothesisIds: ['founder-ops'] });
  const v = viewSession(state);
  assert.deepEqual(v.metrics, { observations: 2, people: 2, mergedObservations: 0, needsReview: 2, blocked: 0, ready: 0, approved: 0 });
  assert.equal(v.candidates.find(c => c.personKey === 'person-olena').evidence.length, 2);
  assert.equal(v.hypotheses.find(h => h.id === 'automation-builders').active, false);
  const inactive = v.hypotheses.find(h => h.id === 'automation-builders');
  assert.equal(inactive.observations, 0);
  assert.equal(inactive.availableObservations, 2);
  assert.equal(inactive.pendingEvidence, 0);
  assert.equal(inactive.staleEvidence, 0);
  assert.throws(() => transition(state, { type: 'review', evidenceId: 'obs-02::0', decision: 'accept', reviewer, reason: 'Hidden claim' }), /inactive/);
  assert.throws(() => transition(state, { type: 'identity', personKey: 'person-taras', confirmed: true, reviewer }), /unknown person/);
  state = setPlan(state, { activeHypothesisIds: ['customer-ops'] });
  const iryna = viewSession(state).candidates.find(c => c.personKey === 'person-iryna');
  assert.equal(iryna.status, 'blocked');
  assert.ok(iryna.blockers.includes('conflicting-identity-refs'));
});

test('shared identity reference in inactive channel still blocks active candidate', () => {
  const p = demoProject();
  p.findings[7].identityRef = p.findings[6].identityRef;
  const state = setPlan(createSession(p), { activeHypothesisIds: ['customer-ops'] });
  const taras = viewSession(state).candidates.find(c => c.personKey === 'person-taras');
  assert.equal(taras.status, 'blocked');
  assert.ok(taras.blockers.includes('conflicting-shared-identity-ref'));
  assert.throws(() => transition(state, { type: 'identity', personKey: 'person-kateryna', confirmed: true, reviewer }), /unknown person/);
});

test('hypothesis contribution requires accepted fresh evidence for a required criterion', () => {
  let state = setPlan(createSession(demoProject()), { requiredCriterionIds: ['automation'] });
  const olena = viewSession(state).candidates.find(c => c.personKey === 'person-olena');
  for (const e of olena.evidence) state = transition(state, { type: 'review', evidenceId: e.id, decision: 'accept', reviewer, reason: 'Checked' });
  state = transition(state, { type: 'identity', personKey: 'person-olena', confirmed: true, reviewer });
  state = transition(state, { type: 'approve', personKey: 'person-olena', reviewer });
  const v = viewSession(state);
  assert.deepEqual(v.coverage.map(c => c.criterionId), ['automation']);
  assert.equal(v.hypotheses.find(h => h.id === 'founder-ops').contributingApproved, 0);
  assert.equal(v.hypotheses.find(h => h.id === 'automation-builders').contributingApproved, 1);
  assert.deepEqual(exportHandoff(state).candidates[0].evidence.map(e => e.criterionId), ['automation']);
});

test('coverage counts people once despite multiple fresh sources for the same criterion', () => {
  const p = demoProject();
  const duplicate = structuredClone(p.findings[0]);
  duplicate.id = 'obs-09'; duplicate.source.ref = 'synthetic://source/obs-09';
  p.findings.push(duplicate);
  let state = setPlan(createSession(p), { requiredCriterionIds: ['operations'], activeHypothesisIds: ['founder-ops'] });
  const olena = viewSession(state).candidates.find(c => c.personKey === 'person-olena');
  for (const e of olena.evidence.filter(e => e.criterionId === 'operations')) state = transition(state, { type: 'review', evidenceId: e.id, decision: 'accept', reviewer, reason: 'Checked' });
  state = transition(state, { type: 'identity', personKey: 'person-olena', confirmed: true, reviewer });
  state = transition(state, { type: 'approve', personKey: 'person-olena', reviewer });
  const v = viewSession(state), operations = v.coverage.find(c => c.criterionId === 'operations');
  assert.deepEqual(operations, { criterionId: 'operations', proposedPeople: 2, reviewedPeople: 1, missingPeople: 1 });
  const founder = v.hypotheses.find(h => h.id === 'founder-ops');
  assert.equal(founder.acceptedEvidence, 2);
  assert.equal(founder.contributingApproved, 1);
  assert.equal(v.metrics.mergedObservations, 1);
});

test('event cap makes current session read-only while earlier revision remains exportable', () => {
  const beforeCap = approvePerson(createSession(demoProject()), 'person-olena');
  let state = beforeCap;
  const limit = viewSession(state).session.eventLimit;
  assert.deepEqual(viewSession(state).session, { exhausted: false, eventCount: 5, eventLimit: limit });
  for (let i = 5; i < limit; i++) state = transition(state, {
    type: 'review', evidenceId: 'obs-03::0', decision: 'reject', reviewer, reason: 'Synthetic cap replay'
  });
  const v = viewSession(state);
  assert.deepEqual(v.session, { exhausted: true, eventCount: limit, eventLimit: limit });
  assert.equal(v.metrics.approved, 1); // Historical approval stays visible.
  assert.equal(v.candidates.find(c => c.personKey === 'person-olena').status, 'approved');
  assert.equal(v.exportPacket, null);
  assert.throws(() => exportHandoff(state), /session event limit reached; start a new session/);
  assert.throws(() => transition(state, { type: 'revoke', personKey: 'person-olena', reviewer }), /event limit reached/);
  assert.throws(() => transition(state, { type: 'setCutoff', cutoff: '2026-09-01' }), /event limit reached/);
  assert.equal(exportHandoff(beforeCap).candidates.length, 1);
  assert.equal(viewSession(beforeCap).session.exhausted, false);
  const fresh = createSession(v.project);
  assert.equal(viewSession(fresh).session.eventCount, 0);
  assert.equal(viewSession(fresh).metrics.approved, 0);
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
