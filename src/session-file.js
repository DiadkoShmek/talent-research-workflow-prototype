import { createSession, transition, viewSession } from './engine.js?v=0.8.0';

export const MAX_SESSION_BYTES = 2 * 1024 * 1024;
const SCHEMA = 'signal-desk-session.v1';
const MAX_ACTIONS = 2000;

function fail(message) { throw new Error(`session file: ${message}`); }
function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function exactKeys(value, keys, label) {
  if (!plain(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...keys].sort())) fail(`${label} has missing or unexpected fields`);
}
function checkedJson(value) {
  let json;
  try { json = JSON.stringify(value); } catch { fail('invalid JSON value'); }
  if (typeof json !== 'string') fail('invalid JSON value');
  if (new TextEncoder().encode(json).byteLength > MAX_SESSION_BYTES) fail('file exceeds size limit');
  return JSON.parse(json);
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}
function same(a, b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }

function eventAction(event) {
  switch (event.type) {
    case 'review':
      return { type: 'review', evidenceId: event.evidenceId, decision: event.decision, reviewer: event.reviewer, reason: event.reason };
    case 'identity':
      return { type: 'identity', personKey: event.personKey, confirmed: event.confirmed, reviewer: event.reviewer };
    case 'approve':
    case 'revoke':
      return { type: event.type, personKey: event.personKey, reviewer: event.reviewer };
    case 'setCutoff':
      return { type: 'setCutoff', cutoff: event.cutoff };
    case 'setPlan':
      return { type: 'setPlan', objective: event.after.objective,
        requiredCriterionIds: event.after.requiredCriterionIds,
        activeHypothesisIds: event.after.activeHypothesisIds,
        reason: event.after.reason, reviewer: event.reviewer };
    default:
      fail(`unknown event type: ${event.type}`);
  }
}

const ACTION_KEYS = {
  review: ['type', 'evidenceId', 'decision', 'reviewer', 'reason'],
  identity: ['type', 'personKey', 'confirmed', 'reviewer'],
  approve: ['type', 'personKey', 'reviewer'],
  revoke: ['type', 'personKey', 'reviewer'],
  setCutoff: ['type', 'cutoff'],
  setPlan: ['type', 'objective', 'requiredCriterionIds', 'activeHypothesisIds', 'reason', 'reviewer']
};

function replay(project, actions) {
  if (!Array.isArray(actions) || actions.length > MAX_ACTIONS) fail('invalid action list or action limit exceeded');
  let state = createSession(project);
  for (const [index, action] of actions.entries()) {
    exactKeys(action, ACTION_KEYS[action?.type] ?? [], `action ${index}`);
    try { state = transition(state, action); }
    catch (error) { fail(`action ${index} rejected: ${error.message}`); }
  }
  return state;
}

export function serializeSession(originProject, state) {
  const original = viewSession(createSession(originProject)).project;
  const current = viewSession(state);
  const actions = current.events.map(eventAction);
  const rebuilt = replay(original, actions);
  if (!same(viewSession(rebuilt), current)) fail('origin project does not reproduce this session');
  return checkedJson({ schema: SCHEMA, project: original, actions });
}

export function restoreSession(envelope) {
  exactKeys(envelope, ['schema', 'project', 'actions'], 'envelope');
  if (Array.isArray(envelope.actions)) {
    if (envelope.actions.length > MAX_ACTIONS) fail('invalid action list or action limit exceeded');
    envelope.actions.forEach((action, index) => exactKeys(action, ACTION_KEYS[action?.type] ?? [], `action ${index}`));
  }
  const file = checkedJson(envelope);
  exactKeys(file, ['schema', 'project', 'actions'], 'envelope');
  if (file.schema !== SCHEMA) fail('unknown schema');
  const original = viewSession(createSession(file.project)).project;
  if (!same(file.project, original)) fail('project is not canonical or has unexpected fields');
  const state = replay(original, file.actions);
  return { originProject: structuredClone(original), state };
}
