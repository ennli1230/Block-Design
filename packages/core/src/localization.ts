import type { ContentLocaleContext, EditorDocument, LocalizationOptions } from '@blockdesign/contracts';

export function normalizeLocale(locale: string): string {
  const [canonical] = Intl.getCanonicalLocales(locale.trim());
  if (!canonical) throw new RangeError(`Geçersiz dil kodu: ${locale}`);
  return canonical;
}

export function validLocale(locale: string): boolean {
  try { normalizeLocale(locale); return true; } catch { return false; }
}

export function normalizeLocalizationOptions(options?: LocalizationOptions): LocalizationOptions | undefined {
  if (!options) return undefined;
  if (!Array.isArray(options.locales) || options.locales.length === 0) throw new TypeError('Çoklu dil için en az bir desteklenen dil tanımlanmalı.');
  const locales = options.locales.map(locale => ({ ...locale, code: normalizeLocale(locale.code) }));
  const codes = new Set(locales.map(locale => locale.code.toLowerCase()));
  if (codes.size !== locales.length) throw new TypeError('Desteklenen dil kodları yinelenemez.');
  const defaultLocale = normalizeLocale(options.defaultLocale);
  if (!codes.has(defaultLocale.toLowerCase())) throw new TypeError(`Varsayılan dil (${defaultLocale}) locales listesinde bulunmalı.`);
  const uiLocale = options.uiLocale ? normalizeLocale(options.uiLocale) : defaultLocale;
  const fallback = options.fallback.mode === 'locale'
    ? { mode: 'locale' as const, locale: normalizeLocale(options.fallback.locale) }
    : { mode: 'none' as const };
  if (fallback.mode === 'locale' && !codes.has(fallback.locale.toLowerCase())) throw new TypeError(`Fallback dili (${fallback.locale}) locales listesinde bulunmalı.`);
  return { ...options, defaultLocale, uiLocale, locales, fallback };
}

export function documentLocaleContext(document: EditorDocument, defaultLocale = 'tr', fallback: ContentLocaleContext['fallback'] = { mode: 'none' }, binding?: { mode: 'inherit' } | { mode: 'fixed'; locale: string }): ContentLocaleContext {
  const locale = binding?.mode === 'fixed' ? binding.locale : document.localization?.locale ?? defaultLocale;
  const normalized = normalizeLocale(locale);
  return fallback.mode === 'locale'
    ? { locale: normalized, fallback: { mode: 'locale', locale: normalizeLocale(fallback.locale) } }
    : { locale: normalized, fallback: { mode: 'none' } };
}

/** Upgrades legacy documents in memory; callers decide when to persist the migration. */
export function migrateDocumentLocalization<T extends EditorDocument>(document: T, defaultLocale = 'tr'): T {
  const migrated = structuredClone(document);
  if (migrated.documentVersion < 3) migrated.documentVersion = 3;
  const legacyLanguage = typeof migrated.editorState['language'] === 'string' ? migrated.editorState['language'] as string : undefined;
  const candidate = migrated.localization?.locale ?? legacyLanguage ?? defaultLocale;
  migrated.localization = {
    ...(migrated.localization ?? {}),
    locale: validLocale(candidate) ? normalizeLocale(candidate) : normalizeLocale(defaultLocale),
  };
  return migrated;
}
