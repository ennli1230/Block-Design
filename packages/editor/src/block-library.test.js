import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLibraryDefinitions, matchingLibraryDefinitions } from './block-library.ts';
import { MemoryBlockLibraryAdapter } from '@blockdesign/adapters';
import { createEmptyDocument, makeInstance, validateDocument } from '@blockdesign/core';
import { definition } from './test-fixtures/source-preview.js';

test('a Scala Nova page can find and reuse a saved Studio block without changing its system', async () => {
  const document = createEmptyDocument();
  document.designSystemRef = { id: 'system.scala-nova-tr', version: '1.0.0' };
  const library = new MemoryBlockLibraryAdapter([definition]);
  assert.deepEqual(await loadLibraryDefinitions(library, [document.designSystemRef]), []);
  const catalog = await loadLibraryDefinitions(library, [document.designSystemRef, definition.designSystemRef]);
  assert.deepEqual(matchingLibraryDefinitions(catalog, 'Hafta'), [definition]);
  document.blocks.push(makeInstance(catalog[0]));
  assert.deepEqual(validateDocument(document, new Map(catalog.map(item => [`${item.ref.id}@${item.ref.version}`, item]))), []);
  assert.equal(document.designSystemRef.id, 'system.scala-nova-tr');
  assert.deepEqual(catalog[0].designSystemRef, definition.designSystemRef);
});

test('shared catalog reads every page, deduplicates systems and repeated local entries, and stops a cursor cycle', async () => {
  const calls = [];
  const second = { ...definition, ref: { id: 'second', version: '1.0.0' } };
  const library = { list: async input => {
    calls.push(input);
    return input.cursor ? { items: [definition, second], nextCursor: 'next' } : { items: [definition], nextCursor: 'next' };
  } };
  assert.deepEqual(await loadLibraryDefinitions(library, [definition.designSystemRef, definition.designSystemRef]), [definition, second]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].cursor, 'next');
});

test('library search finds saved cards with Turkish case, spacing, and unaccented input', () => {
  const saved = { ...definition, name: 'HAFTA SONU FİKİRLERİKısa kaçamaklar', category: 'Özel bloklar' };
  const unrelated = { ...definition, ref: { id: 'other', version: '1.0.0' }, name: 'Menü', description: '', category: 'Bileşenler', fields: [], repeaters: [] };
  for (const query of ['hafta sonu', ' HAFTA   SONU ', 'kisa kacam', 'ozel bloklar']) {
    assert.deepEqual(matchingLibraryDefinitions([unrelated, saved], query), [saved]);
  }
  assert.deepEqual(matchingLibraryDefinitions([saved], 'bulunamayan'), []);
  assert.equal(matchingLibraryDefinitions([unrelated, saved], '').length, 2);
});

test('search uses field and list labels and includes definitions added during an active query', () => {
  const catalog = [];
  assert.deepEqual(matchingLibraryDefinitions(catalog, 'rotaları'), []);
  catalog.push(definition);
  assert.deepEqual(matchingLibraryDefinitions(catalog, 'rotaları'), [definition]);
  const field = definition.repeaters[0].itemFields.find(item => item.type === 'image');
  assert.deepEqual(matchingLibraryDefinitions(catalog, field.label), [definition]);
  assert.deepEqual(matchingLibraryDefinitions([{ ...definition, archived: true }], ''), []);
  assert.deepEqual(matchingLibraryDefinitions([{ ...definition, ref: { id: 'blockdesign.faq', version: '1.0.0' } }], ''), []);
});
