import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const reference = readFileSync(resolve(root, 'REFERENCE.md'), 'utf8');

test('public application copy is evergreen while origin and affiliation remain explicit', () => {
  const app = readFileSync(resolve(root, 'src/app.js'), 'utf8');
  assert.ok(app.includes('PUBLIC-SOURCE RESEARCH · INTERACTIVE PROTOTYPE'));
  assert.ok(app.includes('How to test practical value'));
  assert.ok(app.includes('Original context: public role brief'));
  assert.ok(app.includes('Not an A-Players product.'));
  const {version} = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  assert.ok(app.includes(`v${version} /`));
  assert.ok(!app.includes('How I would approach the first month'));
  assert.ok(!app.includes('In our conversation, I want to understand'));
});

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
