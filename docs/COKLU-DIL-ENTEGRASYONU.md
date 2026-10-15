# Çoklu dil entegrasyonu

Editör sayfa varyantlarını, içerik kaynağının dilini ve arayüz dilini ayrı tutar. Host uygulama kendi CMS dil modelini ve gerçek sayfa URL’lerini yönetir; BlockDesign aynı belge ve kaynak bağlamını taşır.

## Çalışan editör kurulumu

```ts
import {
  mountEditor,
  HttpContentProviderAdapter,
  HttpStorageAdapter,
} from '@blockdesign/editor';
import type { LocalizationAdapter, PageLocaleVariant } from '@blockdesign/editor';
import type { EditorDocument } from '@blockdesign/contracts';

const storage = new HttpStorageAdapter({
  baseUrl: '/api/v1',
  headers: () => ({ Authorization: `Bearer ${sessionToken()}` }),
});

const content = new HttpContentProviderAdapter({
  baseUrl: '/api/v1',
  headers: () => ({ Authorization: `Bearer ${sessionToken()}` }),
  // Convert canonical BCP 47 codes to the CMS's expected values.
  mapLocale: (locale) => ({ tr: 'tr_TR', en: 'en_US' })[locale] ?? locale,
  localeParameter: 'lang',
  fallbackParameter: 'fallback_lang',
});

const pageTranslations: LocalizationAdapter = {
  // This route belongs to the host CMS. Return saved variants and their real URLs.
  getPageVariants: (pageGroupId, context) =>
    cms.pages.listTranslations(pageGroupId, { signal: context?.signal }),
};

const editorEnglish = {
  'editor.contentLanguage': 'Content language',
  'source.dataSource': 'Data source',
  'source.localeUnsupported': 'This collection does not declare translation support for {locale}.',
  'source.selectedRecords': '{count} records selected. List order follows selection order.',
};

const source: EditorDocument = await cms.pages.loadForEditor(pageId);
source.localization = {
  locale: 'tr',
  pageGroupId: 'travel.cappadocia',
};

const editor = mountEditor('#editor', {
  initialDocument: source,
  storageAdapter: storage,
  contentProviders: [content],
  localizationAdapter: pageTranslations,
  localization: {
    uiLocale: 'tr',
    defaultLocale: 'tr',
    locales: [
      { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', direction: 'ltr' },
      { code: 'en', label: 'English', nativeLabel: 'English', direction: 'ltr' },
    ],
    fallback: { mode: 'none' },
    strictExport: true,
    translate: (key, locale, values) => {
      const message = locale.toLowerCase().startsWith('en') ? editorEnglish[key as keyof typeof editorEnglish] : undefined;
      return message?.replace(/\{(\w+)\}/g, (match, name: string) => String(values?.[name] ?? match));
    },
  },
  onLocaleChangeRequested: async (_locale, variant) => {
    if (!variant?.documentId) return null;
    return cms.pages.loadForEditor(variant.documentId);
  },
  onCreateLocaleVariant: async (locale, current) => {
    // Start a separate draft that shares the page family and layout.
    const draft = structuredClone(current);
    delete draft.documentId;
    draft.revision = null;
    draft.localization = {
      locale,
      pageGroupId: current.localization?.pageGroupId ?? crypto.randomUUID(),
    };
    return draft;
  },
});
```

The editor changes the active locale only after the host returns a valid document. If the selected variant is missing, `onCreateLocaleVariant` creates a separate draft; it does not translate text or publish the page. When a document has unsaved changes, the editor offers save and switch, switch without saving, or stay. A failed host load leaves the current page open.

`uiLocale` controls editor UI labels independently of the page's `localization.locale`. Built-in Turkish and English dictionaries cover static controls throughout the toolbar, block library, inspector, authoring tools, media controls, and import flow. Hosts can override labels or add another locale with `translate(key, locale, values)`. Workflow keys include names such as `editor.save` and `source.dataSource`; static labels use `ui.<normalized-Turkish-label>`. Import `uiTextKey` to get a key, for example `uiTextKey('Alanlar')` returns `ui.alanlar`. Placeholders such as `{count}` and `{locale}` receive the `values` object.

`LocalizationAdapter` returns `PageLocaleVariant` rows with `locale`, `status`, optional `documentId`, and the host’s real `url`. Only published rows with an absolute HTTP(S) URL feed public language links and SEO alternates. The active published URL supplies `canonicalUrl`, unless `editorState.seo.canonical` overrides it. Set `xDefault: true` on one published variant when the host explicitly chooses the `hreflang="x-default"` target. `PreviewExport.localization` returns `canonicalUrl`, `alternates`, and `xDefaultUrl`; downloaded HTML includes these tags. Draft and missing rows are excluded. Hosts using server-side rendering can add the same returned metadata to their page head.

## Kaynak verisini dile bağlama

`HttpContentProviderAdapter` sends the active content locale to schema, search, selection, group, and query requests. By default it uses `locale` and `fallbackLocale` query parameters and includes `contentLocale` in POST bodies. `localeParameter: null` disables that query parameter; body context remains available for POST endpoints. `mapLocale` translates codes such as `en-GB` or `tr` to a CMS-specific value.

Every translated collection should declare `localization: { mode: 'translated', supportedLocales: [...] }`. A language-independent collection declares `mode: 'neutral'`. In a multi-locale editor, an undeclared legacy provider can still be used in a single-locale setup, but it is rejected as a translated source until it declares support. That prevents a Turkish-only provider from silently appearing as English. Regional tags match a declared base language, for example `en` supports `en-GB` unless the host maps it differently.

For records with complete variants nested under a translations object, wrap an existing provider:

```ts
import { TranslatedFieldsContentProviderAdapter } from '@blockdesign/editor';

const localizedProvider = new TranslatedFieldsContentProviderAdapter(oldProvider, {
  baseLocale: 'tr',
  translationsKey: 'translations', // values.translations.en = a full values object
  supportedLocales: ['tr', 'en'],
  neutralCollections: ['language-options'],
});
```

The chosen translation replaces the record values as a whole. The adapter reports `requestedLocale`, `resolvedLocale`, and `usedFallback`. It disables automatic query mode by default because a generic wrapper cannot safely translate a database filter or sort after pagination. Set `queryLocaleAware: true` only when the wrapped provider applies filters and ordering against the requested translation.

When each language has different physical record or group IDs, preserve shared references with `LocaleMappedContentProviderAdapter`:

```ts
import { LocaleMappedContentProviderAdapter } from '@blockdesign/editor';

const localizedIds = new LocaleMappedContentProviderAdapter(cmsProvider, {
  mapLocale: (locale) => ({ tr: 'tr_TR', en: 'en_US' })[locale] ?? locale,
  mapRecordRef: (collection, sharedId, locale) => translations.recordId(collection, sharedId, locale),
  canonicalRecordRef: (collection, localizedId, locale) => translations.sharedRecordId(collection, localizedId, locale),
  mapGroupRef: (collection, sharedId, locale) => translations.groupId(collection, sharedId, locale),
  canonicalGroupRef: (collection, localizedId, locale) => translations.sharedGroupId(collection, localizedId, locale),
  supportedLocales: ['tr', 'en'],
  neutralCollections: ['language-options'],
});
```

The host supplies these maps from its translation relations and declares translated/neutral collections when needed. BlockDesign does not guess that similarly named rows are translations. Repeater order remains the selected reference order.

## Fallback, preview, and export

The default policy is `{ mode: 'none' }`. A host may explicitly set `{ mode: 'locale', locale: 'tr' }`. A provider must return the full fallback record and its locale metadata; the editor shows an error-level issue for missing or unsupported content and a warning for a successful fallback. A warning keeps source-backed preview content visible.

`PreviewExport.localization` contains the document locale, writing direction, and machine-readable locale issues. Download is blocked when `strictExport` is true and an error-level locale issue remains. Hosts can inspect `exportStatic()` and make their own publication decision. The downloaded document receives the content locale in `lang` and the configured direction in `dir`.

The language switcher block uses only the host’s published variant URLs. It does not construct routes from locale codes. Draft and missing URLs are never emitted.

## Eski belgeler

New documents use `documentVersion: 3` and store `{ localization: { locale, pageGroupId? } }`. Version 1 and 2 documents migrate in memory: an existing localization locale wins, then the legacy `editorState.language`, then host `defaultLocale`, and finally `tr`. The migration does not save automatically. A missing `pageGroupId` stays missing; the host may set one when it has a known translation family.

The full reference plan is in [COKLU-DIL-PLANI.md](COKLU-DIL-PLANI.md). Vanilla HTML and Laravel-style host examples are in [examples/vanilla/multilingual.html](../examples/vanilla/multilingual.html) and [examples/laravel/editor.ts](../examples/laravel/editor.ts).
