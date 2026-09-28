// Signal Desk domain engine. Everything here is local, deterministic and synthetic.
const MAX = { text: 2000, items: 300, criteria: 12, hypotheses: 12, events: 2000 };
const sessions = new WeakMap();

function fail(message) { throw new Error(message); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function obj(value, label) { if (!plain(value)) fail(`${label}: expected object`); return value; }
function str(value, label, max = MAX.text) { if (typeof value !== 'string' || !value.trim() || value.length > max || value !== value.trim()) fail(`${label}: invalid text`); return value; }
function id(value, label) { str(value, label, 100); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) fail(`${label}: invalid ID`); return value; }
function loc(value, label) { obj(value, label); str(value.uk, `${label}.uk`); str(value.en, `${label}.en`); return { uk: value.uk, en: value.en }; }
function arr(value, label, max = MAX.items) { if (!Array.isArray(value) || value.length > max) fail(`${label}: invalid array`); return value; }
function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${label}: invalid ISO date`);
  const d = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) fail(`${label}: impossible date`);
  return value;
}
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function copy(value) { return structuredClone(value); }

function validateProject(input) {
  const p = obj(input, 'project');
  const asOf = date(p.asOf, 'asOf'), cutoff = date(p.cutoff, 'cutoff');
  if (cutoff > asOf) fail('cutoff must be on or before asOf');
  const criteria = arr(p.criteria, 'criteria', MAX.criteria).map((c, i) => ({ id: id(obj(c, `criterion ${i}`).id, 'criterion ID'), label: loc(c.label, 'criterion label') }));
  const hypotheses = arr(p.hypotheses, 'hypotheses', MAX.hypotheses).map((h, i) => ({ id: id(obj(h, `hypothesis ${i}`).id, 'hypothesis ID'), label: loc(h.label, 'hypothesis label'), rationale: loc(h.rationale, 'hypothesis rationale') }));
  if (!criteria.length || !hypotheses.length) fail('project needs criteria and hypotheses');
  const criterionIds = new Set(criteria.map(c => c.id)), hypothesisIds = new Set(hypotheses.map(h => h.id));
  if (criterionIds.size !== criteria.length || hypothesisIds.size !== hypotheses.length) fail('duplicate criterion or hypothesis ID');
  const seenFindings = new Set(), sources = new Map();
  const findings = arr(p.findings, 'findings').map((f, i) => {
    obj(f, `finding ${i}`);
    const finding = {
      id: id(f.id, 'finding ID'), personKey: id(f.personKey, 'person key'), name: str(f.name, 'name', 200),
      identityRef: str(f.identityRef, 'identity reference', 300), hypothesisId: id(f.hypothesisId, 'hypothesis ID'),
      source: {}, claims: []
    };
    if (seenFindings.has(finding.id)) fail(`duplicate finding ID: ${finding.id}`);
    seenFindings.add(finding.id);
    if (!hypothesisIds.has(finding.hypothesisId)) fail(`unknown hypothesis: ${finding.hypothesisId}`);
    const s = obj(f.source, 'source');
    finding.source = { ref: str(s.ref, 'source ref', 500), title: loc(s.title, 'source title'), text: loc(s.text, 'source text'), observedAt: date(s.observedAt, 'observedAt') };
    if (!finding.source.ref.startsWith('synthetic://')) fail('demo source must use synthetic://');
    // asOf is a replay snapshot supplied by the project; the OS clock is deliberately irrelevant.
    if (finding.source.observedAt > asOf) fail(`future observation: ${finding.id}`);
    const snapshot = JSON.stringify(finding.source);
    if (sources.has(s.ref) && sources.get(s.ref) !== snapshot) fail(`conflicting source snapshot: ${s.ref}`);
    sources.set(s.ref, snapshot);
    finding.claims = arr(f.claims, 'claims', 24).map((claim, j) => {
      obj(claim, `claim ${j}`);
      const criterionId = id(claim.criterionId, 'claim criterion ID'), quote = loc(claim.quote, 'claim quote');
      if (!criterionIds.has(criterionId)) fail(`unknown criterion: ${criterionId}`);
      if (!finding.source.text.uk.includes(quote.uk) || !finding.source.text.en.includes(quote.en)) fail(`quote absent from source: ${finding.id}`);
      return { criterionId, quote };
    });
    return finding;
  });
  const title = loc(p.title, 'project title');
  return freeze({ id: id(p.id, 'project ID'), title, objective: p.objective === undefined ? title : loc(p.objective, 'project objective'), asOf, cutoff, criteria, hypotheses, findings });
}

function makeSession(data) {
  const token = Object.freeze({ revision: data.revision });
  sessions.set(token, data);
  return token;
}
function getSession(state) { const data = sessions.get(state); if (!data) fail('unknown session'); return data; }
function defaultPlan(project) {
  return freeze({ objective: project.objective, requiredCriterionIds: project.criteria.map(c => c.id), activeHypothesisIds: project.hypotheses.map(h => h.id), reason: null });
}
function validatePlan(action, project) {
  const objective = loc(action.objective, 'plan objective');
  const required = arr(action.requiredCriterionIds, 'required criterion IDs', MAX.criteria).map(x => id(x, 'required criterion ID'));
  const active = arr(action.activeHypothesisIds, 'active hypothesis IDs', MAX.hypotheses).map(x => id(x, 'active hypothesis ID'));
  if (!required.length || !active.length) fail('plan requires criteria and hypotheses');
  if (new Set(required).size !== required.length || new Set(active).size !== active.length) fail('duplicate plan ID');
  const requiredSet = new Set(required), activeSet = new Set(active);
  if (required.some(x => !project.criteria.some(c => c.id === x))) fail('unknown required criterion');
  if (active.some(x => !project.hypotheses.some(h => h.id === x))) fail('unknown active hypothesis');
  return { objective, requiredCriterionIds: project.criteria.filter(c => requiredSet.has(c.id)).map(c => c.id),
    activeHypothesisIds: project.hypotheses.filter(h => activeSet.has(h.id)).map(h => h.id), reason: str(action.reason, 'plan reason', 500) };
}
function evidenceFor(project) {
  return project.findings.flatMap(f => f.claims.map((c, i) => ({
    id: `${f.id}::${i}`, personKey: f.personKey, criterionId: c.criterionId, quote: c.quote,
    source: f.source, hypothesisId: f.hypothesisId, fresh: f.source.observedAt >= project.cutoff
  })));
}
function candidatesFor(d) {
  const byPerson = new Map();
  const allByPerson = new Map();
  const refOwners = new Map();
  for (const f of d.project.findings) {
    if (!allByPerson.has(f.personKey)) allByPerson.set(f.personKey, { names: new Set(), refs: new Set() });
    allByPerson.get(f.personKey).names.add(f.name);
    allByPerson.get(f.personKey).refs.add(f.identityRef);
    if (!refOwners.has(f.identityRef)) refOwners.set(f.identityRef, new Set());
    refOwners.get(f.identityRef).add(f.personKey);
    if (!d.plan.activeHypothesisIds.includes(f.hypothesisId)) continue;
    if (!byPerson.has(f.personKey)) byPerson.set(f.personKey, { personKey: f.personKey, name: f.name, hypothesisIds: new Set(), observations: 0, evidence: [] });
    const c = byPerson.get(f.personKey);
    c.hypothesisIds.add(f.hypothesisId); c.observations++;
  }
  for (const e of evidenceFor(d.project)) {
    if (!d.plan.activeHypothesisIds.includes(e.hypothesisId)) continue;
    byPerson.get(e.personKey).evidence.push({ id: e.id, criterionId: e.criterionId, quote: e.quote, source: e.source, hypothesisId: e.hypothesisId, fresh: e.fresh, review: d.reviews[e.id] || null });
  }
  return [...byPerson.values()].map(c => {
    const all = allByPerson.get(c.personKey);
    const identityRefs = [...all.refs], names = [...all.names];
    const blockers = [];
    if (names.length > 1) blockers.push('conflicting-names');
    if (identityRefs.length > 1) blockers.push('conflicting-identity-refs');
    if (identityRefs.some(ref => refOwners.get(ref).size > 1)) blockers.push('conflicting-shared-identity-ref');
    const missingCriteria = d.plan.requiredCriterionIds.filter(criterionId => !c.evidence.some(e => e.criterionId === criterionId && e.fresh && e.review?.decision === 'accept'));
    const identityConfirmed = d.identities[c.personKey] === true;
    if (!identityConfirmed) blockers.push('identity-unconfirmed');
    if (missingCriteria.length) blockers.push('missing-accepted-fresh-evidence');
    const qualified = blockers.length === 0;
    const status = blockers.some(b => b.startsWith('conflicting-')) ? 'blocked' : d.approvals[c.personKey] && qualified ? 'approved' : qualified ? 'ready' : 'needs-review';
    return { personKey: c.personKey, name: c.name, status, blockers, missingCriteria, identityConfirmed, evidence: c.evidence, hypothesisIds: [...c.hypothesisIds], identityRefs };
  });
}
function view(d) {
  const candidates = candidatesFor(d);
  const exhausted = d.events.length >= MAX.events;
  const activeFindings = d.project.findings.filter(f => d.plan.activeHypothesisIds.includes(f.hypothesisId));
  const allEvidence = evidenceFor(d.project);
  const approved = candidates.filter(c => c.status === 'approved').length;
  const hypotheses = d.project.hypotheses.map(h => {
    const findings = d.project.findings.filter(f => f.hypothesisId === h.id);
    const active = d.plan.activeHypothesisIds.includes(h.id);
    const availablePeople = new Set(findings.map(f => f.personKey)).size;
    const evidence = active ? allEvidence.filter(e => e.hypothesisId === h.id) : [];
    const contributingApproved = candidates.filter(c => c.status === 'approved' && c.evidence.some(e => e.hypothesisId === h.id && e.fresh && e.review?.decision === 'accept' && d.plan.requiredCriterionIds.includes(e.criterionId))).length;
    return { id: h.id, label: h.label, rationale: h.rationale, active,
      observations: active ? findings.length : 0, people: active ? availablePeople : 0,
      availableObservations: findings.length, availablePeople,
      acceptedEvidence: evidence.filter(e => e.fresh && d.reviews[e.id]?.decision === 'accept').length,
      rejectedEvidence: evidence.filter(e => e.fresh && d.reviews[e.id]?.decision === 'reject').length,
      pendingEvidence: evidence.filter(e => e.fresh && !d.reviews[e.id]).length,
      staleEvidence: evidence.filter(e => !e.fresh).length,
      contributingApproved, approved: contributingApproved };
  });
  const coverage = d.project.criteria.filter(k => d.plan.requiredCriterionIds.includes(k.id)).map(k => ({ criterionId: k.id,
    // Proposed counts a person with any fresh recorded claim, including a later rejected claim.
    proposedPeople: candidates.filter(c => c.evidence.some(e => e.criterionId === k.id && e.fresh)).length,
    reviewedPeople: candidates.filter(c => c.evidence.some(e => e.criterionId === k.id && e.fresh && e.review?.decision === 'accept')).length,
    missingPeople: candidates.filter(c => !c.evidence.some(e => e.criterionId === k.id && e.fresh && e.review?.decision === 'accept')).length }));
  const metrics = { observations: activeFindings.length, people: candidates.length, mergedObservations: activeFindings.length - candidates.length, needsReview: candidates.filter(c => c.status === 'needs-review').length, blocked: candidates.filter(c => c.status === 'blocked').length, ready: candidates.filter(c => c.status === 'ready').length, approved };
  return freeze({ project: d.project, plan: d.plan, revision: d.revision, session: { exhausted, eventCount: d.events.length, eventLimit: MAX.events },
    candidates, hypotheses, coverage, metrics, events: d.events, exportPacket: approved && !exhausted ? packet(d, candidates) : null });
}
function packet(d, candidates) {
  return freeze({ schema: 'signal-desk-handoff.v1', mode: 'synthetic-local-demo', integrity: 'self-attested, unauthenticated',
    projectId: d.project.id, projectTitle: d.project.title, criteria: d.project.criteria, hypotheses: d.project.hypotheses,
    asOf: d.project.asOf, cutoff: d.project.cutoff, revision: d.revision, plan: d.plan,
    candidates: candidates.filter(c => c.status === 'approved').map(c => ({ personKey: c.personKey, name: c.name, identityRefs: c.identityRefs, hypothesisIds: c.hypothesisIds,
      evidence: c.evidence.filter(e => e.fresh && e.review?.decision === 'accept' && d.plan.requiredCriterionIds.includes(e.criterionId)).map(e => ({ id: e.id, criterionId: e.criterionId, quote: e.quote, source: e.source, hypothesisId: e.hypothesisId, reviewer: e.review.reviewer, reason: e.review.reason })) })),
    events: d.events });
}

export function createSession(project) {
  const validated = validateProject(project);
  return makeSession({ project: validated, plan: defaultPlan(validated), revision: 0, reviews: Object.create(null), identities: Object.create(null), approvals: Object.create(null), events: [] });
}
export function viewSession(state) { return view(getSession(state)); }
export function exportHandoff(state) {
  const d = getSession(state), candidates = candidatesFor(d);
  if (d.events.length >= MAX.events) fail('session event limit reached; start a new session');
  if (!candidates.some(c => c.status === 'approved')) fail('no approved candidates');
  return copy(packet(d, candidates));
}
export function transition(state, action) {
  const old = getSession(state); obj(action, 'action');
  const next = { project: old.project, plan: old.plan, revision: old.revision + 1,
    reviews: Object.assign(Object.create(null), old.reviews),
    identities: Object.assign(Object.create(null), old.identities),
    approvals: Object.assign(Object.create(null), old.approvals), events: [...old.events] };
  if (next.events.length >= MAX.events) fail('event limit reached');
  let event;
  if (action.type === 'review') {
    const evidenceId = str(action.evidenceId, 'evidence ID', 150), reviewer = str(action.reviewer, 'reviewer', 120), reason = str(action.reason, 'reason', 500);
    if (!['accept', 'reject'].includes(action.decision)) fail('invalid review decision');
    const evidence = evidenceFor(next.project).find(e => e.id === evidenceId);
    if (!evidence) fail('unknown evidence ID');
    if (!next.plan.activeHypothesisIds.includes(evidence.hypothesisId)) fail('evidence belongs to inactive hypothesis');
    next.reviews[evidenceId] = { decision: action.decision, reviewer, reason };
    delete next.approvals[evidence.personKey];
    event = { revision: next.revision, type: 'review', evidenceId, personKey: evidence.personKey, decision: action.decision, reviewer, reason };
  } else if (action.type === 'identity') {
    const personKey = id(action.personKey, 'person key'), reviewer = str(action.reviewer, 'reviewer', 120);
    if (typeof action.confirmed !== 'boolean') fail('confirmed must be boolean');
    const c = candidatesFor(next).find(c => c.personKey === personKey);
    if (!c) fail('unknown person key');
    if (action.confirmed && c.blockers.some(b => b.startsWith('conflicting-'))) fail('resolve identity collision before confirmation');
    next.identities[personKey] = action.confirmed;
    delete next.approvals[personKey];
    event = { revision: next.revision, type: 'identity', personKey, confirmed: action.confirmed, reviewer };
  } else if (action.type === 'approve') {
    const personKey = id(action.personKey, 'person key'), reviewer = str(action.reviewer, 'reviewer', 120);
    const c = candidatesFor(next).find(c => c.personKey === personKey);
    if (!c || c.status !== 'ready') fail('candidate is not ready for approval');
    next.approvals[personKey] = reviewer;
    event = { revision: next.revision, type: 'approve', personKey, reviewer };
  } else if (action.type === 'revoke') {
    const personKey = id(action.personKey, 'person key'), reviewer = str(action.reviewer, 'reviewer', 120);
    if (!candidatesFor(next).some(c => c.personKey === personKey)) fail('candidate absent from active plan');
    if (!next.approvals[personKey]) fail('candidate is not approved');
    delete next.approvals[personKey];
    event = { revision: next.revision, type: 'revoke', personKey, reviewer };
  } else if (action.type === 'setCutoff') {
    const cutoff = date(action.cutoff, 'cutoff');
    if (cutoff > next.project.asOf) fail('cutoff after asOf');
    if (cutoff === next.project.cutoff) fail('cutoff unchanged');
    next.project = freeze({ ...next.project, cutoff });
    next.reviews = Object.create(null); next.identities = Object.create(null); next.approvals = Object.create(null);
    event = { revision: next.revision, type: 'setCutoff', cutoff, invalidated: 'reviews, identities, approvals' };
  } else if (action.type === 'setPlan') {
    const plan = validatePlan(action, next.project), reviewer = str(action.reviewer, 'reviewer', 120);
    if (JSON.stringify(plan.objective) === JSON.stringify(old.plan.objective) &&
      JSON.stringify(plan.requiredCriterionIds) === JSON.stringify(old.plan.requiredCriterionIds) &&
      JSON.stringify(plan.activeHypothesisIds) === JSON.stringify(old.plan.activeHypothesisIds)) fail('plan unchanged');
    next.plan = freeze(plan);
    next.reviews = Object.create(null); next.identities = Object.create(null); next.approvals = Object.create(null);
    event = { revision: next.revision, type: 'setPlan', before: old.plan, after: next.plan,
      reason: plan.reason, reviewer, invalidated: 'reviews, identities, approvals' };
  } else fail('unknown action');
  next.events.push(event);
  freeze(next);
  return makeSession(next);
}

function finding(id, personKey, name, identityRef, hypothesisId, observedAt, claims) {
  const text = { uk: claims.map(c => c.quote.uk).join('. ') + '.', en: claims.map(c => c.quote.en).join('. ') + '.' };
  return { id, personKey, name, identityRef, hypothesisId,
    source: { ref: `synthetic://source/${id}`, title: { uk: `Синтетичне джерело ${id}`, en: `Synthetic source ${id}` }, text, observedAt }, claims };
}
function claim(criterionId, uk, en) { return { criterionId, quote: { uk, en } }; }
export function demoProject(scenario = 'standard') {
  if (!['standard', 'conflict', 'future-date'].includes(scenario)) fail('unknown demo scenario');
  const p = { id: 'signal-desk-demo', title: { uk: 'Синтетичний пошук: операційний партнер', en: 'Synthetic search: operations partner' },
    objective: { uk: 'Знайти людину, яка координувала запити між командами й скорочувала ручну передачу роботи через перевірену автоматизацію.', en: 'Find a person who coordinated requests across teams and reduced manual handoffs through verified automation.' },
    asOf: '2026-09-28', cutoff: '2026-08-01',
    criteria: [
      { id: 'operations', label: { uk: 'Операційна робота', en: 'Operations work' } },
      { id: 'automation', label: { uk: 'Автоматизація процесу', en: 'Workflow automation' } },
      { id: 'collaboration', label: { uk: 'Співпраця з командою', en: 'Team collaboration' } }
    ],
    hypotheses: [
      { id: 'founder-ops', label: { uk: 'Оператори при засновниках', en: 'Founder operators' }, rationale: { uk: 'Шукати практичний досвід поряд із засновником.', en: 'Look for hands-on founder-side operations.' } },
      { id: 'automation-builders', label: { uk: 'Практики автоматизації', en: 'Automation practitioners' }, rationale: { uk: 'Шукати людей, що покращували реальний процес.', en: 'Look for people who improved real workflows.' } },
      { id: 'community-ops', label: { uk: 'Оператори спільнот', en: 'Community operators' }, rationale: { uk: 'Перевірити переносимість координації спільнот.', en: 'Test transferability of community coordination.' } },
      { id: 'customer-ops', label: { uk: 'Клієнтські операції', en: 'Customer operations' }, rationale: { uk: 'Перевірити досвід роботи зі зверненнями клієнтів.', en: 'Test customer operations experience.' } }
    ], findings: [
      finding('obs-01', 'person-olena', 'Олена Коваль', 'synthetic://identity/olena', 'founder-ops', '2026-09-10', [claim('operations', 'Координувала щотижневі операції команди', 'Coordinated weekly team operations'), claim('collaboration', 'Узгоджувала пріоритети із засновницею', 'Aligned priorities with the founder')]),
      finding('obs-02', 'person-olena', 'Олена Коваль', 'synthetic://identity/olena', 'automation-builders', '2026-09-14', [claim('automation', 'Автоматизувала передачу заявок у команді', 'Automated request handoff across the team')]),
      finding('obs-03', 'person-petro', 'Петро Мельник', 'synthetic://identity/petro', 'automation-builders', '2026-09-05', [claim('automation', 'Створив робочий маршрут перевірки заявок', 'Built an operational request review flow')]),
      finding('obs-04', 'person-mariia', 'Марія Гринь', 'synthetic://identity/mariia', 'community-ops', '2026-04-12', [claim('operations', 'Керувала календарем подій спільноти', 'Managed the community event calendar'), claim('collaboration', 'Узгоджувала дії волонтерів', 'Coordinated volunteers')]),
      finding('obs-05', 'person-iryna', 'Ірина Бондар', 'synthetic://identity/iryna-a', 'customer-ops', '2026-09-18', [claim('operations', 'Вела операційні запити клієнтів', 'Handled customer operations requests'), claim('automation', 'Автоматизувала облік звернень', 'Automated request tracking'), claim('collaboration', 'Передавала випадки між командами', 'Coordinated cases across teams')]),
      finding('obs-06', 'person-iryna', 'Ірина Бондар', 'synthetic://identity/iryna-b', 'community-ops', '2026-09-20', [claim('collaboration', 'Організовувала зустрічі спільноти', 'Organized community meetings')]),
      finding('obs-07', 'person-taras', 'Тарас Левченко', 'synthetic://identity/taras', 'customer-ops', '2026-09-15', [claim('operations', 'Планував чергування підтримки', 'Planned support coverage'), claim('automation', 'Автоматизував розподіл звернень', 'Automated request routing'), claim('collaboration', 'Працював із продуктовою командою', 'Worked with the product team')]),
      finding('obs-08', 'person-kateryna', 'Катерина Роман', 'synthetic://identity/kateryna', 'founder-ops', '2026-08-22', [claim('operations', 'Вела операційний план', 'Maintained the operations plan')])
    ] };
  if (scenario === 'conflict') p.findings[1].identityRef = 'synthetic://identity/olena-other';
  if (scenario === 'future-date') p.findings[0].source.observedAt = '2026-10-01';
  return copy(p);
}
