import { mountEditor, renderPageDocument } from "@blockdesign/editor";
import {
  HttpFormProviderAdapter,
  HttpFormActionAdapter,
} from "@blockdesign/editor/forms";
import {
  HttpStorageAdapter,
  HttpBlockLibraryAdapter,
  HttpContentProviderAdapter,
  HttpAssetAdapter,
  HttpTemplateAdapter,
  HttpSharedRegionAdapter,
  HttpDesignSystemAdapter,
} from "@blockdesign/adapters";
import type {
  EditorDocument,
  LocalizationAdapter,
  LocalizationOptions,
  PageLocaleVariant,
  RequestContext,
} from "@blockdesign/contracts";

export interface LaravelPageLocaleHost {
  options: LocalizationOptions;
  getPageVariants(
    pageGroupId: string,
    context?: RequestContext,
  ): Promise<PageLocaleVariant[]>;
  loadVariant(
    locale: string,
    variant: PageLocaleVariant,
  ): Promise<EditorDocument>;
  createDraftVariant(
    locale: string,
    source: EditorDocument,
  ): Promise<EditorDocument>;
}

/** The Laravel app supplies its authenticated session, CSRF token and role decisions. */
export function openLaravelEditor(
  element: HTMLElement,
  document: EditorDocument,
  csrfToken: string,
  canDesign: boolean,
  pageLocales?: LaravelPageLocaleHost,
  formEndpoints?: {
    schemaBaseUrl: string;
    actionBaseUrl: string;
    publicContentBaseUrl?: string;
  },
) {
  const http = {
    baseUrl: "/api/v1",
    headers: () => ({ "X-CSRF-TOKEN": csrfToken, Accept: "application/json" }),
  };
  const adapters = {
    ...(formEndpoints
      ? {
          forms: {
            providers: [
              new HttpFormProviderAdapter({
                providerId: "laravel",
                baseUrl: formEndpoints.schemaBaseUrl,
                headers: http.headers,
              }),
            ],
            actions: [
              new HttpFormActionAdapter({
                adapterId: "laravel",
                baseUrl: formEndpoints.actionBaseUrl,
                headers: http.headers,
              }),
            ],
            ...(formEndpoints.publicContentBaseUrl
              ? {
                  publication: {
                    schemaBaseUrl: formEndpoints.schemaBaseUrl,
                    actionBaseUrl: formEndpoints.actionBaseUrl,
                    contentBaseUrl: formEndpoints.publicContentBaseUrl,
                  },
                }
              : {}),
          },
        }
      : {}),
    storageAdapter: new HttpStorageAdapter(http),
    blockLibraryAdapter: new HttpBlockLibraryAdapter(http),
    contentProviders: [new HttpContentProviderAdapter(http)],
    assetAdapter: new HttpAssetAdapter(http),
    templateAdapter: new HttpTemplateAdapter(http),
    sharedRegionAdapter: new HttpSharedRegionAdapter(http),
    designSystemAdapter: new HttpDesignSystemAdapter(http),
  };
  const localizationAdapter: LocalizationAdapter | undefined = pageLocales
    ? {
        getPageVariants: (groupId, context) =>
          pageLocales.getPageVariants(groupId, context),
      }
    : undefined;
  const editor = mountEditor(element, {
    ...adapters,
    initialDocument: document,
    appearance: "embedded",
    showToolbar: false,
    mode: canDesign ? "designer" : "content",
    permissions: { design: canDesign, catalogWrite: canDesign },
    theme: { fontFamily: "inherit" },
    ...(pageLocales
      ? {
          localization: pageLocales.options,
          localizationAdapter,
          onLocaleChangeRequested: async (
            locale: string,
            variant: PageLocaleVariant | null,
          ) => (variant ? pageLocales.loadVariant(locale, variant) : null),
          onCreateLocaleVariant: (locale: string, source: EditorDocument) =>
            pageLocales.createDraftVariant(locale, source),
        }
      : {}),
    onSave: (result) =>
      element.dispatchEvent(
        new CustomEvent("cms:page-saved", { detail: result }),
      ),
  });
  return {
    editor,
    /** Browser/headless worker entry; the host decides when to publish and rejects nonempty issues. */
    render: async () => {
      const result = await renderPageDocument(await editor.getDocument(), adapters);
      if (result.issues.length) throw new Error('CMS yayını engellendi: ' + result.issues.map(issue => issue.message).join('; '));
      return result;
    },
    destroy: () => editor.destroy(),
  };
}
