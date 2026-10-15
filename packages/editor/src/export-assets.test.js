import assert from 'node:assert/strict';
import test from 'node:test';
import { packageExportAssets } from './export-assets.ts';

test('static export bundles readable images, stylesheet fonts, and reports missing alt text', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    if (url === 'https://cdn.example/cover.png') return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
    if (url === 'https://fonts.example/theme.css') return new Response('@font-face{font-family:Demo;src:url("/font.woff2")} @font-face{font-family:Source;src:url("/font.ttf")} .hero{background:url("./texture.png")}', { headers: { 'content-type': 'text/css' } });
    if (url === 'https://fonts.example/font.woff2') return new Response(new Uint8Array([4, 5]), { headers: { 'content-type': 'font/woff2' } });
    if (url === 'https://fonts.example/font.ttf') return new Response(new Uint8Array([8, 9]), { headers: { 'content-type': 'font/ttf' } });
    if (url === 'https://fonts.example/texture.png') return new Response(new Uint8Array([6, 7]), { headers: { 'content-type': 'image/png' } });
    return new Response('not found', { status: 404 });
  };
  const result = await packageExportAssets({
    html: '<section><img src="https://cdn.example/cover.png" alt="Cover"><img src="https://cdn.example/missing.png"></section>',
    css: '.intro{color:#345b4c}',
    stylesheets: ['https://fonts.example/theme.css'],
    baseUrl: 'https://editor.example/page',
  }, fetcher);
  assert.match(result.html, /src="data:image\/png;base64,AQID"/);
  assert.match(result.css, /data:font\/woff2;base64,BAU=/);
  assert.match(result.css, /data:font\/ttf;base64,CAk=/);
  assert.match(result.css, /data:image\/png;base64,Bgc=/);
  assert.ok(result.css.indexOf('@font-face') < result.css.indexOf('.intro{color:#345b4c}'), 'source stylesheet loads before authored overrides');
  assert.deepEqual(result.stylesheets, []);
  assert.ok(result.issues.some((item) => item.code === 'ASSET_UNPACKAGED'));
  assert.ok(result.issues.some((item) => item.code === 'IMAGE_ALT_MISSING'));
  assert.ok(requests.every(({ options }) => options.credentials === 'omit' && options.referrerPolicy === 'no-referrer'));
});

test('static export leaves unsafe and unapproved media linked with a concrete issue', async () => {
  const result = await packageExportAssets({ html: '<img src="https://cdn.example/vector.svg" alt="Vector">', css: '', stylesheets: [], baseUrl: 'https://editor.example/' }, async () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }));
  assert.match(result.html, /https:\/\/cdn\.example\/vector\.svg/);
  assert.equal(result.issues[0].code, 'ASSET_UNPACKAGED');
});
