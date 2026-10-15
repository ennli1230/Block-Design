import assert from 'node:assert/strict';
import test from 'node:test';
import { scopeImportedCss, validateCommonCss } from './html-import.ts';

test('scopes selector lists and nested at-rules, resolves assets and namespaces animation names', () => {
  const input = `
    @import url("https://cdn.example.test/missing.css");
    :root { --space: 1rem; }
    .faq > h2, .faq :is(.copy, .note) { background-image: url("../media/cover.webp"); animation: rise 240ms ease; }
    @media (max-width: 680px) { .faq { grid-template-columns: 1fr; } }
    @keyframes rise { from { opacity: 0; } to { opacity: 1; } }
    .unsafe { background-image: url("javascript:alert(1)"); }
  `;
  const result = scopeImportedCss(input, 'import-test', 'https://example.test/pages/start.html');
  assert.match(result.css, /\[data-bd-import="import-test"\]/);
  assert.match(result.css, /\[data-bd-import="import-test"\] \.faq > h2/);
  assert.match(result.css, /\[data-bd-import="import-test"\]\.faq/);
  assert.match(result.css, /\[data-bd-import="import-test"\] \.faq/);
  assert.match(result.css, /https:\/\/example\.test\/media\/cover\.webp/);
  assert.match(result.css, /@keyframes bd-import-test-rise/);
  assert.match(result.css, /animation: bd-import-test-rise 240ms ease/);
  assert.doesNotMatch(result.css, /@import/);
  assert.doesNotMatch(result.css, /javascript:/);
  assert.ok(result.report.unsupported.some((item) => item.includes('@import')));
  assert.ok(result.report.removed.some((item) => item.includes('background-image')));
});

test('root selectors become the isolated block root and malformed CSS is rejected', () => {
  const result = scopeImportedCss(':root { color: green; } body > .copy { margin: 0; }', 'root-scope');
  assert.match(result.css, /\[data-bd-import="root-scope"\] \{\s*color: green/);
  assert.match(result.css, /\[data-bd-import="root-scope"\] > \.copy/);
  assert.throws(() => scopeImportedCss('.broken { color: red;', 'bad-css'));
});

test('shared CSS is parsed and rejects script hooks and nested imports', () => {
  assert.equal(validateCommonCss(':root { --brand: #345b4c; } @font-face { font-family: Brand; src: url(/brand.woff2); }').includes('@font-face'), true);
  assert.throws(() => validateCommonCss('.x { color: expression(alert(1)); }'), /Riskli CSS/);
  assert.throws(() => validateCommonCss('@import url(https://example.test/site.css);'), /@import/);
  assert.throws(() => validateCommonCss('.broken { color: red;'), /Unclosed|Unclosed block|end of file/i);
});
