import { validateResearchReport } from './research.js?v=0.8.0';

const SCHEMA = 'signal-desk-research-review.v1';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ACTIONS = 100;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => own(value, key));
const clone = value => JSON.parse(JSON.stringify(value));
function fail() { throw new TypeError('invalid research review'); }
function reasonValid(value) {
  return typeof value === 'string' && value === value.trim() && value.length >= 8 && value.length <= 400 &&
    !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
}
function withinLimit(value) {
  let json;
  try { json = JSON.stringify(value); } catch { fail(); }
  if (typeof json !== 'string' || new TextEncoder().encode(json).byteLength > MAX_BYTES) fail();
}

// This review never turns a commit association into qualification or permission to contact.
export function createResearchReview(report) {
  validateResearchReport(report);
  const session = { schema: SCHEMA, report: clone(report), actions: [] };
  withinLimit(session);
  return session;
}

export function researchReviewView(input) {
  if (!exact(input, ['schema', 'report', 'actions']) || input.schema !== SCHEMA ||
      !Array.isArray(input.actions) || input.actions.length > MAX_ACTIONS) fail();
  withinLimit(input);
  const report = validateResearchReport(input.report);
  const leads = new Map(report.leads.map(lead => [lead.id, lead]));
  const evidence = new Map(report.leads.flatMap(lead => lead.evidence.map(item => [item.id, lead.id])));
  const evidenceDecisions = new Map();
  const leadDecisions = new Map();
  const conflictedEvidence = new Set();
  for (const action of input.actions) {
    if (action?.type === 'source-conflict') {
      if (!exact(action, ['type', 'evidenceId']) || !evidence.has(action.evidenceId) ||
          conflictedEvidence.has(action.evidenceId)) fail();
      conflictedEvidence.add(action.evidenceId);
      evidenceDecisions.delete(action.evidenceId);
      leadDecisions.delete(evidence.get(action.evidenceId));
    } else if (action?.type === 'evidence') {
      if (!exact(action, ['type', 'evidenceId', 'decision', 'reason']) ||
          !evidence.has(action.evidenceId) || !['relevant', 'irrelevant', 'uncertain'].includes(action.decision) ||
          !reasonValid(action.reason) || (action.decision === 'relevant' && conflictedEvidence.has(action.evidenceId))) fail();
      evidenceDecisions.set(action.evidenceId, action);
      // Any new source decision withdraws the earlier lead handoff, even if the source later looks useful again.
      leadDecisions.delete(evidence.get(action.evidenceId));
    } else if (action?.type === 'lead') {
      if (!exact(action, ['type', 'leadId', 'decision', 'reason']) || !leads.has(action.leadId) ||
          !['follow-up', 'hold'].includes(action.decision) || !reasonValid(action.reason)) fail();
      if (action.decision === 'follow-up' && !leads.get(action.leadId).evidence.some(item =>
        evidenceDecisions.get(item.id)?.decision === 'relevant')) fail();
      leadDecisions.set(action.leadId, action);
    } else fail();
  }
  const reviewedEvidence = [...evidenceDecisions.values()].length;
  const followUps = [...leadDecisions.values()].filter(action => action.decision === 'follow-up').length;
    return { report, evidenceDecisions, leadDecisions, conflictedEvidence, reviewedEvidence, followUps,
    actionCount: input.actions.length, exhausted: input.actions.length >= MAX_ACTIONS };
}

export function researchReviewAction(input, action) {
  const view = researchReviewView(input);
  if (view.exhausted) fail();
  // Replay the whole proposed history. No independently supplied status or approval is trusted.
  const next = { schema: SCHEMA, report: clone(view.report), actions: [...input.actions.map(clone), clone(action)] };
  researchReviewView(next);
  return next;
}

export function restoreResearchReview(input) {
  researchReviewView(input);
  return clone(input);
}

export function researchReviewPacket(input, imported = true) {
  if (typeof imported !== 'boolean') fail();
  const view = researchReviewView(input);
  if (view.exhausted) return null;
  const selected = view.report.leads.flatMap(lead => {
    const decision = view.leadDecisions.get(lead.id);
    if (decision?.decision !== 'follow-up') return [];
    const support = lead.evidence.flatMap(item => {
      const review = view.evidenceDecisions.get(item.id);
      return review?.decision === 'relevant' ? [{ ...item, reviewReason: review.reason }] : [];
    });
    if (!support.length) return [];
    return [{ id: lead.id, handle: lead.handle, profileUrl: lead.profileUrl,
      hypothesisIds: [...lead.hypothesisIds], evidence: support, nextResearchReason: decision.reason,
      unknowns: [...lead.unknowns] }];
  });
  if (!selected.length) return null;
  return { schema: 'signal-desk-research-follow-up.v1', role: clone(view.report.role),
    observedAt: view.report.run.observedAt, runStatus: view.report.run.status,
    sourceOrigin: imported ? 'imported-file-unverified' : 'same-browser-public-api-read-self-attested',
    decisionAuthority: 'local-human-assertion-unauthenticated',
    scope: 'further-research-only-no-contact-or-candidate-approval',
    selectionLimit: view.report.run.selectionNote,
    leads: selected };
}
