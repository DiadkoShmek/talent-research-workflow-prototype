import { readPublicGitHubJson } from './github-public-read.js?v=0.10.0';

const ROLE = Object.freeze({ title: 'Senior Agentic Software Engineer — Poolday',
  url: 'https://aplayers.na.teamtailor.com/jobs/536324-senior-agentic-software-engineer-poolday' });
export const ROLE_SEARCH_LANES = Object.freeze([
  Object.freeze({ id: 'agent-orchestration', label: 'Agent orchestration', repo: 'langchain-ai/langgraphjs', term: 'agent' }),
  Object.freeze({ id: 'ts-agent-tooling', label: 'TypeScript tool execution', repo: 'vercel/ai', term: 'tool' }),
  Object.freeze({ id: 'programmable-editor', label: 'Programmable editor', repo: 'tldraw/tldraw', term: 'editor' }),
  Object.freeze({ id: 'agent-recovery', label: 'Agent reliability and recovery', repo: 'triggerdotdev/trigger.dev', term: 'agent' })
]);
const VIDEO_LANE = Object.freeze({ id: 'video-timeline', label: 'Video timeline and editor', repo: 'remotion-dev/remotion', term: 'timeline' });
export const ROLE_SEARCH_LANES_V3 = Object.freeze([VIDEO_LANE, ...ROLE_SEARCH_LANES]);
const ROLE_SEARCH_LANES_V3_PREVIOUS_ORDER = Object.freeze([...ROLE_SEARCH_LANES, VIDEO_LANE]);
const NOTE = 'Four role-derived merged-PR title searches in seeded public repositories; title screening is not a skill or candidate ranking.';
const NOTE_V3 = 'Five role-derived merged-PR title searches in seeded public repositories; at most two sources per account and lane; no person ranking.';
const ALIGNMENT = Object.freeze({
  'agent-orchestration': /agent|graph|thread|deploy|subagent|orchestrat/i,
  'ts-agent-tooling': /tool|harness|strict|function.call|gateway|sdk/i,
  'programmable-editor': /editor|shape|cursor|canvas|state|command|mcp|preference|resize/i,
  'agent-recovery': /recover|retry|transcript|context|checkpoint|memory|durable|scheduler/i,
  'video-timeline': /timeline|trim|frame|track|keyframe|canvas|composition|playback/i
});
const UNKNOWN = Object.freeze(['5+ professional years', 'Europe eligibility', 'availability and interest', 'full role fit']);
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => own(value, key));
const natural = value => Number.isSafeInteger(value) && value >= 0;
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
const fail = () => { throw new TypeError('invalid role search report'); };
const sinceFor = observedAt => new Date(Date.parse(observedAt) - 180 * 86400000).toISOString().slice(0, 10);
const queryUrl = (lane, since) => `https://api.github.com/search/issues?q=${encodeURIComponent(`is:pr is:merged repo:${lane.repo} ${lane.term} in:title updated:>=${since}`)}&sort=updated&order=desc&per_page=20`;
function titleOf(value, lane) {
  if (typeof value !== 'string') return null;
  const title = value.split(/\r?\n/)[0].trim();
  const technicalPrefix = lane.id === 'video-timeline'
    ? /^`@remotion\/(?:studio|timeline-utils|media|canvas)`:\s*(?:fix|add|improve|prevent|support|refactor|make)\b/i
    : /^(?:\[[^\]]{1,20}\]\s*)?(?:feat|fix|perf|refactor)(?:\([^)]{1,40}\))?:/i;
  if (!title || title.length > 160 || /[\x00-\x1f\x7f]/.test(title) ||
      !title.toLowerCase().includes(lane.term) || !ALIGNMENT[lane.id].test(title) ||
      !technicalPrefix.test(title)) return null;
  return title;
}
// Preserve safe, canonical rows rejected by title screening for human inspection.
// They remain outside the lead/review/handoff authority path.
function screenedOutRow(row, lane, since, observedAt) {
  if (!record(row) || !record(row.user) || row.user.type !== 'User' ||
      !Number.isSafeInteger(row.user.id) || row.user.id <= 0 ||
      typeof row.user.login !== 'string' || !LOGIN.test(row.user.login) ||
      !Number.isSafeInteger(row.number) || row.number <= 0 ||
      row.repository_url !== `https://api.github.com/repos/${lane.repo}` ||
      row.html_url !== `https://github.com/${lane.repo}/pull/${row.number}` ||
      !record(row.pull_request) || !date(row.pull_request.merged_at) ||
      (own(row.user, 'html_url') && row.user.html_url !== `https://github.com/${row.user.login}`)) return null;
  const title = typeof row.title === 'string' ? row.title.split(/\r?\n/)[0].trim() : '';
  if (!title || title.length > 160 || /[\x00-\x1f\x7f]/.test(title)) return null;
  const mergedAt = row.pull_request.merged_at;
  const outsideWindow = mergedAt.slice(0, 10) < since || Date.parse(mergedAt) > Date.parse(observedAt);
  if (!outsideWindow && titleOf(title, lane)) return null;
  const reason = outsideWindow ? 'outside-merge-window' :
    title.toLowerCase().includes(lane.term) && ALIGNMENT[lane.id].test(title)
      ? 'technical-prefix-required' : 'title-context-rule';
  return { id: `github-pr:${lane.repo}:${row.number}`, url: row.html_url, title, mergedAt, reason };
}
function disposition(row, lane, since, observedAt) {
  if (!record(row)) return { kind: 'rejected' };
  if (row.user === null || (record(row.user) && ['Bot', 'Organization'].includes(row.user.type))) return { kind: 'skipped' };
  const user = row.user;
  if (!record(user) || user.type !== 'User' || !Number.isSafeInteger(user.id) || user.id <= 0 ||
      typeof user.login !== 'string' || !LOGIN.test(user.login) ||
      !Number.isSafeInteger(row.number) || row.number <= 0 ||
      row.repository_url !== `https://api.github.com/repos/${lane.repo}` ||
      row.html_url !== `https://github.com/${lane.repo}/pull/${row.number}` ||
      (own(user, 'html_url') && user.html_url !== `https://github.com/${user.login}`) ||
      !record(row.pull_request)) return { kind: 'rejected' };
  const mergedAt = row.pull_request.merged_at;
  const title = titleOf(row.title, lane);
  if (!date(mergedAt)) return { kind: 'rejected' };
  if (mergedAt.slice(0, 10) < since || Date.parse(mergedAt) > Date.parse(observedAt) || !title)
    return { kind: 'skipped' };
  return { kind: 'valid', userId: user.id, handle: user.login,
    evidence: { id: `github-pr:${lane.repo}:${row.number}`, kind: 'github-pr',
      url: row.html_url, repository: lane.repo, title, mergedAt, observedAt, number: row.number } };
}
function safeError(error) {
  if (Number.isInteger(error?.publicStatus)) return `HTTP ${error.publicStatus}`;
  if (['redirect refused', 'response exceeds size limit', 'invalid JSON response'].includes(error?.message)) return error.message;
  return 'request failed';
}

export async function collectRoleSearch(fetcher = globalThis.fetch) {
  if (typeof fetcher !== 'function') throw new TypeError('fetcher must be a function');
  const started = globalThis.performance?.now?.() ?? Date.now();
  const observedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const searchSince = sinceFor(observedAt);
  const leads = new Map();
  const lanes = [];
  for (const definition of ROLE_SEARCH_LANES) {
    const lane = { ...definition, queryUrl: queryUrl(definition, searchSince), status: 'empty',
      scanned: 0, skipped: 0, rejected: 0, duplicates: 0, capped: 0,
      observations: 0, leadIds: [], totalCount: 0, incomplete: false };
    let result;
    try { result = await readPublicGitHubJson(fetcher, lane.queryUrl); }
    catch (error) { lane.status = 'error'; lane.error = safeError(error); lanes.push(lane); continue; }
    if (!record(result) || !natural(result.total_count) || typeof result.incomplete_results !== 'boolean' ||
        !Array.isArray(result.items) || result.items.length > 20) {
      lane.status = 'error'; lane.error = 'invalid search response'; lanes.push(lane); continue;
    }
    lane.totalCount = result.total_count;
    lane.incomplete = result.incomplete_results;
    const laneIds = new Set();
    for (const row of result.items) {
      lane.scanned++;
      const candidate = disposition(row, definition, searchSince, observedAt);
      if (candidate.kind === 'skipped') { lane.skipped++; continue; }
      if (candidate.kind === 'rejected') { lane.rejected++; continue; }
      const id = `github:${candidate.userId}`;
      if (laneIds.has(id)) { lane.duplicates++; continue; }
      if (laneIds.size >= 2) { lane.capped++; continue; }
      let lead = leads.get(id);
      if (!lead) {
        lead = { id, handle: candidate.handle, profileUrl: `https://github.com/${candidate.handle}`,
          hypothesisIds: [], evidence: [], unknowns: [...UNKNOWN] };
        leads.set(id, lead);
      }
      if (!lead.hypothesisIds.includes(definition.id)) lead.hypothesisIds.push(definition.id);
      lead.evidence.push(candidate.evidence);
      laneIds.add(id);
    }
    lane.leadIds = [...laneIds];
    lane.observations = laneIds.size;
    if (lane.rejected || lane.incomplete) {
      lane.status = lane.observations ? 'partial' : 'error';
      lane.error = `${lane.rejected} malformed rows; incomplete search: ${lane.incomplete}`;
    } else if (lane.observations) lane.status = 'ok';
    lanes.push(lane);
  }
  const errors = lanes.filter(lane => lane.status === 'error').length;
  const report = { schema: 'signal-desk-research.v2', role: { ...ROLE }, run: {
    observedAt, elapsedMs: Math.round((globalThis.performance?.now?.() ?? Date.now()) - started),
    requests: ROLE_SEARCH_LANES.length, mode: 'public-github-merged-pr-search', selectionNote: NOTE, searchSince,
    status: errors === ROLE_SEARCH_LANES.length ? 'failed' : lanes.some(lane => ['error', 'partial'].includes(lane.status)) ? 'partial' : 'complete'
  }, lanes, leads: [...leads.values()] };
  return validateRoleSearchReport(report);
}

export function validateRoleSearchReport(input, expectedRole = ROLE) {
  if (!exact(input, ['schema', 'role', 'run', 'lanes', 'leads']) || input.schema !== 'signal-desk-research.v2' ||
      !exact(input.role, ['title', 'url']) || input.role.title !== expectedRole.title || input.role.url !== expectedRole.url ||
      !exact(input.run, ['observedAt', 'elapsedMs', 'requests', 'mode', 'selectionNote', 'searchSince', 'status']) ||
      !date(input.run.observedAt) || !natural(input.run.elapsedMs) || input.run.requests !== 4 ||
      input.run.mode !== 'public-github-merged-pr-search' || input.run.selectionNote !== NOTE ||
      input.run.searchSince !== sinceFor(input.run.observedAt) ||
      !Array.isArray(input.lanes) || input.lanes.length !== 4 ||
      !Array.isArray(input.leads) || input.leads.length > 8) fail();
  const leadMap = new Map();
  const evidenceIds = new Set();
  for (const lead of input.leads) {
    if (!exact(lead, ['id', 'handle', 'profileUrl', 'hypothesisIds', 'evidence', 'unknowns']) ||
        typeof lead.id !== 'string' || !/^github:[1-9]\d*$/.test(lead.id) ||
        !Number.isSafeInteger(Number(lead.id.slice(7))) || leadMap.has(lead.id) ||
        typeof lead.handle !== 'string' || !LOGIN.test(lead.handle) || lead.profileUrl !== `https://github.com/${lead.handle}` ||
        !Array.isArray(lead.hypothesisIds) || new Set(lead.hypothesisIds).size !== lead.hypothesisIds.length ||
        !Array.isArray(lead.evidence) || lead.evidence.length < 1 || lead.evidence.length > 4 ||
        JSON.stringify(lead.unknowns) !== JSON.stringify(UNKNOWN)) fail();
    leadMap.set(lead.id, lead);
    for (const item of lead.evidence) {
      const lane = ROLE_SEARCH_LANES.find(candidate => candidate.repo === item?.repository);
      if (!lane || !lead.hypothesisIds.includes(lane.id) ||
          !exact(item, ['id', 'kind', 'url', 'repository', 'title', 'mergedAt', 'observedAt', 'number']) ||
          item.kind !== 'github-pr' || !Number.isSafeInteger(item.number) || item.number <= 0 ||
          item.id !== `github-pr:${lane.repo}:${item.number}` || item.url !== `https://github.com/${lane.repo}/pull/${item.number}` ||
          !titleOf(item.title, lane) || !date(item.mergedAt) ||
          item.mergedAt.slice(0, 10) < input.run.searchSince || Date.parse(item.mergedAt) > Date.parse(input.run.observedAt) ||
          item.observedAt !== input.run.observedAt || evidenceIds.has(item.id)) fail();
      evidenceIds.add(item.id);
    }
    if (lead.hypothesisIds.length !== lead.evidence.length ||
        lead.evidence.some(item => lead.evidence.filter(other => other.repository === item.repository).length !== 1)) fail();
  }
  for (let index = 0; index < ROLE_SEARCH_LANES.length; index++) {
    const lane = input.lanes[index], definition = ROLE_SEARCH_LANES[index];
    const fields = ['id', 'label', 'repo', 'term', 'queryUrl', 'status', 'scanned', 'skipped', 'rejected', 'duplicates', 'capped', 'observations', 'leadIds', 'totalCount', 'incomplete'];
    if (!exact(lane, ['error', 'partial'].includes(lane?.status) ? [...fields, 'error'] : fields) ||
        lane.id !== definition.id || lane.label !== definition.label || lane.repo !== definition.repo || lane.term !== definition.term ||
        lane.queryUrl !== queryUrl(definition, input.run.searchSince) ||
        !['ok', 'empty', 'partial', 'error'].includes(lane.status) || !natural(lane.scanned) || lane.scanned > 20 ||
        !natural(lane.skipped) || !natural(lane.rejected) || !natural(lane.duplicates) || !natural(lane.capped) ||
        !natural(lane.observations) || lane.observations > 2 ||
        lane.skipped + lane.rejected + lane.duplicates + lane.capped + lane.observations !== lane.scanned ||
        !natural(lane.totalCount) ||
        typeof lane.incomplete !== 'boolean' || !Array.isArray(lane.leadIds) || lane.leadIds.length > 2 ||
        new Set(lane.leadIds).size !== lane.leadIds.length || lane.leadIds.some(id => !leadMap.has(id)) ||
        (['error', 'partial'].includes(lane.status) && (typeof lane.error !== 'string' || !lane.error || lane.error.length > 100)) ||
        (lane.status === 'ok' && (!lane.observations || lane.incomplete || lane.rejected)) ||
        (lane.status === 'empty' && (lane.observations || lane.incomplete || lane.rejected)) ||
        (lane.status === 'partial' && (!lane.observations || (!lane.incomplete && !lane.rejected))) ||
        (lane.status === 'error' && lane.observations)) fail();
    const actualIds = [...leadMap.values()].filter(lead => lead.evidence.some(item => item.repository === lane.repo)).map(lead => lead.id);
    if (actualIds.length !== lane.leadIds.length || actualIds.some(id => !lane.leadIds.includes(id)) || actualIds.length !== lane.observations ||
        lane.observations > lane.scanned - lane.skipped - lane.rejected) fail();
  }
  const errors = input.lanes.filter(lane => lane.status === 'error').length;
  const status = errors === ROLE_SEARCH_LANES.length ? 'failed' :
    input.lanes.some(lane => ['error', 'partial'].includes(lane.status)) ? 'partial' : 'complete';
  if (input.run.status !== status) fail();
  return input;
}

const STOPPED = 'not requested after HTTP 403/429';

// A second source from the same account can show a pattern of work. It still does not establish role fit.
export async function collectRoleSearchV3(fetcher = globalThis.fetch) {
  if (typeof fetcher !== 'function') throw new TypeError('fetcher must be a function');
  const started = globalThis.performance?.now?.() ?? Date.now();
  const observedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const searchSince = sinceFor(observedAt);
  const leads = new Map();
  const sourceOwners = new Map();
  const lanes = [];
  let requests = 0;
  let stop = false;
  for (const definition of ROLE_SEARCH_LANES_V3) {
    const lane = { ...definition, queryUrl: queryUrl(definition, searchSince), status: 'empty',
      scanned: 0, skipped: 0, rejected: 0, duplicates: 0, capped: 0,
      observations: 0, leadIds: [], totalCount: 0, incomplete: false, screenedOut: [] };
    if (stop) { lane.status = 'error'; lane.error = STOPPED; lanes.push(lane); continue; }
    let result;
    try {
      requests++;
      result = await readPublicGitHubJson(fetcher, lane.queryUrl);
    } catch (error) {
      lane.status = 'error'; lane.error = safeError(error);
      if ([403, 429].includes(error?.publicStatus)) stop = true;
      lanes.push(lane);
      continue;
    }
    if (!record(result) || !natural(result.total_count) || typeof result.incomplete_results !== 'boolean' ||
        !Array.isArray(result.items) || result.items.length > 20) {
      lane.status = 'error'; lane.error = 'invalid search response'; lanes.push(lane); continue;
    }
    lane.totalCount = result.total_count;
    lane.incomplete = result.incomplete_results;
    const laneCounts = new Map();
    for (const row of result.items) {
      lane.scanned++;
      const candidate = disposition(row, definition, searchSince, observedAt);
      if (candidate.kind === 'skipped') {
        lane.skipped++;
        const trace = screenedOutRow(row, definition, searchSince, observedAt);
        if (trace && !lane.screenedOut.some(item => item.id === trace.id)) lane.screenedOut.push(trace);
        continue;
      }
      if (candidate.kind === 'rejected') { lane.rejected++; continue; }
      const id = `github:${candidate.userId}`;
      const priorOwner = sourceOwners.get(candidate.evidence.id);
      if (priorOwner && priorOwner !== id) { lane.rejected++; continue; }
      if (priorOwner === id) { lane.duplicates++; continue; }
      if ((!laneCounts.has(id) && laneCounts.size >= 2) || (laneCounts.get(id) ?? 0) >= 2) {
        lane.capped++; continue;
      }
      let lead = leads.get(id);
      if (!lead) {
        lead = { id, handle: candidate.handle, profileUrl: `https://github.com/${candidate.handle}`,
          hypothesisIds: [], evidence: [], unknowns: [...UNKNOWN] };
        leads.set(id, lead);
      }
      if (!lead.hypothesisIds.includes(definition.id)) lead.hypothesisIds.push(definition.id);
      lead.evidence.push(candidate.evidence);
      sourceOwners.set(candidate.evidence.id, id);
      laneCounts.set(id, (laneCounts.get(id) ?? 0) + 1);
    }
    lane.leadIds = [...laneCounts.keys()];
    lane.observations = [...laneCounts.values()].reduce((sum, count) => sum + count, 0);
    if (lane.rejected || lane.incomplete) {
      lane.status = lane.observations ? 'partial' : 'error';
      lane.error = `${lane.rejected} malformed rows; incomplete search: ${lane.incomplete}`;
    } else if (lane.observations) lane.status = 'ok';
    lanes.push(lane);
  }
  const errors = lanes.filter(lane => lane.status === 'error').length;
  return validateRoleSearchReportV3({ schema: 'signal-desk-research.v3', role: { ...ROLE }, run: {
    observedAt, elapsedMs: Math.round((globalThis.performance?.now?.() ?? Date.now()) - started),
    requests, plannedRequests: ROLE_SEARCH_LANES_V3.length,
    mode: 'public-github-role-evidence-search', selectionNote: NOTE_V3, searchSince,
    status: errors === ROLE_SEARCH_LANES_V3.length ? 'failed' :
      lanes.some(lane => ['error', 'partial'].includes(lane.status)) ? 'partial' : 'complete'
  }, lanes, leads: [...leads.values()] });
}

export function validateRoleSearchReportV3(input, expectedRole = ROLE) {
  if (!exact(input, ['schema', 'role', 'run', 'lanes', 'leads']) || input.schema !== 'signal-desk-research.v3' ||
      !exact(input.role, ['title', 'url']) || input.role.title !== expectedRole.title || input.role.url !== expectedRole.url ||
      !exact(input.run, ['observedAt', 'elapsedMs', 'requests', 'plannedRequests', 'mode', 'selectionNote', 'searchSince', 'status']) ||
      !date(input.run.observedAt) || !natural(input.run.elapsedMs) || !natural(input.run.requests) ||
      input.run.requests > 5 || input.run.plannedRequests !== 5 ||
      input.run.mode !== 'public-github-role-evidence-search' || input.run.selectionNote !== NOTE_V3 ||
      input.run.searchSince !== sinceFor(input.run.observedAt) ||
      !Array.isArray(input.lanes) || input.lanes.length !== 5 ||
      !Array.isArray(input.leads) || input.leads.length > 10) fail();
  // The earlier v3 release queried video last. Both exact orders remain importable.
  const definitions = input.lanes[0]?.id === VIDEO_LANE.id
    ? ROLE_SEARCH_LANES_V3 : ROLE_SEARCH_LANES_V3_PREVIOUS_ORDER;
  const leadMap = new Map();
  const evidenceIds = new Set();
  for (const lead of input.leads) {
    if (!exact(lead, ['id', 'handle', 'profileUrl', 'hypothesisIds', 'evidence', 'unknowns']) ||
        typeof lead.id !== 'string' || !/^github:[1-9]\d*$/.test(lead.id) ||
        !Number.isSafeInteger(Number(lead.id.slice(7))) || leadMap.has(lead.id) ||
        typeof lead.handle !== 'string' || !LOGIN.test(lead.handle) || lead.profileUrl !== `https://github.com/${lead.handle}` ||
        !Array.isArray(lead.hypothesisIds) || lead.hypothesisIds.length < 1 ||
        new Set(lead.hypothesisIds).size !== lead.hypothesisIds.length ||
        !Array.isArray(lead.evidence) || lead.evidence.length < 1 || lead.evidence.length > 10 ||
        JSON.stringify(lead.unknowns) !== JSON.stringify(UNKNOWN)) fail();
    leadMap.set(lead.id, lead);
    const represented = new Set();
    for (const item of lead.evidence) {
      const lane = ROLE_SEARCH_LANES_V3.find(candidate => candidate.repo === item?.repository);
      if (!lane || !lead.hypothesisIds.includes(lane.id) ||
          !exact(item, ['id', 'kind', 'url', 'repository', 'title', 'mergedAt', 'observedAt', 'number']) ||
          item.kind !== 'github-pr' || !Number.isSafeInteger(item.number) || item.number <= 0 ||
          item.id !== `github-pr:${lane.repo}:${item.number}` || item.url !== `https://github.com/${lane.repo}/pull/${item.number}` ||
          !titleOf(item.title, lane) || !date(item.mergedAt) ||
          item.mergedAt.slice(0, 10) < input.run.searchSince || Date.parse(item.mergedAt) > Date.parse(input.run.observedAt) ||
          item.observedAt !== input.run.observedAt || evidenceIds.has(item.id)) fail();
      represented.add(lane.id);
      evidenceIds.add(item.id);
    }
    if (represented.size !== lead.hypothesisIds.length ||
        lead.hypothesisIds.some(id => !represented.has(id)) ||
        ROLE_SEARCH_LANES_V3.some(lane => lead.evidence.filter(item => item.repository === lane.repo).length > 2)) fail();
  }
  const firstStopped = input.lanes.findIndex(lane => lane?.error === STOPPED);
  if (input.run.requests !== (firstStopped < 0 ? 5 : firstStopped) ||
      (firstStopped >= 0 && (firstStopped === 0 ||
        !['HTTP 403', 'HTTP 429'].includes(input.lanes[firstStopped - 1]?.error) ||
        input.lanes.slice(firstStopped).some(lane => lane?.error !== STOPPED))) ||
      input.lanes.slice(0, -1).some((lane, index) =>
        ['HTTP 403', 'HTTP 429'].includes(lane?.error) && firstStopped !== index + 1)) fail();
  for (let index = 0; index < definitions.length; index++) {
    const lane = input.lanes[index], definition = definitions[index];
    const fields = ['id', 'label', 'repo', 'term', 'queryUrl', 'status', 'scanned', 'skipped', 'rejected', 'duplicates', 'capped', 'observations', 'leadIds', 'totalCount', 'incomplete'];
    const hasTrace = own(lane, 'screenedOut');
    if (!exact(lane, ['error', 'partial'].includes(lane?.status) ? [...fields, ...(hasTrace ? ['screenedOut'] : []), 'error'] : [...fields, ...(hasTrace ? ['screenedOut'] : [])]) ||
        lane.id !== definition.id || lane.label !== definition.label || lane.repo !== definition.repo || lane.term !== definition.term ||
        lane.queryUrl !== queryUrl(definition, input.run.searchSince) ||
        !['ok', 'empty', 'partial', 'error'].includes(lane.status) || !natural(lane.scanned) || lane.scanned > 20 ||
        !natural(lane.skipped) || !natural(lane.rejected) || !natural(lane.duplicates) || !natural(lane.capped) ||
        !natural(lane.observations) || lane.observations > 4 ||
        lane.scanned !== lane.skipped + lane.rejected + lane.duplicates + lane.capped + lane.observations ||
        !natural(lane.totalCount) || typeof lane.incomplete !== 'boolean' ||
        !Array.isArray(lane.leadIds) || lane.leadIds.length > 2 ||
        new Set(lane.leadIds).size !== lane.leadIds.length || lane.leadIds.some(id => !leadMap.has(id)) ||
        (['error', 'partial'].includes(lane.status) && (typeof lane.error !== 'string' || !lane.error || lane.error.length > 100)) ||
        (lane.status === 'ok' && (!lane.observations || lane.incomplete || lane.rejected)) ||
        (lane.status === 'empty' && (lane.observations || lane.incomplete || lane.rejected)) ||
        (lane.status === 'partial' && (!lane.observations || (!lane.incomplete && !lane.rejected))) ||
        (lane.status === 'error' && lane.observations)) fail();
    if (hasTrace) {
      if (!Array.isArray(lane.screenedOut) || lane.screenedOut.length > lane.skipped ||
          new Set(lane.screenedOut.map(item => item?.id)).size !== lane.screenedOut.length) fail();
      for (const item of lane.screenedOut) {
        if (!exact(item, ['id', 'url', 'title', 'mergedAt', 'reason']) ||
            !/^github-pr:[^:]+:[1-9]\d*$/.test(item.id) ||
            item.id !== `github-pr:${lane.repo}:${Number(item.id.split(':').at(-1))}` ||
            item.url !== `https://github.com/${lane.repo}/pull/${item.id.split(':').at(-1)}` ||
            typeof item.title !== 'string' || !item.title || item.title.length > 160 ||
            /[\x00-\x1f\x7f]/.test(item.title) || !date(item.mergedAt) ||
            !['outside-merge-window', 'technical-prefix-required', 'title-context-rule'].includes(item.reason) ||
            item.reason !== (item.mergedAt.slice(0, 10) < input.run.searchSince || Date.parse(item.mergedAt) > Date.parse(input.run.observedAt)
              ? 'outside-merge-window' : item.title.toLowerCase().includes(lane.term) && ALIGNMENT[lane.id].test(item.title)
                ? 'technical-prefix-required' : 'title-context-rule') ||
            (item.reason !== 'outside-merge-window' && titleOf(item.title, lane)) || evidenceIds.has(item.id)) fail();
      }
    }
    const actualIds = [...leadMap.values()].filter(lead => lead.evidence.some(item => item.repository === lane.repo)).map(lead => lead.id);
    const actualSources = [...leadMap.values()].reduce((sum, lead) =>
      sum + lead.evidence.filter(item => item.repository === lane.repo).length, 0);
    if (actualIds.length !== lane.leadIds.length || actualIds.some(id => !lane.leadIds.includes(id)) ||
        actualSources !== lane.observations || lane.observations < lane.leadIds.length) fail();
  }
  const errors = input.lanes.filter(lane => lane.status === 'error').length;
  const status = errors === 5 ? 'failed' : input.lanes.some(lane => ['error', 'partial'].includes(lane.status)) ? 'partial' : 'complete';
  if (input.run.status !== status) fail();
  return input;
}
