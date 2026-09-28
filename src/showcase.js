import { validateResearchReport } from './research.js?v=0.10.0';

// Pins the release-bundled public API snapshot, not the truth of GitHub or a hiring claim.
export const SHOWCASE_SHA256 = '44b427089ca164acc5419326f2b5586a23b9a0c081b682f8b69dceadd129e660';
const SHOWCASE_URL = new URL('../data/poolday-public-pass-2026-09-28.json', import.meta.url);
const MAX_BYTES = 128 * 1024;
const EXPECTED = new Set([
  'github-pr:remotion-dev/remotion:11763',
  'github-pr:remotion-dev/remotion:11703'
]);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const natural = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000000;
const testPath = path => /(?:^|\/)(?:__tests__|tests?|specs?)(?:\/|$)|[.-](?:test|spec)\.[^/]+$/i.test(path);
const fail = () => { throw new TypeError('invalid bundled showcase'); };

export function validateShowcase(input) {
  if (!exact(input, ['schema', 'source', 'report', 'inspections']) ||
      input.schema !== 'signal-desk-showcase.v1' || input.source !== 'public-github-api-snapshot') fail();
  const report = validateResearchReport(input.report);
  if (report.schema !== 'signal-desk-research.v3' || report.run.status !== 'complete' ||
      report.run.requests !== 5 || report.lanes[0].id !== 'video-timeline' ||
      !report.run.observedAt.startsWith('2026-09-28T') ||
      report.leads.length !== 8 || report.leads.reduce((sum, lead) => sum + lead.evidence.length, 0) !== 14 ||
      !Array.isArray(input.inspections) || input.inspections.length !== 2) fail();
  const details = new Map();
  for (const item of input.inspections) {
    if (!exact(item, ['kind', 'evidenceId', 'sourceUrl', 'inspectedAt', 'association', 'fileCount', 'shownCount',
      'possiblyIncomplete', 'additions', 'deletions', 'files']) ||
      item.kind !== 'github-pr' || !EXPECTED.has(item.evidenceId) || details.has(item.evidenceId) ||
      item.association !== 'same-github-id' || !Number.isFinite(Date.parse(item.inspectedAt)) ||
      Date.parse(item.inspectedAt) < Date.parse(report.run.observedAt) ||
      Date.parse(item.inspectedAt) - Date.parse(report.run.observedAt) > 3600000 ||
      !natural(item.fileCount) || item.fileCount < 1 || item.fileCount > 300 ||
      !natural(item.shownCount) || item.shownCount > 8 || item.shownCount > item.fileCount ||
      typeof item.possiblyIncomplete !== 'boolean' || !natural(item.additions) || !natural(item.deletions) ||
      !Array.isArray(item.files) || item.files.length !== item.shownCount) fail();
    const evidence = report.leads.flatMap(lead => lead.evidence).find(source => source.id === item.evidenceId);
    if (!evidence || item.sourceUrl !== evidence.url) fail();
    for (const file of item.files) {
      if (!exact(file, ['filename', 'status', 'additions', 'deletions', 'testPath']) ||
          typeof file.filename !== 'string' || !file.filename || file.filename.length > 300 ||
          /[\x00-\x1f\x7f]/.test(file.filename) ||
          !['added', 'modified', 'removed', 'renamed', 'copied', 'changed'].includes(file.status) ||
          !natural(file.additions) || !natural(file.deletions) || file.testPath !== testPath(file.filename)) fail();
    }
    details.set(item.evidenceId, { ...item, provenance: 'release-bundled-snapshot',
      files: item.files.map(file => ({ ...file, patch: null })) });
  }
  if (details.size !== EXPECTED.size) fail();
  return { report, details };
}

export async function loadShowcase(fetcher = globalThis.fetch, subtle = globalThis.crypto?.subtle) {
  if (typeof fetcher !== 'function' || !subtle?.digest) throw new TypeError('showcase reader unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(SHOWCASE_URL.href, { method: 'GET', credentials: 'omit',
      redirect: 'error', cache: 'no-store', signal: controller.signal });
    if (!response?.ok || response.redirected || (response.url && response.url !== SHOWCASE_URL.href)) fail();
    const length = response.headers?.get?.('content-length');
    if (length !== null && length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) fail();
    const reader = response.body?.getReader?.();
    if (!reader) fail();
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); fail(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const hash = [...new Uint8Array(await subtle.digest('SHA-256', bytes))]
      .map(value => value.toString(16).padStart(2, '0')).join('');
    if (hash !== SHOWCASE_SHA256) fail();
    let input;
    try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { fail(); }
    return validateShowcase(input);
  } finally { clearTimeout(timer); }
}
