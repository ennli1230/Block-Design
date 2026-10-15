import type { EditorDocument, VersionRef } from '@blockdesign/contracts';

export interface DemoBaseView {
  id: string;
  name: string;
  headerRef: VersionRef;
  footerRef: VersionRef;
  updatedAt: string;
  designSystemRef?: VersionRef;
}

export interface SavedWorkspacePage {
  document: EditorDocument;
  title: string;
  updatedAt: string;
}

const BASE_VIEW_PREFIX = 'blockdesign:base-view:';
const DOCUMENT_PREFIX = 'blockdesign:document:';

/** One-time reset of the retired automatic import; retain a recoverable local backup. */
export function resetLegacyScalanovaCache(storage: Storage): number {
  const marker = 'blockdesign:maintenance:scalanova-reset-20261012-go-cleared';
  if (storage.getItem(marker)) return 0;
  const entries: Record<string,string> = {};
  for(let index=0;index<storage.length;index++){
    const key=storage.key(index);if(!key?.startsWith('blockdesign:')||key.startsWith('blockdesign:backup:'))continue;
    const value=storage.getItem(key);if(!value)continue;
    if(/block\.scalanova-tr-|region\.scalanova-tour-|template\.scalanova-tour-|base-view\.scalanova-tour-|\/scalanova-tour\//.test(key+' '+value))entries[key]=value;
  }
  if(Object.keys(entries).length){storage.setItem('blockdesign:backup:scalanova-reset-20261012-go-cleared',JSON.stringify(entries));for(const key of Object.keys(entries))storage.removeItem(key);}
  storage.setItem(marker,'done');return Object.keys(entries).length;
}

export function loadBaseViews(storage: Storage, seed?: Omit<DemoBaseView, 'updatedAt'>): DemoBaseView[] {
  const items: DemoBaseView[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(BASE_VIEW_PREFIX)) continue;
    const value = storage.getItem(key);
    if (!value) continue;
    try {
      const view = JSON.parse(value) as DemoBaseView;
      if (view.id && view.name && view.headerRef?.id && view.footerRef?.id) items.push(view);
    } catch { /* Ignore malformed local workspace entries. */ }
  }
  if (items.length) return items.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
  if (!seed) return [];
  const initial = { ...seed, updatedAt: new Date(0).toISOString() };
  saveBaseView(storage, initial);
  return [initial];
}

export function saveBaseView(storage: Storage, view: DemoBaseView): void {
  storage.setItem(`${BASE_VIEW_PREFIX}${view.id}`, JSON.stringify(view));
}

export function updateBaseViewRegion(storage: Storage, view: DemoBaseView, region: 'header' | 'footer', ref: VersionRef): DemoBaseView {
  const next: DemoBaseView = {
    ...view,
    [region === 'header' ? 'headerRef' : 'footerRef']: structuredClone(ref),
    updatedAt: new Date().toISOString(),
  };
  saveBaseView(storage, next);
  return next;
}

export function listSavedWorkspacePages(storage: Storage): SavedWorkspacePage[] {
  const items: SavedWorkspacePage[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(DOCUMENT_PREFIX)) continue;
    const value = storage.getItem(key);
    if (!value) continue;
    try {
      const document = JSON.parse(value) as EditorDocument;
      if (!document.documentId || document.documentKind !== 'page') continue;
      const stage = document.editorState?.workspaceStage;
      if (stage === 'base-view' || stage === 'template' || stage === 'block') continue;
      const pages = document.projectData?.pages;
      const firstPage = Array.isArray(pages) ? pages[0] : null;
      const title = firstPage && typeof firstPage === 'object' && !Array.isArray(firstPage) && typeof firstPage.name === 'string'
        ? firstPage.name
        : 'Adsız sayfa';
      items.push({ document, title, updatedAt: document.revision ?? '' });
    } catch { /* Ignore damaged local document entries. */ }
  }
  return items.sort((a, b) => a.title.localeCompare(b.title, 'tr-TR'));
}

