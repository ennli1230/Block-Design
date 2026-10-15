import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyDocument, makeInstance } from '@blockdesign/core';
import { faqDefinition } from '@blockdesign/core/catalog';
import { resolvePreviewDocument } from './preview-document.ts';

function binding(bindingId, fieldId, recordId) {
  const fieldKey = fieldId.split('.').at(-1);
  return {
    bindingId,
    target: { scope: 'field', id: fieldId },
    mode: 'selection',
    providerId: 'demo',
    collectionId: 'faq',
    schemaVersion: '1',
    recordRefs: [recordId],
    groupRef: null,
    query: null,
    fieldMappings: [{ from: fieldKey, to: fieldKey }],
  };
}

function provider() {
  return {
    providerId: 'demo',
    capabilities: { supported: ['resolveRecords'] },
    async getSchema() { return { capabilities: { recordSelection: true, recordGroups: false, query: null } }; },
    async resolveRecords(_collectionId, recordRefs) {
      return recordRefs.map((recordId) => recordId === 'missing'
        ? { recordId, record: null, error: { code: 'NOT_FOUND', message: 'Kayıt artık bulunamıyor.', recoverable: true } }
        : { recordId, record: { recordId, collectionId: 'faq', values: { title: 'Kaynak başlığı', description: 'Kaynak açıklaması' } } });
    },
  };
}

test('preview falls back to the complete current document when any source is missing', async () => {
  const document = createEmptyDocument();
  const block = makeInstance(faqDefinition);
  block.manualData.title = 'Elle yazılmış başlık';
  block.manualData.description = 'Elle yazılmış açıklama';
  block.sourceBindings = [
    binding('title-binding', 'faq.title', 'valid'),
    binding('description-binding', 'faq.description', 'missing'),
  ];
  document.blocks.push(block);

  const resolution = await resolvePreviewDocument(document, new Map([[`${faqDefinition.ref.id}@${faqDefinition.ref.version}`, faqDefinition]]), [provider()]);

  assert.equal(resolution.issues[0]?.message, 'Kayıt artık bulunamıyor.');
  assert.equal(resolution.document.blocks[0].manualData.title, 'Elle yazılmış başlık');
  assert.equal(resolution.document.blocks[0].manualData.description, 'Elle yazılmış açıklama');
  assert.equal(document.blocks[0].manualData.title, 'Elle yazılmış başlık');
});

test('preview uses resolved content when every source succeeds', async () => {
  const document = createEmptyDocument();
  const block = makeInstance(faqDefinition);
  block.sourceBindings = [binding('title-binding', 'faq.title', 'valid')];
  document.blocks.push(block);

  const resolution = await resolvePreviewDocument(document, new Map([[`${faqDefinition.ref.id}@${faqDefinition.ref.version}`, faqDefinition]]), [provider()]);

  assert.equal(resolution.issues.length, 0);
  assert.equal(resolution.document.blocks[0].manualData.title, 'Kaynak başlığı');
  assert.equal(document.blocks[0].manualData.title, 'Merak edilenler');
});
