import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createResearchReview, researchReviewPacket } from '../src/research-review.js?v=0.10.0';
import { loadShowcase, validateShowcase, SHOWCASE_SHA256 } from '../src/showcase.js?v=0.10.0';

const bytes = readFileSync(new URL('../data/poolday-public-pass-2026-09-28.json', import.meta.url));
const parsed = () => JSON.parse(bytes.toString('utf8'));
const response = body => new Response(body, { headers: { 'content-length': String(body.length) } });

test('release snapshot binds one five-lane public pass and two inspectable PRs without a human decision', async () => {
  const calls = [];
  const { report, details } = await loadShowcase(async (url, options) => {
    calls.push({ url, options }); return response(bytes);
  }, webcrypto.subtle);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/data\/poolday-public-pass-2026-09-28\.json$/);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(report.run.status, 'complete');
  assert.equal(report.lanes[0].id, 'video-timeline');
  assert.equal(report.leads.length, 8);
  assert.equal(report.leads.reduce((sum, lead) => sum + lead.evidence.length, 0), 14);
  assert.equal(details.size, 2);
  assert.deepEqual([...details.keys()].sort(), [
    'github-pr:remotion-dev/remotion:11703', 'github-pr:remotion-dev/remotion:11763'
  ]);
  for (const detail of details.values()) {
    assert.equal(detail.association, 'same-github-id');
    assert.equal(detail.provenance, 'release-bundled-snapshot');
    assert.equal(detail.files.length, 8);
    assert.equal(detail.files.every(file => file.patch === null), true);
  }
  assert.equal(researchReviewPacket(createResearchReview(report), true), null);
  assert.match(SHOWCASE_SHA256, /^[0-9a-f]{64}$/);
});

test('release snapshot refuses changed bytes, oversized body and redirected data', async () => {
  const modified = Buffer.from(bytes);
  modified[100] ^= 1;
  await assert.rejects(loadShowcase(async () => response(modified), webcrypto.subtle), /invalid bundled showcase/);
  await assert.rejects(loadShowcase(async () => new Response('{}', {
    headers: { 'content-length': String(128 * 1024 + 1) }
  }), webcrypto.subtle), /invalid bundled showcase/);
  await assert.rejects(loadShowcase(async () => ({ ok: true, redirected: true }), webcrypto.subtle), /invalid bundled showcase/);
});

test('release snapshot refuses a forged PR binding and file classification even after parsing', () => {
  const wrongSource = parsed();
  wrongSource.inspections[0].sourceUrl = 'https://github.com/remotion-dev/remotion/pull/99999';
  assert.throws(() => validateShowcase(wrongSource), /invalid bundled showcase/);
  const wrongTestPath = parsed();
  wrongTestPath.inspections[1].files.find(file => file.testPath).testPath = false;
  assert.throws(() => validateShowcase(wrongTestPath), /invalid bundled showcase/);
  const inventedOutcome = parsed();
  inventedOutcome.recruiterAccepted = true;
  assert.throws(() => validateShowcase(inventedOutcome), /invalid bundled showcase/);
});
