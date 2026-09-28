// Read-only, explicit public GitHub pass. Account activity is a lead to inspect, not a fit decision.
export const RESEARCH_ROLE = Object.freeze({
  title: 'Senior Agentic Software Engineer — Poolday',
  url: 'https://aplayers.na.teamtailor.com/jobs/536324-senior-agentic-software-engineer-poolday'
});
export const RESEARCH_LANES = Object.freeze([
  Object.freeze({ id: 'agent-orchestration', label: 'Agent orchestration', repo: 'langchain-ai/langgraphjs' }),
  Object.freeze({ id: 'ts-agent-tooling', label: 'TypeScript tools and agents', repo: 'vercel/ai' }),
  Object.freeze({ id: 'programmable-editor', label: 'Programmable React editor', repo: 'tldraw/tldraw' })
]);
const UNKNOWN = Object.freeze(['5+ professional years', 'Europe eligibility', 'availability and interest', 'full role fit']);
const LIMIT = 2 * 1024 * 1024;
const SHA = /^[0-9a-fA-F]{40}(?:[0-9a-fA-F]{24})?$/;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const ISO_DATE = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d+))?(?:Z|([+-])(\d\d):(\d\d))$/;
const selectionNote = 'Seeded-repository discovery in three fixed public repositories; API order is not a ranking or a whole-web search.';
const queryUrl = repo => `https://api.github.com/repos/${repo}/commits?per_page=20`;
function isDate(value) {
  if (typeof value !== 'string') return false;
  const parts = ISO_DATE.exec(value);
  if (!parts) return false;
  const [, year, month, day, hour, minute, second, , , offsetHour, offsetMinute] = parts;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1] &&
    Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59 &&
    (offsetHour === undefined || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59)) &&
    Number.isFinite(Date.parse(value));
}
function instantMicros(value) {
  const parts = ISO_DATE.exec(value);
  const base = value.replace(/\.\d+(?=Z|[+-]\d\d:\d\d$)/, '');
  return BigInt(Date.parse(base)) * 1000n + BigInt((parts[7] ?? '').padEnd(6, '0').slice(0, 6) || '0');
}
const notFuture = (value, observedAt) => instantMicros(value) <= instantMicros(observedAt);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const exactKeys = (value, names) => isRecord(value) &&
  Object.keys(value).length === names.length && names.every(name => own(value, name));

function titleExcerpt(message) {
  if (typeof message !== 'string') return null;
  const line = message.split(/\r\n|\n|\r/)[0].trim();
  if (!line || /[\x00-\x1f\x7f]/.test(line) || EMAIL.test(line)) return null;
  let excerpt = line.slice(0, 160);
  const words = [...excerpt.matchAll(/\S+/g)];
  if (words.length > 25) excerpt = excerpt.slice(0, words[24].index + words[24][0].length);
  return excerpt;
}

function rowDisposition(row, repo, observedAt) {
  if (!isRecord(row)) return { kind: 'rejected' };
  const author = row.author;
  if ((own(row, 'author') && author === null) || (isRecord(author) && ['Bot', 'Organization'].includes(author.type))) return { kind: 'skipped' };
  if (!isRecord(author) || author.type !== 'User' || !Number.isSafeInteger(author.id) || author.id <= 0 ||
      typeof author.login !== 'string' || !LOGIN.test(author.login) || author.login.toLowerCase().endsWith('[bot]') ||
      typeof row.sha !== 'string' || !SHA.test(row.sha) || !isRecord(row.commit) || !isRecord(row.commit.committer)) {
    return { kind: 'rejected' };
  }
  const title = titleExcerpt(row.commit.message);
  const committedAt = row.commit.committer.date;
  const sha = row.sha.toLowerCase();
  const url = `https://github.com/${repo}/commit/${sha}`;
  const profileUrl = `https://github.com/${author.login}`;
  if (!title || !isDate(committedAt) || !notFuture(committedAt, observedAt) ||
      (own(row, 'html_url') && row.html_url !== url) ||
      (own(author, 'html_url') && author.html_url !== profileUrl)) return { kind: 'rejected' };
  return { kind: 'valid', userId: author.id, login: author.login, evidence: {
    id: `github-commit:${repo}:${sha}`, kind: 'github-commit', url, repository: repo,
    title, committedAt, observedAt
  } };
}

function safeError(error) {
  if (error?.publicStatus && Number.isInteger(error.publicStatus)) return `HTTP ${error.publicStatus}`;
  if (error?.message === 'redirect refused' || error?.message === 'response exceeds size limit' ||
      error?.message === 'invalid JSON response' || error?.message === 'response is not a list') return error.message;
  return 'request failed';
}

async function getLane(fetcher, lane) {
  const url = queryUrl(lane.repo);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(url, {
      method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    });
    if (!response || response.redirected || (response.url && response.url !== url)) throw new Error('redirect refused');
    if (!response.ok) {
      const error = new Error('HTTP failure');
      error.publicStatus = response.status;
      throw error;
    }
    const header = response.headers?.get?.('content-length');
    if (header != null && (!/^\d+$/.test(header) || Number(header) > LIMIT)) throw new Error('response exceeds size limit');
    let bytes;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > LIMIT) {
          await reader.cancel();
          throw new Error('response exceeds size limit');
        }
        chunks.push(value);
      }
      bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    } else {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > LIMIT) throw new Error('response exceeds size limit');
      bytes = new Uint8Array(buffer);
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new Error('invalid JSON response'); }
  } finally { clearTimeout(timer); }
}

export async function collectResearch(fetcher = globalThis.fetch) {
  if (typeof fetcher !== 'function') throw new TypeError('fetcher must be a function');
  const started = globalThis.performance?.now?.() ?? Date.now();
  const observedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const responses = await Promise.all(RESEARCH_LANES.map(async lane => {
    try { return await getLane(fetcher, lane); }
    catch (error) { return { fetchError: safeError(error) }; }
  }));
  const leadsById = new Map();
  const evidenceOwner = new Map();
  const lanes = RESEARCH_LANES.map((definition, index) => {
    const lane = { ...definition, queryUrl: queryUrl(definition.repo), status: 'empty',
      scanned: 0, skipped: 0, rejected: 0, observations: 0, leadIds: [] };
    const rows = responses[index];
    if (isRecord(rows) && own(rows, 'fetchError')) {
      lane.status = 'error'; lane.error = rows.fetchError; return lane;
    }
    if (!Array.isArray(rows)) {
      lane.status = 'error'; lane.error = 'response is not a list'; return lane;
    }
    const laneCounts = new Map();
    for (const row of rows.slice(0, 20)) {
      lane.scanned++;
      const result = rowDisposition(row, definition.repo, observedAt);
      if (result.kind === 'skipped') { lane.skipped++; continue; }
      if (result.kind === 'rejected') { lane.rejected++; continue; }
      const id = `github:${result.userId}`;
      if (evidenceOwner.has(result.evidence.id) && evidenceOwner.get(result.evidence.id) !== id) {
        lane.rejected++; continue;
      }
      if ((!laneCounts.has(id) && laneCounts.size >= 2) || (laneCounts.get(id) ?? 0) >= 2) continue;
      let lead = leadsById.get(id);
      if (!lead) {
        lead = { id, handle: result.login, profileUrl: `https://github.com/${result.login}`,
          hypothesisIds: [], evidence: [], unknowns: [...UNKNOWN] };
        leadsById.set(id, lead);
      }
      if (lead.evidence.some(item => item.id === result.evidence.id)) continue;
      if (!lead.hypothesisIds.includes(definition.id)) lead.hypothesisIds.push(definition.id);
      lead.evidence.push(result.evidence);
      evidenceOwner.set(result.evidence.id, id);
      laneCounts.set(id, (laneCounts.get(id) ?? 0) + 1);
    }
    lane.observations = [...laneCounts.values()].reduce((sum, count) => sum + count, 0);
    lane.leadIds = [...laneCounts.keys()];
    if (lane.observations) lane.status = 'ok';
    if (lane.rejected) { lane.status = lane.observations ? 'partial' : 'error'; lane.error = `${lane.rejected} malformed rows rejected`; }
    return lane;
  });
  const errors = lanes.filter(lane => lane.status === 'error').length;
  const report = { schema: 'signal-desk-research.v1', role: { ...RESEARCH_ROLE }, run: {
    observedAt, elapsedMs: Math.round((globalThis.performance?.now?.() ?? Date.now()) - started),
    requests: 3, mode: 'public-api-read-only', selectionNote,
    status: errors === 3 ? 'failed' : lanes.some(lane => ['error', 'partial'].includes(lane.status)) ? 'partial' : 'complete'
  }, lanes, leads: [...leadsById.values()] };
  return validateResearchReport(report);
}

export function validateResearchReport(input) {
  const fail = () => { throw new TypeError('invalid research report'); };
  if (!exactKeys(input, ['schema', 'role', 'run', 'lanes', 'leads']) || input.schema !== 'signal-desk-research.v1' ||
      !exactKeys(input.role, ['title', 'url']) ||
      input.role.title !== RESEARCH_ROLE.title || input.role.url !== RESEARCH_ROLE.url ||
      !exactKeys(input.run, ['observedAt', 'elapsedMs', 'requests', 'mode', 'selectionNote', 'status']) ||
      !isDate(input.run.observedAt) || !integer(input.run.elapsedMs) ||
      input.run.requests !== 3 || input.run.mode !== 'public-api-read-only' ||
      typeof input.run.selectionNote !== 'string' || input.run.selectionNote !== selectionNote ||
      !Array.isArray(input.lanes) || input.lanes.length !== 3 || !Array.isArray(input.leads) || input.leads.length > 6) fail();
  const leadMap = new Map();
  for (const lead of input.leads) {
    if (!exactKeys(lead, ['id', 'handle', 'profileUrl', 'hypothesisIds', 'evidence', 'unknowns']) ||
        typeof lead.id !== 'string' || !/^github:[1-9]\d*$/.test(lead.id) ||
        typeof lead.handle !== 'string' || !LOGIN.test(lead.handle) || lead.profileUrl !== `https://github.com/${lead.handle}` ||
        leadMap.has(lead.id) || !Array.isArray(lead.hypothesisIds) || !Array.isArray(lead.evidence) ||
        lead.evidence.length < 1 || lead.evidence.length > 6 || !Array.isArray(lead.unknowns) ||
        JSON.stringify(lead.unknowns) !== JSON.stringify(UNKNOWN)) fail();
    leadMap.set(lead.id, lead);
    if (new Set(lead.hypothesisIds).size !== lead.hypothesisIds.length ||
        lead.hypothesisIds.some(id => !RESEARCH_LANES.some(lane => lane.id === id))) fail();
    const evidenceIds = new Set();
    for (const item of lead.evidence) {
      if (!exactKeys(item, ['id', 'kind', 'url', 'repository', 'title', 'committedAt', 'observedAt']) ||
          typeof item.id !== 'string' || item.kind !== 'github-commit' ||
          !RESEARCH_LANES.some(lane => lane.repo === item.repository) ||
          typeof item.title !== 'string' || !item.title || item.title.length > 160 ||
          item.title.trim().split(/\s+/).length > 25 || EMAIL.test(item.title) ||
          !isDate(item.committedAt) || !notFuture(item.committedAt, input.run.observedAt) ||
          item.observedAt !== input.run.observedAt) fail();
      const match = /^github-commit:([^:]+):([0-9a-f]{40}(?:[0-9a-f]{24})?)$/.exec(item.id);
      if (!match || match[1] !== item.repository || item.url !== `https://github.com/${item.repository}/commit/${match[2]}` ||
          evidenceIds.has(item.id)) fail();
      evidenceIds.add(item.id);
    }
  }
  const globalEvidenceIds = new Set();
  for (const lead of leadMap.values()) for (const item of lead.evidence) {
    if (globalEvidenceIds.has(item.id)) fail();
    globalEvidenceIds.add(item.id);
  }
  for (let index = 0; index < 3; index++) {
    const lane = input.lanes[index];
    const expected = RESEARCH_LANES[index];
    const laneKeys = ['id', 'label', 'repo', 'queryUrl', 'status', 'scanned', 'skipped', 'rejected', 'observations', 'leadIds'];
    if (!exactKeys(lane, ['error', 'partial'].includes(lane.status) ? [...laneKeys, 'error'] : laneKeys) ||
        lane.id !== expected.id || lane.label !== expected.label || lane.repo !== expected.repo ||
        lane.queryUrl !== queryUrl(expected.repo) || !['ok', 'empty', 'partial', 'error'].includes(lane.status) ||
        !integer(lane.scanned) || lane.scanned > 20 || !integer(lane.skipped) || !integer(lane.rejected) ||
        lane.skipped + lane.rejected > lane.scanned || !integer(lane.observations) || lane.observations > 4 ||
        !Array.isArray(lane.leadIds) || lane.leadIds.length > 2 || new Set(lane.leadIds).size !== lane.leadIds.length ||
        lane.leadIds.some(id => !leadMap.has(id)) ||
        (['error', 'partial'].includes(lane.status) && (typeof lane.error !== 'string' || !lane.error || lane.error.length > 100)) ||
        (!['error', 'partial'].includes(lane.status) && own(lane, 'error')) ||
        (lane.status === 'empty' && (lane.observations !== 0 || lane.rejected !== 0)) ||
        (lane.status === 'ok' && (lane.observations === 0 || lane.rejected !== 0)) ||
        (lane.status === 'partial' && (lane.observations === 0 || lane.rejected === 0)) ||
        (lane.status === 'error' && lane.observations !== 0) ||
        (lane.rejected > 0 && !['error', 'partial'].includes(lane.status))) fail();
    let actual = 0;
    for (const [id, lead] of leadMap) {
      const count = lead.evidence.filter(item => item.repository === lane.repo).length;
      if (count > 2 || (count > 0) !== lane.leadIds.includes(id) ||
          (count > 0) !== lead.hypothesisIds.includes(lane.id)) fail();
      actual += count;
    }
    if (actual !== lane.observations || lane.observations > lane.scanned - lane.skipped - lane.rejected) fail();
  }
  const errors = input.lanes.filter(lane => lane.status === 'error').length;
  const status = errors === 3 ? 'failed' : input.lanes.some(lane => ['error', 'partial'].includes(lane.status)) ? 'partial' : 'complete';
  if (input.run.status !== status) fail();
  return input;
}
