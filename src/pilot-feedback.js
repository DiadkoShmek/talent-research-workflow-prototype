import { researchReviewPacket } from './research-review.js?v=0.9.1';
import { RESEARCH_ROLE, RESEARCH_LANES } from './research.js?v=0.9.1';
import { ROLE_SEARCH_LANES_V3 } from './role-search.js?v=0.9.1';

const SCHEMA = 'signal-desk-pilot-feedback.v1';
const MAX_BYTES = 1024 * 1024;
const MAX_ACTIONS = 60;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const fail = () => { throw new TypeError('invalid pilot feedback'); };
const reason = value => typeof value === 'string' && value === value.trim() && value.length >= 8 && value.length <= 400 &&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const clone = value => JSON.parse(JSON.stringify(value));
const unknowns = ['5+ professional years', 'Europe eligibility', 'availability and interest', 'full role fit'];

function validateSource(source) {
  if (!exact(source, ['schema', 'role', 'observedAt', 'runStatus', 'sourceOrigin', 'decisionAuthority', 'scope', 'selectionLimit', 'leads']) ||
      source.schema !== 'signal-desk-research-follow-up.v1' ||
      source.scope !== 'further-research-only-no-contact-or-candidate-approval' ||
      !exact(source.role, ['title', 'url']) || source.role.title !== RESEARCH_ROLE.title || source.role.url !== RESEARCH_ROLE.url ||
      typeof source.observedAt !== 'string' || !Number.isFinite(Date.parse(source.observedAt)) ||
      !['complete', 'partial', 'failed'].includes(source.runStatus) ||
      !['imported-file-unverified', 'same-browser-public-api-read-self-attested'].includes(source.sourceOrigin) ||
      source.decisionAuthority !== 'local-human-assertion-unauthenticated' ||
      typeof source.selectionLimit !== 'string' || source.selectionLimit.length > 300 ||
      !Array.isArray(source.leads) || source.leads.length < 1 || source.leads.length > 10) fail();
  const ids = new Set();
  for (const lead of source.leads) {
    if (!exact(lead, ['id', 'handle', 'profileUrl', 'hypothesisIds', 'evidence', 'nextResearchReason', 'unknowns']) ||
        typeof lead.id !== 'string' || !/^github:[1-9]\d*$/.test(lead.id) || ids.has(lead.id) ||
        typeof lead.handle !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(lead.handle) ||
        lead.profileUrl !== `https://github.com/${lead.handle}` || !reason(lead.nextResearchReason) ||
        !Array.isArray(lead.hypothesisIds) || lead.hypothesisIds.length < 1 ||
        new Set(lead.hypothesisIds).size !== lead.hypothesisIds.length ||
        lead.hypothesisIds.some(id => ![...RESEARCH_LANES, ...ROLE_SEARCH_LANES_V3].some(lane => lane.id === id)) ||
        JSON.stringify(lead.unknowns) !== JSON.stringify(unknowns) ||
        !Array.isArray(lead.evidence) || lead.evidence.length < 1 || lead.evidence.length > 10) fail();
    ids.add(lead.id);
    const evidenceIds = new Set();
    for (const item of lead.evidence) {
      const commit = item?.kind === 'github-commit';
      const lane = [...RESEARCH_LANES, ...ROLE_SEARCH_LANES_V3].find(candidate => candidate.repo === item?.repository);
      if (!exact(item, commit ? ['id', 'kind', 'url', 'repository', 'title', 'committedAt', 'observedAt', 'reviewReason'] :
        ['id', 'kind', 'url', 'repository', 'title', 'mergedAt', 'observedAt', 'number', 'reviewReason']) ||
          typeof item.id !== 'string' || evidenceIds.has(item.id) || !lane || !lead.hypothesisIds.includes(lane.id) ||
          (commit ? (!/^github-commit:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+:[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(item.id) ||
            item.url !== `https://github.com/${item.id.slice('github-commit:'.length).replace(/:([0-9a-f]+)$/, '/commit/$1')}`) :
            (!Number.isSafeInteger(item.number) || item.number <= 0 ||
              item.id !== `github-pr:${lane.repo}:${item.number}` || item.url !== `https://github.com/${lane.repo}/pull/${item.number}`)) ||
          typeof item.title !== 'string' || !item.title || item.title.length > 160 ||
          item.observedAt !== source.observedAt || typeof (commit ? item.committedAt : item.mergedAt) !== 'string' ||
          !Number.isFinite(Date.parse(commit ? item.committedAt : item.mergedAt)) ||
          Date.parse(commit ? item.committedAt : item.mergedAt) > Date.parse(source.observedAt) ||
          !reason(item.reviewReason)) fail();
      evidenceIds.add(item.id);
    }
  }
  return ids;
}

export function createPilotFeedback(review, imported = true) {
  const source = researchReviewPacket(review, imported);
  if (!source) fail();
  const feedback = { schema: SCHEMA, source, actions: [] };
  viewPilotFeedback(feedback);
  return clone(feedback);
}

export function viewPilotFeedback(input) {
  let serialized;
  try { serialized = JSON.stringify(input); } catch { fail(); }
  if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).byteLength > MAX_BYTES ||
      !exact(input, ['schema', 'source', 'actions']) || input.schema !== SCHEMA ||
      !Array.isArray(input.actions) || input.actions.length > MAX_ACTIONS) fail();
  const ids = validateSource(input.source);
  const latest = new Map();
  for (const action of input.actions) {
    if (!exact(action, ['type', 'leadId', 'verdict', 'minutes', 'assessorContext', 'reason']) ||
        action.type !== 'evaluate' || !ids.has(action.leadId) ||
        !['useful-next-step', 'not-useful', 'unclear'].includes(action.verdict) ||
        !Number.isInteger(action.minutes) || action.minutes < 1 || action.minutes > 240 ||
        !['builder', 'recruiter-reported', 'unknown'].includes(action.assessorContext) ||
        !reason(action.reason)) fail();
    latest.set(action.leadId, action);
  }
  const useful = [...latest.values()].filter(action => action.verdict === 'useful-next-step').length;
  const minutes = [...latest.values()].reduce((sum, action) => sum + action.minutes, 0);
  return { source: input.source, latest, assessed: latest.size, total: ids.size, useful, minutes,
    complete: latest.size === ids.size, exhausted: input.actions.length >= MAX_ACTIONS };
}

export function recordPilotFeedback(input, action) {
  const view = viewPilotFeedback(input);
  if (view.exhausted) fail();
  const next = { schema: SCHEMA, source: clone(view.source), actions: [...input.actions.map(clone), clone(action)] };
  viewPilotFeedback(next);
  return next;
}

export function restorePilotFeedback(input) {
  viewPilotFeedback(input);
  return clone(input);
}
