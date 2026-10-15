import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasCssForDesignSystem } from './canvas-css.ts';

test('imported designs do not inherit the studio scaffold from a saved snapshot', () => {
  const css='*{box-sizing:border-box}html, body{background:white}body{padding:48px}img{max-width:100%}[data-bd-template-slot="content-main"]{max-width:1120px;padding:24px 32px}.hero{padding:12px}@media(max-width:760px){body{padding:16px}.hero{padding:8px}}';
  const result=canvasCssForDesignSystem(css,false);
  assert.doesNotMatch(result,/body|template-slot|48px|1120px/);
  assert.match(result,/\.hero\{padding:12px\}/);
  assert.match(result,/@media\(max-width:760px\)\{\.hero\{padding:8px\}\}/);
  assert.equal(canvasCssForDesignSystem(css,true),css);
  assert.equal(canvasCssForDesignSystem('body{padding:10px;color:red}img{object-fit:cover}',false),'body{padding:10px;color:red}img{object-fit:cover}');
});
