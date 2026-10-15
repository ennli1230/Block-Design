import type { BlockDefinitionVersion, ContentLocaleContext, ContentProviderAdapter, EditorDocument, SharedRegionDefinition } from '@blockdesign/contracts';
import { resolveDocumentSources } from '@blockdesign/core';

/** Keep the editor's current content in preview when any source cannot resolve. */
export async function resolvePreviewDocument(
  document: EditorDocument,
  definitions: Map<string, BlockDefinitionVersion>,
  providers: ContentProviderAdapter[],
  regions: SharedRegionDefinition[] = [],
  localeDefaults?: { defaultLocale?: string; fallback?: ContentLocaleContext['fallback']; requireProviderLocaleDeclaration?: boolean },
) {
  const resolution = await resolveDocumentSources(document, definitions, providers, regions, localeDefaults);
  return resolution.issues.some(issue => issue.severity !== 'warning')
    ? { ...resolution, document: structuredClone(document) }
    : resolution;
}
