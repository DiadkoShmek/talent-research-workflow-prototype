// Deterministic, script-free reading copy of the pinned public showcase.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { SHOWCASE_SHA256, validateShowcase } from '../src/showcase.js?v=0.10.0';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'data/poolday-public-pass-2026-09-28.json');
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const words = {
  uk: {
    title: 'Офлайн-картка публічного проходу', eyebrow: 'SIGNAL DESK / АРХІВНИЙ ПУБЛІЧНИЙ ПРОХІД',
    lead: 'Одна роль. П’ять напрямів. Два точні PR одного GitHub ID.',
    intro: 'Ця картка зібрана з фактичного публічного API-проходу 28 вересня 2026 року. Вона читається без мережі після збереження файла; посилання на джерела потребують мережі.',
    accounts: 'GitHub ID', lanes: 'напрямів із відповіддю', changes: 'збережених PR',
    source: 'Публічна роль', provenance: 'Походження й межа',
    provenanceText: 'SHA-256 звіряє байти релізного JSON із кодом. Він не підтверджує правдивість GitHub, особистий внесок, придатність людини чи поточний стан джерел. Жодних оцінок рекрутера у знімку немає.',
    example: 'Один акаунт, два сліди про відеотаймлайн',
    exampleText: 'Обидва PR пов’язані з одним числовим GitHub ID у записаній відповіді API. Це два джерела для людської перевірки, не двоє людей і не підтверджена кваліфікація.',
    files: 'Змінені файли в архівній відповіді', additions: 'додано', deletions: 'вилучено',
    tests: 'шлях схожий на тест; виконання тестів невідоме',
    omitted: 'Текст diff не входить до цієї картки. Зведення може показувати не всі файли; відкрийте точний PR онлайн.',
    method: 'П’ять пошукових напрямів', scanned: 'переглянуто', skipped: 'пропущено', kept: 'збережено PR',
    oldTrace: 'Цей архів зроблено до збереження окремих відсіяних PR; його пропуски відомі лише як лічильники.',
    questions: 'Що людина має перевірити далі', questionItems: [
      'Який саме внесок належить цьому акаунту в кожному PR?',
      'Чи відповідає досвід повній ролі, а не лише одному технічному сліду?',
      'Чи є цей слід новим і корисним для рекрутера на реальному пошуку?'
    ],
    boundary: 'Тут немає рішення про контакт, співбесіду або найм. Час API-збору не є часом до придатного кандидата.',
    offline: 'Офлайн-копія для читання. Живий пошук і людські рішення залишаються в інтерактивному Signal Desk.',
    observed: 'Зафіксовано', integrity: 'SHA-256 архіву'
  },
  en: {
    title: 'Offline public-pass brief', eyebrow: 'SIGNAL DESK / ARCHIVED PUBLIC PASS',
    lead: 'One role. Five lanes. Two exact PRs linked to one GitHub ID.',
    intro: 'This brief was built from an actual public API pass on 28 September 2026. It reads without a network after saving the file; source links require a network.',
    accounts: 'GitHub IDs', lanes: 'responsive lanes', changes: 'retained PRs',
    source: 'Public role', provenance: 'Provenance and limits',
    provenanceText: 'SHA-256 matches the release JSON bytes to the code. It does not establish GitHub truth, personal authorship, role fit or current source state. The snapshot contains no recruiter assessments.',
    example: 'One account, two video-timeline traces',
    exampleText: 'The recorded API associates both PRs with one numeric GitHub ID. These are two sources for human inspection, not two people or proof of qualification.',
    files: 'Changed files in archived API data', additions: 'added', deletions: 'deleted',
    tests: 'test-like file path; test execution unknown',
    omitted: 'Diff text is excluded. This summary may omit files; open the exact PR online.',
    method: 'Five search lanes', scanned: 'scanned', skipped: 'skipped', kept: 'retained PRs',
    oldTrace: 'This archive predates the individual screened-out PR trace; skipped rows are available only as counts.',
    questions: 'What a person should check next', questionItems: [
      'What was this account’s individual contribution to each PR?',
      'Does experience fit the full role rather than only one technical trace?',
      'Is this lead new and useful to a recruiter on a real search?'
    ],
    boundary: 'There is no contact, interview or hiring decision here. API collection time is not time to a qualified candidate.',
    offline: 'Offline reading copy. Live search and human decisions remain in interactive Signal Desk.',
    observed: 'Observed', integrity: 'Archive SHA-256'
  }
};

export function renderMeetingBrief(envelope, lang = 'uk') {
  if (!Object.hasOwn(words, lang)) throw new TypeError('unsupported brief language');
  const { report, details } = validateShowcase(envelope);
  const w = words[lang];
  const e = escapeHTML;
  const inspected = [...details.values()];
  const oneId = report.leads.find(lead => inspected.every(item => lead.evidence.some(source => source.id === item.evidenceId)));
  if (!oneId) throw new TypeError('showcase source grouping changed');
  const sourceById = new Map(oneId.evidence.map(item => [item.id, item]));
  const evidence = inspected.map(item => {
    const source = sourceById.get(item.evidenceId);
    return `<article class="source"><p class="kicker">${e(source.repository)} / PR #${source.number}</p><h3><a href="${e(source.url)}" target="_blank" rel="noreferrer">${e(source.title)} ↗</a></h3><p>${e(source.mergedAt)} · ${item.fileCount} ${e(w.files.toLowerCase())} · +${item.additions} ${e(w.additions)} / −${item.deletions} ${e(w.deletions)}</p><details><summary>${e(w.files)} (${item.shownCount}/${item.fileCount})</summary><ul>${item.files.map(file => `<li><code>${e(file.filename)}</code> · +${file.additions}/−${file.deletions}${file.testPath ? ` · ${e(w.tests)}` : ''}</li>`).join('')}</ul></details><p class="muted">${e(w.omitted)}</p></article>`;
  }).join('');
  const lanes = report.lanes.map(lane => `<tr><th scope="row">${e(lane.label)}<small>${e(lane.repo)}</small></th><td>${lane.scanned}</td><td>${lane.skipped}</td><td>${lane.observations}</td></tr>`).join('');
  const total = report.leads.reduce((sum, lead) => sum + lead.evidence.length, 0);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><title>Signal Desk — ${e(w.title)}</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f3f2eb;color:#1b3029;font:15px/1.55 system-ui,-apple-system,sans-serif}main{max-width:1080px;margin:0 auto;padding:24px 24px 60px}.mast{border-top:7px solid #1b3029;padding:35px 0 22px}.kicker{font:11px/1.4 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#3c694e}h1{font-size:clamp(32px,5vw,56px);line-height:1.05;max-width:800px;margin:12px 0}h2{font-size:24px;line-height:1.2;margin:0 0 15px}h3{font-size:18px;line-height:1.3;margin:8px 0}p{margin:8px 0}a{color:#1d5d3b;overflow-wrap:anywhere}code{overflow-wrap:anywhere}a:focus-visible,summary:focus-visible{outline:3px solid #b36b24;outline-offset:3px}.sub{max-width:800px;color:#4b5b51}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0 36px}.stats div{background:#e5ece1;border:1px solid #cbd9c8;border-radius:9px;padding:17px}.stats strong{display:block;font-size:29px;line-height:1.2}.stats span,.muted,small{color:#596b5e;font-size:12px}.panel{background:#fffefa;border:1px solid #d4dbcf;border-radius:10px;padding:23px;margin:16px 0}.proof{border-left:4px solid #2a6145;background:#e8efe4}.source{padding:19px;border:1px solid #c7d4c3;border-radius:8px;margin:12px 0}.source .kicker{margin:0}.source details{margin:11px 0}.source summary{cursor:pointer;font-weight:700}.source li{margin:7px 0;overflow-wrap:anywhere}.source code{font-size:12px;white-space:normal}.tablewrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:480px}th,td{text-align:left;padding:10px;border-bottom:1px solid #d4dbcf}th{font-weight:650}th small{display:block;font-weight:400}.questions li{margin:10px 0}.foot{border-top:1px solid #cbd9c8;margin-top:28px;padding-top:16px;color:#596b5e;font-size:12px;overflow-wrap:anywhere}@media(max-width:600px){main{padding:14px 14px 40px}.mast{padding-top:22px}.stats{gap:6px;margin-bottom:18px}.stats div{padding:11px}.stats strong{font-size:22px}.stats span{font-size:10px}.panel{padding:16px}.source{padding:14px}h2{font-size:21px}}@media print{body{background:white}main{max-width:none}.panel,.source{break-inside:avoid}a{text-decoration:underline}details{display:block}details>*{display:block}}
</style></head><body><main><header class="mast"><p class="kicker">${e(w.eyebrow)}</p><h1>${e(w.title)}</h1><p class="sub">${e(w.lead)} ${e(w.intro)}</p></header><div class="stats"><div><strong>${report.leads.length}</strong><span>${e(w.accounts)}</span></div><div><strong>${report.lanes.length}/${report.lanes.length}</strong><span>${e(w.lanes)}</span></div><div><strong>${total}</strong><span>${e(w.changes)}</span></div></div><section class="panel proof"><h2>${e(w.provenance)}</h2><p>${e(w.observed)}: <time>${e(report.run.observedAt)}</time> · ${e(w.integrity)}: <code>${SHOWCASE_SHA256}</code></p><p>${e(w.provenanceText)}</p><p>${e(w.source)}: <a href="${e(report.role.url)}" target="_blank" rel="noreferrer">${e(report.role.title)} ↗</a></p></section><section class="panel"><h2>${e(w.example)}</h2><p>${e(w.exampleText)}</p>${evidence}</section><section class="panel"><h2>${e(w.method)}</h2><div class="tablewrap"><table><thead><tr><th></th><th>${e(w.scanned)}</th><th>${e(w.skipped)}</th><th>${e(w.kept)}</th></tr></thead><tbody>${lanes}</tbody></table></div><p class="muted">${e(w.oldTrace)}</p></section><section class="panel questions"><h2>${e(w.questions)}</h2><ol>${w.questionItems.map(item => `<li>${e(item)}</li>`).join('')}</ol><p><strong>${e(w.boundary)}</strong></p></section><footer class="foot">${e(w.offline)} · ${e(w.integrity)}: ${SHOWCASE_SHA256}</footer></main></body></html>\n`;
}

export function buildMeetingBriefs() {
  const bytes = readFileSync(source);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== SHOWCASE_SHA256) throw new TypeError('bundled archive hash mismatch');
  const input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  for (const lang of ['uk', 'en']) {
    const output = resolve(root, `docs/meeting-brief.${lang}.html`);
    writeFileSync(output, renderMeetingBrief(input, lang), 'utf8');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildMeetingBriefs();
