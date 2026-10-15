import { normalizeLocale } from '@blockdesign/core';
import type { PageLocaleVariant } from '@blockdesign/contracts';

export interface LocaleSeoLinks {
  canonicalUrl?: string;
  alternates: Array<{ locale: string; url: string }>;
  xDefaultUrl?: string;
}

function publicUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Builds SEO links only from published, absolute HTTP(S) URLs supplied by the host. */
export function createLocaleSeoLinks(
  variants: PageLocaleVariant[],
  currentLocale: string,
  canonicalOverride?: string,
): LocaleSeoLinks {
  const published = variants.filter((variant) => variant.status === 'published');
  const seen = new Set<string>();
  const alternates = published.flatMap((variant) => {
    const locale = normalizeLocale(variant.locale);
    const url = publicUrl(variant.url);
    if (!locale || !url || seen.has(locale)) return [];
    seen.add(locale);
    return [{ locale, url }];
  });
  const canonicalUrl = publicUrl(canonicalOverride)
    ?? alternates.find((variant) => normalizeLocale(variant.locale) === normalizeLocale(currentLocale))?.url;
  const xDefaultUrl = publicUrl(published.find((variant) => variant.xDefault)?.url);
  return { alternates, ...(canonicalUrl ? { canonicalUrl } : {}), ...(xDefaultUrl ? { xDefaultUrl } : {}) };
}
