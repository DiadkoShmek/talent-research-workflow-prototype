import { validateResearchReport } from './research.js?v=0.8.0';

const RATIONALE = {
  uk: {
    'agent-orchestration': 'Графи й виконання агентів дають видимі технічні сліди для перевірки оркестрації.',
    'ts-agent-tooling': 'TypeScript SDK дає видимі зміни в інструментах, викликах і потокових відповідях.',
    'programmable-editor': 'Редактор на React дає видимі зміни в інтерфейсі та програмованій взаємодії.',
    'agent-recovery': 'Продукт із довгими процесами агентів дає сліди відновлення, контексту й надійності.'
  },
  en: {
    'agent-orchestration': 'Agent graph and run code provides inspectable signals for orchestration work.',
    'ts-agent-tooling': 'A TypeScript SDK provides inspectable changes in tools, calls, and streaming.',
    'programmable-editor': 'A React editor provides inspectable changes in UI and programmable interaction.',
    'agent-recovery': 'A product with long-running agents offers traces of recovery, context and reliability.'
  }
};

const UNKNOWN = {
  uk: {
    '5+ professional years': 'Щонайменше п’ять років професійного досвіду',
    'Europe eligibility': 'Можливість працювати в Європі',
    'availability and interest': 'Доступність та інтерес до ролі',
    'full role fit': 'Відповідність усім вимогам ролі'
  },
  en: {
    '5+ professional years': 'Five or more professional years',
    'Europe eligibility': 'Europe work eligibility',
    'availability and interest': 'Availability and interest',
    'full role fit': 'Fit with all role requirements'
  }
};

// Source text is untrusted even when a structural report validator accepts it.
function markdownText(value) {
  return String(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|~\-])/g, '\\$1');
}

export function researchNote(input, lang = 'uk', imported = true) {
  if (lang !== 'uk' && lang !== 'en') throw new RangeError('invalid research note language');
  if (typeof imported !== 'boolean') throw new TypeError('imported must be boolean');
  const report = validateResearchReport(input);
  const uk = lang === 'uk';
  const lines = [
    `# Signal Desk — ${uk ? 'передача пошукового проходу' : 'research pass handoff'}`,
    '',
    `**${uk ? 'Роль' : 'Role'}:** [${markdownText(report.role.title)}](${report.role.url})`,
    `**${uk ? 'Походження звіту' : 'Report origin'}:** ${imported
      ? (uk ? 'відкрито з локального файлу; походження файлу не підтверджене' : 'opened from a local file; file origin is unverified')
      : (uk ? 'результат публічних GET-запитів цього проходу; авторство акаунтів не підтверджене' : 'result of this run’s public GET requests; account authorship is unverified')}`,
    `**${uk ? 'Дата збору' : 'Collected at'}:** ${report.run.observedAt}`,
    `**${uk ? 'Стан проходу' : 'Run status'}:** ${report.run.status}`,
    `**${uk ? 'Час збору' : 'Collection time'}:** ${report.run.elapsedMs} ms ${uk ? '(це не час до придатного кандидата)' : '(not time to a qualified candidate)'}`,
    `**${uk ? 'Обсяг' : 'Scope'}:** ${report.leads.length} ${uk ? 'унікальних GitHub ID' : 'distinct GitHub IDs'}, ${report.lanes.length} ${uk ? 'заздалегідь вибраних напрямів на GitHub; порядок API не ранжує людей' : 'seeded GitHub lanes; API order does not rank people'}`,
    '',
    `## ${uk ? 'Чому ці напрями' : 'Why these lanes'}`,
    ''
  ];
  for (const lane of report.lanes) {
    lines.push(`- **${markdownText(lane.repo)}** — ${RATIONALE[lang][lane.id]} ${uk ? 'Запит' : 'Query'}: [GET](${lane.queryUrl}). ${uk ? 'Стан' : 'Status'}: ${lane.status}; ${uk ? 'переглянуто' : 'scanned'} ${lane.scanned}, ${uk ? 'збережено змін' : 'retained changes'} ${lane.observations}${lane.duplicates !== undefined ? `, ${uk ? 'дублі' : 'duplicates'} ${lane.duplicates}, ${uk ? 'поза лімітом' : 'over cap'} ${lane.capped}` : ''}${lane.error ? `; ${uk ? 'помилка' : 'error'}: ${markdownText(lane.error)}` : ''}.`);
  }
  lines.push('', `## ${uk ? 'Публічні акаунти для подальшої перевірки' : 'Public accounts for further inspection'}`, '');
  if (!report.leads.length) lines.push(uk ? 'Цей обмежений прохід не дав акаунтів. Це не висновок про весь ринок.' : 'This bounded pass surfaced no accounts. It says nothing about the whole market.', '');
  for (const lead of report.leads) {
    lines.push(`### [@${markdownText(lead.handle)}](${lead.profileUrl})`,
      `${uk ? 'GitHub ID' : 'GitHub ID'}: ${lead.id}. ${uk ? 'Зв’язок між джерелами встановлено за ID, без зіставлення імен.' : 'Sources were linked by ID, without name matching.'}`, '');
    for (const evidence of lead.evidence) {
      lines.push(`- [${markdownText(evidence.repository)} · ${evidence.kind === 'github-pr' ? `PR #${evidence.number}` : evidence.id.slice(-40)}](${evidence.url}) — ${evidence.kind === 'github-pr' ? (uk ? 'злито' : 'merged') : (uk ? 'коміт' : 'commit')} ${evidence.mergedAt ?? evidence.committedAt}; ${uk ? 'побачено' : 'observed'} ${evidence.observedAt}.`,
        `  - **${uk ? 'Назва зміни, неперевірений текст джерела' : 'Change title, unverified source text'}:** “${markdownText(evidence.title)}”`);
    }
    lines.push('', `**${uk ? 'Ще невідомо' : 'Still unknown'}:** ${lead.unknowns.map(item => UNKNOWN[lang][item]).join('; ')}.`, '');
  }
  lines.push(`## ${uk ? 'Наступні три дії з колегою' : 'Three next steps with a colleague'}`, '',
    uk ? '1. Рекрутер звіряє вимоги Poolday та вже відомі команді джерела; позначає, які акаунти справді нові для поточного пошуку.' : '1. A recruiter checks the Poolday brief and sources the team already uses; mark which accounts are genuinely new to this search.',
    uk ? '2. Дослідник відкриває кожну зміну й перевіряє зміст внеску та особу; рекрутер окремо оцінює релевантність і прогалини. Рішення про контакт лишається людині.' : '2. A researcher opens each change and checks the contribution and identity; the recruiter separately assesses relevance and gaps. Contact remains a human decision.',
    uk ? '3. На одному погодженому пошуку порівняти з початковим процесом: час до першого прийнятого рекрутером профілю, хвилини перевірки на прийнятий профіль і частку нових корисних знахідок. Виграш наперед не припускається.' : '3. In one agreed search, compare with the baseline: time to first recruiter-accepted profile, review minutes per accepted profile, and the share of novel useful findings. No improvement is assumed.',
    '',
    uk ? 'Межа: це передача контексту дослідження, без підключення до Brain чи ATS, без оцінок людей, повідомлень або рішень про найм.' : 'Boundary: this transfers research context without Brain or ATS integration, person scores, messages, or hiring decisions.',
    '');
  return lines.join('\n');
}
