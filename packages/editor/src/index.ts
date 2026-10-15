import { createApp, h, type App } from 'vue';
import type { EditorDocument, EditorMode, SaveResult } from '@blockdesign/contracts';
import { normalizeLocalizationOptions } from '@blockdesign/core';
import type { InnerEditorRuntime, MountEditorOptions, PreviewExport, EditorHandle } from './types';
import './style.css';
import 'grapesjs/dist/css/grapes.min.css';

export type { MountEditorOptions, EditorHandle, PreviewExport, EditorWorkspaceStage } from './types';
export type { LocalizationAdapter, LocalizationOptions, LocaleDefinition, PageLocaleVariant, ContentLocaleContext, ContentLocaleResolution } from '@blockdesign/contracts';
export { HttpStorageAdapter, HttpBlockLibraryAdapter, HttpContentProviderAdapter, HttpAssetAdapter, HttpTemplateAdapter, HttpSharedRegionAdapter, HttpDesignSystemAdapter, DemoContentProvider, DemoContentProviderFallback, TranslatedFieldsContentProviderAdapter, LocaleMappedContentProviderAdapter } from '@blockdesign/adapters';
export { uiTextKey } from './ui-i18n';
export { createLocaleSeoLinks } from './localization-seo';
export type { FormDefinition, FormBinding, FormField, FormFieldType, FormProviderAdapter, FormActionAdapter, FormActionRequest, FormActionResult, FormPublicationConfig, FormRuntimeOptions } from '@blockdesign/contracts';

/** Use the same resolution and export pipeline without displaying the editing UI.
 * Runs in a browser, including a host's headless publication worker.
 */
export async function renderPageDocument(document: EditorDocument, options: Omit<MountEditorOptions, 'initialDocument' | 'onChange' | 'onSave'> = {}): Promise<PreviewExport> {
  const mount = window.document.createElement('div');
  mount.style.cssText = 'position:fixed;left:-100000px;top:0;width:1440px;height:900px;pointer-events:none;';
  mount.setAttribute('aria-hidden','true');
  window.document.body.append(mount);
  const handle = mountEditor(mount, { ...options, initialDocument: structuredClone(document), appearance:'embedded', showToolbar:false, mode:'content', permissions:{design:false,save:false,import:false,catalogWrite:false,export:true} });
  try { await handle.ready; return await handle.exportStatic(); }
  finally { await handle.destroy(); mount.remove(); }
}

export function mountEditor(element: Element | string, options: MountEditorOptions = {}): EditorHandle {
  const normalizedLocalization = normalizeLocalizationOptions(options.localization);
  if (normalizedLocalization) options = { ...options, localization: normalizedLocalization };
  const host = typeof element === 'string' ? document.querySelector(element) : element;
  if (!(host instanceof Element)) throw new TypeError('mountEditor için geçerli bir host elementi gerekli.');
  const root = document.createElement('div');
  root.className = 'blockdesign-root';
  root.dataset['embedded'] = options.appearance === 'embedded' ? 'true' : 'false';
  for(const [key,value] of Object.entries(options.theme ?? {})) if(value) root.style.setProperty('--bd-host-'+key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),value);
  root.setAttribute('data-blockdesign-root', '');
  host.replaceChildren(root);
  let app: App<Element> | null = null;
  let runtime: InnerEditorRuntime | null = null;
  let destroyed = false;
  let resolveReady!: () => void;
  let rejectReady!: (reason: unknown) => void;
  const readyPromise = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  readyPromise.catch(() => undefined);
  root.addEventListener('blockdesign:ready', () => resolveReady(), { once: true });
  root.addEventListener('blockdesign:failure', ((event: CustomEvent<Error>) => rejectReady(event.detail)) as EventListener, { once: true });

  function setRuntime(next: InnerEditorRuntime): void {
    if (destroyed) return;
    runtime = next;
    root.dispatchEvent(new Event('blockdesign:ready'));
  }
  function fail(error: Error): void {
    if (destroyed) return;
    options.onError?.(error);
    root.dispatchEvent(new CustomEvent('blockdesign:failure', { detail: error }));
  }
  async function requireRuntime(): Promise<InnerEditorRuntime> {
    await readyPromise;
    if (destroyed || !runtime) throw new Error('Editör kapatıldı.');
    return runtime;
  }

  // The public entry can load before the larger editor shell and canvas runtime.
  // This keeps host startup small for ESM consumers and still lets IIFE builds inline the chunk.
  void import('./EditorShell.vue').then(({ default: EditorShell }) => {
    if (destroyed) return;
    app = createApp({
      render: () => h(EditorShell, {
        options,
        onRuntime: (runtime: InnerEditorRuntime) => setRuntime(runtime),
        onFailure: (error: Error) => fail(error),
      }),
    });
    app.mount(root);
  }).catch(fail);

  return {
    ready: readyPromise,
    async getDocument() { return (await requireRuntime()).getDocument(); },
    async loadDocument(document: EditorDocument | string) { return (await requireRuntime()).loadDocument(document); },
    async save(): Promise<SaveResult> { return (await requireRuntime()).save(); },
    async setMode(mode: EditorMode) { (await requireRuntime()).setMode(mode); },
    async setPreview(active: boolean) { await (await requireRuntime()).setPreview(active); },
    async exportStatic(): Promise<PreviewExport> { return (await requireRuntime()).exportStatic(); },
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      if (!runtime) rejectReady(new Error('Editör kapatıldı.'));
      app?.unmount();
      app = null;
      runtime = null;
      root.replaceChildren();
      root.remove();
    },
  };

}
