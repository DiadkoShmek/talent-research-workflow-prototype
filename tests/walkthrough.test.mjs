import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, demoProject, viewSession } from '../src/engine.js?v=0.6.1';
import { WALKTHROUGH_STEPS, walkthroughAt } from '../src/walkthrough-state.js';

const reviewer = {
  uk: 'Сценарій показу — автоматичне відтворення',
  en: 'Scripted demo — automated replay'
};

test('five guided stages replay the real gates in both languages', () => {
  assert.equal(WALKTHROUGH_STEPS, 5);
  for (const lang of ['uk', 'en']) {
    const stages = Array.from({ length: WALKTHROUGH_STEPS }, (_, step) => walkthroughAt(step, lang));
    assert.deepEqual(stages.map(x => x.step), [0, 1, 2, 3, 4]);
    assert.deepEqual(stages.map(x => x.view.candidates[0].status),
      ['needs-review', 'needs-review', 'ready', 'approved', 'needs-review']);
    assert.deepEqual(stages.map(x => x.view.metrics.approved), [0, 0, 0, 1, 0]);
    assert.deepEqual(stages.map(x => Boolean(x.view.exportPacket)), [false, false, false, true, false]);
    assert.deepEqual(stages.map(x => x.view.events.length), [0, 3, 5, 6, 7]);

    const first = stages[0].view;
    assert.equal(first.project.findings.length, 3);
    assert.ok(first.project.findings.every(f => f.personKey === 'person-olena'));
    const webinar = first.project.findings.find(f => f.id === 'obs-webinar');
    assert.ok(webinar);
    assert.equal(webinar.identityRef, 'synthetic://identity/olena');
    assert.ok(webinar.source.text[lang].includes(webinar.claims[0].quote[lang]));
    assert.match(webinar.source.text[lang], lang === 'uk' ? /немає опису виконаного впровадження/ : /does not describe a completed implementation/);

    const weak = stages[1].view.candidates[0].evidence.find(e => e.id === 'obs-webinar::0');
    assert.equal(weak.review.decision, 'reject');
    assert.match(weak.review.reason, lang === 'uk' ? /не впровадження/ : /does not show implementing/);
    assert.equal(stages[1].view.candidates[0].identityConfirmed, false);
    assert.deepEqual(stages[1].view.candidates[0].missingCriteria, ['automation']);

    assert.equal(stages[2].view.candidates[0].evidence.find(e => e.id === 'obs-02::0').review.decision, 'accept');
    assert.equal(stages[2].view.candidates[0].identityConfirmed, true);
    assert.equal(stages[3].view.exportPacket.candidates[0].personKey, 'person-olena');
    assert.ok(stages[3].view.exportPacket.candidates[0].evidence.some(e => e.id === 'obs-02::0'));
    assert.ok(!stages[3].view.exportPacket.candidates[0].evidence.some(e => e.id === 'obs-webinar::0'));
    assert.equal(stages[4].view.candidates[0].evidence.find(e => e.id === 'obs-02::0').review.decision, 'reject');
    assert.deepEqual(stages[4].view.candidates[0].missingCriteria, ['automation']);
    assert.ok(stages[3].view.exportPacket); // Prior immutable snapshot stays approved.
    assert.ok(stages.flatMap(x => x.view.events).every(e => e.reviewer === reviewer[lang]));
    assert.ok(stages[3].view.exportPacket.events.every(e => e.reviewer === reviewer[lang]));
  }
});

test('guided replay is isolated from independent manual sessions and validates inputs', () => {
  const manual = createSession(demoProject());
  const before = viewSession(manual);
  const guided = walkthroughAt(3);
  assert.equal(guided.view.metrics.approved, 1);
  assert.equal(viewSession(manual).revision, before.revision);
  assert.deepEqual(viewSession(manual).metrics, before.metrics);
  assert.equal(viewSession(manual).events.length, 0);
  assert.equal(walkthroughAt(3).view.events.length, guided.view.events.length);
  for (const step of [-1, 5, 1.5, '3', NaN, null]) assert.throws(() => walkthroughAt(step), /invalid walkthrough step/);
  for (const lang of ['', 'de', null, 3]) assert.throws(() => walkthroughAt(0, lang), /invalid walkthrough language/);
});
