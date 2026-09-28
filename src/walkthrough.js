import { WALKTHROUGH_STEPS, walkthroughAt } from './walkthrough-state.js?v=0.6.1';
import { renderHandoff } from './handoff.js?v=0.6.1';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy = {
  uk: [
    ['Спочатку — зрозуміла задача', 'Потрібен операційний партнер: координувати роботу, співпрацювати з командою й упроваджувати автоматизацію. Простежимо одне рішення про вигадану Олену.', 'Для кожної вимоги має бути джерело, яке справді її підтверджує.', 'Перевірити перше джерело'],
    ['Вебінар ще не підтверджує виконану роботу', 'Сценарій прийняв два інші твердження, але відхилив цей доказ автоматизації. Цитата є в документі; опису власного впровадження в ньому немає.', 'Це не висновок, що людина не вміє. Нам поки бракує достатнього доказу.', 'Відкрити інше джерело'],
    ['Інше джерело описує виконану дію', 'У заготовленому прикладі є ще один документ. Сценарій приймає прямий опис автоматизації та підтверджує спільний умовний ідентифікатор записів. Передачу ще не схвалено.', 'Підстави зібрані. У робочому процесі людина має перевірити їх і окремо схвалити передачу.', 'Відтворити схвалення'],
    ['Колега отримує підстави для наступного кроку', 'Сценарій схвалив передачу. Нижче можна прочитати картку: вимоги, джерела, причини рішень і те, що ще невідомо.', 'Рекрутер бачить, на чому стоїть висновок, і вирішує, що уточнювати далі.', 'Перевірити відкликання доказу'],
    ['Підстава змінилася — схвалення знято', 'Перевірка збою: сценарій відкликав раніше прийнятий доказ автоматизації. Ядро автоматично скасувало схвалення; нового пакета більше немає.', 'Коли достатнього доказу немає, потрібна повторна перевірка. Старе схвалення не повинно діяти далі.', 'Почати показ заново']
  ],
  en: [
    ['Start with a clear task', 'We need an operations partner who coordinates work, collaborates with a team and implements automation. Follow one decision about fictional Olena.', 'Each requirement needs a source that actually supports it.', 'Check the first source'],
    ['A webinar does not establish completed work', 'The script accepted two other claims but rejected this automation evidence. The quote is in the document; it does not describe a hands-on implementation.', 'This does not mean the person cannot do it. We still lack sufficient evidence.', 'Open another source'],
    ['Another source describes a completed action', 'The prepared example includes another document. The script accepts its direct description of automation and confirms the records’ shared synthetic identifier. Handoff is not yet approved.', 'The supporting claims are collected. In a real workflow a person must check them and separately approve handoff.', 'Replay approval'],
    ['A colleague receives the reasons for the next step', 'The script approved the handoff. Open the readable card below: requirements, sources, reasons and what remains unknown.', 'The recruiter can see what supports the conclusion and decide what to clarify next.', 'Test evidence withdrawal'],
    ['The evidence changes — approval is removed', 'Failure check: the script withdrew the previously accepted automation evidence. The engine automatically removed approval; a new packet is no longer available.', 'Insufficient evidence calls for another review. The old approval should no longer apply.', 'Restart the walkthrough']
  ]
};

export function renderWalkthrough(step, lang = 'uk', { staticView = false } = {}) {
  const { view } = walkthroughAt(step, lang);
  const t = (uk, en) => lang === 'en' ? en : uk;
  const l = value => value[lang];
  const e = escapeHTML;
  const candidate = view.candidates[0];
  const [title, explanation, takeaway, next] = copy[lang][step];
  const labels = lang === 'uk' ? ['Задача', 'Сумнів', 'Перевірка', 'Пакет', 'Зміна'] : ['Task', 'Doubt', 'Review', 'Handoff', 'Change'];
  const status = {
    'needs-review': t('Передача закрита', 'Handoff unavailable'),
    ready: t('Готово до рішення людини', 'Ready for a human decision'),
    approved: t('Пакет доступний у сценарії', 'Packet available in this scenario')
  }[candidate.status];
  const evidence = candidate.evidence.find(ev => ev.id === (step === 1 ? 'obs-webinar::0' : 'obs-02::0'));
  const headingId = staticView ? `walkthrough-title-${step}` : 'walkthrough-title';
  return `<section class="walkthrough" aria-labelledby="${headingId}" data-demo-step="${step}">
    <div class="walkthrough-top"><p class="eyebrow">${t('ПОКАЗ ІЗ ПОЯСНЕННЯМИ', 'A GUIDED EXAMPLE')} · ${step + 1}/${WALKTHROUGH_STEPS}</p>${staticView ? '' : `<button class="button quiet" id="close-walkthrough">${t('Закрити показ', 'Close walkthrough')}</button>`}</div>
    <p class="walkthrough-disclosure">${t('Вигадані дані. Рішення автоматично відтворює сценарій; це не ваші перевірки й не робота ШІ-пошуку. Ручна черга нижче зберігається окремо.', 'Fictional data. The script automatically replays decisions; these are not your reviews or AI sourcing. The manual queue below remains separate.')}</p>
    <ol class="walkthrough-progress" aria-label="${t('Кроки показу', 'Walkthrough steps')}">${labels.map((label, i) => `<li ${i === step ? 'aria-current="step"' : ''}><span>${i + 1}</span>${label}</li>`).join('')}</ol>
    <h2 id="${headingId}" tabindex="-1">${e(title)}</h2>
    <p class="walkthrough-explanation">${e(explanation)}</p>
    <div class="walkthrough-status"><strong>${status}</strong><span>${t('Підтверджено критеріїв', 'Criteria supported')}: ${view.plan.requiredCriterionIds.length - candidate.missingCriteria.length}/${view.plan.requiredCriterionIds.length}</span></div>
    ${step === 0 ? `<ul class="walkthrough-requirements">${view.project.criteria.map(c => `<li>${e(l(c.label))}</li>`).join('')}</ul>` : step === 3 ? `<p>${t('У пакеті одна умовна людина та три прийняті докази. Остаточні рішення про розмову й найм залишаються людям.', 'The packet contains one fictional person and three accepted claims. People retain interview and hiring decisions.')}</p><details class="walkthrough-packet" ${staticView ? 'open' : ''}><summary>${t('Прочитати пакет для рекрутера', 'Read the recruiter handoff')}</summary>${renderHandoff(view.exportPacket, lang)}</details>` : `<div class="walkthrough-source"><p class="section-label">${t('ДЖЕРЕЛО З НАВЧАЛЬНОГО ПРИКЛАДУ', 'SOURCE FROM THE FICTIONAL EXAMPLE')}</p><blockquote>“${e(l(evidence.quote))}”</blockquote><p>${e(evidence.review.reason)}</p><details ${staticView ? 'open' : ''}><summary>${t('Прочитати весь документ', 'Read the full document')}</summary><p>${e(l(evidence.source.text))}</p><code>${e(evidence.source.ref)}</code></details></div>`}
    <div class="walkthrough-takeaway"><strong>${t('Головна думка', 'The takeaway')}</strong><p>${e(takeaway)}</p></div>
    ${step === 4 ? `<p class="walkthrough-footnote">${t('Раніше завантажений файл лишається історичною копією. Прототип не може відкликати файл з чужого комп’ютера.', 'A previously downloaded file remains a historical copy. The prototype cannot revoke a file on someone else’s computer.')}</p>` : ''}
    ${staticView ? '' : `<div class="walkthrough-controls"><button class="button" id="walkthrough-prev" ${step === 0 ? 'disabled' : ''}>← ${t('Назад', 'Back')}</button><button class="button primary" id="walkthrough-next">${e(next)} →</button></div><div class="walkthrough-footer"><button class="text-link" id="download-walkthrough">${t('Зберегти весь показ для читання офлайн', 'Save the full walkthrough for offline reading')}</button><span>${t('У реальній роботі зміст оцінює людина. Цей показ відтворює заготовлені рішення через ті самі правила передачі.', 'In real work, a person judges the content. This example replays preset decisions through the same handoff rules.')}</span></div>`}
  </section>`;
}

export function walkthroughDocument(lang = 'uk') {
  // Static, script-free copy: readable without a server or active browser session.
  const content = Array.from({ length: WALKTHROUGH_STEPS }, (_, step) => renderWalkthrough(step, lang, { staticView: true })).join('\n');
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Signal Desk — ${lang === 'uk' ? 'Показ із поясненнями' : 'Guided walkthrough'}</title><style>body{margin:0;padding:24px;background:#f4f3ed;color:#1b3029;font:16px/1.6 system-ui,sans-serif}main{max-width:900px;margin:auto}.walkthrough{padding:28px;margin:0 0 28px;border:1px solid #d6dcd1;border-radius:12px;background:#fffefa;overflow-wrap:anywhere}.eyebrow,.section-label{font-size:12px;letter-spacing:1px}.walkthrough-progress{display:flex;flex-wrap:wrap;gap:14px;list-style:none;padding:0;font-size:12px}.walkthrough-progress span{margin-right:5px}[aria-current=step]{font-weight:750}.walkthrough-status,.walkthrough-takeaway{background:#e9efe5;padding:16px;margin:20px 0;border-radius:8px}.walkthrough-status{display:flex;flex-wrap:wrap;gap:20px}.walkthrough-disclosure,.walkthrough-footnote{font-size:13px;color:#58675f}blockquote{border-left:3px solid #255c43;margin:18px 0;padding-left:16px;font-size:20px}summary{cursor:pointer;padding:12px 0;font-weight:650}h2{line-height:1.25}code{overflow-wrap:anywhere}@media(max-width:600px){body{padding:12px}.walkthrough{padding:18px}}@media print{.walkthrough{break-before:page}.walkthrough:first-child{break-before:auto}details>summary{display:none}details>*{display:block!important}}</style></head><body><main><h1>Signal Desk</h1><p>${lang === 'uk' ? 'Задача → джерело → перевірка → зрозуміла передача. Усі п’ять кроків — заготовлений вигаданий сценарій; відкриття цього файла не запускає пошук і не змінює робочу сесію.' : 'Task → source → review → readable handoff. All five steps are a prepared fictional scenario; opening this file does not run sourcing or change a working session.'}</p>${content}</main></body></html>`;
}
