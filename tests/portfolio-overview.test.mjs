import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const reference = readFileSync(resolve(root, 'REFERENCE.md'), 'utf8');

test('public overview is short, inspectable and clear about historical data', () => {
  assert.ok(readme.split(/\s+/).length < 420);
  for (const text of ['28 September 2026', 'further research', 'npm test', 'npm run stress', 'not a deployed recruiting system', 'Artur supplied the brief']) {
    assert.ok(readme.includes(text), text);
  }
  assert.ok(reference.includes('five seeded repositories on one platform'));
  assert.ok(reference.includes('not a claim that those vacancies remain open'));
});

test('overview and technical reference keep local navigation valid', () => {
  for (const [name, text] of [['README.md', readme], ['REFERENCE.md', reference]]) {
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (target.startsWith('https://') || target.startsWith('#')) continue;
      const path = resolve(root, target.split('#')[0]);
      assert.ok(path.startsWith(root + sep), `${name}: ${target}`);
      assert.ok(existsSync(path), `${name}: ${target}`);
    }
  }
});
