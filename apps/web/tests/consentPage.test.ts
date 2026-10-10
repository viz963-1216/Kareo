import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

test('actual consent page permits draft reading acknowledgement without offering formal submission', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kareo-consent-page-'));
  const require = createRequire(import.meta.url);
  try {
    for (const mode of ['real', 'mock']) {
      const outfile = join(directory, `${mode}.cjs`);
      await build({ stdin: { contents: `
        import { createElement } from 'react';
        import { renderToStaticMarkup } from 'react-dom/server';
        import { MemoryRouter } from 'react-router-dom';
        import { ConsentPage } from './src/pages/ConsentPage';
        export const render = () => renderToStaticMarkup(createElement(MemoryRouter, {},
          createElement(ConsentPage, { onAccept: async () => { throw new Error('not submitted'); } })));
      `, resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'tsx' },
        outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
        define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_KAREO_API_MODE: mode,
          VITE_KAREO_DEPLOY_CONTEXT: mode === 'real' ? 'production' : 'local' }),
          __KAREO_CONSENT_DOCUMENTS__: JSON.stringify({ schemaVersion: 1, archives: [] }) } });
      const html: string = require(outfile).render();
      const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0];
      assert.ok(checkbox, 'actual page renders its acknowledgement control');
      assert.doesNotMatch(checkbox, /disabled|checked=""/, 'reading confirmation is enabled and opt-in');
      const button = html.match(/<button[^>]*>[^<]*<\/button>/)?.[0];
      assert.ok(button);
      assert.match(button, /disabled/, 'unchecked form cannot submit');
      if (mode === 'real') {
        assert.match(checkbox, /aria-describedby="consent-unavailable"/);
        assert.match(html, /僅閱讀確認，尚未送出正式同意/);
        assert.match(html, /不會建立使用階段或保存同意紀錄/);
        assert.match(button, /正式評估尚未開放/);
        assert.match(html, /href="\/resources"/);
        assert.match(html, /href="\/info"/);
      } else {
        assert.match(button, /同意並開始評估/);
        assert.doesNotMatch(html, /consent-unavailable/);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
