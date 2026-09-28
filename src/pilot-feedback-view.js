import { viewPilotFeedback } from './pilot-feedback.js?v=0.7.0';

const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const names = {
  'useful-next-step': ['Корисно для наступного кроку', 'Useful for the next step'],
  'not-useful': ['Не допомогло', 'Not useful'],
  unclear: ['Ще не ясно', 'Still unclear']
};
const assessorNames = {
  builder: ['Автор прототипу', 'Prototype builder'],
  'recruiter-reported': ['Зі слів рекрутера, особу не перевірено', 'Recruiter-reported, identity unverified'],
  unknown: ['Джерело оцінки невідоме', 'Assessment source unknown']
};

export function renderPilotFeedback(feedback, lang = 'uk', canStart = false) {
  const t = (uk, en) => lang === 'en' ? en : uk;
  const view = feedback ? viewPilotFeedback(feedback) : null;
  return `<section class="pilot-feedback" id="pilot-feedback" aria-labelledby="pilot-feedback-title">
    <p class="eyebrow">${t('ПОВЕРНЕННЯ РЕЗУЛЬТАТУ', 'RETURN THE OUTCOME')}</p>
    <h3 id="pilot-feedback-title">${t('Чи це допомогло людині?', 'Did this help a person?')}</h3>
    <p>${t('Після перевірки вибраних слідів запишіть оцінку й хвилини роботи для кожного акаунта. Це локально внесені твердження. Особу оцінювача система не перевіряє; без оцінки рекрутера й порівнянного звичного процесу виграш не доведений.', 'After checking the selected signals, record an outcome and review minutes for each account. These are locally entered assertions. Reviewer identity is not verified; without recruiter feedback and a comparable usual process, benefit is unproven.')}</p>
    <div class="research-actions"><button class="button quiet" id="start-pilot-feedback" ${canStart ? '' : 'disabled'}>${feedback ? t('Новий знімок вибору', 'New selection snapshot') : t('Почати оцінку вибраного', 'Start selected-signal evaluation')}</button><button class="button quiet" id="import-pilot-feedback">${t('Відкрити оцінку з файлу', 'Open saved evaluation')}</button><input type="file" class="file-input" id="pilot-feedback-file" accept=".json,application/json">${feedback ? `<button class="button" id="download-pilot-feedback">${t('Зберегти оцінку JSON', 'Save evaluation JSON')}</button>` : ''}</div>
    ${view ? `<p class="pilot-feedback-stats">${t('Оцінено', 'Assessed')}: <strong>${view.assessed}/${view.total}</strong> · ${t('Корисно для наступного кроку', 'Useful for next step')}: <strong>${view.useful}</strong> · ${t('Внесено хвилин перевірки', 'Entered review minutes')}: <strong>${view.minutes}</strong>${view.complete ? ` · ${t('Усі записи оцінено', 'All entries assessed')}` : ` · ${t('Неповна вибірка', 'Incomplete sample')}`}</p>
      <p class="research-footnote">${t('Цей знімок може відрізнятися від поточного вибору вище. Кожен запис можна змінити; файл зберігає історію локальних оцінок. Час збору GitHub до цих хвилин не входить.', 'This snapshot may differ from the current selection above. Each entry can be revised; the file keeps local assessment history. GitHub collection time is not included in these minutes.')}</p>
      <div class="pilot-feedback-grid">${view.source.leads.map(lead => {
        const current = view.latest.get(lead.id);
        return `<article class="pilot-feedback-card" data-pilot-lead="${e(lead.id)}"><h4><a href="${e(lead.profileUrl)}" target="_blank" rel="noreferrer">@${e(lead.handle)} ↗</a></h4><p>${current ? `${t('Остання оцінка', 'Latest assessment')}: ${e(names[current.verdict][lang === 'en' ? 1 : 0])} · ${current.minutes} ${t('хв', 'min')}` : t('Оцінки ще немає', 'No assessment yet')}</p>${current ? `<p><strong>${e(assessorNames[current.assessorContext][lang === 'en' ? 1 : 0])}.</strong> ${e(current.reason)}</p>` : ''}<label>${t('Висновок для наступного дослідження', 'Outcome for further research')}<select name="pilot-verdict"><option value="useful-next-step">${t('Корисно для наступного кроку', 'Useful for the next step')}</option><option value="not-useful">${t('Не допомогло', 'Not useful')}</option><option value="unclear">${t('Ще не ясно', 'Still unclear')}</option></select></label><label>${t('Хвилини перевірки вручну', 'Manual review minutes')}<input name="pilot-minutes" type="number" min="1" max="240" step="1" inputmode="numeric" required></label><label>${t('Хто дав оцінку', 'Assessment source')}<select name="pilot-assessor"><option value="builder">${t('Автор прототипу', 'Prototype builder')}</option><option value="recruiter-reported">${t('Зі слів рекрутера, без підтвердження особи', 'Recruiter-reported, identity unverified')}</option><option value="unknown">${t('Невідомо', 'Unknown')}</option></select></label><label>${t('Причина висновку', 'Reason for outcome')}<input name="pilot-reason" maxlength="400" autocomplete="off" placeholder="${t('Що рекрутер зможе використати або чому відхилив?', 'What can be used, or why was it rejected?')}"></label><button class="button quiet" data-pilot-record="${e(lead.id)}" ${view.exhausted ? 'disabled' : ''}>${t('Записати оцінку', 'Record assessment')}</button></article>`;
      }).join('')}</div><p class="research-footnote">${t('Файл містить вибрані публічні профілі, посилання на зміни та ваші причини. Перевірте його перед передачею. Це не рішення про найм і не запис у TeamTailor.', 'The file contains selected public profiles, change links and your reasons. Inspect it before sharing. It is not a hiring decision or a TeamTailor record.')}</p>` : `<p class="research-footnote">${t('Спершу позначте корисний слід і передайте його на наступне дослідження. Поки ніхто не оцінив вибір, жодного результату тут немає.', 'First select a useful signal for further research. Until someone evaluates the selection, there is no outcome here.')}</p>`}
  </section>`;
}
