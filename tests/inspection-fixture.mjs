import { createInspectionReceipt } from '../src/research-review.js';

export function fixtureInspection(report, evidenceId, filename = 'src/verified-source.ts') {
  const item = report.leads.flatMap(lead => lead.evidence).find(source => source.id === evidenceId);
  if (!item) throw new TypeError('unknown fixture evidence');
  return createInspectionReceipt(report, evidenceId, {
    kind: item.kind, evidenceId, sourceUrl: item.url,
    inspectedAt: new Date(Date.parse(report.run.observedAt) + 1000).toISOString(),
    association: 'same-github-id', fileCount: 1, shownCount: 1, possiblyIncomplete: false,
    files: [{ filename }]
  });
}
