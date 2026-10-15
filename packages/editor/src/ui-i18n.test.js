import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUiText, uiTextKey } from './ui-i18n.ts';

test('UI text keys are stable for Turkish labels and English fallback is available', () => {
  assert.equal(uiTextKey('Alanlar'), 'ui.alanlar');
  assert.equal(uiTextKey('İki sütun'), 'ui.iki-sutun');
  assert.equal(resolveUiText('Açık', 'en'), 'On');
  assert.equal(resolveUiText('Bilinmeyen etiket', 'tr'), 'Bilinmeyen etiket');
});

test('host UI translations override built-in labels using the documented key', () => {
  const requested = [];
  const translated = resolveUiText('Alanlar', 'de', (key, locale) => {
    requested.push({ key, locale });
    return 'Felder';
  });

  assert.equal(translated, 'Felder');
  assert.deepEqual(requested, [{ key: 'ui.alanlar', locale: 'de' }]);
});
