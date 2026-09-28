import { demoProject, createSession, transition, viewSession, exportHandoff } from './engine.js?v=0.8.0';
import { renderSearchPlan, renderHypothesisResults, renderCoverage } from './search-plan.js?v=0.8.0';
import { renderHandoff, handoffDocument } from './handoff.js?v=0.8.0';
import { renderWalkthrough, walkthroughDocument } from './walkthrough.js?v=0.8.0';
import { WALKTHROUGH_STEPS } from './walkthrough-state.js?v=0.8.0';
import { MAX_SESSION_BYTES, restoreSession, serializeSession } from './session-file.js?v=0.8.0';
import { sessionStore } from './session-store.js?v=0.8.0';
import { collectResearch, validateResearchReport } from './research.js?v=0.8.0';
import { collectRoleSearch } from './role-search.js?v=0.8.0';
import { renderResearch, researchDocument } from './research-view.js?v=0.8.0';
import { researchNote } from './research-note.js?v=0.8.0';
import { createResearchReview, researchReviewAction, researchReviewPacket, researchReviewView, restoreResearchReview } from './research-review.js?v=0.8.0';
import { researchFollowUpDocument } from './research-review-view.js?v=0.8.0';
import { inspectResearchSource } from './source-inspection.js?v=0.8.0';
import { createPilotFeedback, recordPilotFeedback, restorePilotFeedback } from './pilot-feedback.js?v=0.8.0';

const root = document.querySelector('#app');
let state = createSession(demoProject());
let lang = new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : 'uk';
let selected = 'person-olena', filter = 'all', search = '', scenario = 'standard', touring = false, showExport = false;
let noticeTimer;
let imported = false;
let showWalkthrough = new URL(location.href).searchParams.get('demo') === '1';
let walkthroughStep = 0;
let sessionOrigin = demoProject(), persistence = null, saveStatus = 'ready';
let researchReport = null, researchReview = null, researchLoading = false, researchImported = true, researchError = '';
let pilotFeedback = null;
let researchRevision = 0;
let inspections = { details: new Map(), loading: new Set(), errors: new Map(), attempts: new Map() };
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t = (uk, en) => lang === 'uk' ? uk : en;
const l = value => typeof value === 'string' ? value : (value?.[lang] || value?.uk || '');
const arrow = '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.5"/></svg>';
const download = '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v9m-3-3 3 3 3-3M4 13v4h12v-4" stroke="currentColor" stroke-width="1.5"/></svg>';
const repo = 'https://github.com/DiadkoShmek/talent-research-workflow-prototype';
function statusLabel(status) { return {blocked:t('Конфлікт особи','Identity conflict'),'needs-review':t('Потрібна перевірка','Review needed'),ready:t('Готово до схвалення','Ready for approval'),approved:t('Передачу схвалено','Handoff approved')}[status]; }
function notify(message) {const node=document.querySelector('#notice');node.textContent=message;node.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.classList.remove('show'),6500);}
function userError(error){
 const message=error.message;
 if(lang!=='uk')return message;
 const known={'plan unchanged':'План не змінився. Змініть задачу, критерії або напрямки.','plan requires criteria and hypotheses':'Оберіть хоча б один обов’язковий критерій і один напрямок.','cutoff unchanged':'Ця дата вже застосована.','cutoff after asOf':'Дата не може бути пізнішою за дату знімка прикладу.'};
 if(known[message])return known[message];
 if(message.startsWith('future observation:'))return 'Дата знахідки пізніша за дату знімка прикладу.';
 return message;
}
function persistSession(){
 if(!persistence){saveStatus='unavailable';return;}
 try{persistence.save(sessionOrigin,state);saveStatus='saved';}
 catch(error){saveStatus=error.message.includes('another tab')?'conflict':'unavailable';}
}
function storageMessage(){
 if(saveStatus==='conflict')return t('Інша вкладка змінила збережену сесію. Цю роботу не перезаписано — збережіть її окремим файлом.','Another tab changed the saved session. It was not overwritten — save this work as a separate file.');
 if(saveStatus==='unavailable')return t('Автозбереження недоступне. Збережіть сесію у файл перед закриттям вкладки.','Autosave is unavailable. Save a session file before closing the tab.');
 if(saveStatus==='restored')return t('Сесію відновлено на цьому пристрої. Рішення й план збережені; незавершений текст у полях не відновлюється.','Session restored on this device. Decisions and plan are preserved; unfinished text in input fields is not restored.');
 if(saveStatus==='saved')return t('Ухвалені рішення й план збережено на цьому пристрої.','Recorded decisions and the plan are saved on this device.');
 return t('Ухвалені рішення й план зберігатимуться на цьому пристрої. Чернетки в полях не зберігаються.','Recorded decisions and the plan will be saved on this device. Unsubmitted input drafts are not saved.');
}
function act(action) {try {state=transition(state,action);persistSession();render();return true;}catch(error){notify(t('Дію зупинено: ','Action stopped: ')+userError(error));return false;}}
function reviewer(){return t('Учасник демонстрації','Demo participant');}
function metric(number,label,emphasis=''){return `<div class="metric ${emphasis}"><strong>${number.toString().padStart(2,'0')}</strong><span>${label}</span></div>`;}
function nextStep(c,v){
 if(v.session.exhausted)return t('Журнал заповнений. Ця сесія доступна для читання; нова перевірка починається кнопкою «Скинути».','The journal is full. This session is read-only; use Reset to start a new review.');
 if(c.status==='blocked')return t('Спершу треба розділити або виправити суперечливі записи. Позначка підтвердження не прибере конфлікт.','First separate or correct the conflicting records. A confirmation checkbox cannot remove the conflict.');
 if(c.status==='approved')return t('Відкрийте «Пакет» угорі: готова картка містить джерела, пояснення та наступну дію рекрутера.','Open Handoff above: the readable card contains sources, reasons and the recruiter’s next step.');
 if(c.missingCriteria.length)return t('Перевірте джерела для непідтверджених критеріїв: ','Review sources for the unsupported criteria: ')+c.missingCriteria.map(id=>l(v.project.criteria.find(k=>k.id===id).label)).join(', ')+t('. Прочитайте текст і запишіть власну причину.','. Read the text and record your own reason.');
 if(!c.identityConfirmed)return t('Докази прийняті. Тепер перевірте, що записи стосуються однієї людини, та підтвердьте це нижче.','Evidence is accepted. Now check that the records concern one person and confirm below.');
 return t('Умови виконані. Перегляньте рішення й натисніть «Схвалити передачу».','The conditions are met. Review your decisions and choose Approve handoff.');
}
function eventText(event,v){
 const name=v.candidates.find(c=>c.personKey===event.personKey)?.name || event.personKey;
 if(event.type==='review')return `${e(name)} · ${event.decision==='accept'?t('доказ прийнято','evidence accepted'):t('доказ відхилено','evidence rejected')} <span class="mono">${e(event.evidenceId)}</span>`;
 if(event.type==='identity')return `${e(name)} · ${event.confirmed?t('зв’язок записів підтверджено','record identity confirmed'):t('підтвердження особи знято','identity confirmation removed')}`;
 if(event.type==='approve')return `${e(name)} · ${t('дослідження схвалено до передачі','research handoff approved')}`;
 if(event.type==='revoke')return `${e(name)} · ${t('схвалення відкликано','approval revoked')}`;
 if(event.type==='setPlan')return `${t('План змінено — попередні рішення скинуто','Plan changed — prior decisions invalidated')}: ${e(event.reason)}`;
 if(event.type==='setCutoff')return `${t('Змінено дату — усі перевірки та схвалення скасовано','Cutoff changed — all reviews and approvals invalidated')} (${e(event.cutoff)})`;
 return e(event.type);
}
function evidenceCard(ev,v){
 const criterion=v.project.criteria.find(c=>c.id===ev.criterionId);
 const h=v.project.hypotheses.find(h=>h.id===ev.hypothesisId);
 const reviewed=ev.review;
 return `<article class="evidence ${reviewed?.decision==='accept'?'accepted':reviewed?'rejected':''}" data-evidence="${e(ev.id)}">
 <div class="evidence-top"><strong>${e(l(criterion.label))}${!v.plan.requiredCriterionIds.includes(ev.criterionId)?` <span class="section-label">${t('додатково','optional')}</span>`:''}</strong><span class="badge ${!ev.fresh?'bad':reviewed?.decision==='accept'?'good':''}">${!ev.fresh?t('Застаріле спостереження','Old observation'):reviewed?reviewed.decision==='accept'?t('Прийнято людиною','Accepted by reviewer'):t('Відхилено','Rejected'):t('Не перевірено','Unreviewed')}</span></div>
 <blockquote>“${e(l(ev.quote))}”</blockquote>
 <div class="evidence-meta"><span>${e(l(h.label))}</span><span>·</span><time>${e(ev.source.observedAt)}</time></div>
 <details data-source="${e(ev.id)}"><summary>${t('Відкрити джерело й перевірити','Read source & review')}</summary>
 <div class="source-content"><span class="source-ref">${e(ev.source.ref)} · ${imported?t('імпортований документ','imported document'):t('вигаданий документ','fictional document')}</span>${e(l(ev.source.text))}</div>
 <p class="hint">${t('Наявність цитати не доводить відповідність критерію. Перевірте зміст. Це демонстраційний документ; його справжність не перевіряється.','A matching quote does not prove the criterion. Check its meaning. This is a demonstration document; its authenticity is not verified.')}</p>
 <form class="review-form" data-review-form="${e(ev.id)}"><label for="reason-${e(ev.id)}">${t('Ваш висновок — чому приймаєте або відхиляєте?','Your reason — why accept or reject?')}</label><input id="reason-${e(ev.id)}" name="reason" maxlength="500" required value="${e(reviewed?.reason||'')}" placeholder="${t('Що саме підтверджує цей уривок…','What this passage actually supports…')}"><div class="review-actions"><button class="button" name="decision" value="accept" type="submit" ${!ev.fresh?'disabled':''}>${t('Доказ підтверджує критерій','Evidence supports criterion')}</button><button class="button danger" name="decision" value="reject" type="submit">${t('Відхилити доказ','Reject evidence')}</button></div></form>
 </details>${reviewed?`<p class="review-record ${reviewed.decision==='reject'?'rejected':''}">${e(reviewed.reason)} · ${e(reviewed.reviewer)}</p>`:''}
 </article>`;
}
function candidateDetail(c,v){
 if(!c)return `<div class="empty">${t('Оберіть людину в черзі дослідження.','Select a person from the research queue.')}</div>`;
 const conflict=c.blockers.some(b=>b.startsWith('conflicting-'));
 const required=v.project.criteria.filter(k=>v.plan.requiredCriterionIds.includes(k.id));
 const absent=required.filter(k=>!c.evidence.some(ev=>ev.criterionId===k.id&&ev.fresh));
 return `<div class="detail-top"><div><div class="section-label">${t('ДОСЛІДНИЦЬКА КАРТКА','RESEARCH RECORD')} · ${e(c.personKey.replace('person-',''))}</div><h3>${e(c.name)}</h3><p class="detail-sub">${imported?t('Імпортований приклад — зміст не перевірено','Imported sample — content unverified'):t('Вигадана людина','Fictional person')} · ${c.hypothesisIds.length} ${t('напрямки пошуку','research channels')} · ${c.evidence.length} ${t('твердження','claims')}</p></div><span class="badge ${c.status==='blocked'?'bad':['ready','approved'].includes(c.status)?'good':''}">${statusLabel(c.status)}</span></div>
 <div class="criteria">${required.map(k=>`<span class="criterion ${!c.missingCriteria.includes(k.id)?'complete':''}">${!c.missingCriteria.includes(k.id)?'✓':'○'} ${e(l(k.label))}</span>`).join('')}</div>
 <div class="next-step"><strong>${t('Наступний крок','Next step')}</strong><p>${e(nextStep(c,v))}</p></div>
 ${conflict?`<div class="blocked-note">${t('Записи мають різні посилання на особу або різні імена. Передача заблокована. Враховано також відомі суперечності з вимкнених напрямків. Дослідник мав би розділити чи виправити записи.','Records contain conflicting identities or names. Handoff is blocked. Known conflicts from inactive channels are retained. A researcher would need to split or correct the records.')}</div>`:absent.length?`<div class="blocked-note">${t('Потрібні нові джерела:','New sources needed:')} ${absent.map(k=>e(l(k.label))).join(', ')}.</div>`:''}
 <div class="evidence-title"><span class="section-label">${t('ДОКАЗИ ДО РІШЕННЯ','EVIDENCE BEFORE DECISION')}</span><span>${t('Свіжість спостереження від','Observation cutoff')} ${e(v.project.cutoff)}</span></div>
 ${c.evidence.map(ev=>evidenceCard(ev,v)).join('')}
 <div class="identity"><label><input type="checkbox" id="identity-check" ${c.identityConfirmed?'checked':''} ${conflict?'disabled':''}><span>${t('Я перевірив зв’язок цих записів з однією людиною в прикладі.','I checked that these sample records refer to the same person.')}</span></label><code>${c.identityRefs.map(e).join(' · ')}</code></div>
 <div class="decision-row"><p>${t('Це схвалення дослідження до передачі. Рішення про співбесіду й найм залишається за рекрутером.','This approves research for handoff. Interview and hiring decisions remain with the recruiter.')}</p><button class="button ${c.status==='approved'?'quiet':'primary'}" id="approve-button" ${!['ready','approved'].includes(c.status)?'disabled':''}>${c.status==='approved'?t('Відкликати схвалення','Revoke approval'):t('Схвалити передачу','Approve handoff')} ${arrow}</button></div>`;
}
function render(){
 const focusId=document.activeElement?.id;
 const planOpen=document.querySelector('#search-plan')?.open;
 const openSources=[...document.querySelectorAll('details[open][data-source]')].map(n=>n.dataset.source);
 const v=viewSession(state);if(!v.candidates.some(c=>c.personKey===selected))selected=v.candidates[0]?.personKey;
 const c=v.candidates.find(c=>c.personKey===selected);
 const visible=v.candidates.filter(c=>(filter==='all'||c.status===filter)&&(!search||c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
 document.documentElement.lang=lang;
 document.title=t('Signal Desk — Спочатку докази','Signal Desk — Evidence before decisions');
 root.innerHTML=`<div class="shell">
 <header class="topbar"><a class="brand" href="#"><span class="brand-icon"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18v-7m7 7V5m7 13V9" stroke="currentColor" stroke-width="3"/></svg></span><span class="brand-name">signal desk<small>RESEARCH WITH A REASON</small></span></a><nav class="topnav" aria-label="${t('Основна навігація','Main navigation')}"><a href="#workspace">${t('Робочий стіл','Workspace')}</a><a href="#system">${t('Архітектура','Architecture')}</a><a href="#pilot">${t('Перший пілот','First pilot')}</a><div class="language" aria-label="Language"><button data-lang="uk" aria-pressed="${lang==='uk'}">УКР</button><button data-lang="en" aria-pressed="${lang==='en'}">EN</button></div></nav></header>
 <section class="hero" data-story-beat="arrival"><div><p class="eyebrow"><span class="dot"></span>${t('НЕЗАЛЕЖНИЙ ПРОТОТИП ДЛЯ РОЗМОВИ З A-PLAYERS','AN INDEPENDENT PROTOTYPE FOR A-PLAYERS')}</p><h1>${t('Спочатку докази.<br><em>Потім рішення.</em>','Evidence first.<br><em>Then a decision.</em>')}</h1></div><div class="hero-copy"><p>${t('Знайти публічні сліди у відкритому коді. Побачити джерела й прогалини. Передати рекрутеру зрозумілий результат для наступної перевірки.','Discover public signals in open-source code. Inspect sources and gaps. Give a recruiter a readable result for the next research step.')}</p><div class="hero-actions"><button class="button primary" id="go-to-research">${t('Відкрити реальний пошуковий прохід','Open the public-source research pass')} ${arrow}</button><button class="button quiet" id="open-walkthrough">${t('Подивитися показ із поясненнями','Watch the guided example')} ${arrow}</button></div></div></section>
 <div class="ribbon"><span><strong>${t('Демонстраційний режим.','Demonstration mode.')}</strong> ${imported?t('Власний або відновлений приклад: вигаданість змісту не перевірено.','User-supplied or restored sample: fictionality is unverified.'):t('Показ і ручний приклад нижче — вигадані. Окремий пошуковий прохід читає реальні відкриті дані GitHub.','The walkthrough and manual example below are fictional. The separate research pass reads real public GitHub data.')}</span><span class="mono version">v0.8.0 / ${t('GitHub — лише за кнопкою','GitHub — only on request')}</span></div>
 <main><div id="research-root">${renderResearch(researchReport,lang,{loading:researchLoading,imported:researchImported,error:researchError,reviewSession:researchReview,inspections,pilotFeedback})}</div><div id="walkthrough-root">${showWalkthrough?renderWalkthrough(walkthroughStep,lang):''}</div><section id="workspace" data-story-beat="work"><div class="workspace-heading"><div><p class="eyebrow">01 / ${imported?t('РУЧНА ПЕРЕВІРКА ІМПОРТОВАНИХ ДАНИХ','MANUAL REVIEW OF IMPORTED DATA'):t('РУЧНА ПЕРЕВІРКА НА ВИГАДАНОМУ ПРИКЛАДІ','MANUAL REVIEW OF A FICTIONAL EXAMPLE')}</p><h2>${e(l(v.project.title))}</h2></div><div class="tools"><label class="sr-only" for="scenario">${t('Сценарій','Scenario')}</label><select class="select" id="scenario">${imported?`<option value="imported" selected disabled>${t('Власний приклад','Imported sample')}</option>`:''}<option value="standard" ${scenario==='standard'&&!imported?'selected':''}>${t('Базовий пошук','Standard search')}</option><option value="conflict" ${scenario==='conflict'?'selected':''}>${t('Перевірка: конфлікт особи','Test: identity collision')}</option><option value="future-date">${t('Перевірка: дата з майбутнього','Test: future observation')}</option></select><button class="button quiet" id="start-tour">${t('Новий ручний приклад','New manual example')}</button><button class="button quiet" id="reset">${t('Скинути','Reset')}</button><button class="button" id="export-button" ${!v.exportPacket?'disabled':''}>${download} ${t('Пакет','Handoff')} (${v.metrics.approved})</button></div></div>
 <div class="session-recovery"><div><strong>${t('Продовжити після перерви','Continue after a break')}</strong><p id="save-status" role="status">${e(storageMessage())}</p></div><div class="session-actions"><button class="button" id="download-session">${t('Зберегти сесію у файл','Save session file')}</button><button class="button quiet" id="restore-session">${t('Відновити з файлу','Restore session file')}</button><input class="file-input" type="file" id="session-file" accept=".json,application/json"></div><p class="session-note">${t('Файл сесії містить усі дані й повний журнал для вашого продовження. Для рекрутера використовуйте окремий «Пакет». Збереження локальне, без входу в обліковий запис.','A session file includes all data and the full trail for your own continuation. Use the separate Handoff for a recruiter. Storage is local, without an account.')}</p></div>
 ${touring?`<div class="tour"><div><strong>${t('Три хвилини: пройдіть шлях одного рішення','Three minutes: follow one decision')}</strong><p>${t('Відкрийте три докази Олени → запишіть висновок і прийміть кожен → підтвердьте особу → схваліть передачу → відкрийте пакет. Потім змініть дату внизу: схвалення скинеться.','Open Olena’s three evidence items → write your reason and accept each → confirm identity → approve the handoff → open the packet. Then change the cutoff below: approvals are cleared.')}</p></div><button class="button" id="end-tour">${t('Закрити','Dismiss')}</button></div>`:''}
 ${v.session.exhausted?`<div class="blocked-note" id="session-limit" role="alert"><strong>${t('Сесію завершено: журнал заповнений.','Session closed: the journal is full.')}</strong> ${t('Передача й нові рішення заблоковані. Нижче залишилась історія попередніх рішень. Натисніть «Скинути», щоб почати нову перевірку; старі схвалення не перенесуться.','Handoff and new decisions are blocked. Previous decisions remain visible as history. Choose Reset to start a fresh review; prior approvals will not carry over.')}</div>`:''}
 ${renderSearchPlan(v,lang)}
 <div class="metrics">${metric(v.metrics.observations,t('знахідок<br>на вході','input<br>observations'))}${metric(v.metrics.people,t('карток<br>у черзі','profiles<br>in queue'))}${metric(v.metrics.mergedObservations,t('об’єднаних<br>знахідок','merged<br>observations'))}${metric(v.metrics.blocked,t('конфліктів<br>особи','identity<br>conflicts'))}${metric(v.metrics.approved,t('схвалених<br>передач','approved<br>handoffs'),'emphasis')}</div>
 <div class="workbench" data-signature-moment="evidence-gate"><aside class="queue" aria-label="${t('Черга дослідження','Research queue')}"><div class="queue-head"><label class="section-label" for="search">${t('ЧЕРГА ДОСЛІДЖЕННЯ','RESEARCH QUEUE')}</label><input class="search" id="search" placeholder="${t('Знайти у прикладах…','Find in samples…')}" value="${e(search)}"><div class="filters">${[['all',t('Усі','All')],['needs-review',t('Перевірити','Review')],['blocked',t('Конфлікт','Blocked')],['approved',t('Схвалені','Approved')]].map(([id,label])=>`<button class="filter ${filter===id?'active':''}" data-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div></div><div class="candidate-list">${visible.length?visible.map(item=>`<button class="candidate ${selected===item.personKey?'selected':''}" data-person="${e(item.personKey)}" aria-pressed="${selected===item.personKey}"><span class="avatar">${e(item.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}</span><span class="candidate-info"><strong>${e(item.name)}</strong><small>${statusLabel(item.status)}</small></span><span class="status-dot ${item.status}"></span></button>`).join(''):`<p class="empty">${t('Немає збігів у цьому фільтрі.','No matches in this filter.')}</p>`}</div><div class="queue-footer">${t('Порядок записів — без оцінки чи рейтингу людей.','Display order is not a ranking of people.')}</div></aside><div class="detail" id="candidate-detail">${candidateDetail(c,v)}</div></div>
 ${showExport&&v.exportPacket?`<section class="export-panel" id="export-panel" aria-label="${t('Пакет для рекрутера','Recruiter handoff')}">${renderHandoff(v.exportPacket,lang,imported)}<div class="export-actions"><button class="button primary" id="download-readable">${download} ${t('Завантажити картку','Download readable handoff')}</button><button class="button" id="download-packet">${download} ${t('Завантажити JSON','Download JSON')}</button><button class="button quiet" id="close-export">${t('Згорнути','Collapse')}</button></div><details id="packet-json"><summary>${t('Технічний формат: переглянути JSON','Technical format: inspect JSON')}</summary><pre>${e(JSON.stringify(v.exportPacket,null,2))}</pre></details><p class="handoff-download-note">${t('Файли зберігаються локально. До TeamTailor або інших людей нічого не надсилається.','Files download locally. Nothing is sent to TeamTailor or other people.')}</p></section>`:''}
 <div class="settings"><label>${t('Враховувати спостереження від','Use observations from')}<br><input type="date" id="cutoff" value="${e(v.project.cutoff)}" max="${e(v.project.asOf)}"></label><button class="button" id="apply-cutoff">${t('Застосувати й скинути перевірки','Apply & invalidate reviews')}</button><button class="button quiet" id="import-project">${t('Імпортувати синтетичний приклад','Import synthetic example')}</button><button class="button quiet" id="download-project">${t('Завантажити лише дані прикладу','Download example data only')}</button><input class="file-input" type="file" id="project-file" accept=".json,application/json"></div><p class="settings-note">${t('Дата означає, коли знахідку зафіксували, а не коли людина здобула навичку. Зміна дати скидає всі перевірки, підтвердження особи й схвалення.','The date is when the observation was recorded, not when a skill was gained. Changing the cutoff clears all reviews, identity confirmations and approvals.')}</p>
 <div class="below-workbench" data-story-beat="trace"><section class="panel"><div class="panel-heading"><h3>${t('Що дали напрямки пошуку','What each channel contributed')}</h3><small>${t('зріз на','snapshot')} ${e(v.project.asOf)}</small></div>${renderHypothesisResults(v,lang)}</section><section class="panel"><div class="panel-heading"><h3>${t('Журнал рішень','Decision trail')}</h3><small class="mono">${t('РЕВІЗІЯ','REVISION')} ${String(v.revision).padStart(3,'0')}</small></div>${v.events.length?`<ol class="log">${v.events.slice().reverse().slice(0,10).map(event=>`<li><span class="number">${String(event.revision).padStart(3,'0')}</span><span>${eventText(event,v)}</span></li>`).join('')}</ol>`:`<p class="hint">${t('Поки що немає рішень. Відкрийте джерело, перевірте твердження й залиште причину — тут з’явиться ваш слід.','No decisions yet. Open a source, review a claim and leave a reason — your decision will appear here.')}</p>`}<p class="hint">${t('Журнал демонструє послідовність дій у вкладці. Це не автентифікований аудит працівників.','This trail shows actions in this tab. It is not an authenticated staff audit.')}</p>${renderCoverage(v,lang)}</section></div></section>
 <section class="system-section" id="system"><div class="section-intro"><div><p class="eyebrow">02 / ${t('ЩО ПІД КАПОТОМ','UNDER THE SURFACE')}</p><h2>${t('Висновок має<br>витримати перевірку.','A conclusion should<br>survive inspection.')}</h2></div><p>${t('Інтерфейс керує одним ядром правил. Воно перевіряє вхідні дані, зберігає рішення з причинами й повторно оцінює можливість передачі після кожної зміни. Ті самі правила працюють у браузері та тестах.','The interface drives one policy engine. It validates input, records decisions with reasons, and re-evaluates handoff eligibility after every change. The same rules run in the browser and in tests.')}</p></div><div class="architecture">${[
 [t('01 / ВХІД','01 / INPUT'),t('Пропозиція ≠ доказ','A proposal needs evidence'),t('Критерії, гіпотези й джерела проходять перевірку структури та дат. Цитата має бути в документі.','Criteria, hypotheses and sources pass structure and date checks. A quote must occur in its source.')],
 [t('02 / ОБ’ЄДНАННЯ','02 / GROUPING'),t('Зберегти походження','Keep the provenance'),t('Об’єднані знахідки зберігають власні джерела. Конфлікт особи блокує передачу.','Merged findings keep their own sources. An identity conflict blocks the handoff.')],
 [t('03 / ЛЮДИНА','03 / HUMAN'),t('Перевірити й вирішити','Inspect, then decide'),t('Людина перевіряє кожен потрібний доказ і зв’язок записів. Відсутнє підтвердження лишається видимим.','A person checks the required evidence and record identity. Missing confirmation stays visible.')],
 [t('04 / ПЕРЕДАЧА','04 / HANDOFF'),t('Перенести причину','Carry the reason'),t('Локальний пакет містить прийняті докази й рішення, що їх підтримують. Зміна умов скасовує попередні перевірки.','A local packet carries accepted evidence and its supporting decisions. Changed conditions invalidate earlier reviews.')]
 ].map(([num,title,body])=>`<article class="arch-step"><div class="num">${num}</div><h3>${title}</h3><p>${body}</p></article>`).join('')}</div><div class="system-boundaries"><span>${t('Живий пошук за роллю обмежений чотирма обраними репозиторіями GitHub. Мовні моделі, Brain і TeamTailor не підключені. Дослідницький звіт ще не є схваленням кандидата.','Live role search covers four selected GitHub repositories. Language models, Brain and TeamTailor are not connected. A research brief is not a candidate approval.')}</span><a href="${repo}/blob/main/docs/architecture.md" target="_blank" rel="noreferrer">${t('Повна архітектура ↗','Full architecture ↗')}</a></div></section>
 <section class="system-section" id="pilot"><div class="section-intro"><div><p class="eyebrow">03 / ${t('РОЗМОВА ПРО РЕАЛЬНУ РОБОТУ','THE CONVERSATION ABOUT REAL WORK')}</p><h2>${t('Один пошук.<br>Перевірний результат.','One search.<br>An inspectable result.')}</h2></div><p>${t('Прототип перевіряє спосіб роботи. Користь для A-Players можна встановити тільки на погодженому пілоті з їхніми критеріями, даними та початковими вимірами.','The prototype tests a way of working. Its value to A-Players can only be established in an agreed pilot with their criteria, data and baseline measurements.')}</p></div><div class="notes-grid"><div class="note"><h3>${t('Як я підійшов би до першого місяця','How I would approach the first month')}</h3><ol class="pilot-list"><li><div><strong>${t('Побачити роботу зсередини','Observe the actual work')}</strong><small>${t('Перші 2–3 тижні — спостерігати за живими пошуками разом із рекрутерами, як передбачено в ролі.','First 2–3 weeks: shadow live searches with recruiters, as described in the role.')}</small></div></li><li><div><strong>${t('Вибрати одну втрату часу','Pick one source of lost time')}</strong><small>${t('Пошук, перевірка чи передача даних? Визначити початковий рівень й один критерій успіху.','Sourcing, verification or handoff? Establish a baseline and one success measure.')}</small></div></li><li><div><strong>${t('Провести малий погоджений пілот','Run a small agreed pilot')}</strong><small>${t('Один пошук, обмежені доступи, рішення людини. Порівняти час і частку прийнятих знахідок.','One search, limited access, human decisions. Compare elapsed time and accepted findings.')}</small></div></li></ol></div><div class="note"><h3>${t('Чому я приніс цей прототип','Why I brought this prototype')}</h3><p>${t('Я Артур. Працюю в будівництві й створюю прототипи разом із ШІ. Signal Desk розроблено з Codex для предметної розмови: що варто перевіряти, де губиться контекст і який наступний крок можна спростити.','I’m Artur. I work in construction and build prototypes with AI. Signal Desk was developed with Codex for a concrete conversation: what needs checking, where context gets lost and which next step could be simpler.')}</p><p>${t('На зустрічі хочу зрозуміти, де вашій команді найбільше потрібна допомога, й разом визначити маленький результат, який справді варто перевірити.','In our conversation, I want to understand where your team most needs help and agree on a small result that is worth testing.')}</p><a class="text-link" href="https://aplayers.na.teamtailor.com/jobs/617015-talent-engineer-ai-automation-a-players" target="_blank" rel="noreferrer">${t('Публічний опис ролі, на якому базується задум ↗','The public role brief behind this proposal ↗')}</a></div></div></section></main>
 <footer class="footer"><span>Signal Desk · ${t('Незалежний прототип Артура, створений із Codex. Не продукт A-Players.','Artur’s independent prototype, built with Codex. Not an A-Players product.')}</span><div class="footer-links"><a href="${repo}/blob/main/docs/limits.md" target="_blank" rel="noreferrer">${t('Межі','Limits')}</a><a href="${repo}" target="_blank" rel="noreferrer">GitHub ↗</a></div></footer></div>`;
 for(const node of document.querySelectorAll('details[data-source]')) if(openSources.includes(node.dataset.source))node.open=true;
 if(planOpen)document.querySelector('#search-plan').open=true;
 if(v.session.exhausted) document.querySelectorAll('[data-review-form] input, [data-review-form] button, #identity-check, #approve-button, #apply-cutoff, #cutoff, #plan-form input, #plan-form textarea, #plan-form button').forEach(node=>node.disabled=true);
 bind(v,c);
 bindWalkthrough();
 bindResearch();
 if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
}
function saveFile(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function saveJSON(value,name){saveFile(JSON.stringify(value,null,2),'application/json',name);}
function resetInspections(){researchRevision++;inspections={details:new Map(),loading:new Set(),errors:new Map(),attempts:new Map()};}
function refreshResearch(preserveDrafts=true){
 const drafts=new Map();
 if(preserveDrafts){
  document.querySelectorAll('[data-review-evidence]').forEach(card=>drafts.set(`e:${card.dataset.reviewEvidence}`,card.querySelector('[name="research-reason"]')?.value||''));
  document.querySelectorAll('[data-review-lead]').forEach(card=>drafts.set(`l:${card.dataset.reviewLead}`,card.querySelector('[name="lead-reason"]')?.value||''));
  document.querySelectorAll('[data-pilot-lead]').forEach(card=>drafts.set(`p:${card.dataset.pilotLead}`,Object.fromEntries([...card.querySelectorAll('input,select')].map(input=>[input.name,input.value]))));
 }
 document.querySelector('#research-root').innerHTML=renderResearch(researchReport,lang,{loading:researchLoading,imported:researchImported,error:researchError,reviewSession:researchReview,inspections,pilotFeedback});
 if(preserveDrafts){
  document.querySelectorAll('[data-review-evidence]').forEach(card=>{const value=drafts.get(`e:${card.dataset.reviewEvidence}`);if(value!==undefined)card.querySelector('[name="research-reason"]').value=value;});
  document.querySelectorAll('[data-review-lead]').forEach(card=>{const value=drafts.get(`l:${card.dataset.reviewLead}`);if(value!==undefined)card.querySelector('[name="lead-reason"]').value=value;});
  document.querySelectorAll('[data-pilot-lead]').forEach(card=>{const values=drafts.get(`p:${card.dataset.pilotLead}`);if(values)card.querySelectorAll('input,select').forEach(input=>{if(values[input.name]!==undefined)input.value=values[input.name];});});
 }
 bindResearch();
}
function researchCard(attribute,id){return [...document.querySelectorAll(`[${attribute}]`)].find(card=>card.getAttribute(attribute)===id);}
function inspectionError(error){
 if(Number.isInteger(error?.publicStatus))return t(`GitHub відповів HTTP ${error.publicStatus}. Можливий ліміт API або недоступне джерело.`,`GitHub returned HTTP ${error.publicStatus}. The API limit or source availability may be involved.`);
 if(error?.message==='response exceeds size limit')return t('Зміна завелика для безпечного перегляду тут. Відкрийте точне посилання GitHub.','The change is too large for this bounded preview. Open the exact GitHub link.');
 if(error?.message==='invalid commit detail'||error?.message==='invalid source detail')return t('Деталь зміни не збіглася зі збереженим джерелом або має помилкову форму.','The change detail did not match the saved source or has invalid form.');
 return t('Не вдалося прочитати деталь зміни. Посилання на GitHub залишається доступним.','Could not read the change detail. The GitHub link remains available.');
}
function bindResearch(){
 document.querySelector('#go-to-research').onclick=()=>{document.querySelector('#research-heading').focus({preventScroll:true});document.querySelector('#research-root').scrollIntoView({block:'start'});};
 document.querySelector('#collect-role-search').onclick=async()=>{
  if(researchLoading)return;
  researchLoading=true;researchError='';refreshResearch();
  let replaced=false;
  try{const report=validateResearchReport(await collectRoleSearch());researchReport=report;researchReview=createResearchReview(report);researchImported=false;resetInspections();replaced=true;}
  catch{researchError=t('Пошук злитих PR не завершився. Перевірте доступ до GitHub; попередній звіт збережено.','Merged-PR search did not finish. Check GitHub access; the previous report remains.');}
  finally{researchLoading=false;refreshResearch(!replaced);document.querySelector('#collect-role-search').focus({preventScroll:true});}
 };
 document.querySelector('#collect-research').onclick=async()=>{
  if(researchLoading)return;
  researchLoading=true;researchError='';refreshResearch();
  let replaced=false;
  try{const report=validateResearchReport(await collectResearch());researchReport=report;researchReview=createResearchReview(report);researchImported=false;resetInspections();replaced=true;}
  catch{researchError=t('Збір не завершився. Перевірте доступ до GitHub і повторіть. Попередній звіт, якщо він був, лишився нижче.','Collection did not finish. Check GitHub access and retry. Any previous report is still shown below.');}
  finally{researchLoading=false;refreshResearch(!replaced);document.querySelector('#collect-research').focus({preventScroll:true});}
 };
 document.querySelector('#import-research').onclick=()=>document.querySelector('#research-file').click();
 document.querySelector('#research-file').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  let replaced=false;
  try{if(file.size>2*1024*1024)throw Error('research file too large');const input=JSON.parse(await file.text());
   if(input?.schema==='signal-desk-research-review.v1'){const review=restoreResearchReview(input);researchReport=review.report;researchReview=review;}
   else{const report=validateResearchReport(input);researchReport=report;researchReview=createResearchReview(report);}
   researchImported=true;researchError='';resetInspections();replaced=true;}
  catch{researchError=t('Файл дослідження відхилено. Попередній звіт збережено.','Research file rejected. The previous report is preserved.');}
  finally{event.target.value='';refreshResearch(!replaced);}
 };
 document.querySelector('#download-research')?.addEventListener('click',()=>saveFile(researchDocument(researchReport,lang,researchImported),'text/html;charset=utf-8',`signal-desk-research-${lang}.html`));
 document.querySelector('#download-research-json')?.addEventListener('click',()=>saveJSON(researchReport,'signal-desk-research.json'));
 document.querySelector('#download-research-note')?.addEventListener('click',()=>saveFile(researchNote(researchReport,lang,researchImported),'text/markdown;charset=utf-8',`signal-desk-next-colleague-${lang}.md`));
 document.querySelector('#download-review-session')?.addEventListener('click',()=>saveJSON(researchReview,'signal-desk-full-research-review.json'));
 document.querySelector('#download-follow-up')?.addEventListener('click',()=>saveFile(researchFollowUpDocument(researchReview,lang,researchImported),'text/html;charset=utf-8',`signal-desk-follow-up-${lang}.html`));
 document.querySelector('#download-follow-up-json')?.addEventListener('click',()=>saveJSON(researchReviewPacket(researchReview,researchImported),'signal-desk-follow-up.json'));
 document.querySelector('#start-pilot-feedback').onclick=()=>{
  try{
   if(pilotFeedback&&!window.confirm(t('Нова оцінка замінить поточну в цій вкладці. Збережіть файл, якщо хочете її лишити. Продовжити?','A new evaluation will replace the current one in this tab. Save its file first if needed. Continue?')))return;
   pilotFeedback=createPilotFeedback(researchReview,researchImported);refreshResearch(false);
   document.querySelector('#pilot-feedback-title')?.scrollIntoView({block:'start'});
  }catch{notify(t('Спершу передайте хоча б один корисний слід на наступне дослідження.','First select at least one useful signal for further research.'));}
 };
 document.querySelector('#import-pilot-feedback').onclick=()=>document.querySelector('#pilot-feedback-file').click();
 document.querySelector('#pilot-feedback-file').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{if(file.size>1024*1024)throw Error('file too large');pilotFeedback=restorePilotFeedback(JSON.parse(await file.text()));refreshResearch(false);}
  catch{notify(t('Файл оцінки відхилено. Поточну оцінку не змінено.','Evaluation file rejected. Current evaluation remains.'));}
  finally{event.target.value='';}
 };
 document.querySelector('#download-pilot-feedback')?.addEventListener('click',()=>saveJSON(pilotFeedback,'signal-desk-pilot-feedback.json'));
 document.querySelectorAll('[data-pilot-record]').forEach(button=>button.onclick=()=>{
  const id=button.dataset.pilotRecord,card=button.closest('[data-pilot-lead]');
  try{pilotFeedback=recordPilotFeedback(pilotFeedback,{type:'evaluate',leadId:id,
   verdict:card.querySelector('[name="pilot-verdict"]').value,
   minutes:Number(card.querySelector('[name="pilot-minutes"]').value),
   assessorContext:card.querySelector('[name="pilot-assessor"]').value,
   reason:card.querySelector('[name="pilot-reason"]').value.trim()});
   refreshResearch();researchCard('data-pilot-lead',id)?.querySelector('[data-pilot-record]')?.focus({preventScroll:true});
  }catch{notify(t('Вкажіть 1–240 хвилин і конкретну причину від 8 до 400 символів.','Enter 1–240 minutes and a specific reason of 8 to 400 characters.'));}
 });
 document.querySelectorAll('[data-inspect-source]').forEach(button=>button.onclick=async()=>{
  const id=button.dataset.inspectSource;if(inspections.loading.has(id)||inspections.details.has(id)||(inspections.attempts.get(id)||0)>=2)return;
  const revision=researchRevision,report=researchReport;
  inspections.loading.add(id);inspections.errors.delete(id);inspections.attempts.set(id,(inspections.attempts.get(id)||0)+1);refreshResearch();
  try{const detail=await inspectResearchSource(report,id);if(revision===researchRevision){
   if(detail.association==='different-github-id' && researchReview){
    const reviewState=researchReviewView(researchReview);
    if(!reviewState.exhausted && !reviewState.conflictedEvidence.has(id))
     researchReview=researchReviewAction(researchReview,{type:'source-conflict',evidenceId:id});
   }
   inspections.details.set(id,detail);
  }}
  catch(error){if(revision===researchRevision)inspections.errors.set(id,inspectionError(error));}
  finally{if(revision===researchRevision){inspections.loading.delete(id);refreshResearch();researchCard('data-source-inspection',id)?.focus({preventScroll:true});}}
 });
 document.querySelectorAll('[data-evidence-decision]').forEach(button=>button.onclick=()=>{
  const card=button.closest('[data-review-evidence]');
  try{const id=card.dataset.reviewEvidence,decision=button.dataset.evidenceDecision;researchReview=researchReviewAction(researchReview,{type:'evidence',evidenceId:id,decision,reason:card.querySelector('[name="research-reason"]').value.trim()});refreshResearch();researchCard('data-review-evidence',id)?.querySelector(`[data-evidence-decision="${decision}"]`)?.focus({preventScroll:true});}
  catch{notify(t('Оцінку зупинено. Запишіть конкретну причину від 8 до 400 символів.','Assessment stopped. Write a specific reason of 8 to 400 characters.'));}
 });
 document.querySelectorAll('[data-lead-decision]').forEach(button=>button.onclick=()=>{
  const card=button.closest('[data-review-lead]');
  try{const id=card.dataset.reviewLead,decision=button.dataset.leadDecision;researchReview=researchReviewAction(researchReview,{type:'lead',leadId:id,decision,reason:card.querySelector('[name="lead-reason"]').value.trim()});refreshResearch();researchCard('data-review-lead',id)?.querySelector(`[data-lead-decision="${decision}"]`)?.focus({preventScroll:true});}
  catch{notify(t('Рішення зупинено. Спершу оцініть слід і запишіть причину від 8 до 400 символів.','Decision stopped. Review a signal and write a reason of 8 to 400 characters.'));}
 });
}
function refreshWalkthrough(){
 document.querySelector('#walkthrough-root').innerHTML=showWalkthrough?renderWalkthrough(walkthroughStep,lang):'';
 bindWalkthrough();
 const heading=document.querySelector('#walkthrough-title');
 if(heading){heading.focus({preventScroll:true});document.querySelector('#walkthrough-root').scrollIntoView({block:'start'});}
}
function bindWalkthrough(){
 document.querySelector('#open-walkthrough').onclick=()=>{showWalkthrough=true;refreshWalkthrough();};
 document.querySelector('#close-walkthrough')?.addEventListener('click',()=>{showWalkthrough=false;refreshWalkthrough();document.querySelector('#open-walkthrough').focus();});
 document.querySelector('#walkthrough-prev')?.addEventListener('click',()=>{if(walkthroughStep>0){walkthroughStep--;refreshWalkthrough();}});
 document.querySelector('#walkthrough-next')?.addEventListener('click',()=>{walkthroughStep=(walkthroughStep+1)%WALKTHROUGH_STEPS;refreshWalkthrough();});
 document.querySelector('#download-walkthrough')?.addEventListener('click',()=>saveFile(walkthroughDocument(lang),'text/html;charset=utf-8',`signal-desk-walkthrough-${lang}.html`));
}
function bind(v,c){
 document.querySelectorAll('[data-lang]').forEach(n=>n.onclick=()=>{lang=n.dataset.lang;const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);render();});
 document.querySelectorAll('[data-person]').forEach(n=>n.onclick=()=>{selected=n.dataset.person;render();if(innerWidth<761)document.querySelector('#candidate-detail').scrollIntoView({block:'start'});});
 document.querySelectorAll('[data-filter]').forEach(n=>n.onclick=()=>{filter=n.dataset.filter;render();document.querySelector(`[data-filter="${filter}"]`).focus();});
 document.querySelector('#search').oninput=event=>{const pos=event.target.selectionStart;search=event.target.value;render();const n=document.querySelector('#search');n.focus();n.setSelectionRange(pos,pos);};
 document.querySelector('#scenario').onchange=event=>{try{const project=demoProject(event.target.value);const next=createSession(project);state=next;sessionOrigin=project;persistSession();imported=false;scenario=event.target.value;selected='person-olena';showExport=false;filter='all';search='';render();}catch(error){event.target.value=imported?'imported':scenario;notify(t('Вхідні дані відхилено. Поточна сесія збережена. Причина: ','Input rejected. Current session preserved. Reason: ')+userError(error));}};
 document.querySelector('#reset').onclick=()=>{state=createSession(v.project);sessionOrigin=v.project;persistSession();selected='';showExport=false;filter='all';search='';render();notify(t('Новий показ почато.','A fresh demonstration started.'));};
 document.querySelector('#start-tour').onclick=()=>{sessionOrigin=demoProject();state=createSession(sessionOrigin);persistSession();imported=false;scenario='standard';showExport=false;touring=true;selected='person-olena';filter='all';search='';render();document.querySelector('#workspace').scrollIntoView({block:'start'});};
 document.querySelector('#end-tour')?.addEventListener('click',()=>{touring=false;render();});
 document.querySelectorAll('[data-review-form]').forEach(form=>form.onsubmit=event=>{event.preventDefault();const id=form.dataset.reviewForm;const reason=new FormData(form).get('reason').trim();const decision=event.submitter?.value;if(!reason){form.querySelector('input').focus();return;}if(act({type:'review',evidenceId:id,decision,reason,reviewer:reviewer()})){const next=document.getElementById(`reason-${id}`);next?.focus();notify(t('Рішення записано.','Decision recorded.'));}});
 document.querySelector('#identity-check')?.addEventListener('change',event=>act({type:'identity',personKey:c.personKey,confirmed:event.target.checked,reviewer:reviewer()}));
 document.querySelector('#approve-button')?.addEventListener('click',()=>{if(act({type:c.status==='approved'?'revoke':'approve',personKey:c.personKey,reviewer:reviewer()}))notify(c.status==='approved'?t('Схвалення відкликано.','Approval revoked.'):t('Передачу схвалено. Відкрийте пакет у правому верхньому куті.','Handoff approved. Open the packet at the top right.'));});
 document.querySelector('#export-button').onclick=()=>{showExport=!showExport;render();document.querySelector('#export-panel')?.scrollIntoView({block:'center'});};
 document.querySelector('#close-export')?.addEventListener('click',()=>{showExport=false;render();document.querySelector('#export-button').focus();});
 document.querySelector('#download-readable')?.addEventListener('click',()=>{try{saveFile(handoffDocument(exportHandoff(state),lang,imported),'text/html;charset=utf-8','signal-desk-handoff.html');}catch(error){notify(userError(error));}});
 document.querySelector('#download-packet')?.addEventListener('click',()=>{try{saveJSON(exportHandoff(state),'signal-desk-handoff.json');}catch(error){notify(error.message);}});
 document.querySelector('#apply-cutoff').onclick=()=>{if(act({type:'setCutoff',cutoff:document.querySelector('#cutoff').value})){showExport=false;render();notify(t('Дату змінено. Попередні перевірки, підтвердження й схвалення скинуто.','Cutoff changed. Prior reviews, confirmations and approvals cleared.'));}};
 document.querySelector('#plan-form').onsubmit=event=>{event.preventDefault();const form=new FormData(event.currentTarget);const text=String(form.get('objective')).trim();const oldText=l(v.plan.objective);const objective=text===oldText?v.plan.objective:{uk:text,en:text};const action={type:'setPlan',objective,requiredCriterionIds:form.getAll('criterion'),activeHypothesisIds:form.getAll('hypothesis'),reason:String(form.get('reason')).trim(),reviewer:reviewer()};if(act(action)){showExport=false;filter='all';search='';render();notify(t('План змінено. Перевірки та схвалення скинуто; відомі конфлікти збережено.','Plan changed. Reviews and approvals cleared; known conflicts retained.'));}};
 document.querySelector('#download-session').onclick=()=>{try{saveFile(JSON.stringify(serializeSession(sessionOrigin,state)),'application/json','signal-desk-session.json');}catch(error){notify(t('Сесію не збережено: ','Session could not be saved: ')+userError(error));}};
 document.querySelector('#restore-session').onclick=()=>document.querySelector('#session-file').click();
 document.querySelector('#session-file').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>MAX_SESSION_BYTES)throw Error('session file exceeds size limit');const restored=restoreSession(JSON.parse(await file.text()));state=restored.state;sessionOrigin=restored.originProject;imported=true;scenario='standard';selected='';filter='all';search='';showExport=false;persistSession();render();notify(t('Сесію відновлено: план, причини та рішення. Походження файлу й імена учасників не автентифіковані.','Session restored: plan, reasons and decisions. File origin and reviewer names are not authenticated.'));}catch(error){notify(t('Файл сесії відхилено. Поточну роботу не змінено. Перевірте формат і розмір файлу.','Session file rejected. Current work was not changed. Check the file format and size.'));}finally{event.target.value='';}};
 document.querySelector('#download-project').onclick=()=>saveJSON(v.project,'signal-desk-project.json');
 document.querySelector('#import-project').onclick=()=>document.querySelector('#project-file').click();
 document.querySelector('#project-file').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>500000)throw Error('file exceeds 500 KB');const project=JSON.parse(await file.text());const next=createSession(project);state=next;sessionOrigin=project;persistSession();imported=true;scenario='standard';showExport=false;selected='';filter='all';search='';render();notify(t('Приклад завантажено. Перевірки починаються заново.','Example loaded. Reviews start fresh.'));}catch(error){notify(t('Імпорт відхилено: ','Import rejected: ')+userError(error));}};
}
try{
 persistence=sessionStore(window.localStorage);
 const restored=persistence.load();
 if(restored){state=restored.state;sessionOrigin=restored.originProject;imported=true;selected='';saveStatus='restored';}
}catch{persistence=null;saveStatus='unavailable';}
render();
