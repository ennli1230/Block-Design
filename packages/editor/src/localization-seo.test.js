import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocaleSeoLinks } from './localization-seo.ts';

test('SEO links use only published absolute URLs and honor host canonical and x-default choices', () => {
  const links = createLocaleSeoLinks([
    { locale: 'tr', status: 'published', url: 'https://example.com/tr/guide' },
    { locale: 'en-GB', status: 'published', url: 'https://example.com/en/guide', xDefault: true },
    { locale: 'ar', status: 'draft', url: 'https://example.com/ar/guide' },
    { locale: 'fr', status: 'published', url: '/fr/guide' },
    { locale: 'en-gb', status: 'published', url: 'https://duplicate.example.com/en/guide' },
  ], 'tr');

  assert.deepEqual(links, {
    canonicalUrl: 'https://example.com/tr/guide',
    alternates: [
      { locale: 'tr', url: 'https://example.com/tr/guide' },
      { locale: 'en-GB', url: 'https://example.com/en/guide' },
    ],
    xDefaultUrl: 'https://example.com/en/guide',
  });

  assert.equal(createLocaleSeoLinks([], 'en', 'javascript:alert(1)').canonicalUrl, undefined);
  assert.equal(createLocaleSeoLinks([], 'en', 'https://example.com/custom').canonicalUrl, 'https://example.com/custom');
});
