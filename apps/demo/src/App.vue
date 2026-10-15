<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, shallowRef } from 'vue';
import type { BlockDefinitionVersion, EditorDocument, JsonValue, PageTemplateDefinition, SharedRegionDefinition, VersionRef } from '@blockdesign/contracts';
import {
  DemoBlockLibraryAdapter,
  DemoContentProviderFallback,
  DemoDesignSystemAdapter,
  DemoSharedRegionAdapter,
  DemoStorageAdapter,
  DemoTemplateAdapter,
  HttpAssetAdapter,
  HttpContentProviderAdapter,
} from '@blockdesign/adapters';
import { applySharedRegions, createEmptyDocument, createPageFromTemplate, defaultPageTemplate, normalizeLocale } from '@blockdesign/core';
import type { EditorWorkspaceStage, MountEditorOptions } from '@blockdesign/editor';
import WorkspaceEditor from './WorkspaceEditor.vue';
import { ScalanovaTourContentProvider } from './scalanova-tour-content-provider';
import { resetLegacyScalanovaCache, listSavedWorkspacePages, loadBaseViews, saveBaseView, updateBaseViewRegion, type DemoBaseView, type SavedWorkspacePage } from './workspace';
import { TR_SYSTEM } from './scalanova-constants';
import { scalanovaBehaviors } from './scalanova-runtime';
import { DemoCmsFormProvider, DemoFormOptionsProvider, DemoCmsFormAction } from './cms-forms';

const FormExamples = defineAsyncComponent(() => import('./FormExamples.vue'));
type WorkspaceScreen = 'overview' | 'base-views' | 'templates' | 'pages' | 'blocks' | 'forms';
type EditorSession = {
  key: number;
  stage: EditorWorkspaceStage;
  label: string;
  document: EditorDocument;
  baseViewId?: string;
  baseViewName?: string;
  templateName?: string;
  existingTemplateRef?: VersionRef;
  existingBlockDefinition?: BlockDefinitionVersion;
  regionKind?: 'header' | 'footer';
  regionRef?: VersionRef;
};

const http = { baseUrl: '/api/v1', headers: () => ({ 'X-Editor-Client': 'blockdesign-demo' }) };
const localization = {
  uiLocale: 'tr',
  defaultLocale: 'tr',
  locales: [
    { code: 'tr', label: 'Turkish', nativeLabel: 'Türkçe', direction: 'ltr' as const },
    { code: 'en', label: 'English', nativeLabel: 'English', direction: 'ltr' as const },
  ],
  fallback: { mode: 'none' as const },
  strictExport: true,
};
const localizationAdapter = {
  async getPageVariants(pageGroupId: string) {
    return listSavedWorkspacePages(localStorage)
      .filter(page => (page.document.localization?.pageGroupId ?? (page.document.documentId ? `page.${page.document.documentId}` : undefined)) === pageGroupId)
      .map(page => ({ locale: page.document.localization!.locale, ...(page.document.documentId ? { documentId: page.document.documentId } : {}), status: 'draft' as const }));
  },
};
const apiAvailable = ref(false);
const storageAdapter = new DemoStorageAdapter({ baseUrl: '/api/v1', onBackendState: (available) => { apiAvailable.value = available; } });
const blockLibraryAdapter = new DemoBlockLibraryAdapter({ ...http, onBackendState: (available) => { apiAvailable.value = available; } });
const templateAdapter = new DemoTemplateAdapter(http);
const sharedRegionAdapter = new DemoSharedRegionAdapter(http);
const adapters: Pick<MountEditorOptions, 'storageAdapter' | 'blockLibraryAdapter' | 'blockLibraryDesignSystemRefs' | 'contentProviders' | 'forms' | 'assetAdapter' | 'templateAdapter' | 'sharedRegionAdapter' | 'designSystemAdapter' | 'http' | 'canvas' | 'behaviorPlugins' | 'localization' | 'localizationAdapter'> = {
  storageAdapter,
  blockLibraryAdapter,
  blockLibraryDesignSystemRefs: [TR_SYSTEM],
  templateAdapter,
  sharedRegionAdapter,
  designSystemAdapter: new DemoDesignSystemAdapter(http),
  assetAdapter: new HttpAssetAdapter(http),
  contentProviders: [new HttpContentProviderAdapter(http), new ScalanovaTourContentProvider(),new DemoFormOptionsProvider()],
  forms:{providers:[new DemoCmsFormProvider()],actions:[new DemoCmsFormAction()]},
  canvas: { stylesheets: [] },
  behaviorPlugins:scalanovaBehaviors,
  localization,
  localizationAdapter,
  http,
};

const baseViews = shallowRef<DemoBaseView[]>([]);
const templates = shallowRef<PageTemplateDefinition[]>([]);
const regions = shallowRef<SharedRegionDefinition[]>([]);
const blocks = shallowRef<BlockDefinitionVersion[]>([]);
const pages = shallowRef<SavedWorkspacePage[]>([]);
const screen = ref<WorkspaceScreen>('overview');
const activeEditor = shallowRef<EditorSession | null>(null);
const nextSessionKey = ref(1);
const loading = ref(true);
const catalogError = ref('');
const savedMessage = ref('');
const query = ref('');
const importingTr=ref(false),importProgress=ref('');
async function importTr(){if(importingTr.value)return;importingTr.value=true;catalogError.value='';try{const {importAtomicTr}=await import('./scalanova-tr-import');const result=await importAtomicTr(message=>importProgress.value=message);await refreshWorkspace();savedMessage.value=`TR aktarımı tamamlandı: ${result.pages.length} sayfa, ${result.templates.length} şablon, ${result.blocks.length} küçük bileşen, 2 ortak bölge.`;}catch(error){catalogError.value=error instanceof Error?error.message:String(error);}finally{importingTr.value=false;importProgress.value='';}}

const newBaseView = ref({ name: '', copyFromId: '' });
const newTemplate = ref({ name: '', baseViewId: '' });
const newPage = ref({ name: '', templateRef: '' });
const activeTemplates = computed(() => templates.value.filter((item) => !item.archived));
const blockCount = computed(() => blocks.value.length);
const category = ref('');
const blockCategories = computed(() => [...new Set(blocks.value.map(block => block.category))].sort((a,b) => a.localeCompare(b,'tr')));
const filteredBlocks = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase('tr-TR');
  return blocks.value.filter(item => (!category.value || item.category === category.value) && (!needle || `${item.name} ${item.category} ${item.description}`.toLocaleLowerCase('tr-TR').includes(needle)))
    .sort((a,b) => a.category.localeCompare(b.category,'tr') || a.name.localeCompare(b.name,'tr'));
});

function refKey(ref: VersionRef): string { return `${ref.id}@${ref.version}`; }
function regionByRef(ref: VersionRef | undefined): SharedRegionDefinition | undefined {
  return ref ? regions.value.find((item) => refKey(item.ref) === refKey(ref)) : undefined;
}
function pageTemplateName(page: SavedWorkspacePage): string {
  const ref = page.document.templateRef;
  return ref ? templates.value.find((item) => refKey(item.ref) === refKey(ref))?.name ?? 'Şablon sürümü' : 'Şablonsuz sayfa';
}
function setScreen(next: WorkspaceScreen): void { screen.value = next; savedMessage.value = ''; }

function openFormExample(id: string): void {
  const paths: Record<string, string> = { contact:'iletisim',travel:'kisiye-ozel',partner:'b2b',transfer:'transferler',shore:'liman-turlari',booking:'turlar/efes-ozel-turu',search:'' };
  const path = 'tr/' + (paths[id] ? paths[id] + '/' : '') + 'index.html';
  const page = pages.value.find(item => String(item.document.editorState.workspaceImportedFrom).endsWith(path));
  if (page) openSavedPage(page);
  else catalogError.value = 'Bu örneğin sayfası bulunamadı. TR içeriğini aktararak sayfaları oluşturabilirsiniz.';
}

async function refreshWorkspace(): Promise<void> {
  loading.value = true;
  catalogError.value = '';
  const systems = [TR_SYSTEM];
  const results = await Promise.allSettled([
    Promise.all(systems.map(designSystemRef=>templateAdapter.list({ designSystemRef, includeArchived: true }))).then(results=>({items:results.flatMap(r=>r.items)})),
    Promise.all(systems.map(designSystemRef=>sharedRegionAdapter.list({ designSystemRef, includeArchived: true }))).then(results=>({items:results.flatMap(r=>r.items)})),
    Promise.all(systems.map(ref=>listAllBlockDefinitions(ref))).then(results=>results.flat()),
  ]);
  const [templateResult, regionResult, blockResult] = results;
  const templateItems = templateResult.status === 'fulfilled' ? templateResult.value.items : [];
  const regionItems = regionResult.status === 'fulfilled' ? regionResult.value.items : [];
  const blockItems = blockResult.status === 'fulfilled' ? blockResult.value : [];
  templates.value = mergeByRef(templateItems).filter(item=>!item.archived);
  regions.value = mergeByRef(regionItems);
  blocks.value = mergeByRef(blockItems).filter(item=>!item.archived);
  // The Go API is the source of page records; local entries remain an offline cache.
  try{for(const system of systems){let cursor='';do{const response=await fetch(`/api/v1/documents?systemId=${encodeURIComponent(system.id)}&systemVersion=${encodeURIComponent(system.version)}${cursor?'&cursor='+encodeURIComponent(cursor):''}`);if(!response.ok)throw Error('Sayfa listesi alınamadı.');const result=await response.json() as {items:EditorDocument[];nextCursor:string|null};for(const document of result.items)if(document.documentId)localStorage.setItem('blockdesign:document:'+document.documentId,JSON.stringify(document));cursor=result.nextCursor??'';}while(cursor);}}catch{/* Existing demo deployments may not implement listing; retain their local drafts. */}
  const trTemplate=templateItems.find(item=>item.baseViewId==='base-view.sn-tr');
  if(trTemplate){const header=regionItems.find(r=>r.region==='header'&&refKey(r.designSystemRef)===refKey(TR_SYSTEM)),footer=regionItems.find(r=>r.region==='footer'&&refKey(r.designSystemRef)===refKey(TR_SYSTEM));if(header&&footer&&!localStorage.getItem('blockdesign:base-view:base-view.sn-tr'))saveBaseView(localStorage,{id:'base-view.sn-tr',name:'Scala Nova · Türkçe',headerRef:header.ref,footerRef:footer.ref,designSystemRef:TR_SYSTEM,updatedAt:new Date().toISOString()});}
  baseViews.value = loadBaseViews(localStorage);
  // One-time navigation migration for the imported base view; other pinned views stay intact.
  const importedView = baseViews.value.find(view => view.id === 'base-view.sn-tr');
  if (importedView) {
    const header = regionItems.find(region => !region.archived && region.ref.id === 'region.sn-tr.header' && region.ref.version === '1.1.0');
    const footer = regionItems.find(region => !region.archived && region.ref.id === 'region.sn-tr.footer' && region.ref.version === '1.1.0');
    if (header && footer && importedView.headerRef.id === header.ref.id && importedView.footerRef.id === footer.ref.id && (importedView.headerRef.version === '1.0.0' || importedView.footerRef.version === '1.0.0')) {
      if (!localStorage.getItem('blockdesign:backup:before-cms-navigation-base-view')) localStorage.setItem('blockdesign:backup:before-cms-navigation-base-view', JSON.stringify(importedView));
      saveBaseView(localStorage,{...importedView,headerRef:header.ref,footerRef:footer.ref,updatedAt:new Date().toISOString()});
      baseViews.value = loadBaseViews(localStorage);
    }
  }
  pages.value = listSavedWorkspacePages(localStorage);
  if (templateResult.status === 'rejected' || regionResult.status === 'rejected' || blockResult.status === 'rejected') {
    catalogError.value = 'Bazı kataloglar şu an yüklenemedi. Yerel kayıtlar kullanılmaya devam ediyor.';
  }
  if (!newBaseView.value.copyFromId) newBaseView.value.copyFromId = baseViews.value[0]?.id ?? '';
  if (!newTemplate.value.baseViewId) newTemplate.value.baseViewId = baseViews.value[0]?.id ?? '';
  if (!newPage.value.templateRef) newPage.value.templateRef = activeTemplates.value[0] ? refKey(activeTemplates.value[0].ref) : '';
  loading.value = false;
}

async function listAllBlockDefinitions(designSystemRef:VersionRef): Promise<BlockDefinitionVersion[]> {
  const items: BlockDefinitionVersion[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await blockLibraryAdapter.list({
      designSystemRef,
      includeArchived: true,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (cursor && seenCursors.has(cursor)) break;
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return items;
}

function mergeByRef<T extends { ref: VersionRef }>(items: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of items) merged.set(refKey(item.ref), item);
  return [...merged.values()];
}

function createBaseView(): void {
  const name = newBaseView.value.name.trim();
  if (!name) return;
  const source = baseViews.value.find((item) => item.id === newBaseView.value.copyFromId) ?? baseViews.value[0];
  if (!source) return;
  const view: DemoBaseView = {
    id: `base-view.${slug(name)}.${crypto.randomUUID().slice(0, 8)}`,
    name,
    headerRef: structuredClone(source.headerRef),
    footerRef: structuredClone(source.footerRef),
    ...(source.designSystemRef?{designSystemRef:structuredClone(source.designSystemRef)}:{}),
    updatedAt: new Date().toISOString(),
  };
  saveBaseView(localStorage, view);
  baseViews.value = [...baseViews.value, view].sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
  newBaseView.value = { name: '', copyFromId: source.id };
  savedMessage.value = `“${name}” temel görünümü oluşturuldu. Header ve footer sürümlerini ayrı ayrı düzenleyebilirsin.`;
}

function openBaseViewRegion(view: DemoBaseView, kind: 'header' | 'footer'): void {
  const ref = kind === 'header' ? view.headerRef : view.footerRef;
  const document = createBaseViewDocument(view);
  document.editorState.workspaceSharedRegionKind = kind;
  openEditor({ stage: 'base-view', label: `${view.name} · ${kind === 'header' ? 'Header' : 'Footer'}`, document, baseViewId: view.id, baseViewName: view.name, regionKind: kind, regionRef: ref });
}

function createBaseViewDocument(view: DemoBaseView): EditorDocument {
  const document = createPageFromTemplate(defaultPageTemplate);
  document.designSystemRef=structuredClone(view.designSystemRef??defaultPageTemplate.designSystemRef);
  const selectedRegions = [regionByRef(view.headerRef), regionByRef(view.footerRef)].filter((item): item is SharedRegionDefinition => Boolean(item));
  const refs = [view.headerRef, view.footerRef].map((ref) => structuredClone(ref));
  const values: Record<string, Record<string, JsonValue>> = {};
  for (const region of selectedRegions) values[refKey(region.ref)] = Object.fromEntries(region.fields.map((field) => [field.key, structuredClone(field.defaultValue)]));
  document.templateRef = document.designSystemRef.id === defaultPageTemplate.designSystemRef.id ? structuredClone(defaultPageTemplate.ref) : null;
  document.sharedRegionRefs = refs;
  document.sharedRegionData = values;
  document.projectData = applySharedRegions(document.projectData, selectedRegions, values);
  document.editorState = { viewport: 'desktop', workspaceBaseViewId: view.id, workspaceStage: 'base-view' };
  return document;
}

function createTemplate(): void {
  const name = newTemplate.value.name.trim();
  const view = baseViews.value.find((item) => item.id === newTemplate.value.baseViewId);
  if (!name || !view) return;
  const document = createBaseViewDocument(view);
  document.templateRef = null;
  openEditor({ stage: 'template', label: `Yeni şablon · ${name}`, document, baseViewId: view.id, baseViewName: view.name, templateName: name });
  newTemplate.value = { name: '', baseViewId: view.id };
}

function editTemplate(template: PageTemplateDefinition): void {
  const document = createPageFromTemplate(template);
  document.sharedRegionData = {};
  const view = baseViews.value.find((item) => item.id === template.baseViewId);
  openEditor({
    stage: 'template', label: `${template.name} · v${template.ref.version}`, document,
    ...(template.baseViewId ? { baseViewId: template.baseViewId } : {}),
    ...(view ? { baseViewName: view.name } : {}),
    templateName: template.name, existingTemplateRef: structuredClone(template.ref),
  });
}

function createPage(): void {
  const name = newPage.value.name.trim();
  const template = activeTemplates.value.find((item) => refKey(item.ref) === newPage.value.templateRef);
  if (!name || !template) return;
  const document = createPageFromTemplate(template);
  renameDocumentPage(document, name);
  document.localization = { locale: 'tr', pageGroupId: `page.${slug(name)}.${crypto.randomUUID().slice(0, 8)}` };
  document.sharedRegionData = {};
  document.editorState = { ...document.editorState, viewport: 'desktop', workspaceStage: 'page' };
  openEditor({ stage: 'page', label: name, document });
  newPage.value.name = '';
}

function createBlock(): void {
  const document = createEmptyDocument();
  document.documentKind = 'blockDraft';
  document.designSystemRef = structuredClone(TR_SYSTEM);
  document.editorState.workspaceStage = 'block';
  openEditor({ stage: 'block', label: 'Yeni blok tasarla', document });
}

function editBlock(definition: BlockDefinitionVersion): void {
  const document = createEmptyDocument();
  document.documentKind = 'blockDraft';
  document.designSystemRef = structuredClone(definition.designSystemRef);
  document.editorState.workspaceStage = 'block';
  openEditor({ stage: 'block', label: `${definition.name} · v${definition.ref.version} düzenle`, document, existingBlockDefinition: structuredClone(definition) });
}

async function openSavedPage(page: SavedWorkspacePage): Promise<void> {
  try {
    const document = await storageAdapter.load(page.document.documentId!);
    openStoredDocument(document, page.title);
  } catch {
    openStoredDocument(structuredClone(page.document), page.title);
  }
}

function openStoredDocument(document: EditorDocument, fallbackLabel: string): void {
  const stage = document.editorState.workspaceStage;
  if (stage === 'block') { openEditor({ stage: 'block', label: 'Blok taslağı', document }); return; }
  if (stage === 'template') {
    const existing = document.editorState.workspaceExistingTemplateRef as VersionRef | undefined;
    const baseViewId = typeof document.editorState.workspaceBaseViewId === 'string' ? document.editorState.workspaceBaseViewId : undefined;
    const view = baseViews.value.find((item) => item.id === baseViewId);
    openEditor({ stage: 'template', label: fallbackLabel, document, ...(baseViewId ? { baseViewId } : {}), ...(view ? { baseViewName: view.name } : {}), ...(typeof document.editorState.workspaceTemplateName === 'string' ? { templateName: document.editorState.workspaceTemplateName } : {}), ...(existing ? { existingTemplateRef: existing } : {}) });
    return;
  }
  if (stage === 'base-view') {
    const baseViewId = typeof document.editorState.workspaceBaseViewId === 'string' ? document.editorState.workspaceBaseViewId : undefined;
    const view = baseViews.value.find((item) => item.id === baseViewId);
    const kind = document.editorState.workspaceSharedRegionKind === 'footer' ? 'footer' : 'header';
    const region = document.sharedRegionRefs.map(regionByRef).find((item) => item?.region === kind);
    openEditor({ stage: 'base-view', label: fallbackLabel, document, ...(baseViewId ? { baseViewId } : {}), ...(view ? { baseViewName: view.name } : {}), regionKind: kind, ...(region ? { regionRef: region.ref } : {}) });
    return;
  }
  if (!document.localization?.pageGroupId && document.documentId) document.localization = { ...(document.localization ?? {}), locale: document.localization?.locale ?? 'tr', pageGroupId: `page.${document.documentId}` };
  openEditor({ stage: 'page', label: fallbackLabel, document });
}

async function loadPageLocaleVariant(locale: string, variant: import('@blockdesign/contracts').PageLocaleVariant | null): Promise<EditorDocument | null> {
  if (!variant?.documentId) return null;
  const document = await storageAdapter.load(variant.documentId);
  if (!document.localization || normalizeLocale(document.localization.locale) !== normalizeLocale(locale)) throw new Error(`Kaydedilen varyant ${locale} dilinde değil.`);
  return document;
}

async function createPageLocaleVariant(locale: string, source: EditorDocument): Promise<EditorDocument> {
  const document = structuredClone(source);
  const pages = document.projectData.pages;
  const title = Array.isArray(pages) ? pages[0] : undefined;
  if (title && typeof title === 'object' && !Array.isArray(title) && typeof title.name === 'string') title.name = `${title.name} (${locale.toUpperCase()})`;
  delete document.documentId;
  document.revision = null;
  document.localization = { locale, pageGroupId: document.localization?.pageGroupId ?? `page.${crypto.randomUUID()}` };
  return document;
}

function openEditor(session: Omit<EditorSession, 'key'>): void {
  activeEditor.value = { ...session, key: nextSessionKey.value++ };
}

function closeEditor(): void {
  activeEditor.value = null;
  const address = new URL(window.location.href);
  address.searchParams.delete('document');
  window.history.replaceState(null, '', address);
  void refreshWorkspace();
}

function onCatalogSaved(event: { kind: 'block' | 'template' | 'shared-region'; ref: VersionRef }): void {
  const editor = activeEditor.value;
  if (event.kind === 'shared-region' && editor?.baseViewId && editor.regionKind) {
    const view = baseViews.value.find((item) => item.id === editor.baseViewId);
    if (view) {
      const updated = updateBaseViewRegion(localStorage, view, editor.regionKind, event.ref);
      baseViews.value = baseViews.value.map((item) => item.id === updated.id ? updated : item);
    }
  }
  void refreshWorkspace();
}

function renameDocumentPage(document: EditorDocument, title: string): void {
  const pages = document.projectData.pages;
  const first = Array.isArray(pages) ? pages[0] : null;
  if (first && !Array.isArray(first) && typeof first === 'object') first.name = title;
}

function slug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'yeni';
}

onMounted(async () => {
  resetLegacyScalanovaCache(localStorage);
  await refreshWorkspace();
  if (new URLSearchParams(window.location.search).get('view') === 'forms') screen.value = 'forms';
  const documentId = new URLSearchParams(window.location.search).get('document');
  if (documentId) {
    try {
      const document = await storageAdapter.load(documentId);
      const first = Array.isArray(document.projectData.pages) ? document.projectData.pages[0] : null;
      const title = first && !Array.isArray(first) && typeof first === 'object' && typeof first.name === 'string' ? first.name : 'Düzenlenen sayfa';
      openStoredDocument(document, title);
    } catch { /* A missing legacy query should leave the workspace home visible. */ }
  }
});
</script>

<template>
  <WorkspaceEditor
    v-if="activeEditor"
    :key="activeEditor.key"
    :stage="activeEditor.stage"
    :label="activeEditor.label"
    :initial-document="activeEditor.document"
    :existing-block-definition="activeEditor.existingBlockDefinition"
    :adapters="adapters"
    :localization="activeEditor.stage === 'page' ? localization : undefined"
    :localization-adapter="activeEditor.stage === 'page' ? localizationAdapter : undefined"
    :base-view-id="activeEditor.baseViewId"
    :base-view-name="activeEditor.baseViewName"
    :template-name="activeEditor.templateName"
    :existing-template-ref="activeEditor.existingTemplateRef"
    :region-kind="activeEditor.regionKind"
    :region-ref="activeEditor.regionRef"
    @back="closeEditor"
    @saved="refreshWorkspace"
    @catalog-saved="onCatalogSaved"
    :on-locale-change-requested="loadPageLocaleVariant"
    :on-create-locale-variant="createPageLocaleVariant"
  />
  <div v-else class="workspace-shell">
    <header class="workspace-header">
      <a class="workspace-brand" href="#home" @click.prevent="setScreen('overview')"><span class="workspace-brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>BlockDesign</b></a>
      <div class="workspace-header-right"><span class="backend-status" :class="apiAvailable ? 'is-connected' : 'is-local'"><i></i>{{ apiAvailable ? 'API bağlı' : 'Yerel çalışma alanı' }}</span><button type="button" class="quiet-button" :disabled="importingTr" @click="importTr">{{importingTr?importProgress:'TR içeriğini aktar'}}</button><button type="button" class="quiet-button" @click="refreshWorkspace">Katalogları yenile</button></div>
    </header>
    <div class="workspace-layout">
      <aside class="workspace-sidebar" aria-label="Çalışma alanı">
        <p class="sidebar-caption">PROJE</p>
        <nav>
          <button :class="{ active: screen === 'overview' }" @click="setScreen('overview')">Genel bakış</button>
          <p class="sidebar-caption sidebar-group-label">SİTE YAPISI</p>
          <button :class="{ active: screen === 'base-views' }" @click="setScreen('base-views')">Temel görünümler <span>{{ baseViews.length }}</span></button>
          <button :class="{ active: screen === 'templates' }" @click="setScreen('templates')">Şablonlar <span>{{ activeTemplates.length }}</span></button>
          <button :class="{ active: screen === 'pages' }" @click="setScreen('pages')">Sayfalar <span>{{ pages.length }}</span></button>
          <p class="sidebar-caption sidebar-group-label">KÜTÜPHANE</p>
          <button :class="{ active: screen === 'blocks' }" @click="setScreen('blocks')">Bloklar <span>{{ blocks.length }}</span></button>
          <button :class="{ active: screen === 'forms' }" @click="setScreen('forms')">Form örnekleri</button>
        </nav>
        <div class="sidebar-note"><b>Kurulum sırası</b><p>Önce temel görünümü, sonra sayfa şablonunu, en son içeriği oluştur.</p></div>
      </aside>

      <main class="workspace-main">
        <div v-if="catalogError" class="workspace-alert" role="status">{{ catalogError }}</div>
        <div v-if="savedMessage" class="workspace-success" role="status">{{ savedMessage }}</div>
        <div v-if="loading" class="workspace-loading">Çalışma alanı yükleniyor…</div>

        <template v-else-if="screen === 'overview'">
          <section class="workspace-intro">
            <h1>Site yapısı</h1>
            <p class="intro-copy">Görünümü kur, tekrar kullanılabilir şablonları hazırla ve sayfaları kendi içerikleriyle yönet.</p>
          </section>
          <ol class="workflow-strip" aria-label="Site oluşturma sırası">
            <li><span>1</span><div><b>Temel görünüm</b><small>Header ve footer sürümleri</small><button @click="setScreen('base-views')">Görünümleri aç</button></div></li>
            <li><span>2</span><div><b>Sayfa şablonu</b><small>Görünüm üstüne blok yerleşimi</small><button @click="setScreen('templates')">Şablonları aç</button></div></li>
            <li><span>3</span><div><b>Sayfa</b><small>Şablondan bağımsız içerik</small><button @click="setScreen('pages')">Sayfaları aç</button></div></li>
          </ol>
          <section class="overview-lower">
            <div><div class="section-heading"><h2>Son sayfalar</h2><button class="text-action" @click="setScreen('pages')">Tüm sayfalar</button></div>
              <p v-if="!pages.length" class="empty-copy">Henüz sayfa oluşturulmadı. Sayfalar bölümünden bir şablon seçerek başlayabilirsin.</p>
              <button v-for="page in pages.slice(0, 4)" :key="page.document.documentId" class="compact-page-row" @click="openSavedPage(page)"><span><b>{{ page.title }}</b><small>{{ pageTemplateName(page) }}</small></span><span>Sayfayı aç</span></button>
            </div>
            <div class="overview-counts"><p><span>Temel görünümler</span><b>{{ baseViews.length }}</b></p><p><span>Kullanılabilir şablon</span><b>{{ activeTemplates.length }}</b></p><p><span>Kayıtlı blok</span><b>{{ blockCount }}</b></p></div>
          </section>
        </template>

        <template v-else-if="screen === 'base-views'">
          <section class="screen-heading"><div><h1>Temel görünümler</h1><p>Header ve footer tasarımlarını ayrı ayrı düzenle. Her kaydetme yeni, sürümlü bir bölge oluşturur.</p></div></section>
          <form class="create-line" @submit.prevent="createBaseView"><label><span>Görünüm adı</span><input v-model="newBaseView.name" placeholder="Örn. Kurumsal görünüm" required /></label><label><span>Başlangıç görünümü</span><select v-model="newBaseView.copyFromId"><option v-for="view in baseViews" :key="view.id" :value="view.id">{{ view.name }}</option></select></label><button class="solid-button" type="submit">Temel görünüm oluştur</button></form>
          <div class="list-heading"><span>GÖRÜNÜM</span><span>HEADER</span><span>FOOTER</span><span>İŞLEMLER</span></div>
          <article v-for="view in baseViews" :key="view.id" class="catalog-row base-view-row">
            <div class="catalog-primary"><b>{{ view.name }}</b><small>{{ view.id }}</small></div>
            <div class="region-version"><span>{{ regionByRef(view.headerRef)?.name ?? 'Header' }}</span><small>v{{ view.headerRef.version }}</small></div>
            <div class="region-version"><span>{{ regionByRef(view.footerRef)?.name ?? 'Footer' }}</span><small>v{{ view.footerRef.version }}</small></div>
            <div class="row-actions"><button @click="openBaseViewRegion(view, 'header')">Header düzenle</button><button @click="openBaseViewRegion(view, 'footer')">Footer düzenle</button></div>
          </article>
        </template>

        <template v-else-if="screen === 'templates'">
          <section class="screen-heading"><div><h1>Sayfa şablonları</h1><p>Temel görünümü seç, içerik alanına blok ve statik HTML yerleştir. Bu şablon daha sonra birden fazla sayfada başlangıç noktası olur.</p></div></section>
          <form class="create-line template-create-line" @submit.prevent="createTemplate"><label><span>Şablon adı</span><input v-model="newTemplate.name" placeholder="Örn. Ana sayfa" required /></label><label><span>Temel görünüm</span><select v-model="newTemplate.baseViewId"><option v-for="view in baseViews" :key="view.id" :value="view.id">{{ view.name }}</option></select></label><button class="solid-button" type="submit">Şablon tasarla</button></form>
          <div class="list-heading template-list-heading"><span>ŞABLON</span><span>TEMEL GÖRÜNÜM</span><span>SÜRÜM</span><span>İŞLEMLER</span></div>
          <article v-for="template in templates" :key="refKey(template.ref)" class="catalog-row template-row" :class="{ archived: template.archived }">
            <div class="catalog-primary"><b>{{ template.name }}</b><small>{{ template.description }}</small></div>
            <div class="region-version">{{ baseViews.find((view) => view.id === template.baseViewId)?.name ?? (template.baseViewId ? 'Temel görünüm' : 'Varsayılan') }}</div>
            <div class="region-version"><span>v{{ template.ref.version }}</span><small>{{ template.archived ? 'Arşivli' : 'Kullanılabilir' }}</small></div>
            <div class="row-actions"><button :disabled="template.archived" @click="editTemplate(template)">Şablonu düzenle</button><button :disabled="template.archived" @click="newPage.templateRef = refKey(template.ref); newPage.name = ''; setScreen('pages')">Bu şablondan sayfa</button></div>
          </article>
        </template>

        <template v-else-if="screen === 'pages'">
          <section class="screen-heading"><div><h1>Sayfalar</h1><p>Her sayfa seçilen şablonun bağımsız kopyasıdır. Bir sayfadaki içerik değişikliği diğer sayfalara taşınmaz.</p></div></section>
          <form class="create-line page-create-line" @submit.prevent="createPage"><label><span>Sayfa adı</span><input v-model="newPage.name" placeholder="Örn. Hakkımızda" required /></label><label><span>Başlangıç şablonu</span><select v-model="newPage.templateRef" required><option v-for="template in activeTemplates" :key="refKey(template.ref)" :value="refKey(template.ref)">{{ template.name }} · v{{ template.ref.version }}</option></select></label><button class="solid-button" type="submit" :disabled="!activeTemplates.length">Sayfa oluştur</button></form>
          <div class="list-heading page-list-heading"><span>SAYFA</span><span>ŞABLON</span><span>SÜRÜM</span><span>İŞLEMLER</span></div>
          <p v-if="!pages.length" class="empty-copy page-empty">Henüz kayıtlı sayfa yok. Sayfa adını ve başlangıç şablonunu seçerek ilk sayfanı oluştur.</p>
          <article v-for="page in pages" :key="page.document.documentId" class="catalog-row page-row">
            <div class="catalog-primary"><b>{{ page.title }}</b><small>{{ typeof page.document.editorState.workspaceImportedFrom === 'string' ? page.document.editorState.workspaceImportedFrom : page.document.documentId }}</small></div>
            <div class="region-version">{{ pageTemplateName(page) }}</div>
            <div class="region-version"><span>rev {{ page.document.revision ?? '—' }}</span></div>
            <div class="row-actions"><button @click="openSavedPage(page)">Sayfayı düzenle</button></div>
          </article>
        </template>

        <FormExamples v-else-if="screen === 'forms'" @open-page="openFormExample" />

        <template v-else>
          <section class="screen-heading"><div><h1>Blok kütüphanesi</h1><p>Bloklar tekrar kullanılabilir içerik parçalarıdır. Bir kez tasarla, şablon ve sayfalarda ihtiyacın oldukça kullan.</p></div><button class="solid-button" @click="createBlock">Yeni blok tasarla</button></section>
          <label class="catalog-search"><span>Bloklarda ara</span><input v-model="query" type="search" placeholder="Blok adı veya kategori" /></label>
          <label class="catalog-search"><span>Kategori</span><select v-model="category"><option value="">Tüm kategoriler ({{ blocks.length }})</option><option v-for="item in blockCategories" :key="item" :value="item">{{ item }} ({{ blocks.filter(block => block.category === item).length }})</option></select></label>
          <div class="list-heading block-list-heading"><span>BLOK</span><span>KATEGORİ</span><span>SÜRÜM</span><span>ALANLAR</span><span>İŞLEMLER</span></div>
          <article v-for="block in filteredBlocks" :key="refKey(block.ref)" class="catalog-row block-row">
            <div class="catalog-primary"><b>{{ block.name }}</b><small>{{ block.description }}</small></div>
            <div class="region-version">{{ block.category }}</div>
            <div class="region-version">v{{ block.ref.version }}</div>
            <div class="region-version">{{ block.fields.length }} alan · {{ block.repeaters.length }} liste{{ block.archived ? ' · Arşivli' : '' }}</div>
            <div class="row-actions"><button type="button" :aria-label="`${block.name} bloğunu düzenle`" @click="editBlock(block)">Bloğu düzenle</button></div>
          </article>
          <p v-if="!filteredBlocks.length" class="empty-copy">Aramayla eşleşen blok bulunamadı.</p>
        </template>
      </main>
    </div>
  </div>
</template>
