import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderWalkthrough} from '../src/walkthrough.js';
import {walkthroughAt} from '../src/walkthrough-state.js';
import {renderHandoff} from '../src/handoff.js';

test('site CSP allows the exact existing handoff CSS in both entry paths without general inline execution', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const policy = index.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|\*/);
  assert.match(policy, /script-src 'self';/);
  assert.match(policy, /connect-src 'self' https:\/\/api.github.com;/);
  for (const lang of ['uk', 'en']) {
    for (const markup of [renderHandoff(walkthroughAt(3, lang).view.exportPacket, lang), renderWalkthrough(3, lang)]) {
      const blocks = [...markup.matchAll(/<style>([\s\S]*?)<\/style>/g)];
      assert.ok(blocks.length, 'recipient styling must remain present');
      for (const [, css] of blocks) {
        const digest = createHash('sha256').update(css).digest('base64');
        assert.ok(policy.includes(`'sha256-${digest}'`), 'Update the exact stylesheet CSP hash after changing handoff CSS');
      }
    }
  }
});
