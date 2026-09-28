import { createSession, demoProject, transition, viewSession } from './engine.js?v=0.8.0';

export const WALKTHROUGH_STEPS = 5;

const REVIEWER = {
  uk: 'Сценарій показу — автоматичне відтворення',
  en: 'Scripted demo — automated replay'
};

const REASONS = {
  uk: {
    accepted: 'Синтетичне джерело прямо описує виконану роботу.',
    webinar: 'Участь у вебінарі підтверджує навчання, але не впровадження автоматизації.',
    withdrawn: 'У цьому сценарії раніше прийнятий доказ відкликано після повторної перевірки.'
  },
  en: {
    accepted: 'The synthetic source directly describes completed work.',
    webinar: 'Attending a webinar shows training, but does not show implementing automation.',
    withdrawn: 'In this scenario, the previously accepted evidence is withdrawn after another review.'
  }
};

function walkthroughProject() {
  const project = demoProject();
  project.id = 'signal-desk-guided-demo';
  project.findings = project.findings.filter(f => f.personKey === 'person-olena');
  const quote = {
    uk: 'Пройшла навчальний вебінар з автоматизації передачі заявок',
    en: 'Attended a training webinar about automating request handoffs'
  };
  project.findings.push({
    id: 'obs-webinar',
    personKey: 'person-olena',
    name: 'Олена Коваль',
    identityRef: 'synthetic://identity/olena',
    hypothesisId: 'automation-builders',
    source: {
      ref: 'synthetic://source/obs-webinar',
      title: { uk: 'Синтетичний запис про навчання', en: 'Synthetic training record' },
      text: {
        uk: `${quote.uk}. У записі немає опису виконаного впровадження.`,
        en: `${quote.en}. The record does not describe a completed implementation.`
      },
      observedAt: '2026-09-16'
    },
    claims: [{ criterionId: 'automation', quote }]
  });
  return project;
}

// Each call replays an isolated synthetic session through the real domain engine.
export function walkthroughAt(step, lang = 'uk') {
  if (!Number.isInteger(step) || step < 0 || step >= WALKTHROUGH_STEPS) throw new RangeError('invalid walkthrough step');
  if (lang !== 'uk' && lang !== 'en') throw new RangeError('invalid walkthrough language');

  const reviewer = REVIEWER[lang];
  const reasons = REASONS[lang];
  let state = createSession(walkthroughProject());
  if (step >= 1) {
    for (const evidenceId of ['obs-01::0', 'obs-01::1']) {
      state = transition(state, { type: 'review', evidenceId, decision: 'accept', reviewer, reason: reasons.accepted });
    }
    state = transition(state, { type: 'review', evidenceId: 'obs-webinar::0', decision: 'reject', reviewer, reason: reasons.webinar });
  }
  if (step >= 2) {
    state = transition(state, { type: 'review', evidenceId: 'obs-02::0', decision: 'accept', reviewer, reason: reasons.accepted });
    state = transition(state, { type: 'identity', personKey: 'person-olena', confirmed: true, reviewer });
  }
  if (step >= 3) state = transition(state, { type: 'approve', personKey: 'person-olena', reviewer });
  if (step >= 4) {
    state = transition(state, { type: 'review', evidenceId: 'obs-02::0', decision: 'reject', reviewer, reason: reasons.withdrawn });
  }
  return { step, view: viewSession(state) };
}
