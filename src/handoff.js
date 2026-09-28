// Recipient presentation is derived only from the engine's scoped packet.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const styles = `
.handoff{color:#1b3029;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-wrap:anywhere}
.handoff *{box-sizing:border-box}.handoff h2,.handoff h3,.handoff h4,.handoff p{margin:0 0 12px}.handoff p{font-size:inherit;color:inherit}
.handoff h2{font-size:28px;line-height:1.2}.handoff h3{font-size:24px;line-height:1.25}.handoff h4{font-size:16px}
.handoff .handoff-kicker{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#58675f;margin-bottom:12px}
.handoff .handoff-meta{font-size:12px;color:#58675f}.handoff .handoff-brief{background:#e9efe5;padding:20px;border-radius:10px;margin:20px 0}
.handoff .handoff-card{border:1px solid #d6dcd1;border-radius:12px;padding:24px;margin:20px 0;background:#fffefa}
.handoff .handoff-card-head{display:flex;justify-content:space-between;align-items:start;gap:16px;border-bottom:1px solid #d6dcd1;padding-bottom:16px;margin-bottom:20px}
.handoff .handoff-state{font-size:12px;background:#e9efe5;color:#255c43;padding:6px 10px;border-radius:6px;max-width:220px}
.handoff .handoff-evidence{padding:16px 0;border-bottom:1px solid #d6dcd1}.handoff .handoff-evidence:last-child{border-bottom:0}
.handoff blockquote{margin:8px 0 12px;padding:0 0 0 14px;border-left:3px solid #255c43;font-size:17px;line-height:1.5}
.handoff .handoff-reason{font-size:14px}.handoff .handoff-source{font-size:12px;color:#58675f}.handoff code{font-size:11px;word-break:break-all}
.handoff details{margin:12px 0}.handoff summary{cursor:pointer;font-weight:600;min-height:36px;padding:6px 0}
.handoff .handoff-source-text{white-space:pre-wrap;background:#f4f3ed;border-radius:8px;padding:14px;font-size:14px}
.handoff .handoff-next{margin-top:20px;padding:16px;background:#f5eddb;border-radius:8px}.handoff .handoff-next p:last-child{margin-bottom:0}
.handoff .handoff-receipts{padding-left:24px;font-size:13px}.handoff .handoff-receipts li{margin:8px 0}
.handoff .handoff-scope{border-top:1px solid #d6dcd1;padding-top:18px;margin-top:24px;font-size:13px;color:#58675f}
.handoff .handoff-snapshot{font-size:12px;color:#58675f;margin-top:18px}
@media(max-width:600px){.handoff .handoff-card{padding:16px}.handoff .handoff-card-head{display:block}.handoff .handoff-state{display:inline-block;max-width:none}.handoff h2{font-size:24px}.handoff blockquote{font-size:16px}}
`;

export function renderHandoff(packet, lang = 'uk', imported = false) {
  const t = (uk, en) => lang === 'en' ? en : uk;
  const l = value => value?.[lang] || value?.uk || '';
  const e = escapeHTML;
  const names = new Map(packet.candidates.map(c => [c.personKey, c.name]));
  const evidence = new Map(packet.candidates.flatMap(c => c.evidence.map(ev => [ev.id, ev])));
  const criteria = new Map(packet.criteria.map(c => [c.id, l(c.label)]));
  const receipt = event => {
    const action = event.type === 'review'
      ? `${t('Прийнято доказ','Evidence accepted')}: ${e(criteria.get(evidence.get(event.evidenceId).criterionId))}`
      : event.type === 'identity' ? t('Зв’язок записів підтверджено','Record identity confirmed')
      : t('Передачу дослідження схвалено','Research handoff approved');
    return `<li><strong>#${event.revision}</strong> · ${e(names.get(event.personKey))} · ${action} · ${e(event.reviewer)}</li>`;
  };
  return `<div class="handoff"><style>${styles}</style>
    <p class="handoff-kicker">SIGNAL DESK / ${t('ПАКЕТ ДЛЯ РЕКРУТЕРА','RECRUITER HANDOFF')}</p>
    <h2>${t('Підстави для наступної розмови','Evidence for the next conversation')}</h2>
    <p class="handoff-meta">${e(l(packet.projectTitle))}</p>
    <p>${imported ? t('Імпортований навчальний приклад: вигаданість змісту не перевірено.','User-supplied sample: fictionality is unverified.') : t('Навчальний приклад: усі люди та джерела вигадані.','Demonstration: all people and sources are fictional.')}</p>
    <p class="handoff-meta">${t('Знімок даних','Data snapshot')}: ${e(packet.asOf)} · ${t('Спостереження від','Observations from')}: ${e(packet.cutoff)} · ${t('Версія рішень','Decision revision')}: ${packet.revision}</p>
    <div class="handoff-brief"><h4>${t('Задача пошуку','Search objective')}</h4><p>${e(l(packet.plan.objective))}</p></div>
    ${packet.candidates.map(c => `<article class="handoff-card" data-handoff-person="${e(c.personKey)}">
      <header class="handoff-card-head"><div><h3>${e(c.name)}</h3><p class="handoff-meta">${t('Схвалив','Approved by')}: ${e(c.approval.reviewer)} · #${c.approval.revision}<br>${t('Зв’язок записів підтвердив','Record identity confirmed by')}: ${e(c.identity.reviewer)} · #${c.identity.revision}</p></div><span class="handoff-state">${t('Дослідження схвалено до передачі','Research approved for handoff')}</span></header>
      <h4>${t('Що прийняв перевіряльник і на якій підставі','What the reviewer accepted and why')}</h4>
      ${c.evidence.map(ev => `<section class="handoff-evidence" data-handoff-evidence="${e(ev.id)}">
        <h4>${e(criteria.get(ev.criterionId))}</h4><blockquote>“${e(l(ev.quote))}”</blockquote>
        <p class="handoff-reason"><strong>${t('Пояснення','Reason')}:</strong> ${e(ev.reason)}</p>
        <p class="handoff-source">${t('Перевірив','Reviewed by')}: ${e(ev.reviewer)}<br>${t('Джерело','Source')}: ${e(l(ev.source.title))} · ${t('зафіксовано','observed')} ${e(ev.source.observedAt)}<br><code>${e(ev.source.ref)}</code></p>
        <details><summary>${t('Прочитати документ прикладу','Read the sample document')}</summary><div class="handoff-source-text">${e(l(ev.source.text))}</div></details>
      </section>`).join('')}
      <div class="handoff-next"><h4>${t('Що ще невідомо','What remains unknown')}</h4><p>${t('Правдивість документів поза цим прикладом, реальний рівень навичок, доступність та інтерес людини до ролі не встановлені.','The documents’ truth outside this sample, actual proficiency, availability and interest in the role are not established.')}</p><h4>${t('Наступна дія людини','Next human action')}</h4><p>${t('Рекрутер переглядає докази, визначає потрібні уточнення досвіду та вирішує, чи переходити до розмови. Цей пакет не приймає рішення про найм і нікого не контактує.','A recruiter reviews the evidence, identifies experience to clarify and decides whether to proceed to a conversation. This packet makes no hiring decision and contacts nobody.')}</p></div>
    </article>`).join('')}
    <details class="handoff-decision-trace"><summary>${t('Рішення, що підтримують цей пакет','Decisions supporting this packet')} (${packet.events.length})</summary><ol class="handoff-receipts">${packet.events.map(receipt).join('')}</ol></details>
    <p class="handoff-scope">${t('Тут лише останні рішення, що підтримують передані докази, підтвердження особи та схвалення. Повний журнал сесії сюди не входить. Вільні примітки й тексти джерел не очищуються автоматично: перегляньте їх перед передачею. Учасники позначені зі слів користувача; входу в систему немає.','Only the latest decisions supporting exported evidence, identity and approval are included. This is not the full session journal. Free-text notes and source documents are not automatically redacted: inspect them before sharing. Reviewer names are self-attested; there is no authenticated login.')}</p>
    <p class="handoff-snapshot">${t('Це знімок на зазначеній версії рішень. Завантажений файл не оновиться після подальших змін чи відкликання схвалення.','This is a snapshot at the stated decision revision. A downloaded file will not update after later changes or approval revocation.')}</p>
  </div>`;
}

export function handoffDocument(packet, lang = 'uk', imported = false) {
  const language = lang === 'en' ? 'en' : 'uk';
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Signal Desk — ${escapeHTML(language === 'uk' ? 'Пакет для рекрутера' : 'Recruiter handoff')}</title><style>body{background:#f4f3ed;margin:0;padding:24px}main{max-width:900px;margin:auto} @media(max-width:600px){body{padding:12px}}</style></head><body><main>${renderHandoff(packet, language, imported)}</main></body></html>`;
}
