import assert from 'node:assert/strict';
import test from 'node:test';
import { ScalanovaTourContentProvider } from './scalanova-tour-content-provider.ts';

test('Scalanova blog source returns the three Turkish guide cards for automatic repeaters', async () => {
  const provider = new ScalanovaTourContentProvider();
  const collections = await provider.listCollections();
  assert.equal(collections[0]?.collectionId, 'scalanova-blog-posts');
  assert.deepEqual(collections[0]?.fields.map((field) => field.fieldId), ['title', 'body', 'cover', 'category', 'readingTime', 'url', 'publishedAt']);

  const result = await provider.query('scalanova-blog-posts', { filters: [], sort: { fieldId: 'publishedAt', direction: 'desc' }, limit: 10 });
  assert.deepEqual(result.items.map((record) => record.recordId), [
    'scalanova-kusadasi-one-day',
    'scalanova-ephesus-preparation',
    'scalanova-kusadasi-cruise-planning',
  ]);
  assert.equal(result.items[0]?.values['cover'], '/scalanova-tour/assets/images/kusadasi-coast.jpg');
});

test('Scalanova blog source supports category filters and resolves selected records', async () => {
  const provider = new ScalanovaTourContentProvider();
  const result = await provider.query('scalanova-blog-posts', {
    filters: [{ fieldId: 'category', operator: 'eq', value: 'Kruvaziyer' }],
    sort: null,
    limit: 10,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.recordId, 'scalanova-kusadasi-cruise-planning');

  const [resolved] = await provider.resolveRecords('scalanova-blog-posts', ['scalanova-ephesus-preparation']);
  assert.equal(resolved?.record?.values['title'], 'Efes gezisine hazırlık: yola çıkmadan önce');
});
