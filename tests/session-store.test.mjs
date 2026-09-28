import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, demoProject, transition, viewSession } from '../src/engine.js?v=0.9.0';
import { SESSION_STORAGE_KEY, sessionStore } from '../src/session-store.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('saved decisions survive a new store; an observed other-tab change is not overwritten', () => {
  const storage = memoryStorage(), project = demoProject();
  const first = sessionStore(storage), second = sessionStore(storage);
  assert.equal(first.load(), null);
  assert.equal(second.load(), null);
  let state = createSession(project);
  state = transition(state, { type: 'review', evidenceId: 'obs-01::0', decision: 'accept', reviewer: 'Reviewer', reason: 'Source checked' });
  first.save(project, state);
  const saved = storage.getItem(SESSION_STORAGE_KEY);
  assert.throws(() => second.save(project, createSession(project)), /another tab/);
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), saved);
  const resumed = sessionStore(storage).load();
  assert.deepEqual(viewSession(resumed.state), viewSession(state));
});

test('bad storage and quota failures preserve the previous stored bytes', () => {
  const storage = memoryStorage(), project = demoProject(), state = createSession(project);
  storage.setItem(SESSION_STORAGE_KEY, '{broken');
  const broken = sessionStore(storage);
  assert.throws(() => broken.load());
  assert.throws(() => broken.save(project, state), /not loaded/);
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), '{broken');
  const quota = sessionStore({ getItem: () => null, setItem: () => { throw Error('quota exceeded'); } });
  quota.load();
  assert.throws(() => quota.save(project, state), /quota/);
  assert.equal(viewSession(state).revision, 0);
});
