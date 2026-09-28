import { validateResearchReport } from './research.js?v=0.7.0';
import { readPublicGitHubJson } from './github-public-read.js?v=0.7.0';

const MAX_DETAIL_BYTES = 1024 * 1024;
const MAX_FILES = 8;
const MAX_PATCH_LINES = 24;
const MAX_PATCH_CHARS = 2400;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const CREDENTIAL = /\b(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{8,}\b/g;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const natural = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000000;
const testPath = path => /(?:^|\/)(?:__tests__|tests?|specs?)(?:\/|$)|[.-](?:test|spec)\.[^/]+$/i.test(path);

function publicPatch(patch) {
  if (typeof patch !== 'string') return null; // binary files and very large patches may omit it.
  const lines = patch.split(/\r?\n/);
  const excerpt = lines.slice(0, MAX_PATCH_LINES).join('\n').slice(0, MAX_PATCH_CHARS)
    .replace(EMAIL, '[email hidden]').replace(CREDENTIAL, '[credential-like text hidden]');
  return { excerpt, truncated: lines.length > MAX_PATCH_LINES || patch.length > MAX_PATCH_CHARS };
}

export async function inspectResearchSource(input, evidenceId, fetcher = globalThis.fetch) {
  const report = validateResearchReport(input);
  const lead = report.leads.find(candidate => candidate.evidence.some(item => item.id === evidenceId));
  if (!lead) throw new TypeError('unknown research source');
  const item = lead.evidence.find(source => source.id === evidenceId);
  const sha = item.id.slice(item.id.lastIndexOf(':') + 1);
  const apiUrl = `https://api.github.com/repos/${item.repository}/commits/${sha}`;
  const detail = await readPublicGitHubJson(fetcher, apiUrl, MAX_DETAIL_BYTES);
  if (!record(detail) || detail.sha !== sha || detail.html_url !== item.url ||
      !record(detail.stats) || !natural(detail.stats.additions) || !natural(detail.stats.deletions) ||
      !Array.isArray(detail.files) || detail.files.length > 300) throw new TypeError('invalid commit detail');

  const files = detail.files.slice(0, MAX_FILES).map(file => {
    if (!record(file) || typeof file.filename !== 'string' || file.filename.length < 1 ||
        file.filename.length > 300 || /[\x00-\x1f\x7f]/.test(file.filename) ||
        !natural(file.additions) || !natural(file.deletions)) throw new TypeError('invalid commit detail');
    return { filename: file.filename, status: ['added', 'modified', 'removed', 'renamed', 'copied', 'changed'].includes(file.status) ? file.status : 'changed',
      additions: file.additions, deletions: file.deletions, testPath: testPath(file.filename), patch: publicPatch(file.patch) };
  });
  const apiAuthor = detail.author;
  const association = !record(apiAuthor) || !Number.isSafeInteger(apiAuthor.id) ? 'unlinked' :
    apiAuthor.id === Number(lead.id.slice(7)) ? 'same-github-id' : 'different-github-id';
  return { evidenceId: item.id, sourceUrl: item.url, inspectedAt: new Date().toISOString(), association,
    fileCount: detail.files.length, shownCount: files.length, possiblyIncomplete: detail.files.length >= 300,
    additions: detail.stats.additions, deletions: detail.stats.deletions, files };
}
