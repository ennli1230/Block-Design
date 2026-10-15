<script setup lang="ts">
import type { Component } from 'grapesjs';
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue';
import type { BlockDefinitionVersion, BlockInstance, BlockLibraryAdapter, ContentLocaleContext, ContentProviderAdapter, ContentRecordGroup, DesignSystemAdapter, DesignSystemAssetManifest, EditorChangeEvent, EditorDocument, EditorMode, FieldDefinition, JsonValue, PageLocaleVariant, PageTemplateDefinition, ProviderCollection, RepeaterDefinition, SaveResult, SharedRegionDefinition, SharedRegionAdapter, SourceBinding, StorageAdapter, TemplateAdapter, VersionRef } from '@blockdesign/contracts';
import { DOCUMENT_VERSION, composableDefinitions, EDITABLE_STYLE_PROPERTIES, safeStyleValue, validateRepeaterRows, applySharedRegions, createEmptyDocument, createPageFromTemplate, createTemplateFromDocument, defaultPageTemplate, defaultSharedRegions, makeId, makeInstance, migrateDocumentLocalization, migrateSharedRegionValues, missingMandatoryBlockIds, resolveDocumentSources, setFieldValue, templateAllowsCategory, updateRepeater as updateRepeaterModel, validateDocument, validateFieldValue, documentLocaleContext, normalizeLocale, validLocale } from '@blockdesign/core';
import { createSampleDocument } from '@blockdesign/core/sample';
import { DocumentHistory } from '@blockdesign/core/history';
import { demoDefinitions } from '@blockdesign/core/catalog';
import { HttpDesignSystemAdapter, HttpSharedRegionAdapter, HttpTemplateAdapter, DemoContentProvider, DemoContentProviderFallback, DemoDesignSystemAdapter, DemoSharedRegionAdapter, DemoTemplateAdapter, HttpAssetAdapter, HttpBlockLibraryAdapter, HttpContentProviderAdapter, HttpStorageAdapter, LocalStorageAdapter, LocalStorageBlockLibraryAdapter, LocalStorageDesignSystemAdapter, LocalStorageSharedRegionAdapter, LocalStorageTemplateAdapter, AdapterRequestError } from '@blockdesign/adapters';
import { analyzeHtmlImport, behaviorExportDependencies, BASE_CANVAS_CSS, canvasCssForDesignSystem, createGrapesCanvas, renderBlockMarkup, validateCommonCss, type CanvasBridge, type CanvasSelection, type HtmlImportAnalysis, type PreviewBehaviorPlugin } from '@blockdesign/grapesjs-bridge';
import type { MountEditorOptions, PreviewExport } from './types';
import { resolvePreviewDocument } from './preview-document.ts';
import { createSourcePreviewResolver, effectiveSourceBinding, mergeSourcePreview } from './source-preview';
import { blockSettingsVersion } from './block-settings';
import { loadLibraryDefinitions, matchingLibraryDefinitions } from './block-library';
import Icon from './Icon.vue';
import FieldEditor from './FieldEditor.vue';
import AuthoringInspector from './AuthoringInspector.vue';
import BehaviorDesigner from './BehaviorDesigner.vue';
import RepeaterEditor from './RepeaterEditor.vue';
import NodeStyleEditor from './NodeStyleEditor.vue';
import SourceConfigEditor from './SourceConfigEditor.vue';
import CmsFormInspector from './CmsFormInspector.vue';
import { createCmsFormDefinition, CMS_FORM_ID, validateFormBinding } from '@blockdesign/core';
import { createCmsFormBehavior, prepareCmsFormExport } from './cms-forms';
import { packageExportAssets } from './export-assets';
import { resolveUiText, uiTextInjectionKey } from './ui-i18n';
import { createLocaleSeoLinks } from './localization-seo';
import { createCollectionBehavior, collectionExport } from './collections';
import { assessPublication } from './publication';
import { createPageHead } from './page-metadata';
import PageMetadataEditor from './PageMetadataEditor.vue';
import { collectExtensions } from './extensions';

type ComponentModelView = {
  get: (property: string) => unknown;
  getAttributes: () => Record<string, unknown>;
  setAttributes: (attributes: Record<string, unknown>) => void;
  getStyle: () => Record<string, unknown>;
  components: () => { models: ComponentModelView[] };
};

const props = defineProps<{ options: MountEditorOptions }>();
const extensionRegistry=collectExtensions(props.options.extensions??[]);
provide('blockdesign:field-editors',extensionRegistry.fieldEditors);
const panelIdPrefix = `bd-${makeId('panel')}`;
const libraryPanelId = `${panelIdPrefix}-library`;
const inspectorPanelId = `${panelIdPrefix}-inspector`;
const emit = defineEmits<{ runtime: [runtime: {
  getDocument: () => EditorDocument;
  loadDocument: (document: EditorDocument) => Promise<EditorDocument>;
  save: () => Promise<SaveResult>;
  setMode: (mode: EditorMode) => void;
  setPreview: (active: boolean) => Promise<void>;
  exportStatic: () => Promise<PreviewExport>;
}]; failure: [error: Error] }>();

const host = ref<HTMLElement | null>(null);
const blockRoot = ref<HTMLElement | null>(null);

const bridge = shallowRef<CanvasBridge | null>(null);
const recoverableDraft=shallowRef<EditorDocument|null>(null);
const pageMetadata=computed<Record<string,JsonValue>>(()=>{const value=doc.value.editorState.seo;return value&&typeof value==='object'&&!Array.isArray(value)?value:{};});
function updatePageMetadata(value:Record<string,JsonValue>){history.push(doc.value,'page.metadata');doc.value={...doc.value,editorState:{...doc.value.editorState,seo:value}};generation.value++;savedState.value='dirty';emitChange('page.metadata');}
async function openHostPreview(){try{await props.options.preview?.open(snapshotDocument(),sourceRequestContext(null));}catch(error){errorMessage.value=normalizeError(error).message;}}
let autosaveTimer:ReturnType<typeof setTimeout>|undefined;
let editorStarted=false;
let documentEpoch=0;
function recoverDraft(){const draft=recoverableDraft.value;if(!draft)return;recoverableDraft.value=null;void loadDocument({...draft,revision:doc.value.revision}).then(()=>{savedState.value='dirty';generation.value++;});}
function discardDraft(){recoverableDraft.value=null;if(props.options.recovery)try{localStorage.removeItem(props.options.recovery.key);}catch{/* storage can be unavailable */}}
const library: BlockLibraryAdapter = props.options.blockLibraryAdapter ?? (props.options.http?.baseUrl ? new HttpBlockLibraryAdapter(props.options.http) : new LocalStorageBlockLibraryAdapter());
const storage: StorageAdapter = props.options.storageAdapter ?? (props.options.http?.baseUrl
  ? new HttpStorageAdapter(props.options.http)
  : props.options.appearance === 'embedded' ? { capabilities:{supported:[]},load:async()=>{throw new Error('Host belge yükleme adapter’ı sağlamadı.');},save:async()=>{throw new Error('Host saklama adapter’ı sağlamadı.');} } : new LocalStorageAdapter());
const contentProviders: ContentProviderAdapter[] = props.options.contentProviders ?? [props.options.http?.baseUrl
  ? (props.options.appearance === 'embedded' ? new HttpContentProviderAdapter(props.options.http) : new DemoContentProviderFallback(new HttpContentProviderAdapter(props.options.http)))
  : new DemoContentProvider()];
if(props.options.appearance === 'embedded' && !props.options.contentProviders && !props.options.http?.baseUrl) contentProviders.splice(0);
const editorBehaviors: PreviewBehaviorPlugin[] = [...extensionRegistry.behaviors,...(props.options.behaviorPlugins ?? []),createCmsFormBehavior({...(props.options.forms ?? {providers:[]}),contentProviders,getContext:()=>sourceRequestContext(null)}),createCollectionBehavior(contentProviders,()=>sourceRequestContext(null))];
const assetAdapter = props.options.assetAdapter ?? (props.options.http?.baseUrl ? new HttpAssetAdapter(props.options.http) : undefined);
const templateAdapter: TemplateAdapter = props.options.templateAdapter ?? (props.options.http?.baseUrl
  ? (props.options.appearance === 'embedded' ? new HttpTemplateAdapter(props.options.http) : new DemoTemplateAdapter({ ...props.options.http, initial: [defaultPageTemplate] }))
  : props.options.appearance === 'embedded' ? {capabilities:{supported:['list']},list:async()=>({items:[],nextCursor:null}),getVersion:async()=>{throw new Error('Host şablon adapter’ı sağlamadı.');}} : new LocalStorageTemplateAdapter(undefined, [defaultPageTemplate]));
const sharedRegionAdapter: SharedRegionAdapter = props.options.sharedRegionAdapter ?? (props.options.http?.baseUrl
  ? (props.options.appearance === 'embedded' ? new HttpSharedRegionAdapter(props.options.http) : new DemoSharedRegionAdapter({ ...props.options.http, initial: defaultSharedRegions }))
  : props.options.appearance === 'embedded' ? {capabilities:{supported:['list']},list:async()=>({items:[],nextCursor:null}),getVersion:async()=>{throw new Error('Host bölge adapter’ı sağlamadı.');}} : new LocalStorageSharedRegionAdapter(undefined, defaultSharedRegions));
const designSystemAdapter: DesignSystemAdapter = props.options.designSystemAdapter ?? (props.options.http?.baseUrl
  ? (props.options.appearance === 'embedded' ? new HttpDesignSystemAdapter(props.options.http) : new DemoDesignSystemAdapter(props.options.http))
  : props.options.appearance === 'embedded' ? {capabilities:{supported:['readManifest']},load:async(ref:VersionRef)=>({ref,name:ref.id,commonCss:'',stylesheets:[],revision:null}),save:async()=>{throw new Error('Host tasarım varlığı adapter’ı sağlamadı.');}} : new LocalStorageDesignSystemAdapter());
const initialDesignSystemRef = props.options.initialDocument?.designSystemRef ?? defaultPageTemplate.designSystemRef;
const designSystemManifest = shallowRef<DesignSystemAssetManifest>({ ref: structuredClone(initialDesignSystemRef), name: initialDesignSystemRef.id, commonCss: '', stylesheets: [], revision: null });
const commonCssDraft = ref('');
const stylesheetDraft = ref('');
const designAssetsSaving = ref(false);
const templates = shallowRef<PageTemplateDefinition[]>([structuredClone(defaultPageTemplate)]);
const sharedRegions = shallowRef<SharedRegionDefinition[]>(structuredClone(defaultSharedRegions));
const sharedRegionDraft = shallowRef<SharedRegionDefinition | null>(null);
const sharedRegionStructureEditable = ref(false);
const templateName = ref('');
const workspaceTemplateRef = shallowRef<VersionRef | null>(props.options.workspaceExistingTemplateRef ? structuredClone(props.options.workspaceExistingTemplateRef) : null);
const templateAllowedCategories = ref<string[]>([]);
const templateMandatoryBlockIds = ref<string[]>([]);
const templateChoice = ref(defaultPageTemplate.ref.id + '@' + defaultPageTemplate.ref.version);
const headerRegionChoice = ref('region.studio-header@1.0.0');
const footerRegionChoice = ref('region.studio-footer@1.0.0');
const providerCollections = shallowRef<Array<{ provider: ContentProviderAdapter; collection: ProviderCollection }>>([]);
const sourceSearch = ref<Record<string, string>>({});
const sourceRecords = shallowRef<Record<string, Array<{ recordId: string; title: string; body: string }>>>({});
const sourceGroups = shallowRef<Record<string, ContentRecordGroup[]>>({});
const sourceBusy = ref<Record<string, boolean>>({});
const sourceErrors = ref<Record<string, string>>({});
const sourceQueryLimit = ref<Record<string, number>>({});
const sourceFilterField = ref<Record<string, string>>({});
const sourceFilterValue = ref<Record<string, string>>({});
const availableDefinitions = shallowRef<BlockDefinitionVersion[]>(structuredClone([...demoDefinitions,...extensionRegistry.blocks]));
const storedDefinitionRefs = shallowRef<Set<string>>(new Set());
const doc = shallowRef<EditorDocument>((() => {
  const defaultLocale = props.options.localization?.defaultLocale ?? props.options.language ?? 'tr';
  if (props.options.initialDocument) return migrateDocumentLocalization(props.options.initialDocument, defaultLocale);
  return { ...createEmptyDocument(), localization: { locale: normalizeLocale(defaultLocale) } };
})());
const history = new DocumentHistory();
const selection = ref<CanvasSelection>({ blockId: null, definitionRef: null, nodeId: null, itemId: null, repeaterId: null, label: 'Tuval' });
const sidebarMode = ref<'blocks' | 'layers'>('blocks');
const mobilePanel = ref<'library' | 'inspector' | null>(null);
const inspectorTab = ref<'content' | 'styles' | 'settings'>('content');
const blockNameDraft = ref('');
const blockSettingsSaving = ref(false);
const sourcePreviewBlocks = shallowRef<Record<string, BlockInstance>>({});
const sourcePreviewErrors = ref<Record<string, string>>({});
const sourcePreviewBusy = ref<Record<string, boolean>>({});
const canvasProjectionRevision = ref(0);
const sourcePreviewResolver = createSourcePreviewResolver();
let regionPreviewSequence = 0;
const configuredLocalization = computed(() => props.options.localization);
const uiLocale = computed(() => configuredLocalization.value?.uiLocale ?? configuredLocalization.value?.defaultLocale ?? 'tr');
const uiDirection = computed(() => configuredLocalization.value?.locales.find(item => normalizeLocale(item.code) === normalizeLocale(uiLocale.value))?.direction ?? 'ltr');
const uiText = (source: string): string => resolveUiText(source, uiLocale.value, (key, locale) => props.options.localization?.translate?.(key, locale));
const selectionDisplayLabel = computed(() => selection.value.label === 'Tuval' ? uiText('Tuval') : selection.value.label);
const contentLocale = computed(() => doc.value.localization?.locale ?? props.options.localization?.defaultLocale ?? props.options.language ?? 'tr');
const contentLocaleContext = computed(() => documentLocaleContext(doc.value, props.options.localization?.defaultLocale ?? props.options.language ?? 'tr', props.options.localization?.fallback ?? { mode: 'none' }));
const sourceLocaleDefaults = computed(() => ({ defaultLocale: props.options.localization?.defaultLocale ?? props.options.language ?? 'tr', fallback: props.options.localization?.fallback ?? { mode: 'none' } as const, requireProviderLocaleDeclaration: (props.options.localization?.locales.length ?? 0) > 1, context: props.options.requestContext?.() }));
const pageLocaleVariants = shallowRef<PageLocaleVariant[]>([]);
let pageLocaleRequest = 0;
const localeSwitchBusy = ref(false);
const localeSwitchIssue = ref('');
const pendingLocaleChoice = ref<{ locale: string; variant: PageLocaleVariant | null } | null>(null);
const localeVariantCreating = ref(false);
let sourcePreviewTimer: ReturnType<typeof setTimeout> | undefined;
const defaultUiEnglish: Record<string, string> = {
  'editor.contentLanguage': 'Content language', 'editor.preview': 'Preview', 'editor.returnToEditing': 'Back to editing',
  'editor.save': 'Save', 'editor.saving': 'Saving…', 'editor.undo': 'Undo', 'editor.redo': 'Redo',
  'editor.designBlocks': 'Design blocks', 'editor.editContent': 'Edit content', 'editor.blocks': 'Blocks',
  'editor.layers': 'Layers', 'editor.searchBlocks': 'Search blocks', 'locale.saveAndSwitch': 'Save and switch',
  'locale.creatingVariant': 'Creating page variant…', 'locale.opening': 'Opening…',
  'editor.librarySearchCount': '{count} results', 'editor.libraryComponentCount': '{count} components',
  'editor.embeddedLibrary': 'Component library', 'editor.apiConnected': 'Go API connected',
  'editor.browserDraft': 'Browser draft', 'editor.sampleCatalog': 'Sample catalog',
  'editor.devicePreview': '{device} preview', 'editor.designLocks': 'Design controls active',
  'editor.contentLocks': 'Structure locked · content fields editable',
  'editor.desktop': 'Desktop', 'editor.tablet': 'Tablet', 'editor.phone': 'Phone',
  'editor.saveBlockName': 'Save block name', 'editor.saveBlockVersion': 'Save new block version',
  'editor.lockStructure': 'Lock structure', 'editor.editStructure': 'Edit structure',
  'editor.headerRegion': 'Header region', 'editor.footerRegion': 'Footer region',
  'editor.catalogSaveBlock': 'Save block to catalog', 'editor.saveTemplate': 'Save template',
  'editor.saveTemplateVersion': 'Save new template version', 'editor.saveDesignAssets': 'Save assets',
  'editor.archivedCurrentPage': ' · archived, current page', 'editor.upgrade': 'Upgrade to v{version}',
  'repeater.created': '{name} created: {items} items, {fields} fields.',
  'repeater.containerCount': 'The container has {count} items. Check the item limits in advanced settings.',
  'locale.discardAndSwitch': 'Switch without saving', 'locale.stay': 'Stay here', 'locale.switchTitle': 'Change page language?',
  'locale.switchBody': 'The open page has unsaved changes. Choose what to do before opening the other language.',
  'source.dataSource': 'Data source', 'source.target': 'Field / list', 'source.collection': 'Source collection',
  'source.manualContent': 'Manual content', 'source.advancedLocale': 'Advanced language settings', 'source.locale': 'Source language',
  'source.inheritLocale': 'Use page language ({locale})', 'source.localeHelp': 'This source resolves only in the selected language. Other blocks keep following the page language.',
  'source.localeUnsupported': 'This collection does not declare translation support for {locale}.', 'source.selectionMode': 'Data selection',
  'source.useManualDraft': 'Use manual draft', 'source.selectRecords': 'Select records / menu', 'source.query': 'Automatic query',
  'source.search': 'Search source', 'source.loading': 'Loading…', 'source.loadRecords': 'Load records', 'source.recordGroup': 'Record group',
  'source.noGroup': 'No group', 'source.selectedRecords': '{count} records selected. List order follows selection order.',
  'source.recordLimit': 'Record limit', 'source.sortField': 'Sort field', 'source.sourceOrder': 'Source order',
  'source.sortDirection': 'Sort direction', 'source.ascending': 'Ascending', 'source.descending': 'Descending',
  'source.filterField': 'Filter field', 'source.chooseFilter': 'Choose a filter', 'source.filterValue': 'Filter value',
  'source.applyFilter': 'Apply filter', 'source.notMapped': 'Not mapped',
  'locale.noLoader': 'To open the “{locale}” page, the host app must provide a page loader or document ID.',
  'locale.noVariant': 'No translated page is connected for “{locale}”.',
  'locale.loadFailed': 'The “{locale}” page could not be loaded.',
  'locale.opened': '{locale} opened.',
  'block.versionSaved': '“{name}” · v{version} saved.',
  'template.applied': 'Page template “{name}” applied.',
  'template.saved': 'Template “{name}” saved.',
  'region.draftOpened': 'A new version draft for “{name}” is open. Edit its structure or map an element to a field.',
  'region.fieldAdded': 'Field “{name}” added to the region draft.',
  'region.versionSaved': '“{name}” v{version} saved to the catalog. Pages keep their existing versions.',
  'region.archived': '“{name}” v{version} archived. Pages using this version can still open.',
  'block.newVersion': 'New block version v{version} created. Pages were not changed.',
  'block.upgraded': 'Block instance moved to version v{version}.',
  'block.upgradedWithRecovery': 'Block instance moved to version v{version}. Incompatible data and mappings were saved in the document recovery record.',
  'block.catalogSaved': '“{name}” saved to the block catalog.',
  'page.templateCopy': 'This page is an independent copy of the “{name}” template. Changes to its blocks and fields do not affect other pages.',
  'template.regionCount': '{count} versioned region references connected',
  'template.regionCountStatus': '{count} versioned region references connected · {status}',
  'template.catalogSupported': 'catalog available',
  'template.catalogReadOnly': 'read-only catalog',
  'template.newVersionFor': '{name} · v{version} new version',
  'template.appliesToNew': 'Applies to new templates',
  'template.draftVersionFor': '{name} · v{version} draft',
  'template.newVersionDraft': 'Applies to the new template version',
  'workspace.regionDesign': 'Edit the {region} design for “{name}” as a version.',
  'import.candidates': '{count} block candidates · CSS and content are previewed in an isolated iframe',
  'definition.upgrade': 'Upgrade to v{version}',
  'assets.loadFailed': 'Design system assets could not be loaded: {message}',
  'assets.saveFailed': 'Design system assets could not be saved: {message}',
  'template.categoryNotAllowed': 'Category “{category}” is not allowed by the page template.',
  'import.readFailed': 'File could not be read: {message}',
  'import.noCandidates': 'No importable section or article was found.',
  'import.analysisFailed': 'Import could not be analyzed: {message}',
  'import.blockFailed': 'Block draft could not be created: {message}',
  'block.draftOpened': 'Block draft “{name}” opened. Update its design and field mappings.',
  'repeater.added': 'Repeater “{name}” added to the block.',
  'page.savedRevision': 'Saved · revision {revision}',
  'export.downloadedWithNotes': 'HTML downloaded · {count} export notes.',
  'export.downloaded': 'Static HTML downloaded with accessible media and stylesheets included.',
  'preview.failed': 'Preview could not be prepared.',
  'field.typeImage': 'Select an img element for an image field.',
  'field.typeVideo': 'Select a video element for a video field.',
};
const t = (key: string, fallback: string, values?: Record<string, string | number>): string => {
  const message = props.options.localization?.translate?.(key, uiLocale.value, values) ?? (uiLocale.value.toLowerCase().startsWith('en') ? defaultUiEnglish[key] ?? uiText(fallback) : fallback);
  return values ? message.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match)) : message;
};
provide('blockdesign:translate', t);
provide(uiTextInjectionKey, uiText);
const blockSearch = ref('');
const matchingBlocks = computed(() => matchingLibraryDefinitions(availableDefinitions.value, blockSearch.value));
const mode = ref<EditorMode>(props.options.permissions?.design === false ? 'content' : props.options.mode ?? 'content');
const previewing = ref(false);
const previewSourceIssue = ref<string | null>(null);
const device = ref<'desktop' | 'tablet' | 'mobile'>('desktop');
const savedState = ref<'dirty' | 'saving' | 'saved' | 'error' | 'conflict'>('dirty');
const backendAvailable = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const exportReport = ref<PreviewExport['issues'] | null>(null);
const generation = ref(0);
const lastSavedGeneration = ref(0);
const revisions=ref<Array<{revision:string;savedAt:string}>>([]),historyCursor=ref<string|null>(null),historyBusy=ref(false),historyOpen=ref(false);
const revisionPreview=shallowRef<EditorDocument|null>(null);
async function loadRevisions(more=false){if(!storage.listRevisions||!doc.value.documentId)return;historyBusy.value=true;historyOpen.value=true;try{const page=await storage.listRevisions(doc.value.documentId,{...sourceRequestContext(null),...(more&&historyCursor.value?{cursor:historyCursor.value}:{})});revisions.value=more?[...revisions.value,...page.items]:page.items;historyCursor.value=page.nextCursor;}catch(error){errorMessage.value=normalizeError(error).message;}finally{historyBusy.value=false;}}
async function previewRevision(revision:string){if(!storage.loadRevision||!doc.value.documentId)return;try{revisionPreview.value=await storage.loadRevision(doc.value.documentId,revision,sourceRequestContext(null));}catch(error){errorMessage.value=normalizeError(error).message;}}
async function restoreRevision(){const old=revisionPreview.value;if(!old||props.options.permissions?.save===false)return;await loadDocument({...old,documentId:doc.value.documentId!,revision:doc.value.revision});generation.value++;savedState.value='dirty';revisionPreview.value=null;historyOpen.value=false;}
watch([generation,savedState],()=>{
  if(autosaveTimer)clearTimeout(autosaveTimer);
  if(!editorStarted||savedState.value!=='dirty')return;
  if(props.options.recovery)try{localStorage.setItem(props.options.recovery.key,JSON.stringify(snapshotDocument()));}catch{/* Saving to the CMS must still work when browser storage is unavailable. */}
  if(props.options.autosave&&props.options.permissions?.save!==false&&!customBlockDraft.value&&!sharedRegionDraft.value)autosaveTimer=setTimeout(()=>{if(editorStarted&&savedState.value==='dirty')void saveDocument().catch(()=>undefined);},Math.max(300,props.options.autosave.debounceMs??1500));
},{flush:'post'});
const pendingMapping = ref(false);
const importOpen = ref(false);
const importDialog = ref<HTMLDialogElement | null>(null);
const importHtml = ref('');
const importCss = ref('');
const importBaseUrl = ref('');
const importAnalysis = shallowRef<HtmlImportAnalysis | null>(null);
const selectedImportId = ref('');
const importError = ref('');
const mappingDraft = ref({ label: '', key: '', type: 'text' as FieldDefinition['type'], required: false, options: '' });
const customBlockDraft = shallowRef<{
  rootNodeId: string;
  componentTemplate: JsonValue;
  name: string;
  description: string;
  category: string;
  fields: FieldDefinition[];
  repeaters: RepeaterDefinition[];
  defaultData: Record<string, JsonValue>;
  css: string;
  sourceBindings?: SourceBinding[];
  styleProperties?: string[];
  behavior?: BlockDefinitionVersion['behavior'];
  sourceDefinition?: BlockDefinitionVersion;
} | null>(null);
const customRepeaterDraft = shallowRef<{
  repeaterId: string;
  containerNodeId: string;
  itemNodeId: string | null;
  key: string;
  label: string;
  minItems: number;
  maxItems: number;
  itemFields: FieldDefinition[];
  defaultItemData: Record<string, JsonValue>;
} | null>(null);
const customDraftStyleProperties = computed(() => customBlockDraft.value?.styleProperties ?? ['color', 'background-color', 'background-image', 'font-size', 'font-weight', 'text-align', 'padding']);
function toggleCustomStyle(property: string, enabled: boolean): void {
  if (!customBlockDraft.value) return;
  const properties = new Set(customDraftStyleProperties.value);
  if (enabled) properties.add(property); else properties.delete(property);
  customBlockDraft.value = { ...customBlockDraft.value, styleProperties: [...properties] };
}
const resizeObserver = shallowRef<ResizeObserver | null>(null);
let disposed = false;
const sharedRegionValidationIssues = computed(() => doc.value.sharedRegionRefs.flatMap((ref) => {
  const region = sharedRegions.value.find((item) => definitionKey(item.ref) === definitionKey(ref));
  if (!region) return [{ code: 'SHARED_REGION_MISSING', message: `Paylaşılan bölge sürümü bulunamadı: ${definitionKey(ref)}.`, path: 'sharedRegionRefs', recoverable: true }];
  const values = doc.value.sharedRegionData?.[definitionKey(ref)] ?? {};
  return [...region.fields.flatMap((field) => validateFieldValue(field, values[field.key] ?? field.defaultValue, `sharedRegionData.${definitionKey(ref)}.${field.key}`)), ...(region.repeaters ?? []).flatMap(repeater => validateRepeaterRows(values[repeater.key] ?? region.defaultData?.[repeater.key] ?? [],repeater,validateFieldValue,`sharedRegionData.${definitionKey(ref)}.${repeater.key}`))];
}));
const validationIssues = computed(() => [...validateDocument(doc.value, definitionMap.value), ...sharedRegionValidationIssues.value]);
const adapterStatus = computed(() => storage.getStatus?.() ?? 'unknown');
const definitionMap = computed<Map<string, BlockDefinitionVersion>>(() => new Map(availableDefinitions.value.map((definition): [string, BlockDefinitionVersion] => [definitionKey(definition.ref), definition])));
const selectedBlock = computed(() => doc.value.blocks.find((item) => item.instanceId === selection.value.blockId) ?? null);
const selectedDefinition = computed(() => selectedBlock.value ? definitionMap.value.get(definitionKey(selectedBlock.value.definitionRef)) ?? null : null);
const displayedBlock = computed(() => selectedBlock.value && selectedDefinition.value ? mergeSourcePreview(selectedBlock.value, selectedDefinition.value, sourcePreviewBlocks.value[selectedBlock.value.instanceId]) : selectedBlock.value);
const canSaveBlockSettings = computed(() => mode.value === 'designer' && props.options.permissions?.catalogWrite !== false && Boolean(library.create) && library.capabilities.supported.includes('create'));
watch(() => selectedDefinition.value ? definitionKey(selectedDefinition.value.ref) : '', () => { blockNameDraft.value = selectedDefinition.value?.name ?? ''; });
watch(() => [bridge.value, previewing.value, contentLocale.value, JSON.stringify(doc.value.blocks), JSON.stringify(availableDefinitions.value.map(definition => definition.ref))], () => {
  if (sourcePreviewTimer) clearTimeout(sourcePreviewTimer);
  for (const block of doc.value.blocks) sourcePreviewResolver.invalidate(block.instanceId);
  if (!bridge.value || previewing.value || disposed) return;
  sourcePreviewTimer = setTimeout(() => { void refreshSourcePreviews(); }, 120);
}, { immediate: true });
watch(() => [bridge.value, previewing.value, contentLocale.value, JSON.stringify(doc.value.sharedRegionRefs), JSON.stringify(doc.value.sharedRegionData), JSON.stringify(sharedRegions.value), Boolean(sharedRegionDraft.value)], () => {
  const sequence = ++regionPreviewSequence;
  const canvas = bridge.value;
  if (!canvas || previewing.value || disposed || sharedRegionDraft.value) return;
  const input = structuredClone(doc.value);
  const active = sharedRegions.value.filter(region => input.sharedRegionRefs.some(ref => definitionKey(ref) === definitionKey(region.ref)));
  if (!active.some(region => region.sourceBindings?.some(binding => binding.mode !== 'manual'))) return;
  void resolveDocumentSources({...input,blocks:[]}, new Map(), contentProviders, active, sourceLocaleDefaults.value).then(result => {
    if (disposed || sequence !== regionPreviewSequence || bridge.value !== canvas || previewing.value || sharedRegionDraft.value) return;
    const issue = result.issues.find(issue => issue.severity !== 'warning');
    if (issue) { errorMessage.value = issue.message; return; }
    for (const region of active) canvas.syncSharedRegion(region, result.document.sharedRegionData?.[definitionKey(region.ref)] ?? {});
  }).catch(error => { if (!disposed && sequence === regionPreviewSequence) errorMessage.value = normalizeError(error).message; });
}, { immediate: true });
watch(() => `${doc.value.localization?.pageGroupId ?? ''}|${contentLocale.value}`, async () => {
  const requestId = ++pageLocaleRequest;
  sourcePreviewResolver.clear();
  sourcePreviewBlocks.value = {};
  if (!bridge.value || previewing.value) { pageLocaleVariants.value = []; return; }
  if (!doc.value.localization?.pageGroupId || !props.options.localizationAdapter) { pageLocaleVariants.value = []; return; }
  const groupId = doc.value.localization.pageGroupId;
  try {
    const variants = await props.options.localizationAdapter.getPageVariants(groupId, sourceRequestContext(null));
    if (requestId === pageLocaleRequest && doc.value.localization?.pageGroupId === groupId) {
      const supported = new Set(configuredLocalization.value?.locales.map(item => normalizeLocale(item.code)) ?? []);
      const seen = new Set<string>();
      pageLocaleVariants.value = variants.flatMap(item => {
        try {
          const locale = normalizeLocale(item.locale);
          if (!supported.has(locale) || seen.has(locale) || !['draft','published','missing'].includes(item.status)) return [];
          seen.add(locale);
          return [{ ...item, locale }];
        } catch { return []; }
      });
    }
  } catch (error) { localeSwitchIssue.value = normalizeError(error).message; }
});

async function refreshSourcePreviews(): Promise<void> {
  const bridgeAtStart = bridge.value;
  if (!bridgeAtStart || previewing.value || disposed) return;
  const ids = new Set(doc.value.blocks.map(block => block.instanceId));
  sourcePreviewBlocks.value = Object.fromEntries(Object.entries(sourcePreviewBlocks.value).filter(([id]) => ids.has(id)));
  await Promise.all(doc.value.blocks.map(async current => {
    const id = current.instanceId, definition = definitionMap.value.get(definitionKey(current.definitionRef));
    if (!definition) return;
    if (!current.sourceBindings.some(binding => binding.mode !== 'manual')) {
      if (sourcePreviewBlocks.value[id]) {
        const next = { ...sourcePreviewBlocks.value }; delete next[id]; sourcePreviewBlocks.value = next;
        syncSourceCanvas(bridgeAtStart, current, definition);
      }
      sourcePreviewErrors.value[id] = ''; sourcePreviewBusy.value[id] = false;
      return;
    }
    const block = structuredClone(current), signature = JSON.stringify(current);
    sourcePreviewBusy.value[id] = true;
    try {
      const result = await sourcePreviewResolver.request(block, definition, contentProviders, contentLocaleContext.value, sourceLocaleDefaults.value);
      if (!result || disposed || bridge.value !== bridgeAtStart || previewing.value || JSON.stringify(doc.value.blocks.find(item => item.instanceId === id)) !== signature) return;
      sourcePreviewBlocks.value = { ...sourcePreviewBlocks.value, [id]: result.block };
      sourcePreviewErrors.value[id] = result.issues.find(issue => issue.severity !== 'warning')?.message ?? result.issues[0]?.message ?? '';
      syncSourceCanvas(bridgeAtStart, result.block, definition);
    } catch (error) {
      if (disposed || JSON.stringify(doc.value.blocks.find(item => item.instanceId === id)) !== signature) return;
      sourcePreviewErrors.value[id] = normalizeError(error).message;
    } finally { if (JSON.stringify(doc.value.blocks.find(item => item.instanceId === id)) === signature) sourcePreviewBusy.value[id] = false; }
  }));
}

function syncSourceCanvas(canvas: CanvasBridge, block: BlockInstance, definition: BlockDefinitionVersion): void {
  canvas.syncBlockData(block, definition);
  queueMicrotask(() => {
    if (disposed || bridge.value !== canvas) return;
    canvasProjectionRevision.value++;
    if (selection.value.blockId === block.instanceId && !canvas.editor.getSelected()?.getEl()?.isConnected) {
      const root = canvas.editor.getWrapper()?.find(`[data-bd-block-id="${escapeSelector(block.instanceId)}"]`)[0];
      if (root) canvas.editor.select(root);
    }
  });
}

async function askForLocale(locale: string): Promise<void> {
  localeSwitchIssue.value = '';
  try { locale = normalizeLocale(locale); } catch { localeSwitchIssue.value = uiText('Geçersiz dil kodu.'); return; }
  if (!configuredLocalization.value?.locales.some(item => normalizeLocale(item.code) === locale) || locale === contentLocale.value) return;
  const variant = pageLocaleVariants.value.find(item => normalizeLocale(item.locale) === locale) ?? null;
  if (!props.options.onLocaleChangeRequested && !props.options.onCreateLocaleVariant && !variant?.documentId) {
    localeSwitchIssue.value = t('locale.noLoader', '“{locale}” sayfasını açmak için host uygulama bir sayfa yükleme callback’i veya documentId sağlamalı.', { locale }); return;
  }
  if (variant?.status === 'missing' && !props.options.onCreateLocaleVariant && !props.options.onLocaleChangeRequested) {
    localeSwitchIssue.value = t('locale.noVariant', '“{locale}” için çeviri sayfası bağlı değil.', { locale }); return;
  }
  pendingLocaleChoice.value = { locale, variant };
  if (savedState.value === 'saved') await finishLocaleChange('discard');
}

async function finishLocaleChange(action: 'save' | 'discard' | 'stay'): Promise<void> {
  const choice = pendingLocaleChoice.value;
  if (!choice || localeSwitchBusy.value) return;
  if (action === 'stay') { pendingLocaleChoice.value = null; return; }
  localeSwitchBusy.value = true;
  localeSwitchIssue.value = '';
  try {
    if (action === 'save') {
      await saveDocument();
      if (savedState.value !== 'saved') throw new Error('Kaydetme sürerken yeni değişiklik oluştu. Önce tekrar kaydet veya kaydetmeden geç.');
    }
    let next: EditorDocument | null = null;
    if (choice.variant?.status === 'missing' && props.options.onCreateLocaleVariant) {
      localeVariantCreating.value = true;
      next = await props.options.onCreateLocaleVariant(choice.locale, snapshotDocument());
    } else if (props.options.onLocaleChangeRequested) {
      next = await props.options.onLocaleChangeRequested(choice.locale, choice.variant);
    } else if (choice.variant?.documentId) {
      next = await storage.load(choice.variant.documentId);
    }
    if (!next) throw new Error(t('locale.loadFailed', '“{locale}” sayfası yüklenemedi.', { locale: choice.locale }));
    next.localization = { ...(next.localization ?? {}), locale: normalizeLocale(next.localization?.locale ?? choice.locale), ...(next.localization?.pageGroupId ?? doc.value.localization?.pageGroupId ? { pageGroupId: next.localization?.pageGroupId ?? doc.value.localization!.pageGroupId } : {}) };
    await loadDocument(next);
    pendingLocaleChoice.value = null;
    successMessage.value = t('locale.opened', '{locale} açıldı.', { locale: configuredLocalization.value?.locales.find(item => normalizeLocale(item.code) === choice.locale)?.label ?? choice.locale });
  } catch (error) {
    localeSwitchIssue.value = normalizeError(error).message;
  } finally { localeSwitchBusy.value = false; localeVariantCreating.value = false; }
}

function languageWidgetDocument(document: EditorDocument): EditorDocument {
  const projected = structuredClone(document);
  const localeDefinition = availableDefinitions.value.find(item => item.ref.id === 'blockdesign.languages');
  if (!localeDefinition || !projected.localization?.pageGroupId || !pageLocaleVariants.value.length) return projected;
  const repeater = localeDefinition.repeaters.find(item => item.key === 'items');
  if (!repeater) return projected;
  const values = configuredLocalization.value?.locales.flatMap(locale => {
    const variant = pageLocaleVariants.value.find(item => normalizeLocale(item.locale) === normalizeLocale(locale.code));
    if (!variant || variant.status !== 'published' || !variant.url) return [];
    return [{ __id: `locale-${locale.code}`, label: locale.nativeLabel ?? locale.label, url: variant.url, icon: '', alt: locale.nativeLabel ?? locale.label }];
  }) ?? [];
  if (!values.length) return projected;
  projected.blocks = projected.blocks.map(block => block.definitionRef.id === localeDefinition.ref.id
    ? { ...block, manualData: { ...block.manualData, [repeater.key]: values } }
    : block);
  return projected;
}

async function saveSelectedBlockSettings(): Promise<void> {
  const current = selectedBlock.value, source = selectedDefinition.value;
  if (!current || !source || !canSaveBlockSettings.value || blockSettingsSaving.value) return;
  blockSettingsSaving.value = true;
  errorMessage.value = '';
  try {
    const latest = availableDefinitions.value.filter(item => item.ref.id === source.ref.id).map(item => item.ref.version).sort(compareVersions).at(-1) ?? source.ref.version;
    const definition = blockSettingsVersion(source, current, blockNameDraft.value, nextPatchVersion(latest), props.options.workspaceStage === 'block');
    const ref = await library.create!(definition);
    const saved = { ...definition, ref }, next = { ...(doc.value.blocks.find(item => item.instanceId === current.instanceId) ?? current), definitionRef: ref };
    availableDefinitions.value = [...availableDefinitions.value, saved];
    storedDefinitionRefs.value = new Set([...storedDefinitionRefs.value, definitionKey(ref)]);
    bridge.value?.registerDefinition(saved);
    commit('block.settings.save', null, document => { const index = document.blocks.findIndex(item => item.instanceId === current.instanceId); if (index >= 0) document.blocks[index] = next; });
    if (selection.value.blockId === current.instanceId) selection.value = { ...selection.value, definitionRef: ref, label: saved.name };
    bridge.value?.syncBlockData(next, saved);
    successMessage.value = t('block.versionSaved', '“{name}” · v{version} kaydedildi.', { name: saved.name, version: ref.version });
    props.options.onCatalogSave?.('block', ref);
  } catch (error) { errorMessage.value = normalizeError(error).message; }
  finally { blockSettingsSaving.value = false; }
}
const selectedTemplate = computed(() => templates.value.find((item) => definitionKey(item.ref) === templateChoice.value) ?? null);
const templateCategories = computed(() => [...new Set(availableDefinitions.value.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr-TR')));
const templatePolicyBlocks = computed(() => [...new Map(availableDefinitions.value.map((item) => [item.ref.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name, 'tr-TR')));
const definitionUpgradeDiff = computed(() => {
  const current = selectedDefinition.value;
  const next = newerDefinition(current);
  if (!current || !next) return null;
  return {
    from: current.ref.version,
    to: next.ref.version,
    addedFields: next.fields.filter((field) => !current.fields.some((old) => old.key === field.key)),
    removedFields: current.fields.filter((field) => !next.fields.some((item) => item.key === field.key)),
    changedFields: current.fields.flatMap((field) => { const replacement = next.fields.find((item) => item.key === field.key); return replacement && field.type !== replacement.type ? [{ from: field, to: replacement }] : []; }),
    addedRepeaters: next.repeaters.filter((item) => !current.repeaters.some((old) => old.key === item.key)),
    removedRepeaters: current.repeaters.filter((old) => !next.repeaters.some((item) => item.key === old.key)),
  };
});
const selectedSharedRegion = computed(() => selection.value.regionRef ? sharedRegions.value.find((region) => definitionKey(region.ref) === definitionKey(selection.value.regionRef!)) ?? null : null);
const selectedRepeater = computed(() => selectedDefinition.value?.repeaters.find((item) => item.repeaterId === selection.value.repeaterId || item.key === selection.value.nodeId) ?? (selection.value.itemId ? selectedDefinition.value?.repeaters[0] ?? null : null));
const selectedItem = computed(() => {
  if (!selectedBlock.value || !selectedRepeater.value || !selection.value.itemId) return null;
  const rows = selectedBlock.value.manualData[selectedRepeater.value.key];
  return Array.isArray(rows) ? rows.find((row) => Boolean(row && typeof row === 'object' && !Array.isArray(row) && row.__id === selection.value.itemId)) as Record<string, JsonValue> | undefined ?? null : null;
});
const selectedFields = computed(() => selectedDefinition.value?.fields ?? []);
const canMapSharedRegionField = computed(() => mode.value === 'designer' && Boolean(sharedRegionDraft.value) && selection.value.regionRef && definitionKey(selection.value.regionRef) === definitionKey(sharedRegionDraft.value!.ref) && Boolean(selection.value.nodeId));
const selectedImportCandidate = computed(() => importAnalysis.value?.candidates.find((candidate) => candidate.id === selectedImportId.value) ?? null);
const importPreviewSrcdoc = computed(() => selectedImportCandidate.value ? makeImportPreview(selectedImportCandidate.value) : '');
const selectedRepeaterField = computed(() => {
  if (!selectedRepeater.value || !selection.value.nodeId) return null;
  return selectedRepeater.value.itemFields.find((item) => item.mappingTarget.nodeId === selection.value.nodeId) ?? null;
});
const breadcrumbs = computed(() => [selection.value.blockId ? selectedDefinition.value?.name ?? uiText('Blok') : selectedSharedRegion.value?.name ?? uiText('Sayfa'), selection.value.itemId ? selectedRepeater.value?.label ?? uiText('Liste öğesi') : '', selection.value.nodeId ? selection.value.label : ''].filter(Boolean));
const issueCount = computed(() => validationIssues.value.length);
const canvasIsEmpty = computed(() => !doc.value.blocks.length && !hasCanvasContent(doc.value.projectData));
const canStartCustomDraft = computed(() => {
  if (mode.value !== 'designer' || props.options.permissions?.catalogWrite === false || !library.create || !bridge.value || selectedBlock.value || selection.value.blockId) return false;
  const component = bridge.value.editor.getSelected();
  return component?.getAttributes()['data-bd-container'] === 'true' && typeof component.getAttributes()['data-bd-node'] === 'string';
});
const canMapCustomField = computed(() => mode.value === 'designer' && Boolean(customBlockDraft.value) && selectedIsInsideCustomDraft());
const canBeginCustomRepeater = computed(() => {
  const selected = bridge.value?.editor.getSelected();
  const attributes = selected?.getAttributes() ?? {};
  return mode.value === 'designer' && Boolean(customBlockDraft.value) && !customRepeaterDraft.value && !selectedBlock.value && !selection.value.blockId
    && attributes['data-bd-container'] === 'true' && typeof attributes['data-bd-node'] === 'string' && selectedIsInsideCustomDraftRoot();
});
const canSetCustomRepeaterItem = computed(() => {
  const draft = customRepeaterDraft.value;
  return Boolean(draft && selectedRepeaterSampleNodeId(draft.containerNodeId) && selectedIsInsideCustomDraftRoot());
});

watch([templateChoice, templates], () => {
  const template = selectedTemplate.value;
  templateAllowedCategories.value = template ? [...template.allowedBlockCategories] : [];
  templateMandatoryBlockIds.value = template ? [...template.mandatoryBlockIds] : [];
}, { immediate: true });

function bindingFor(repeater: RepeaterDefinition): SourceBinding | null {
  return selectedBlock.value ? effectiveSourceBinding(selectedBlock.value, repeater) : null;
}

function supportsSourceTarget(target: 'block' | 'field' | 'repeater'): boolean {
  const configured = selectedDefinition.value?.sourceCapabilities.target;
  return Array.isArray(configured) ? configured.includes(target) : configured === target;
}

function bindingOptionValue(repeater: RepeaterDefinition): string {
  const binding = bindingFor(repeater);
  return binding?.mode !== 'manual' && binding?.providerId && binding.collectionId
    ? `${binding.mode}|${binding.providerId}|${binding.collectionId}` : 'manual';
}

function providerCollectionFor(binding: SourceBinding | null): { provider: ContentProviderAdapter; collection: ProviderCollection } | null {
  if (!binding?.providerId || !binding.collectionId) return null;
  return providerCollections.value.find((item) => item.provider.providerId === binding.providerId && item.collection.collectionId === binding.collectionId) ?? null;
}

function sourceRequestContext(binding: SourceBinding | null): import('@blockdesign/contracts').RequestContext & { contentLocale: ContentLocaleContext } {
  return { ...props.options.requestContext?.(), contentLocale: documentLocaleContext(doc.value, props.options.localization?.defaultLocale ?? props.options.language ?? 'tr', props.options.localization?.fallback ?? { mode: 'none' }, binding?.locale) };
}

function sourceModeOptions(): Array<{ value: string; label: string }> {
  const options = [{ value: 'manual', label: 'Manuel içerik' }];
  const supportedModes = selectedDefinition.value?.sourceCapabilities.modes ?? ['manual'];
  for (const { provider, collection } of providerCollections.value) {
    if (supportedModes.includes('selection') && collection.capabilities.recordSelection && provider.capabilities.supported.includes('resolveRecords')) options.push({ value: `selection|${provider.providerId}|${collection.collectionId}`, label: `${collection.label} · kayıt seç` });
    if (supportedModes.includes('query') && collection.capabilities.query && provider.query && provider.capabilities.supported.includes('query')) options.push({ value: `query|${provider.providerId}|${collection.collectionId}`, label: `${collection.label} · otomatik sorgu` });
  }
  return options;
}

function blockBindingFor(current: BlockInstance | null = selectedBlock.value): SourceBinding | null {
  return current?.sourceBindings.find((binding) => binding.target.scope === 'block') ?? null;
}

function blockSourceKey(): string { return `${selectedBlock.value?.instanceId ?? 'none'}:block`; }

function blockBindingOptionValue(): string {
  const binding = blockBindingFor();
  return binding?.mode !== 'manual' && binding?.providerId && binding.collectionId
    ? `${binding.mode}|${binding.providerId}|${binding.collectionId}` : 'manual';
}

function blockMappingTargets(): Array<{ to: string; label: string; type: FieldDefinition['type'] }> {
  const definition = selectedDefinition.value;
  if (!definition) return [];
  return [
    ...definition.fields.map((field) => ({ to: field.key, label: field.label, type: field.type })),
    ...definition.repeaters.flatMap((repeater) => repeater.itemFields.map((field) => ({ to: `${repeater.key}.${field.key}`, label: `${repeater.label} · ${field.label}`, type: field.type }))),
  ];
}

function changeBlockSourceMode(value: string): void {
  const current = selectedBlock.value;
  if (!current) return;
  const binding = blockBindingFor(current);
  if (value === 'manual') {
    saveBlockSourceBinding(current, binding
      ? { ...binding, mode: 'manual', providerId: null, collectionId: null, schemaVersion: null, recordRefs: [], groupRef: null, query: null, fieldMappings: [] }
      : { bindingId: makeId('binding'), target: { scope: 'block', id: 'block' }, mode: 'manual', providerId: null, collectionId: null, schemaVersion: null, recordRefs: [], groupRef: null, query: null, fieldMappings: [] });
    return;
  }
  const [modeValue, providerId, collectionId] = value.split('|');
  const target = providerCollections.value.find((item) => item.provider.providerId === providerId && item.collection.collectionId === collectionId);
  if (!providerId || !collectionId || !target || (modeValue !== 'selection' && modeValue !== 'query')) return;
  const oldMappings = binding?.fieldMappings ?? [];
  const fieldMappings = blockMappingTargets().map((item) => ({
    to: item.to,
    from: oldMappings.find((mapping) => mapping.to === item.to)?.from ?? suggestedProviderField(item.to.split('.').at(-1)!, target.collection.fields.map((field) => field.fieldId)),
  })).filter((item) => item.from);
  saveBlockSourceBinding(current, {
    bindingId: binding?.bindingId ?? makeId('binding'), target: { scope: 'block', id: 'block' }, mode: modeValue,
    providerId, collectionId, schemaVersion: target.collection.schemaVersion, recordRefs: binding?.recordRefs ?? [], groupRef: null,
    query: modeValue === 'query' ? (binding?.query ?? { filters: [], sort: target.collection.capabilities.query?.sortFields[0] ? { fieldId: target.collection.capabilities.query.sortFields[0]!, direction: 'desc' } : null, limit: Math.min(10, target.collection.capabilities.query?.maxLimit ?? 10) }) : null,
    fieldMappings,
  });
}

function saveBlockSourceBinding(current: BlockInstance, binding: SourceBinding): void {
  const nextBlock = { ...current, sourceBindings: [...current.sourceBindings.filter((item) => item.target.scope !== 'block'), binding] };
  commit('source.block.binding.change', null, (draft) => {
    const index = draft.blocks.findIndex((item) => item.instanceId === current.instanceId);
    if (index >= 0) draft.blocks[index] = nextBlock;
  });
  if (binding.mode === 'selection') void searchBlockSourceRecords();
}

async function searchBlockSourceRecords(): Promise<void> {
  const binding = blockBindingFor();
  const target = providerCollectionFor(binding);
  if (!binding || binding.mode !== 'selection' || !target || !target.collection.capabilities.search) return;
  const key = blockSourceKey();
  sourceBusy.value = { ...sourceBusy.value, [key]: true };
  sourceErrors.value = { ...sourceErrors.value, [key]: '' };
  try {
    const result = await target.provider.search(target.collection.collectionId, sourceSearch.value[key] ?? '', undefined, sourceRequestContext(binding));
    sourceRecords.value = { ...sourceRecords.value, [key]: result.items.map((record) => ({ recordId: record.recordId, title: String(record.values['title'] ?? record.values['question'] ?? record.recordId), body: String(record.values['body'] ?? record.values['description'] ?? '') })) };
  } catch (error) {
    sourceErrors.value = { ...sourceErrors.value, [key]: error instanceof Error ? error.message : 'Kayıtlar aranamadı.' };
  } finally { sourceBusy.value = { ...sourceBusy.value, [key]: false }; }
}

function toggleBlockSourceRecord(recordId: string, checked: boolean): void {
  const current = selectedBlock.value;
  const binding = blockBindingFor(current);
  if (!current || !binding) return;
  const recordRefs = checked ? [...binding.recordRefs.filter((id) => id !== recordId), recordId] : binding.recordRefs.filter((id) => id !== recordId);
  saveBlockSourceBinding(current, { ...binding, recordRefs });
}

function updateBlockSourceMapping(to: string, from: string): void {
  const current = selectedBlock.value;
  const binding = blockBindingFor(current);
  if (!current || !binding) return;
  saveBlockSourceBinding(current, { ...binding, fieldMappings: [...binding.fieldMappings.filter((item) => item.to !== to), ...(from ? [{ from, to }] : [])] });
}

function updateBlockSourceQuery(change: (binding: SourceBinding) => SourceBinding): void {
  const current = selectedBlock.value;
  const binding = blockBindingFor(current);
  if (!current || !binding?.query) return;
  saveBlockSourceBinding(current, change(binding));
}

function updateBlockQueryLimit(value: string): void {
  const maximum = providerCollectionFor(blockBindingFor())?.collection.capabilities.query?.maxLimit ?? 50;
  const limit = Math.max(1, Math.min(maximum, Number(value) || 1));
  updateBlockSourceQuery((binding) => ({ ...binding, query: binding.query ? { ...binding.query, limit } : null }));
}

function updateBlockQuerySort(fieldId: string): void {
  updateBlockSourceQuery((binding) => ({ ...binding, query: binding.query ? { ...binding.query, sort: fieldId ? { fieldId, direction: binding.query.sort?.direction ?? 'asc' } : null } : null }));
}

function fieldBindingFor(field: FieldDefinition): SourceBinding | null {
  return selectedBlock.value?.sourceBindings.find((binding) => binding.target.scope === 'field' && (binding.target.id === field.fieldId || binding.target.id === field.key)) ?? null;
}

function fieldSourceKey(field: FieldDefinition): string { return `${selectedBlock.value?.instanceId ?? 'none'}:field:${field.fieldId}`; }

function fieldBindingOptionValue(field: FieldDefinition): string {
  const binding = fieldBindingFor(field);
  return binding?.mode !== 'manual' && binding?.providerId && binding.collectionId
    ? `${binding.mode}|${binding.providerId}|${binding.collectionId}` : 'manual';
}

function changeFieldSourceMode(field: FieldDefinition, value: string): void {
  const current = selectedBlock.value;
  if (!current) return;
  const binding = current.sourceBindings.find((item) => item.target.scope === 'field' && (item.target.id === field.fieldId || item.target.id === field.key));
  if (value === 'manual') {
    saveFieldSourceBinding(current, field, binding
      ? { ...binding, mode: 'manual', providerId: null, collectionId: null, schemaVersion: null, recordRefs: [], groupRef: null, query: null, fieldMappings: [] }
      : { bindingId: makeId('binding'), target: { scope: 'field', id: field.fieldId }, mode: 'manual', providerId: null, collectionId: null, schemaVersion: null, recordRefs: [], groupRef: null, query: null, fieldMappings: [] });
    return;
  }
  const [modeValue, providerId, collectionId] = value.split('|');
  const target = providerCollections.value.find((item) => item.provider.providerId === providerId && item.collection.collectionId === collectionId);
  if (!providerId || !collectionId || !target || (modeValue !== 'selection' && modeValue !== 'query')) return;
  const oldMapping = binding?.fieldMappings.find((item) => item.to === field.key)?.from;
  const sourceField = oldMapping && target.collection.fields.some((item) => item.fieldId === oldMapping)
    ? oldMapping
    : suggestedProviderField(field.key, target.collection.fields.map((item) => item.fieldId));
  saveFieldSourceBinding(current, field, {
    bindingId: binding?.bindingId ?? makeId('binding'), target: { scope: 'field', id: field.fieldId }, mode: modeValue,
    providerId, collectionId, schemaVersion: target.collection.schemaVersion, recordRefs: binding?.recordRefs ?? [], groupRef: binding?.groupRef ?? null,
    query: modeValue === 'query' ? (binding?.query ?? { filters: [], sort: null, limit: 1 }) : null,
    fieldMappings: sourceField ? [{ from: sourceField, to: field.key }] : [],
  });
}

function saveFieldSourceBinding(current: BlockInstance, field: FieldDefinition, binding: SourceBinding): void {
  const nextBlock = { ...current, sourceBindings: [...current.sourceBindings.filter((item) => !(item.target.scope === 'field' && (item.target.id === field.fieldId || item.target.id === field.key))), binding] };
  commit('source.field.binding.change', null, (draft) => {
    const index = draft.blocks.findIndex((item) => item.instanceId === current.instanceId);
    if (index >= 0) draft.blocks[index] = nextBlock;
  });
  if (binding.mode === 'selection') void searchFieldSourceRecords(field);
}

function changeSourceMode(repeater: RepeaterDefinition, value: string): void {
  const current = selectedBlock.value;
  if (!current) return;
  const binding = current.sourceBindings.find((item) => item.target.scope === 'repeater' && item.target.id === repeater.repeaterId);
  if (value === 'manual') {
    saveSourceBinding(current, repeater, binding
      ? { ...binding, mode: 'manual', providerId: null, collectionId: null, schemaVersion: null, recordRefs: [], groupRef: null, query: null, fieldMappings: [] }
      : { bindingId: makeId('binding'), target: { scope: 'repeater', id: repeater.repeaterId }, mode: 'manual', providerId: null, collectionId: null, schemaVersion: null, recordRefs: [], groupRef: null, query: null, fieldMappings: [] });
    return;
  }
  const [modeValue, providerId, collectionId] = value.split('|');
  if (!providerId || !collectionId) return;
  const target = providerCollections.value.find((item) => item.provider.providerId === providerId && item.collection.collectionId === collectionId);
  if (!target || (modeValue !== 'selection' && modeValue !== 'query')) return;
  const old = binding?.fieldMappings ?? [];
  const fieldMappings = repeater.itemFields.map((field) => ({
    to: field.key,
    from: old.find((mapping) => mapping.to === field.key)?.from ?? suggestedProviderField(field.key, target.collection.fields.map((item) => item.fieldId)),
  })).filter((mapping) => mapping.from);
  saveSourceBinding(current, repeater, {
    bindingId: binding?.bindingId ?? makeId('binding'), target: { scope: 'repeater', id: repeater.repeaterId }, mode: modeValue,
    providerId, collectionId, schemaVersion: target.collection.schemaVersion, recordRefs: binding?.recordRefs ?? [], groupRef: binding?.groupRef ?? null,
    query: modeValue === 'query' ? (binding?.query ?? { filters: [], sort: target.collection.capabilities.query?.sortFields[0] ? { fieldId: target.collection.capabilities.query.sortFields[0]!, direction: 'desc' as const } : null, limit: Math.min(10, target.collection.capabilities.query?.maxLimit ?? 10) }) : null,
    fieldMappings,
  });
  if (modeValue === 'selection') void loadSourceGroups(repeater);
}

function suggestedProviderField(key: string, fields: string[]): string {
  const aliases: Record<string, string[]> = { question: ['title', 'question'], answer: ['body', 'answer', 'description'], image: ['cover', 'image'], alt: ['alt'], url: ['url', 'link'] };
  return (aliases[key] ?? [key]).find((candidate) => fields.includes(candidate)) ?? '';
}

function saveSourceBinding(current: BlockInstance, repeater: RepeaterDefinition, binding: SourceBinding): void {
  const nextBlock = { ...current, sourceBindings: [...current.sourceBindings.filter((item) => !(item.target.scope === 'repeater' && (item.target.id === repeater.repeaterId || item.target.id === repeater.key))), binding] };
  commit('source.binding.change', null, (draft) => {
    const index = draft.blocks.findIndex((item) => item.instanceId === current.instanceId);
    if (index >= 0) draft.blocks[index] = nextBlock;
  });
  void searchSourceRecords(repeater);
}

async function loadProviderCollections(): Promise<void> {
  const results = await Promise.allSettled(contentProviders.map(async (provider) => {
    if (!provider.capabilities.supported.includes('collections')) return [];
    return (await provider.listCollections()).map((collection) => ({ provider, collection }));
  }));
  providerCollections.value = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}

async function searchSourceRecords(repeater: RepeaterDefinition): Promise<void> {
  const binding = bindingFor(repeater);
  const target = providerCollectionFor(binding);
  if (!binding || binding.mode !== 'selection' || !target || !target.collection.capabilities.search) return;
  const key = sourceKey(repeater);
  sourceBusy.value = { ...sourceBusy.value, [key]: true };
  sourceErrors.value = { ...sourceErrors.value, [key]: '' };
  try {
    const result = await target.provider.search(target.collection.collectionId, sourceSearch.value[key] ?? '', undefined, sourceRequestContext(binding));
    sourceRecords.value = { ...sourceRecords.value, [key]: result.items.map((record) => ({ recordId: record.recordId, title: String(record.values['title'] ?? record.values['question'] ?? record.recordId), body: String(record.values['body'] ?? record.values['description'] ?? '') })) };
  } catch (error) {
    sourceErrors.value = { ...sourceErrors.value, [key]: error instanceof Error ? error.message : 'Kayıtlar aranamadı.' };
  } finally { sourceBusy.value = { ...sourceBusy.value, [key]: false }; }
}

async function loadSourceGroups(repeater: RepeaterDefinition): Promise<void> {
  const binding = bindingFor(repeater);
  const target = providerCollectionFor(binding);
  if (!binding || binding.mode !== 'selection' || !target?.collection.capabilities.recordGroups || !target.provider.listGroups) {
    sourceGroups.value = { ...sourceGroups.value, [sourceKey(repeater)]: [] };
    return;
  }
  try {
    const groups = await target.provider.listGroups(target.collection.collectionId, sourceRequestContext(binding));
    sourceGroups.value = { ...sourceGroups.value, [sourceKey(repeater)]: groups };
  } catch (error) {
    sourceErrors.value = { ...sourceErrors.value, [sourceKey(repeater)]: error instanceof Error ? error.message : 'Kayıt grupları yüklenemedi.' };
  }
}

function chooseSourceGroup(repeater: RepeaterDefinition, groupId: string): void {
  const current = selectedBlock.value;
  const binding = bindingFor(repeater);
  if (!current || !binding) return;
  saveSourceBinding(current, repeater, { ...binding, groupRef: groupId || null });
}

async function searchFieldSourceRecords(field: FieldDefinition): Promise<void> {
  const binding = fieldBindingFor(field);
  const target = providerCollectionFor(binding);
  if (!binding || binding.mode !== 'selection' || !target || !target.collection.capabilities.search) return;
  const key = fieldSourceKey(field);
  sourceBusy.value = { ...sourceBusy.value, [key]: true };
  sourceErrors.value = { ...sourceErrors.value, [key]: '' };
  try {
    const result = await target.provider.search(target.collection.collectionId, sourceSearch.value[key] ?? '', undefined, sourceRequestContext(binding));
    sourceRecords.value = { ...sourceRecords.value, [key]: result.items.map((record) => ({ recordId: record.recordId, title: String(record.values['title'] ?? record.values['question'] ?? record.recordId), body: String(record.values['body'] ?? record.values['description'] ?? '') })) };
  } catch (error) {
    sourceErrors.value = { ...sourceErrors.value, [key]: error instanceof Error ? error.message : 'Kayıtlar aranamadı.' };
  } finally { sourceBusy.value = { ...sourceBusy.value, [key]: false }; }
}

function toggleFieldSourceRecord(field: FieldDefinition, recordId: string, checked: boolean): void {
  const current = selectedBlock.value;
  const binding = fieldBindingFor(field);
  if (!current || !binding) return;
  saveFieldSourceBinding(current, field, { ...binding, recordRefs: checked ? [recordId] : [] });
}

function sourceKey(repeater: RepeaterDefinition): string { return `${selectedBlock.value?.instanceId ?? 'none'}:${repeater.repeaterId}`; }

function toggleSourceRecord(repeater: RepeaterDefinition, recordId: string, checked: boolean): void {
  const current = selectedBlock.value;
  const binding = bindingFor(repeater);
  if (!current || !binding) return;
  const recordRefs = checked ? [...binding.recordRefs.filter((id) => id !== recordId), recordId] : binding.recordRefs.filter((id) => id !== recordId);
  saveSourceBinding(current, repeater, { ...binding, recordRefs });
}

function updateSourceMapping(repeater: RepeaterDefinition, fieldKey: string, providerFieldId: string): void {
  const current = selectedBlock.value;
  const binding = bindingFor(repeater);
  if (!current || !binding) return;
  saveSourceBinding(current, repeater, { ...binding, fieldMappings: [...binding.fieldMappings.filter((item) => item.to !== fieldKey), ...(providerFieldId ? [{ from: providerFieldId, to: fieldKey }] : [])] });
}

function updateFieldSourceMapping(field: FieldDefinition, providerFieldId: string): void {
  const current = selectedBlock.value;
  const binding = fieldBindingFor(field);
  if (!current || !binding) return;
  saveFieldSourceBinding(current, field, { ...binding, fieldMappings: providerFieldId ? [{ from: providerFieldId, to: field.key }] : [] });
}

function updateSourceQuery(repeater: RepeaterDefinition, change: (binding: SourceBinding) => SourceBinding): void {
  const current = selectedBlock.value;
  const binding = bindingFor(repeater);
  if (!current || !binding?.query) return;
  saveSourceBinding(current, repeater, change(binding));
}

function updateQuerySort(repeater: RepeaterDefinition, fieldId: string): void {
  updateSourceQuery(repeater, (binding) => ({ ...binding, query: binding.query ? { ...binding.query, sort: fieldId ? { fieldId, direction: binding.query.sort?.direction ?? 'asc' } : null } : null }));
}

function updateQueryLimit(repeater: RepeaterDefinition, value: string): void {
  const binding = bindingFor(repeater);
  const maximum = providerCollectionFor(binding)?.collection.capabilities.query?.maxLimit ?? 50;
  const limit = Math.max(1, Math.min(maximum, Number(value) || 1));
  updateSourceQuery(repeater, (item) => ({ ...item, query: item.query ? { ...item.query, limit } : null }));
}

function editQueryLimit(repeater: RepeaterDefinition, value: string): void {
  sourceQueryLimit.value = { ...sourceQueryLimit.value, [sourceKey(repeater)]: Number(value) || 1 };
}

function updateQueryFilter(repeater: RepeaterDefinition, fieldId: string, value: string): void {
  updateSourceQuery(repeater, (binding) => ({ ...binding, query: binding.query ? {
    ...binding.query,
    filters: fieldId && value ? [{ fieldId, operator: 'contains', value }] : [],
  } : null }));
}

function chooseQueryFilterField(repeater: RepeaterDefinition, fieldId: string): void {
  sourceFilterField.value = { ...sourceFilterField.value, [sourceKey(repeater)]: fieldId };
  sourceFilterValue.value = { ...sourceFilterValue.value, [sourceKey(repeater)]: '' };
  if (!fieldId) updateQueryFilter(repeater, '', '');
}

function editQueryFilterValue(repeater: RepeaterDefinition, value: string): void {
  sourceFilterValue.value = { ...sourceFilterValue.value, [sourceKey(repeater)]: value };
}

function applyQueryFilter(repeater: RepeaterDefinition): void {
  const key = sourceKey(repeater);
  const fieldId = sourceFilterField.value[key] ?? bindingFor(repeater)?.query?.filters[0]?.fieldId ?? '';
  updateQueryFilter(repeater, fieldId, sourceFilterValue.value[key] ?? '');
}

function applySelectedTemplate(): void {
  const template = templates.value.find((item) => definitionKey(item.ref) === templateChoice.value);
  if (!template) { errorMessage.value = uiText('Sayfa şablonu bulunamadı.'); return; }
  if (template.archived) { errorMessage.value = uiText('Arşivlenmiş şablon yeni sayfa için kullanılamaz.'); return; }
  if (template.allowedBlockCategories.length) {
    const forbidden = doc.value.blocks.find((block) => !template.allowedBlockCategories.includes(definitionMap.value.get(definitionKey(block.definitionRef))?.category ?? ''));
    if (forbidden) { errorMessage.value = uiText('Bu şablon mevcut bloklardan bazılarına izin vermiyor; blokları kaldır veya farklı şablon seç.'); return; }
  }
  const next = createPageFromTemplate(template);
  const chosenRegions = [headerRegionChoice.value, footerRegionChoice.value]
    .map((choice) => sharedRegions.value.find((region) => definitionKey(region.ref) === choice && !region.archived))
    .filter((region): region is SharedRegionDefinition => Boolean(region));
  const migrationNotes: string[] = [];
  if (chosenRegions.length) {
    const nextRegionData: Record<string, Record<string, JsonValue>> = structuredClone(doc.value.sharedRegionData ?? {});
    for (const region of chosenRegions) {
      const regionKey = definitionKey(region.ref);
      const previousRegion = doc.value.sharedRegionRefs
        .map((ref) => sharedRegions.value.find((candidate) => definitionKey(candidate.ref) === definitionKey(ref)))
        .find((candidate) => candidate?.region === region.region);
      const previousValues = previousRegion ? doc.value.sharedRegionData?.[definitionKey(previousRegion.ref)] ?? {} : {};
      if (previousRegion) {
        const migrated = migrateSharedRegionValues(previousRegion, region, previousValues);
        nextRegionData[regionKey] = migrated.values;
        if (definitionKey(previousRegion.ref) !== regionKey) {
          const details = [`${migrated.carried.length} alan korundu`, `${migrated.initialized.length} yeni alan varsayılanla başladı`, ...(migrated.incompatible.length ? [`${migrated.incompatible.length} uyumsuz alan varsayılana döndü`] : []), ...(migrated.removed.length ? [`${migrated.removed.length} eski alan eski sürümde saklandı`] : [])];
          migrationNotes.push(`${region.region === 'header' ? 'Header' : 'Footer'}: ${details.join(', ')}.`);
        }
      } else {
        nextRegionData[regionKey] = Object.fromEntries(region.fields.map((field) => [field.key, structuredClone(field.defaultValue)]));
      }
    }
    next.sharedRegionData = nextRegionData;
    next.projectData = applySharedRegions(next.projectData, chosenRegions, nextRegionData);
    const chosenKeys = new Set(chosenRegions.map((region) => definitionKey(region.ref)));
    const preserved = template.sharedRegionRefs.filter((ref) => !chosenKeys.has(definitionKey(ref)) && !chosenRegions.some((region) => region.region === sharedRegions.value.find((candidate) => definitionKey(candidate.ref) === definitionKey(ref))?.region));
    next.sharedRegionRefs = [...chosenRegions.map((region) => structuredClone(region.ref)), ...preserved.map((ref) => structuredClone(ref))];
  }
  if (doc.value.documentId) next.documentId = doc.value.documentId;
  next.revision = doc.value.revision;
  next.blocks = structuredClone(doc.value.blocks);
  next.editorState = structuredClone(doc.value.editorState);
  history.push(snapshotDocument(), null);
  doc.value = next;
  generation.value += 1;
  savedState.value = 'dirty';
  bridge.value?.syncDocument(next);
  emitChange('template.apply');
  successMessage.value = `${t('template.applied', '“{name}” sayfa şablonu uygulandı.', { name: template.name })}${migrationNotes.length ? ` ${migrationNotes.join(' ')}` : ''}`;
}

async function saveCurrentAsTemplate(): Promise<void> {
  const selected = props.options.workspaceStage === 'template'
    ? (workspaceTemplateRef.value ? templates.value.find((item) => definitionKey(item.ref) === definitionKey(workspaceTemplateRef.value!)) ?? null : null)
    : selectedTemplate.value;
  const name = templateName.value.trim() || selected?.name || '';
  if (!name) { errorMessage.value = uiText('Şablon için bir ad yaz.'); return; }
  if (!templateAdapter.create || !templateAdapter.capabilities.supported.includes('create')) { errorMessage.value = uiText('Bu şablon adapter’ı yeni şablon kaydetmeyi desteklemiyor.'); return; }
  const selectedId = selected && (!templateName.value.trim() || `template.${slug(name)}` === selected.ref.id) ? selected.ref.id : null;
  const id = selectedId ?? `template.${slug(name)}`;
  const versions = templates.value.filter((template) => template.ref.id === id).map((template) => template.ref.version);
  const nextVersion = versions.length ? nextPatchVersion(versions.sort(compareVersions).at(-1)!) : '1.0.0';
  try {
    const template = createTemplateFromDocument(name, snapshotDocument(), id, props.options.workspaceStage === 'template');
    template.ref.version = nextVersion;
    if (props.options.workspaceBaseViewId) template.baseViewId = props.options.workspaceBaseViewId;
    template.allowedBlockCategories = [...templateAllowedCategories.value];
    template.mandatoryBlockIds = [...templateMandatoryBlockIds.value];
    await templateAdapter.create(template);
    templates.value = [...templates.value, template];
    templateChoice.value = definitionKey(template.ref);
    workspaceTemplateRef.value = structuredClone(template.ref);
    templateName.value = name;
    doc.value.editorState.workspaceTemplateName = name;
    doc.value.editorState.workspaceExistingTemplateRef = { id: template.ref.id, version: template.ref.version };
    successMessage.value = t('template.saved', '“{name}” şablonu kaydedildi.', { name });
    props.options.onCatalogSave?.('template', template.ref);
  } catch (error) { errorMessage.value = normalizeError(error).message; }
}

function beginSharedRegionDraft(refKey: string): void {
  if (mode.value !== 'designer' || !bridge.value) { errorMessage.value = uiText('Paylaşılan bölge sürümleri yalnızca tasarım modunda düzenlenebilir.'); return; }
  if (!sharedRegionAdapter.create || !sharedRegionAdapter.capabilities.supported.includes('create')) { errorMessage.value = uiText('Bağlı bölge kataloğu yeni sürüm oluşturmayı desteklemiyor.'); return; }
  const source = sharedRegions.value.find((region) => definitionKey(region.ref) === refKey);
  if (!source) { errorMessage.value = uiText('Düzenlenecek bölge sürümü bulunamadı.'); return; }
  const liveRegion = findRegionModel(source.ref);
  if (!liveRegion) { errorMessage.value = uiText('Bu bölge tuvalde yok. Önce seçili sayfa şablonunu uygula.'); return; }
  ensureSharedRegionNodeIds(liveRegion);
  sharedRegionDraft.value = structuredClone(source);
  sharedRegionStructureEditable.value = true;
  pendingMapping.value = false;
  bridge.value.setRegionEditing(source.ref);
  successMessage.value = t('region.draftOpened', '“{name}” için yeni sürüm taslağı açıldı. Yapıyı düzenle veya bir öğeyi alan olarak eşle.', { name: source.name });
}

function ensureSharedRegionNodeIds(model: ComponentModelView): void {
  if (model.get('type') !== 'textnode') {
    const attributes = model.getAttributes();
    if (typeof attributes['data-bd-node'] !== 'string' || !attributes['data-bd-node']) {
      attributes['data-bd-node'] = makeId('region-node');
      model.setAttributes(attributes);
    }
  }
  model.components().models.forEach(ensureSharedRegionNodeIds);
}

function findRegionModel(ref: VersionRef): ComponentModelView | null {
  const key = definitionKey(ref);
  const components = bridge.value?.editor.getWrapper()?.find('[data-bd-region-ref]') ?? [];
  const root = components.find((item) => item.getAttributes()['data-bd-region-ref'] === key);
  return root as unknown as ComponentModelView | null;
}

function setSharedRegionStructureEditable(editable: boolean): void {
  const draft = sharedRegionDraft.value;
  if (!draft) return;
  sharedRegionStructureEditable.value = editable;
  bridge.value?.setRegionEditing(editable ? draft.ref : null);
}

function addMappingForSharedRegion(): void {
  const draft = sharedRegionDraft.value;
  const selected = bridge.value?.editor.getSelected();
  const attributes = selected?.getAttributes() ?? {};
  const nodeId = attributes['data-bd-node'];
  const element = selected?.getEl();
  if (!draft || !selected || !element || typeof nodeId !== 'string' || !canMapSharedRegionField.value) {
    errorMessage.value = uiText('Önce düzenlenen bölgenin içinden bir öğe seç.'); return;
  }
  const label = mappingDraft.value.label.trim();
  const key = slugify(mappingDraft.value.key || label);
  if (!label || !key) { errorMessage.value = uiText('Alan adı ve anahtarı gerekli.'); return; }
  if (draft.fields.some((field) => field.key === key || field.mappingTarget.nodeId === nodeId)) { errorMessage.value = uiText('Bu anahtar veya tuval öğesi zaten bir alana bağlı.'); return; }
  const type = mappingDraft.value.type;
  const tag = element.tagName.toLowerCase();
  let operation: FieldDefinition['mappingTarget']['operation'] = 'text';
  let property: string | undefined;
  let defaultValue: JsonValue = element.textContent?.trim() ?? '';
  if (type === 'image' || type === 'video') {
    if (type === 'image' && tag !== 'img' || type === 'video' && tag !== 'video') { errorMessage.value = type === 'image' ? t('field.typeImage', 'Görsel alanı için bir img öğesi seç.') : t('field.typeVideo', 'Video alanı için bir video öğesi seç.'); return; }
    operation = 'attribute'; property = 'src'; defaultValue = attributes['src'] ?? '';
  } else if (type === 'url' && (tag === 'a' || tag === 'area')) {
    operation = 'attribute'; property = 'href'; defaultValue = attributes['href'] ?? '';
  } else if (type === 'color') {
    operation = 'style'; property = 'color'; defaultValue = element.ownerDocument.defaultView?.getComputedStyle(element).color || '#345b4c';
  } else if (type === 'boolean') {
    operation = 'booleanVisibility'; defaultValue = attributes['hidden'] === true;
  } else if (type === 'richText') {
    errorMessage.value = uiText('Paylaşılan bölge alanlarında güvenli zengin metin eşlemesi henüz desteklenmiyor; metin alanını seç.'); return;
  }
  const field: FieldDefinition = { fieldId: makeId('field'), key, label, type, required: mappingDraft.value.required, defaultValue, mappingTarget: { nodeId, operation, ...(property ? { property } : {}) } };
  sharedRegionDraft.value = { ...draft, fields: [...draft.fields, field] };
  mappingDraft.value = { label: '', key: '', type: 'text', required: false, options: '' };
  pendingMapping.value = false;
  successMessage.value = t('region.fieldAdded', '“{name}” alanı bölge taslağına eklendi.', { name: field.label });
}

function removeSharedRegionDraftField(fieldKey: string): void {
  const draft = sharedRegionDraft.value;
  if (draft) sharedRegionDraft.value = { ...draft, fields: draft.fields.filter((field) => field.key !== fieldKey) };
}

async function saveSharedRegionVersion(): Promise<void> {
  if (props.options.permissions?.catalogWrite === false) { errorMessage.value=uiText('Host katalog yazmaya izin vermiyor.'); return; }
  const draft = sharedRegionDraft.value;
  if (!draft || !sharedRegionAdapter.create || !sharedRegionAdapter.capabilities.supported.includes('create')) return;
  const root = findRegionModel(draft.ref);
  if (!root) { errorMessage.value = uiText('Bölge tuvalde bulunamadı; taslak kaydedilemedi.'); return; }
  const componentTemplate = prepareComponentTemplate(root);
  const nodeIds = collectTemplateNodeIds(componentTemplate);
  const listProblems = repeaterDraftProblems(draft.repeaters ?? [], nodeIds, draft.defaultData ?? {});
  if(listProblems.length){errorMessage.value=listProblems.join(' ');return;}
  const missing = draft.fields.filter((field) => !nodeIds.has(field.mappingTarget.nodeId));
  if (missing.length) { errorMessage.value = `Tuvalden kaldırılan alan eşlemeleri var: ${missing.map((field) => field.label).join(', ')}.`; return; }
  const latestVersion = sharedRegions.value.filter((item) => item.ref.id === draft.ref.id).map((item) => item.ref.version).sort(compareVersions).at(-1) ?? draft.ref.version;
  const next: SharedRegionDefinition = { ...structuredClone(draft), ref: { ...draft.ref, version: nextPatchVersion(latestVersion) }, componentTemplate, archived: false };
  try {
    const savedRef = await sharedRegionAdapter.create(next);
    const saved = { ...next, ref: savedRef };
    sharedRegions.value = [...sharedRegions.value, saved];
    sharedRegionDraft.value = null;
    sharedRegionStructureEditable.value = false;
    bridge.value?.setRegionEditing(null);
    bridge.value?.syncDocument(doc.value);
    successMessage.value = t('region.versionSaved', '“{name}” v{version} sürümü kataloğa kaydedildi. Sayfalar eski sürümlerini korur.', { name: saved.name, version: saved.ref.version });
    props.options.onCatalogSave?.('shared-region', saved.ref);
  } catch (error) { errorMessage.value = normalizeError(error).message; }
}

function cancelSharedRegionDraft(): void {
  sharedRegionDraft.value = null;
  sharedRegionStructureEditable.value = false;
  pendingMapping.value = false;
  bridge.value?.setRegionEditing(null);
  bridge.value?.syncDocument(doc.value);
}

function updateSharedRegionField(region: SharedRegionDefinition, field: FieldDefinition, value: JsonValue): void {
  const issue = validateFieldValue(field, value, `sharedRegionData.${definitionKey(region.ref)}.${field.key}`)[0];
  if (issue) { errorMessage.value = issue.message; return; }
  const key = definitionKey(region.ref);
  commit(`region.field.change:${field.key}`, `region:${key}:${field.key}`, (next) => {
    next.sharedRegionData ??= {};
    next.sharedRegionData[key] = { ...(next.sharedRegionData[key] ?? {}), [field.key]: value };
    const activeRegions = next.sharedRegionRefs.map((ref) => sharedRegions.value.find((item) => definitionKey(item.ref) === definitionKey(ref))).filter((item): item is SharedRegionDefinition => Boolean(item));
    next.projectData = applySharedRegions(next.projectData, activeRegions, next.sharedRegionData);
  }, { syncRegion: region });
}

async function archiveSelectedDefinition(): Promise<void> {
  if(props.options.permissions?.catalogWrite === false)return;
  const definition = selectedDefinition.value;
  if (!definition || !library.archive || !library.capabilities.supported.includes('archive')) return;
  if (!storedDefinitionRefs.value.has(definitionKey(definition.ref))) { errorMessage.value = uiText('Önce blok sürümünü kataloğa kaydet.'); return; }
  try {
    await library.archive(definition.ref, true);
    availableDefinitions.value = availableDefinitions.value.map((item) => definitionKey(item.ref) === definitionKey(definition.ref) ? { ...item, archived: true } : item);
    successMessage.value = uiText('Blok sürümü arşivlendi. Mevcut örnekler açılabilir.');
  } catch (error) { errorMessage.value = normalizeError(error).message; }
}

async function archiveSelectedSharedRegion(): Promise<void> {
  if(props.options.permissions?.catalogWrite === false)return;
  const region = selectedSharedRegion.value;
  if (!region || !sharedRegionAdapter.archive || !sharedRegionAdapter.capabilities.supported.includes('archive')) return;
  try {
    await sharedRegionAdapter.archive(region.ref, true);
    sharedRegions.value = sharedRegions.value.map((item) => definitionKey(item.ref) === definitionKey(region.ref) ? { ...item, archived: true } : item);
    successMessage.value = t('region.archived', '“{name}” v{version} arşivlendi. Bu sürümü kullanan sayfalar açılabilir.', { name: region.name, version: region.ref.version });
  } catch (error) { errorMessage.value = normalizeError(error).message; }
}

async function deleteSelectedDefinition(): Promise<void> {
  if(props.options.permissions?.catalogWrite === false)return;
  const definition = selectedDefinition.value;
  if (!definition || !library.delete || !library.capabilities.supported.includes('deleteUnused')) return;
  if (!storedDefinitionRefs.value.has(definitionKey(definition.ref))) { errorMessage.value = uiText('Bu blok sürümü bağlı katalogda kayıtlı değil.'); return; }
  if (doc.value.blocks.some((block) => definitionKey(block.definitionRef) === definitionKey(definition.ref))) {
    errorMessage.value = uiText('Bu sürüm açık sayfada kullanılıyor. Önce blok örneğini kaldır veya başka sürüme geçir.');
    return;
  }
  if (!window.confirm(`“${definition.name} · v${definition.ref.version}” sürümü kalıcı olarak silinsin mi? Kullanımdaki sürümler sunucu tarafından korunur.`)) return;
  try {
    await library.delete(definition.ref);
    availableDefinitions.value = availableDefinitions.value.filter((item) => definitionKey(item.ref) !== definitionKey(definition.ref));
    const stored = new Set(storedDefinitionRefs.value); stored.delete(definitionKey(definition.ref)); storedDefinitionRefs.value = stored;
    selection.value = { blockId: null, definitionRef: null, nodeId: null, itemId: null, repeaterId: null, label: 'Tuval' };
    successMessage.value = uiText('Kullanılmayan blok sürümü silindi.');
  } catch (error) { errorMessage.value = normalizeError(error).message; }
}

async function createDefinitionVersion(): Promise<void> {
  const definition = selectedDefinition.value;
  if (!definition || !library.create || !library.capabilities.supported.includes('create')) return;
  const next: BlockDefinitionVersion = { ...structuredClone(definition), ref: { ...definition.ref, version: nextPatchVersion(definition.ref.version) }, archived: false };
  try {
    await library.create(next);
    storedDefinitionRefs.value = new Set([...storedDefinitionRefs.value, definitionKey(next.ref)]);
    availableDefinitions.value = [...availableDefinitions.value, next];
    bridge.value?.registerDefinition(next);
    successMessage.value = t('block.newVersion', 'Yeni blok sürümü v{version} oluşturuldu. Sayfalar kendiliğinden değiştirilmedi.', { version: next.ref.version });
  } catch (error) { errorMessage.value = normalizeError(error).message; }
}

function upgradeSelectedBlock(): void {
  const block = selectedBlock.value;
  const current = selectedDefinition.value;
  if (!block || !current) return;
  const newer = availableDefinitions.value.filter((item) => item.ref.id === current.ref.id && compareVersions(item.ref.version, current.ref.version) > 0).sort((a, b) => compareVersions(b.ref.version, a.ref.version))[0];
  if (!newer) return;
  const removedFields = current.fields.filter((field) => !newer.fields.some((next) => next.key === field.key));
  const removedRepeaters = current.repeaters.filter((repeater) => !newer.repeaters.some((next) => next.key === repeater.key));
  const manualData: Record<string, JsonValue> = { ...structuredClone(newer.defaultData), ...structuredClone(block.manualData) };
  const recovery: { from: string; to: string; removedFields: Record<string, JsonValue>; removedRepeaters: Record<string, JsonValue>; incompatibleValues: Record<string, JsonValue>; removedBindings: SourceBinding[] } = {
    from: current.ref.version, to: newer.ref.version, removedFields: {}, removedRepeaters: {}, incompatibleValues: {}, removedBindings: [],
  };
  for (const field of removedFields) {
    if (manualData[field.key] !== undefined) recovery.removedFields[field.key] = structuredClone(manualData[field.key]!);
    delete manualData[field.key];
  }
  for (const field of newer.fields) {
    const previous = current.fields.find((item) => item.key === field.key);
    const value = manualData[field.key];
    if (previous && value !== undefined && validateFieldValue(field, value, field.key).length) {
      recovery.incompatibleValues[field.key] = structuredClone(value);
      manualData[field.key] = structuredClone(field.defaultValue);
    } else if (value === undefined) manualData[field.key] = structuredClone(field.defaultValue);
  }
  for (const repeater of removedRepeaters) {
    if (manualData[repeater.key] !== undefined) recovery.removedRepeaters[repeater.key] = structuredClone(manualData[repeater.key]!);
    delete manualData[repeater.key];
  }
  for (const repeater of newer.repeaters) {
    const rows = manualData[repeater.key];
    if (!Array.isArray(rows)) continue;
    const previous = current.repeaters.find((item) => item.key === repeater.key);
    const nextKeys = new Set(repeater.itemFields.map((field) => field.key));
    if (previous?.itemFields.some((field) => !nextKeys.has(field.key))) recovery.removedRepeaters[repeater.key] = structuredClone(rows);
    manualData[repeater.key] = rows.map((raw) => {
      if (!raw || Array.isArray(raw) || typeof raw !== 'object') return raw;
      const row: Record<string, JsonValue> = { __id: typeof raw.__id === 'string' ? raw.__id : makeId('item') };
      for (const field of repeater.itemFields) {
        const value = raw[field.key];
        const priorField = previous?.itemFields.find((item) => item.key === field.key);
        if (priorField && value !== undefined && validateFieldValue(field, value, `${repeater.key}.${field.key}`).length) {
          recovery.incompatibleValues[`${repeater.key}.${field.key}`] = structuredClone(value);
          row[field.key] = structuredClone(field.defaultValue);
        } else row[field.key] = value === undefined ? structuredClone(field.defaultValue) : structuredClone(value);
      }
      return row;
    });
  }
  const validFieldTargets = new Set(newer.fields.flatMap((field) => [field.fieldId, field.key]));
  const validRepeaterTargets = new Set(newer.repeaters.flatMap((repeater) => [repeater.repeaterId, repeater.key]));
  const sourceBindings = block.sourceBindings.filter((binding) => {
    const valid = binding.target.scope === 'block' || (binding.target.scope === 'field' ? validFieldTargets.has(binding.target.id) : validRepeaterTargets.has(binding.target.id));
    if (!valid) recovery.removedBindings.push(structuredClone(binding));
    return valid;
  });
  const upgraded: BlockInstance = { ...block, definitionRef: structuredClone(newer.ref), manualData, sourceBindings };
  availableDefinitions.value = [...availableDefinitions.value, newer];
  bridge.value?.registerDefinition(newer);
  commit('block.version.upgrade', null, (draft) => {
    const index = draft.blocks.findIndex((item) => item.instanceId === block.instanceId);
    if (index >= 0) draft.blocks[index] = upgraded;
    if (Object.values(recovery).some((value) => typeof value === 'object' && Object.keys(value).length > 0)) {
      const existing = draft.editorState['blockVersionRecovery'];
      const backups = existing && !Array.isArray(existing) && typeof existing === 'object' ? existing as Record<string, JsonValue> : {};
      draft.editorState['blockVersionRecovery'] = { ...backups, [block.instanceId]: JSON.parse(JSON.stringify(recovery)) as JsonValue };
    }
  }, { syncCanvas: true });
  const recoveryCount = Object.values(recovery).filter((value) => typeof value === 'object' && Object.keys(value).length > 0).length;
  successMessage.value = recoveryCount
    ? t('block.upgradedWithRecovery', 'Blok örneği v{version} sürümüne geçirildi. Uyumsuz veri ve eşlemeler belge içindeki sürüm kurtarma kaydında saklandı.', { version: newer.ref.version })
    : t('block.upgraded', 'Blok örneği v{version} sürümüne geçirildi.', { version: newer.ref.version });
}

function newerDefinition(definition: BlockDefinitionVersion | null): BlockDefinitionVersion | null {
  if (!definition) return null;
  return availableDefinitions.value.filter((item) => item.ref.id === definition.ref.id && compareVersions(item.ref.version, definition.ref.version) > 0).sort((a, b) => compareVersions(b.ref.version, a.ref.version))[0] ?? null;
}

function slug(value: string): string { return value.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || makeId('template'); }
function nextPatchVersion(value: string): string { const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value); return match ? `${match[1]}.${match[2]}.${Number(match[3]) + 1}` : '1.0.1'; }
function compareVersions(left: string, right: string): number { const a = left.split('.').map(Number); const b = right.split('.').map(Number); for (let index = 0; index < Math.max(a.length, b.length); index += 1) { const difference = (a[index] ?? 0) - (b[index] ?? 0); if (difference) return difference; } return 0; }

async function loadDesignSystemAssets(ref: VersionRef): Promise<void> {
  try {
    const manifest = await designSystemAdapter.load(ref);
    if (definitionKey(manifest.ref) !== definitionKey(ref)) throw new Error('Varlık adapter’ı farklı tasarım sistemi sürümü döndürdü.');
    manifest.commonCss = validateCommonCss(manifest.commonCss ?? '');
    manifest.stylesheets = manifest.stylesheets.filter((item) => normalizeStylesheetUrl(item) !== null);
    designSystemManifest.value = manifest;
    commonCssDraft.value = manifest.commonCss;
    stylesheetDraft.value = manifest.stylesheets.join('\n');
    bridge.value?.setDesignSystemAssets(manifest);
  } catch (error) {
    designSystemManifest.value = { ref: structuredClone(ref), name: ref.id, commonCss: '', stylesheets: [], revision: null };
    commonCssDraft.value = '';
    stylesheetDraft.value = '';
    props.options.onError?.(normalizeError(error));
    errorMessage.value = t('assets.loadFailed', 'Tasarım sistemi varlıkları yüklenemedi: {message}', { message: normalizeError(error).message });
  }
}

function normalizeStylesheetUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, window.location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../') ? trimmed : url.href) : null;
  } catch { return null; }
}

async function saveDesignSystemAssets(): Promise<void> {
  if (mode.value !== 'designer' || !designSystemAdapter.capabilities.supported.includes('writeManifest')) return;
  designAssetsSaving.value = true;
  errorMessage.value = '';
  try {
    const commonCss = validateCommonCss(commonCssDraft.value);
    const requestedStylesheets = stylesheetDraft.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const stylesheets = requestedStylesheets.map(normalizeStylesheetUrl);
    if (stylesheets.some((item) => item === null)) throw new Error('Stil dosyası adresleri http, https veya geçerli bağıl yollar olmalı.');
    const manifest: DesignSystemAssetManifest = { ...designSystemManifest.value, ref: structuredClone(doc.value.designSystemRef), commonCss, stylesheets: [...new Set(stylesheets as string[])] };
    const saved = await designSystemAdapter.save(manifest, designSystemManifest.value.revision);
    designSystemManifest.value = { ...manifest, revision: saved.revision };
    commonCssDraft.value = commonCss;
    stylesheetDraft.value = manifest.stylesheets.join('\n');
    bridge.value?.setDesignSystemAssets(designSystemManifest.value);
    successMessage.value = uiText('Ortak tasarım varlıkları kaydedildi ve tuvale yüklendi.');
  } catch (error) { errorMessage.value = t('assets.saveFailed', 'Tasarım varlıkları kaydedilemedi: {message}', { message: normalizeError(error).message }); }
  finally { designAssetsSaving.value = false; }
}

async function refreshTemplateCatalogs(systemRef: VersionRef): Promise<void> {
  const isDefaultSystem = definitionKey(systemRef) === definitionKey(defaultPageTemplate.designSystemRef);
  try {
    const listed = await templateAdapter.list({ designSystemRef: systemRef, includeArchived: true });
    templates.value = listed.items.length ? listed.items : isDefaultSystem && props.options.appearance !== 'embedded' ? [structuredClone(defaultPageTemplate)] : [];
  } catch (error) { props.options.onError?.(normalizeError(error)); }
  try {
    const listed = await sharedRegionAdapter.list({ designSystemRef: systemRef, includeArchived: true });
    sharedRegions.value = listed.items.length ? listed.items : isDefaultSystem && props.options.appearance !== 'embedded' ? structuredClone(defaultSharedRegions) : [];
  } catch (error) { props.options.onError?.(normalizeError(error)); }
  if (doc.value.templateRef) templateChoice.value = definitionKey(doc.value.templateRef);
  else templateChoice.value = templates.value[0] ? definitionKey(templates.value[0].ref) : '';
  const refs = doc.value.sharedRegionRefs;
  const header = refs.map((ref) => sharedRegions.value.find((region) => definitionKey(region.ref) === definitionKey(ref))).find((region) => region?.region === 'header')
    ?? sharedRegions.value.find((region) => region.region === 'header' && !region.archived);
  const footer = refs.map((ref) => sharedRegions.value.find((region) => definitionKey(region.ref) === definitionKey(ref))).find((region) => region?.region === 'footer')
    ?? sharedRegions.value.find((region) => region.region === 'footer' && !region.archived);
  headerRegionChoice.value = header ? definitionKey(header.ref) : '';
  footerRegionChoice.value = footer ? definitionKey(footer.ref) : '';
}

onMounted(async () => {
  try {
    if (props.options.initialDocument?.revision !== null && props.options.initialDocument?.revision !== undefined) {
      savedState.value = 'saved';
      lastSavedGeneration.value = generation.value;
    }
    await loadProviderCollections();
    const params = new URLSearchParams(window.location.search);
    const useSample = params.get('sample') === 'faq';
    const loadId = props.options.appearance==='embedded' ? null : props.options.workspaceStage
      ? (props.options.initialDocument ? null : params.get('document'))
      : params.get('document') || (props.options.initialDocument || params.get('new') === '1' || useSample ? null : localStorage.getItem('blockdesign:last-document'));
    if (loadId && !props.options.initialDocument) {
      try {
        const loaded = await storage.load(loadId);
        loaded.sharedRegionData ??= {};
        doc.value = migrateDocumentLocalization(loaded, props.options.localization?.defaultLocale ?? props.options.language ?? 'tr');
        savedState.value = 'saved';
        lastSavedGeneration.value = generation.value;
        backendAvailable.value = adapterStatus.value === 'available';
      } catch (error) {
        if (!(error instanceof AdapterRequestError && error.status === 404)) throw error;
      }
    } else if (!props.options.initialDocument) {
      doc.value = useSample ? createSampleDocument() : createEmptyDocument();
    }
    doc.value = migrateDocumentLocalization(doc.value, props.options.localization?.defaultLocale ?? props.options.language ?? 'tr');
    doc.value.sharedRegionData ??= {};
    if (props.options.workspaceStage) {
      doc.value.editorState.workspaceStage = props.options.workspaceStage;
      if (props.options.workspaceBaseViewId) doc.value.editorState.workspaceBaseViewId = props.options.workspaceBaseViewId;
      if (props.options.workspaceSharedRegionKind) doc.value.editorState.workspaceSharedRegionKind = props.options.workspaceSharedRegionKind;
      if (props.options.workspaceStage === 'block') doc.value.documentKind = 'blockDraft';
      if (props.options.workspaceStage === 'page') doc.value.documentKind = 'page';
      if (props.options.workspaceStage === 'template') {
        templateName.value = props.options.workspaceTemplateName ?? '';
        doc.value.editorState.workspaceTemplateName = templateName.value;
        if (workspaceTemplateRef.value) doc.value.editorState.workspaceExistingTemplateRef = { id: workspaceTemplateRef.value.id, version: workspaceTemplateRef.value.version };
      }
    }
    await loadDesignSystemAssets(doc.value.designSystemRef);
    await refreshTemplateCatalogs(doc.value.designSystemRef);
    doc.value.projectData=applySharedRegions(doc.value.projectData,sharedRegions.value,doc.value.sharedRegionData??{});
    const isDefaultSystem = definitionKey(doc.value.designSystemRef) === definitionKey(defaultPageTemplate.designSystemRef);
    const widgets = structuredClone(composableDefinitions).map(item => ({...item,designSystemRef:structuredClone(doc.value.designSystemRef)}));
    const localDefaults = props.options.appearance === 'embedded' || props.options.includeDemoBlocks === false ? [] : [...widgets,...(isDefaultSystem ? structuredClone([...demoDefinitions]) : [])];
    availableDefinitions.value = localDefaults;
    try {
      const existingBlock = props.options.workspaceExistingBlockDefinition;
      const listed = await loadLibraryDefinitions(library, [doc.value.designSystemRef, ...(props.options.blockLibraryDesignSystemRefs ?? [])], Boolean(existingBlock));
      const builtIns = props.options.appearance === 'embedded' || props.options.includeDemoBlocks === false ? [] : [...widgets,...(isDefaultSystem ? demoDefinitions.filter(d => !['blockdesign.faq','blockdesign.banner'].includes(d.ref.id) || doc.value.blocks.some(b=>definitionKey(b.definitionRef)===definitionKey(d.ref))) : [])];
      const combined = new Map([...builtIns, ...listed, ...(existingBlock ? [existingBlock] : [])].map((item) => [definitionKey(item.ref), item]));
      if(props.options.forms || doc.value.blocks.some(block=>block.definitionRef.id===CMS_FORM_ID))if(!combined.has(CMS_FORM_ID+'@1.0.0'))combined.set(CMS_FORM_ID+'@1.0.0',createCmsFormDefinition(doc.value.designSystemRef));
      for(const definition of extensionRegistry.blocks)combined.set(definitionKey(definition.ref),definition);
      availableDefinitions.value = [...combined.values()];
      storedDefinitionRefs.value = new Set(listed.map((item) => definitionKey(item.ref)));
    } catch (error) {
      if (!(error instanceof TypeError) && !(error instanceof AdapterRequestError && [404, 500, 502, 503, 504].includes(error.status))) throw error;
    }
    for (const ref of doc.value.blocks.map((block) => block.definitionRef)) {
      if (availableDefinitions.value.some((definition) => definitionKey(definition.ref) === definitionKey(ref))) continue;
      try {
        const definition = await library.getVersion(ref);
        availableDefinitions.value = [...availableDefinitions.value, definition];
        storedDefinitionRefs.value = new Set([...storedDefinitionRefs.value, definitionKey(ref)]);
      } catch (error) { props.options.onError?.(normalizeError(error)); }
    }
    if (props.options.workspaceExistingBlockDefinition) {
      const definition = availableDefinitions.value.find((item) => definitionKey(item.ref) === definitionKey(props.options.workspaceExistingBlockDefinition!.ref)) ?? props.options.workspaceExistingBlockDefinition;
      const componentTemplate = editableBlockTemplate(definition);
      const attributes = templateAttributes(componentTemplate);
      if (!attributes) throw new Error('Blok tuvalde düzenlenebilir bir bölüm olarak açılamadı.');
      attributes['data-bd-container'] = 'true';
      doc.value.projectData = {
        ...doc.value.projectData,
        pages: [{ name: definition.name, component: { type: 'wrapper', components: [componentTemplate] } }],
      };
    }
    await nextTick();
    if (!host.value || !blockRoot.value) throw new Error('Tuval hazırlanamadı.');
    bridge.value = await createGrapesCanvas({
      ...props.options.canvas,
      element: host.value,
      blockManagerRoot: blockRoot.value,
      document: doc.value,
      definitions: availableDefinitions.value,
      behaviorPlugins: editorBehaviors,
      mode: mode.value,
      onSelection: (next) => { selection.value = next; },
      onDocumentChange: (projectData) => { if (!sharedRegionDraft.value) commitCanvas(projectData); },
      onBlockDrop: (instance) => acceptDrop(instance),
      onBlockRemove: (instanceId) => removeInstance(instanceId),
    });
    bridge.value.setDesignSystemAssets(designSystemManifest.value);
    for(const region of sharedRegions.value) if(region.css && doc.value.sharedRegionRefs.some(ref=>definitionKey(ref)===definitionKey(region.ref)))bridge.value.editor.addStyle(region.css);
    if (props.options.workspaceExistingBlockDefinition) beginExistingBlockDraft(props.options.workspaceExistingBlockDefinition);
    if (disposed) { bridge.value.destroy(); bridge.value = null; return; }
    resizeObserver.value = new ResizeObserver(() => bridge.value?.resize());
    const workbench = host.value.closest('.bd-workbench');
    if (workbench) resizeObserver.value.observe(workbench);
    if (props.options.workspaceStage === 'template') {
      templateName.value = props.options.workspaceTemplateName ?? (workspaceTemplateRef.value ? (templates.value.find((item) => definitionKey(item.ref) === definitionKey(workspaceTemplateRef.value!))?.name ?? '') : '');
      if (workspaceTemplateRef.value) templateChoice.value = definitionKey(workspaceTemplateRef.value);
      templateAllowedCategories.value = selectedTemplate.value?.allowedBlockCategories ?? [];
      templateMandatoryBlockIds.value = selectedTemplate.value?.mandatoryBlockIds ?? [];
    }
    if (props.options.initialSharedRegionRef) beginSharedRegionDraft(definitionKey(props.options.initialSharedRegionRef));
    window.addEventListener('beforeunload', warnIfDirty);
    window.addEventListener('keydown', saveShortcut);
    watch([blockSearch, availableDefinitions], () => applyBlockSearch(), { flush: 'post' });
    applyBlockSearch();
    emit('runtime', {
      getDocument: () => snapshotDocument(),
      loadDocument,
      save: saveDocument,
      setMode: setEditorMode,
      setPreview: setPreview,
      exportStatic,
    });
    editorStarted=true;
    if(props.options.recovery)try{const raw=localStorage.getItem(props.options.recovery.key);if(raw){const draft=JSON.parse(raw) as EditorDocument;if(draft.documentId===doc.value.documentId&&draft.revision===doc.value.revision&&draft.documentVersion===doc.value.documentVersion)recoverableDraft.value=draft;}}catch{/* malformed or unavailable recovery must not prevent startup */}
  } catch (error) {
    const normalized = normalizeError(error);
    errorMessage.value = normalized.message;
    emit('failure', normalized);
  }
});

onBeforeUnmount(() => {
  editorStarted=false;
  if(autosaveTimer)clearTimeout(autosaveTimer);
  disposed = true;
  if (sourcePreviewTimer) clearTimeout(sourcePreviewTimer);
  sourcePreviewResolver.clear();
  window.removeEventListener('beforeunload', warnIfDirty);
  window.removeEventListener('keydown', saveShortcut);
  resizeObserver.value?.disconnect();
  bridge.value?.destroy();
  bridge.value = null;
});

function snapshotDocument(): EditorDocument {
  if (bridge.value) doc.value.projectData = bridge.value.captureProjectData();
  doc.value.sharedRegionData ??= {};
  return structuredClone({...doc.value,documentVersion:doc.value.documentVersion === 1 ? DOCUMENT_VERSION : doc.value.documentVersion});
}

function commit(reason: string, historyKey: string | null, change: (draft: EditorDocument) => void, options: { syncCanvas?: boolean; syncRegion?: SharedRegionDefinition } = {}): void {
  const before = structuredClone(doc.value);
  history.push(before, historyKey);
  const next = structuredClone(doc.value);
  change(next);
  doc.value = next;
  generation.value += 1;
  savedState.value = 'dirty';
  errorMessage.value = '';
  successMessage.value = '';
  if (options.syncRegion) {
    const regionKey = definitionKey(options.syncRegion.ref);
    bridge.value?.syncSharedRegion(options.syncRegion, doc.value.sharedRegionData?.[regionKey] ?? {});
  }
  else if (options.syncCanvas) bridge.value?.syncDocument(next);
  emitChange(reason, !options.syncCanvas && !options.syncRegion);
}

function emitChange(reason: string, captureCanvas = true): void {
  const event: EditorChangeEvent = { document: captureCanvas ? snapshotDocument() : structuredClone(doc.value), generation: generation.value, reason };
  props.options.onChange?.(event);
}

function commitCanvas(projectData: Record<string, JsonValue>): void {
  if (JSON.stringify(doc.value.projectData) === JSON.stringify(projectData)) return;
  commit('canvas.change', 'canvas', (draft) => { draft.projectData = projectData; });
}

function acceptDrop(instance: BlockInstance): void {
  const definition = definitionMap.value.get(definitionKey(instance.definitionRef));
  if (!definition) return;
  const activeTemplate = doc.value.templateRef ? templates.value.find((item) => definitionKey(item.ref) === definitionKey(doc.value.templateRef!)) ?? null : null;
  if (!templateAllowsCategory(activeTemplate, definition.category)) { errorMessage.value = t('template.categoryNotAllowed', '“{category}” kategorisi sayfa şablonunda izinli değil.', { category: definition.category }); bridge.value?.syncDocument(doc.value); return; }
  commit('block.drop', null, (draft) => {
    draft.blocks.push(instance);
    draft.projectData = bridge.value?.captureProjectData() ?? draft.projectData;
  });
}

function removeInstance(instanceId: string): void {
  const current = doc.value.blocks.find((block) => block.instanceId === instanceId);
  const activeTemplate = doc.value.templateRef ? templates.value.find((item) => definitionKey(item.ref) === definitionKey(doc.value.templateRef!)) ?? null : null;
  if (current && activeTemplate?.mandatoryBlockIds.includes(current.definitionRef.id)
    && doc.value.blocks.filter((block) => block.definitionRef.id === current.definitionRef.id).length <= 1) {
    errorMessage.value = uiText('Bu blok sayfa şablonunda zorunlu; sayfadan kaldırılamaz.');
    bridge.value?.syncDocument(doc.value);
    return;
  }
  commit('block.remove', null, (draft) => {
    draft.blocks = draft.blocks.filter((block) => block.instanceId !== instanceId);
    selection.value = { blockId: null, definitionRef: null, nodeId: null, itemId: null, repeaterId: null, label: 'Tuval' };
    draft.projectData = bridge.value?.captureProjectData() ?? draft.projectData;
  });
}

function addBlock(definition: BlockDefinitionVersion): void {
  if (mode.value === 'content' && definition.archived) return;
  const activeTemplate = doc.value.templateRef ? templates.value.find((item) => definitionKey(item.ref) === definitionKey(doc.value.templateRef!)) ?? null : null;
  if (!templateAllowsCategory(activeTemplate, definition.category)) { errorMessage.value = t('template.categoryNotAllowed', '“{category}” kategorisi sayfa şablonunda izinli değil.', { category: definition.category }); return; }
  const instance = makeInstance(definition);
  const selectedAttrs = bridge.value?.editor.getSelected()?.getAttributes() ?? {};
  const selectedBlockId = selectedAttrs['data-bd-block-id'];
  commit('block.add', null, (draft) => { draft.blocks.push(instance); });
  bridge.value?.insertBlock(instance, definition);

}

function updateBlockField(field: FieldDefinition, value: JsonValue, historyKey: string | null = `field:${selection.value.blockId}:${field.key}`): void {
  const current = selectedBlock.value;
  if (!current || !selectedDefinition.value) return;
  const nextBlock = setFieldValue(current, field, value);
  commit(`field.change:${field.key}`, historyKey, (draft) => {
    const index = draft.blocks.findIndex((block) => block.instanceId === current.instanceId);
    if (index >= 0) draft.blocks[index] = nextBlock;
  });
  bridge.value?.syncBlockData(nextBlock, selectedDefinition.value);
}

function updateCmsFormBinding(binding: import('@blockdesign/contracts').FormBinding): void {
  const block=selectedBlock.value,definition=selectedDefinition.value;if(!block||!definition||definition.ref.id!==CMS_FORM_ID)return;
  validateFormBinding(binding);
  const next={...structuredClone(block),formBinding:structuredClone(binding)};
  commit('form.binding',null,draft=>{const index=draft.blocks.findIndex(item=>item.instanceId===block.instanceId);if(index>=0)draft.blocks[index]=next;});
  bridge.value?.syncBlockData(next,definition);
}

function updateRepeaterField(field: FieldDefinition, value: JsonValue): void {
  const current = selectedBlock.value;
  const repeater = selectedRepeater.value;
  const row = selectedItem.value;
  if (!current || !repeater || !row || typeof row['__id'] !== 'string') return;
  const rows = current.manualData[repeater.key];
  if (!Array.isArray(rows)) return;
  const nextRows = rows.map((entry) => entry === row || (entry && typeof entry === 'object' && !Array.isArray(entry) && entry.__id === row['__id']) ? { ...entry, [field.key]: value } : entry) as JsonValue[];
  const nextBlock = { ...current, manualData: { ...current.manualData, [repeater.key]: nextRows } };
  commit(`repeater.field.change:${field.key}`, `item:${selection.value.blockId}:${row['__id']}:${field.key}`, (draft) => {
    const index = draft.blocks.findIndex((block) => block.instanceId === current.instanceId);
    if (index >= 0) draft.blocks[index] = nextBlock;
  });
  if (selectedDefinition.value) bridge.value?.syncBlockData(nextBlock, selectedDefinition.value);
}

function updateRepeater(operation: 'add' | 'duplicate' | 'remove' | 'move', itemId?: string, direction: -1 | 1 = 1, repeaterId?: string): void {
  const current = selectedBlock.value;
  const repeater = selectedDefinition.value?.repeaters.find((item) => item.repeaterId === repeaterId) ?? selectedRepeater.value ?? selectedDefinition.value?.repeaters[0];
  if (!current || !repeater) return;
  try {
    const action = operation === 'add'
      ? { type: 'add' as const }
      : operation === 'duplicate'
        ? { type: 'duplicate' as const, itemId: itemId! }
        : operation === 'remove'
          ? { type: 'remove' as const, itemId: itemId! }
          : { type: 'move' as const, itemId: itemId!, direction };
    const nextBlock = updateRepeaterModel(current, repeater, action);
    commit(`repeater.${operation}`, null, (draft) => {
      const index = draft.blocks.findIndex((block) => block.instanceId === current.instanceId);
      if (index >= 0) draft.blocks[index] = nextBlock;
    });
    if (selectedDefinition.value) bridge.value?.syncBlockData(nextBlock, selectedDefinition.value);
  } catch (error) {
    errorMessage.value = normalizeError(error).message;
  }
}

function selectLayer(block: BlockInstance): void {
  selection.value = { blockId: block.instanceId, definitionRef: block.definitionRef, nodeId: null, itemId: null, repeaterId: null, label: definitionMap.value.get(definitionKey(block.definitionRef))?.name ?? uiText('Blok') };
  const root = bridge.value?.editor.getWrapper()?.find(`[data-bd-block-id="${escapeSelector(block.instanceId)}"]`)[0];
  if (root) bridge.value?.editor.select(root);
}

function selectRepeaterItem(itemId: string, repeaterId?: string): void {
  const block = selectedBlock.value;
  if (!block) return;
  const repeater = selectedDefinition.value?.repeaters.find((item) => item.repeaterId === repeaterId) ?? selectedRepeater.value;
  if (!repeater) return;
  selection.value.itemId = itemId;
  selection.value.repeaterId = repeater.repeaterId;
  selection.value.nodeId = repeater.repeaterId;
  selection.value.label = repeater.label;
  const component = bridge.value?.editor.getWrapper()?.find(`[data-bd-item="${escapeSelector(itemId)}"]`)[0];
  if (component) bridge.value?.editor.select(component);
}

function addStructure(kind: 'section' | 'columns' | 'heading' | 'text' | 'image' | 'button' | 'accordion'): void {
  bridge.value?.insertStructure(kind);
  successMessage.value = uiText('Yapı taşı tuvale eklendi.');
  setTimeout(() => { successMessage.value = ''; }, 1800);
}

async function openHtmlImport(): Promise<void> {
  if (mode.value !== 'designer' || previewing.value) return;
  importOpen.value = true;
  importError.value = '';
  await nextTick();
  importDialog.value?.showModal();
}

function closeHtmlImport(): void {
  if (importDialog.value?.open) importDialog.value.close();
  importOpen.value = false;
}

function onHtmlImportClosed(): void { importOpen.value = false; }
function invalidateImport(): void { importAnalysis.value = null; selectedImportId.value = ''; }

async function readImportFile(event: Event, kind: 'html' | 'css'): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const contents = await file.text();
    if (kind === 'html') importHtml.value = contents;
    else importCss.value = contents;
    importAnalysis.value = null;
    importError.value = '';
  } catch (error) {
    importError.value = t('import.readFailed', 'Dosya okunamadı: {message}', { message: normalizeError(error).message });
  } finally {
    input.value = '';
  }
}

function analyzeImport(): void {
  try {
    if (!importHtml.value.trim()) throw new Error('Önce HTML yapıştır veya bir HTML dosyası seç.');
    importAnalysis.value = analyzeHtmlImport(importHtml.value, importCss.value, importBaseUrl.value.trim());
    selectedImportId.value = importAnalysis.value.candidates[0]?.id ?? '';
    importError.value = importAnalysis.value.candidates.length ? '' : t('import.noCandidates', 'İçe aktarılabilecek bir section veya article bulunamadı.');
  } catch (error) {
    importAnalysis.value = null;
    importError.value = t('import.analysisFailed', 'İçe aktarma incelenemedi: {message}', { message: normalizeError(error).message });
  }
}

function addSelectedImport(): void {
  const candidate = selectedImportCandidate.value;
  if (!candidate || !bridge.value) return;
  try {
    const regionRoot=sharedRegionDraft.value ? findRegionModel(sharedRegionDraft.value.ref) : null;
    bridge.value.importHtmlCandidate(candidate);
    if(sharedRegionDraft.value && regionRoot) {
      const imported=bridge.value.editor.getSelected();
      if(imported) {
        let template=prepareComponentTemplate(imported as unknown as ComponentModelView) as Record<string,JsonValue>;
        if(template['tagName']!==sharedRegionDraft.value.region)template={type:'default',tagName:sharedRegionDraft.value.region,attributes:{'data-bd-node':makeId('region')},components:[template]};
        const attrs=template['attributes'] as Record<string,JsonValue> ?? {};
        template['attributes']={...attrs,'data-bd-region-ref':definitionKey(sharedRegionDraft.value.ref),'data-bd-locked':'true'};
        imported.remove();const replacement=(regionRoot as unknown as Component).replaceWith(template as never);bridge.value.editor.select(replacement[0]);
        sharedRegionDraft.value={...sharedRegionDraft.value,componentTemplate:template,css:[sharedRegionDraft.value.css??'',candidate.css].join('\n')};
        bridge.value.setRegionEditing(sharedRegionDraft.value.ref);
      }
    }
    const current = doc.value.editorState['importedBlockStyles'];
    const styles = current && !Array.isArray(current) && typeof current === 'object' ? current as Record<string, JsonValue> : {};
    const currentReports = doc.value.editorState['importReports'];
    const reports = currentReports && !Array.isArray(currentReports) && typeof currentReports === 'object' ? currentReports as Record<string, JsonValue> : {};
    commit('html.import', null, (draft) => {
      draft.editorState['importedBlockStyles'] = { ...styles, [candidate.scopeId]: candidate.css };
      draft.editorState['importReports'] = { ...reports, [candidate.scopeId]: candidate.report as unknown as JsonValue };
    });
    closeHtmlImport();
    successMessage.value = uiText('Seçilen bölüm tuvale eklendi. Alan eşlemesi için bloğu taslak olarak kaydet.');
  } catch (error) {
    importError.value = normalizeError(error).message;
  }
}

function beginCustomBlockDraft(): void {
  const selected = bridge.value?.editor.getSelected();
  const attributes = selected?.getAttributes() ?? {};
  const rootNodeId = attributes['data-bd-node'];
  if (!selected || attributes['data-bd-container'] !== 'true' || typeof rootNodeId !== 'string') {
    errorMessage.value = uiText('Önce bölüm veya sütun kapsayıcısını seç.');
    return;
  }
  try {
    const componentTemplate = prepareComponentTemplate(selected as unknown as ComponentModelView);
    const label = selected.getEl()?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 48);
    customBlockDraft.value = {
      rootNodeId,
      componentTemplate,
      name: label || 'Yeni blok',
      description: 'Tasarım sisteminden oluşturulan özel blok.',
      category: 'Özel bloklar',
      fields: [],
      repeaters: [],
      defaultData: {},
      css: importedCssFor(selected),
    };
    pendingMapping.value = false;
    customRepeaterDraft.value = null;
    errorMessage.value = '';
    successMessage.value = uiText('Blok taslağı açıldı. Tuvalde metin veya görsel seçip alan ekle.');
  } catch (error) {
    errorMessage.value = t('import.blockFailed', 'Blok taslağı oluşturulamadı: {message}', { message: normalizeError(error).message });
  }
}

function beginExistingBlockDraft(definition: BlockDefinitionVersion): void {
  const root = bridge.value?.editor.getWrapper()?.components().models[0] as unknown as ComponentModelView | undefined;
  const attributes = root?.getAttributes() ?? {};
  const rootNodeId = attributes['data-bd-node'];
  if (!root || typeof rootNodeId !== 'string') {
    errorMessage.value = uiText('Bu blok düzenlenebilir bir bileşen olarak yüklenemedi.');
    return;
  }
  root.setAttributes({ ...attributes, 'data-bd-container': 'true' });
  customBlockDraft.value = {
    rootNodeId,
    componentTemplate: prepareComponentTemplate(root),
    name: definition.name,
    description: definition.description,
    category: definition.category,
    fields: structuredClone(definition.fields),
    repeaters: structuredClone(definition.repeaters),
    defaultData: structuredClone(definition.defaultData),
    css: definition.css ?? '',
    sourceBindings: structuredClone(definition.defaultSourceBindings ?? []),
    styleProperties: structuredClone(definition.stylePolicy.allowedProperties),
    behavior: definition.behavior ? structuredClone(definition.behavior) : undefined,
    sourceDefinition: structuredClone(definition),
  };
  if (definition.css) bridge.value?.editor.addStyle(definition.css);
  successMessage.value = t('block.draftOpened', '“{name}” blok taslağı açıldı. Tasarımını ve alan eşlemelerini güncelleyebilirsin.', { name: definition.name });
}

function cancelCustomBlockDraft(): void {
  customBlockDraft.value = null;
  customRepeaterDraft.value = null;
  pendingMapping.value = false;
  successMessage.value = '';
}

function beginCustomRepeaterDraft(): void {
  const selected = bridge.value?.editor.getSelected();
  const attributes = selected?.getAttributes() ?? {};
  const containerNodeId = attributes['data-bd-node'];
  if (!selected || selectedBlock.value || attributes['data-bd-container'] !== 'true' || typeof containerNodeId !== 'string' || !selectedIsInsideCustomDraftRoot()) {
    errorMessage.value = uiText('Tekrarlayıcı için blok taslağının içinden bir liste kapsayıcısı seç.');
    return;
  }
  const suggestion = selected.getEl()?.getAttribute('aria-label') || 'Öğeler';
  customRepeaterDraft.value = {
    repeaterId: makeId('repeater'), containerNodeId, itemNodeId: null,
    key: slugify(suggestion) || 'ogeler', label: suggestion,
    minItems: 0, maxItems: 20, itemFields: [], defaultItemData: {},
  };
  pendingMapping.value = false;
  errorMessage.value = '';
  successMessage.value = uiText('Liste kapsayıcısı seçildi. Tuvalde tekrarlanacak örnek öğeyi seç.');
}

function setCustomRepeaterItem(): void {
  const draft = customRepeaterDraft.value;
  const itemNodeId = draft ? selectedRepeaterSampleNodeId(draft.containerNodeId) : null;
  if (!draft || !itemNodeId || !canSetCustomRepeaterItem.value) {
    errorMessage.value = uiText('Örnek öğe olarak liste kapsayıcısının doğrudan içindeki bir bileşeni seç.');
    return;
  }
  customRepeaterDraft.value = { ...draft, itemNodeId, itemFields: [], defaultItemData: {} };
  const sample = bridge.value?.editor.getWrapper()?.find(`[data-bd-node="${escapeSelector(itemNodeId)}"]`).find((component) => component.getAttributes()['data-bd-node'] === itemNodeId);
  const sampleElement = sample?.getEl();
  const details = sampleElement?.matches('details') ? sampleElement : sampleElement?.querySelector('details');
  details?.setAttribute('open', '');
  pendingMapping.value = false;
  successMessage.value = uiText('Örnek öğe seçildi. İçindeki metinleri, görselleri ve bağlantıları alan olarak eşle.');
}

function selectedRepeaterSampleNodeId(containerNodeId: string): string | null {
  let current = bridge.value?.editor.getSelected();
  while (current) {
    const parentNodeId = current.parent()?.getAttributes()['data-bd-node'];
    if (parentNodeId === containerNodeId) {
      const nodeId = current.getAttributes()['data-bd-node'];
      return typeof nodeId === 'string' ? nodeId : null;
    }
    current = current.parent() ?? undefined;
  }
  const container = bridge.value?.editor.getWrapper()?.find(`[data-bd-node="${escapeSelector(containerNodeId)}"]`).find((component) => component.getAttributes()['data-bd-node'] === containerNodeId);
  const candidates = container?.components().models.filter((component) => typeof component.getAttributes()['data-bd-node'] === 'string') ?? [];
  if (candidates.length === 1) return candidates[0]!.getAttributes()['data-bd-node'] as string;
  return null;
}

function finishCustomRepeaterDraft(): void {
  const draft = customBlockDraft.value;
  const repeaterDraft = customRepeaterDraft.value;
  if (!draft || !repeaterDraft?.itemNodeId) return;
  const key = slugify(repeaterDraft.key);
  const minItems = repeaterDraft.minItems;
  const maxItems = repeaterDraft.maxItems;
  if (!repeaterDraft.label.trim() || !key) { errorMessage.value = uiText('Liste etiketi ve anahtarı gerekli.'); return; }
  if (!Number.isInteger(minItems) || !Number.isInteger(maxItems) || minItems < 0 || maxItems < 1 || maxItems > 100 || minItems > maxItems) {
    errorMessage.value = uiText('Minimum ve maksimum sayı 0–100 arasında olmalı; minimum, maksimumu aşamaz.');
    return;
  }
  if (!repeaterDraft.itemFields.length) { errorMessage.value = uiText('Listeye en az bir içerik alanı eşle.'); return; }
  const allKeys = new Set([...draft.fields.map((field) => field.key), ...draft.repeaters.map((item) => item.key)]);
  if (allKeys.has(key)) { errorMessage.value = uiText('Bu liste anahtarı blokta zaten kullanılıyor.'); return; }
  const repeater: RepeaterDefinition = {
    repeaterId: repeaterDraft.repeaterId,
    key,
    label: repeaterDraft.label.trim(),
    minItems,
    maxItems,
    itemFields: repeaterDraft.itemFields as unknown as FieldDefinition[],
    mappingTarget: { containerNodeId: repeaterDraft.containerNodeId, itemNodeId: repeaterDraft.itemNodeId },
    nesting: 'none',
  };
  const rows: JsonValue[] = Array.from({ length: minItems }, () => ({ __id: makeId('item'), ...repeaterDraft.defaultItemData }));
  customBlockDraft.value = { ...draft, repeaters: [...draft.repeaters, repeater], defaultData: { ...draft.defaultData, [key]: rows } };
  customRepeaterDraft.value = null;
  pendingMapping.value = false;
  successMessage.value = t('repeater.added', '“{name}” tekrarlayıcısı bloğa eklendi.', { name: repeater.label });
}

function cancelCustomRepeaterDraft(): void {
  customRepeaterDraft.value = null;
  pendingMapping.value = false;
  successMessage.value = '';
}

function openMappingDraft(): void {
  const selected = bridge.value?.editor.getSelected();
  const element = selected?.getEl();
  const tag = element?.tagName.toLowerCase();
  const text = element?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 36) ?? '';
  const label = element?.getAttribute('aria-label') || text || selection.value.label || 'Yeni alan';
  const type: FieldDefinition['type'] = tag === 'img' ? 'image' : tag === 'video' ? 'video' : tag === 'a' ? 'url' : text.length > 72 ? 'textarea' : 'text';
  mappingDraft.value = { label, key: slugify(label), type, required: false, options: '' };
  pendingMapping.value = true;
}

function selectedIsInsideNode(targetNodeId: string): boolean {
  let current = bridge.value?.editor.getSelected();
  if (!current || selection.value.blockId) return false;
  let descendant = false;
  while (current) {
    const attributes = current.getAttributes();
    if (attributes['data-bd-node'] === targetNodeId) return descendant;
    if (typeof attributes['data-bd-node'] === 'string') descendant = true;
    current = current.parent() ?? undefined;
  }
  return false;
}

function selectedIsInsideCustomDraftRoot(): boolean {
  const draft = customBlockDraft.value;
  return Boolean(draft && selectedIsInsideNode(draft.rootNodeId));
}

function selectedIsInsideCustomDraft(): boolean {
  const repeater = customRepeaterDraft.value;
  if (repeater) return Boolean(repeater.itemNodeId && selectedIsInsideNode(repeater.itemNodeId));
  return selectedIsInsideCustomDraftRoot();
}

function prepareComponentTemplate(model: ComponentModelView): JsonValue {
  const type = model.get('type');
  const content = model.get('content');
  if (type === 'textnode') return { type: 'textnode', content: typeof content === 'string' ? content : '' };
  const attributes: Record<string, JsonValue> = {};
  for (const [name, value] of Object.entries(model.getAttributes())) {
    if (name === 'data-bd-container' || name === 'data-bd-structure-kind' || name === 'data-bd-locked' || name === 'data-bd-region-ref' || name.toLowerCase().startsWith('on')) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) attributes[name] = value;
  }
  if (typeof attributes['class'] === 'string') attributes['class'] = attributes['class'].split(/\s+/).filter((item) => item && item !== 'bd-structure').join(' ');
  const styles: Record<string, JsonValue> = {};
  for (const [property, value] of Object.entries(model.getStyle())) {
    if (typeof value === 'string' || typeof value === 'number') styles[property] = String(value);
  }
  const components = model.components().models.map(prepareComponentTemplate);
  const result: Record<string, JsonValue> = {
    type: typeof type === 'string' ? type : 'default',
    tagName: typeof model.get('tagName') === 'string' ? model.get('tagName') as string : 'div',
    attributes,
    components,
  };
  if (Object.keys(styles).length) result['style'] = styles;
  if (!components.length && typeof content === 'string') result['content'] = content;
  return result;
}

function templateAttributes(value: JsonValue): Record<string, JsonValue> | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const attributes = (value as Record<string, JsonValue>)['attributes'];
  return attributes && !Array.isArray(attributes) && typeof attributes === 'object' ? attributes as Record<string, JsonValue> : null;
}

function editableBlockTemplate(definition: BlockDefinitionVersion): JsonValue {
  const source = structuredClone(definition.componentTemplate);
  let root: JsonValue | null = source;
  if (source && !Array.isArray(source) && typeof source === 'object') {
    const component = source as Record<string, JsonValue>;
    const children = Array.isArray(component['components']) ? component['components'] : [];
    if (component['type'] === 'wrapper') {
      if (children.length === 1 && children[0] && !Array.isArray(children[0]) && typeof children[0] === 'object' && (children[0] as Record<string, JsonValue>)['type'] !== 'textnode') root = children[0];
      else if (children.length) root = { type: 'default', tagName: 'section', attributes: {}, components: children };
      else root = null;
    }
  }
  if (!root) root = componentTemplateFromHtml(renderBlockMarkup(makeInstance(definition), definition));
  if (!root || Array.isArray(root) || typeof root !== 'object') throw new Error('Blok bileşen şablonu oluşturulamadı.');
  const attributes = templateAttributes(root);
  if (!attributes) throw new Error('Blok şablonunda düzenlenebilir bir kök bölüm bulunamadı.');
  delete attributes['data-bd-block-id'];
  delete attributes['data-bd-definition'];
  if (typeof attributes['data-bd-node'] !== 'string') attributes['data-bd-node'] = makeId('block-root');
  attributes['data-bd-container'] = 'true';
  return root;
}

function componentTemplateFromHtml(html: string): JsonValue | null {
  const root = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild;
  if (!root) return null;
  const convert = (element: Element): JsonValue => {
    const attributes: Record<string, JsonValue> = {};
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name === 'style' || attribute.name === 'data-bd-block-id' || attribute.name === 'data-bd-definition' || attribute.name.toLowerCase().startsWith('on')) continue;
      attributes[attribute.name] = attribute.value;
    }
    const styles: Record<string, JsonValue> = {};
    const style = (element as HTMLElement).style;
    for (let index = 0; index < style.length; index += 1) {
      const property = style.item(index);
      const value = style.getPropertyValue(property);
      if (property && value) styles[property] = value;
    }
    const components: JsonValue[] = [];
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) components.push(convert(child as Element));
      else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) components.push(child.textContent);
    }
    return {
      type: 'default',
      tagName: element.tagName.toLocaleLowerCase('en-US'),
      attributes,
      components,
      ...(Object.keys(styles).length ? { style: styles } : {}),
    };
  };
  const result = convert(root);
  const attributes = templateAttributes(result);
  if (attributes && typeof attributes['data-bd-node'] !== 'string') attributes['data-bd-node'] = makeId('block-root');
  return result;
}

function applyBlockSearch(): void {
  const blocks = bridge.value?.editor.Blocks;
  if (!blocks) return;
  const matches = new Set(matchingBlocks.value.map(definition => definitionKey(definition.ref)));
  const visible = blocks.getAll().models.filter(block => matches.has(String(block.get('attributes')?.['data-bd-drop-definition'] ?? '')));
  if (blockSearch.value.trim()) visible.forEach(block => block.category?.set('open', true));
  blocks.render(visible);
  if (blockRoot.value) blockRoot.value.scrollTop = 0;
}

function saveShortcut(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "s") {
    event.preventDefault();
    void saveDocument().catch(() => undefined);
  }
}

function removeSelectedBlock(): void {
  const id = selectedBlock.value?.instanceId;
  if (!id) return;
  const component = bridge.value?.editor.getWrapper()?.find("[data-bd-block-id=\"" + escapeSelector(id) + "\"]")[0];
  component?.remove();
}

async function togglePreview(): Promise<void> {
  await setPreview(!previewing.value);
}

async function setPreview(active: boolean): Promise<void> {
  if (previewing.value === active || !bridge.value) return;
  if (active && sharedRegionDraft.value) { errorMessage.value = uiText('Önizlemeden önce açık paylaşılan bölge taslağını kaydet veya iptal et.'); return; }
  try {
    if (active) {
      const sourceDocument = languageWidgetDocument(snapshotDocument());
      const resolution = await resolvePreviewDocument(sourceDocument, definitionMap.value, contentProviders, sharedRegions.value, sourceLocaleDefaults.value);
      bridge.value.syncDocument(resolution.document);
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      if (resolution.issues.length) {
        previewSourceIssue.value = resolution.issues[0]!.message;
        errorMessage.value = previewSourceIssue.value;
      }
    } else {
      bridge.value.syncDocument(snapshotDocument());
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      if (previewSourceIssue.value && errorMessage.value === previewSourceIssue.value) errorMessage.value = '';
      previewSourceIssue.value = null;
    }
    previewing.value = active;
    bridge.value.setPreview(active);
    bridge.value.setDesignSystemAssets(designSystemManifest.value);
    selection.value = active ? { blockId: null, definitionRef: null, nodeId: null, itemId: null, repeaterId: null, label: 'Önizleme' } : selection.value;
  } catch (error) { errorMessage.value = error instanceof Error ? error.message : t('preview.failed', 'Önizleme hazırlanamadı.'); }
}

function setEditorMode(next: EditorMode): void {
  if (next === 'designer' && props.options.permissions?.design === false) throw new Error('Host tasarım düzenlemeye izin vermiyor.');
  if (next !== 'designer' && sharedRegionDraft.value) cancelSharedRegionDraft();
  mode.value = next;
  bridge.value?.setMode(next);
  inspectorTab.value = 'content';
}

function undo(): void {
  const previous = history.undo(doc.value);
  if (!previous) return;
  doc.value = previous;
  generation.value += 1;
  savedState.value = 'dirty';
  bridge.value?.syncDocument(previous);
  emitChange('history.undo');
}

function redo(): void {
  const next = history.redo(doc.value);
  if (!next) return;
  doc.value = next;
  generation.value += 1;
  savedState.value = 'dirty';
  bridge.value?.syncDocument(next);
  emitChange('history.redo');
}

async function saveDocument(): Promise<SaveResult> {
  if (props.options.permissions?.save === false) throw new Error('Host kaydetmeye izin vermiyor.');
  if (customBlockDraft.value) throw new Error('Önce açık blok taslağını kataloğa kaydet veya taslağı iptal et.');
  if (sharedRegionDraft.value) throw new Error('Önce açık bölge sürümü taslağını kaydet veya taslağı iptal et.');
  if (savedState.value === 'saving') throw new Error('Kaydetme işlemi devam ediyor.');
  const activeTemplate = doc.value.templateRef ? templates.value.find((item) => definitionKey(item.ref) === definitionKey(doc.value.templateRef!)) ?? null : null;
  const missingMandatory = missingMandatoryBlockIds(activeTemplate, doc.value.blocks);
  if (missingMandatory.length) {
    const message = `Şablonun zorunlu blokları eksik: ${missingMandatory.join(', ')}.`;
    savedState.value = 'error'; errorMessage.value = message; throw new Error(message);
  }
  const issues = [...validateDocument(snapshotDocument(), definitionMap.value), ...sharedRegionValidationIssues.value,...extensionRegistry.validate(snapshotDocument())];
  if (issues.length) {
    savedState.value = 'error';
    errorMessage.value = issues[0]!.message;
    throw new Error(issues[0]!.message);
  }
  const submittedGeneration = generation.value;
  const submittedEpoch=documentEpoch;
  const submitted = snapshotDocument();
  savedState.value = 'saving';
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const result = await storage.save(submitted, submitted.revision, sourceRequestContext(null));
    if(submittedEpoch!==documentEpoch){props.options.onSave?.(result);return result;}
    backendAvailable.value = storage.getStatus?.() === 'available';
    doc.value = { ...doc.value, documentId: result.documentId, revision: result.revision };
    savedState.value = submittedGeneration === generation.value ? 'saved' : 'dirty';
    lastSavedGeneration.value = submittedGeneration;
    if(submittedGeneration===generation.value)discardDraft();
    if(props.options.appearance!=='embedded') {
      localStorage.setItem('blockdesign:last-document', result.documentId);
      const address = new URL(window.location.href);
      address.searchParams.set('document', result.documentId);
      window.history.replaceState(null, '', address);
    }
    props.options.onSave?.(result);
    successMessage.value = t('page.savedRevision', 'Kaydedildi · rev {revision}', { revision: result.revision });
    setTimeout(() => { successMessage.value = ''; }, 2400);
    return result;
  } catch (error) {
    const normalized = normalizeError(error);
    if(submittedEpoch!==documentEpoch)throw normalized;
    savedState.value = normalized.code === 'REVISION_CONFLICT' || normalized.code === 'CONFLICT' ? 'conflict' : 'error';
    errorMessage.value = normalized.message;
    props.options.onError?.(normalized);
    throw normalized;
  }
}

async function loadDocument(input: EditorDocument | string): Promise<EditorDocument> {
  const loaded = migrateDocumentLocalization(typeof input === 'string' ? await storage.load(input) : input, props.options.localization?.defaultLocale ?? props.options.language ?? 'tr');
  loaded.sharedRegionData ??= {};
  for(const ref of loaded.blocks.map(block=>block.definitionRef))if(!definitionMap.value.has(definitionKey(ref)))availableDefinitions.value=[...availableDefinitions.value,await library.getVersion(ref)];
  for(const ref of loaded.sharedRegionRefs)if(!sharedRegions.value.some(region=>definitionKey(region.ref)===definitionKey(ref)))sharedRegions.value=[...sharedRegions.value,await sharedRegionAdapter.getVersion(ref)];
  if(loaded.templateRef&&!templates.value.some(template=>definitionKey(template.ref)===definitionKey(loaded.templateRef!)))templates.value=[...templates.value,await templateAdapter.getVersion(loaded.templateRef)];
  await loadDesignSystemAssets(loaded.designSystemRef);
  backendAvailable.value = storage.getStatus?.() === 'available';
  const before = doc.value;
  documentEpoch++;
  history.push(before, null);
  sourcePreviewResolver.clear();
  sourcePreviewBlocks.value = {};
  doc.value = loaded;
  generation.value += 1;
  lastSavedGeneration.value = generation.value;
  savedState.value = 'saved';
  bridge.value?.syncDocument(loaded);
  for(const region of sharedRegions.value)if(region.css&&loaded.sharedRegionRefs.some(ref=>definitionKey(ref)===definitionKey(region.ref)))bridge.value?.editor.addStyle(region.css);
  selection.value = { blockId: null, definitionRef: null, nodeId: null, itemId: null, repeaterId: null, label: 'Tuval' };
  return structuredClone(loaded);
}

async function exportStatic(): Promise<PreviewExport> {
  if (props.options.permissions?.export === false) throw new Error('Host HTML çıktısına izin vermiyor.');
  if (!bridge.value) throw new Error('Tuval henüz hazır değil.');
  const original = snapshotDocument();
  const exportDocument = languageWidgetDocument(original);
  const resolution = await resolveDocumentSources(exportDocument, definitionMap.value, contentProviders, sharedRegions.value, sourceLocaleDefaults.value);
  const exportLocale = resolution.document.localization?.locale ?? 'tr';
  const seoValue = resolution.document.editorState['seo'];
  const seoMetadata = seoValue && !Array.isArray(seoValue) && typeof seoValue === 'object' ? seoValue : {};
  let seoVariants: PageLocaleVariant[] = [];
  let seoVariantIssue: string | undefined;
  if (resolution.document.localization?.pageGroupId && props.options.localizationAdapter) {
    try {
      seoVariants = await props.options.localizationAdapter.getPageVariants(resolution.document.localization.pageGroupId, sourceRequestContext(null));
    } catch (error) {
      seoVariantIssue = error instanceof Error ? error.message : uiText('Sayfa dil varyantları yüklenemedi.');
    }
  }
    const seoLinks = createLocaleSeoLinks(seoVariants, exportLocale, typeof seoMetadata['canonical'] === 'string' ? seoMetadata['canonical'] : undefined);
  bridge.value.syncDocument(resolution.document);
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  const rawReports = doc.value.editorState['importReports'];
  const reports = rawReports && !Array.isArray(rawReports) && typeof rawReports === 'object' ? Object.values(rawReports) : [];
  const issues = reports.flatMap((value) => {
    if (!value || Array.isArray(value) || typeof value !== 'object') return [];
    const report = value as Record<string, JsonValue>;
    const missing = Array.isArray(report['missing']) ? report['missing'].filter((item): item is string => typeof item === 'string') : [];
    const unsupported = Array.isArray(report['unsupported']) ? report['unsupported'].filter((item): item is string => typeof item === 'string') : [];
    return [
      ...missing.map((message) => ({ code: 'ASSET_UNRESOLVED', message })),
      ...unsupported.map((message) => ({ code: 'IMPORT_UNSUPPORTED', message })),
    ];
  });
  try {
    try{createPageHead(seoMetadata);}catch(error){issues.push({code:'PAGE_METADATA_INVALID',message:error instanceof Error?error.message:'Sayfa metadata değeri geçersiz.'});}
    // GrapesJS exports its wrapper as <body>; the downloadable document owns
    // that element. Keep exactly one body, rather than nesting two of them.
    const html = bridge.value.editor.getHtml().replace(/^\s*<body\b[^>]*>/i, '').replace(/<\/body>\s*$/i, '');
    const behavior = behaviorExportDependencies(editorBehaviors, html);
    const collections = collectionExport(html, props.options.collections?.publication);
    const forms = await prepareCmsFormExport(html,{...(props.options.forms?{providers:props.options.forms.providers}:{}),...(props.options.forms?.publication?{publication:props.options.forms.publication}:{}),context:sourceRequestContext(null)});
    const packaged = await packageExportAssets({
      html: forms.html,
      css: `${canvasCssForDesignSystem(BASE_CANVAS_CSS, doc.value.designSystemRef.id === 'system.studio-neutral')}\n${designSystemManifest.value.commonCss}\n${doc.value.sharedRegionRefs.map(ref=>sharedRegions.value.find(r=>definitionKey(r.ref)===definitionKey(ref))?.css??'').join('\n')}\n${canvasCssForDesignSystem(bridge.value.editor.getCss() ?? '', doc.value.designSystemRef.id === 'system.studio-neutral')}`,
      stylesheets: designSystemManifest.value.stylesheets.map(normalizeStylesheetUrl).filter((item): item is string => Boolean(item)),
      baseUrl: window.location.href,
    });
    return {
      html: packaged.html,
      css: packaged.css,
      js: [behavior.js,forms.js,collections.js].filter(Boolean).join('\n'),
      stylesheets: packaged.stylesheets,
      issues: [...issues, ...collections.issues, ...forms.issues, ...resolution.issues, ...validateDocument(resolution.document,definitionMap.value).map(issue=>({code:issue.code,message:issue.message})), ...packaged.issues,...extensionRegistry.validate(resolution.document).map(issue=>({code:issue.code,message:issue.message,...(issue.path?{path:issue.path}:{}),severity:'error' as const})), ...(seoVariantIssue ? [{ code: 'LOCALE_VARIANTS_UNAVAILABLE', message: seoVariantIssue }] : [])],
      exportedAt: new Date().toISOString(),
      metadata: seoMetadata,
      localization: { locale: exportLocale, direction: configuredLocalization.value?.locales.find(item => normalizeLocale(item.code) === normalizeLocale(exportLocale))?.direction ?? 'ltr', issues: resolution.issues.map(issue => ({ code: issue.code, message: issue.message, severity: issue.severity ?? 'error' })), ...seoLinks },
    };
  } finally {
    if (!previewing.value) {
      bridge.value.syncDocument(original);
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    }
    bridge.value.setDesignSystemAssets(designSystemManifest.value);
  }
}

async function downloadExport(): Promise<void> {
  const output = await exportStatic();
  exportReport.value = output.issues;
  if(props.options.publicationPolicy!=='permissive'&&!assessPublication(output).allowed){errorMessage.value='Yayın çıktısındaki hataları gider; ayrıntılar çıktı raporunda.';return;}
  if (props.options.localization?.strictExport && output.localization?.issues.some(issue => issue.severity === 'error')) {
    errorMessage.value = uiText('Çeviri hataları çözülmeden katı çoklu dil çıktısı indirilemez.');
    return;
  }
  const runtimeScript = output.js ? '<scr' + 'ipt>' + output.js + '</scr' + 'ipt>' : '';
  const language = output.localization?.locale ?? contentLocale.value;
  const direction = output.localization?.direction ?? 'ltr';
  const stylesheets = output.stylesheets.map((href) => `<link rel="stylesheet" href="${escapeHtmlAttribute(href)}">`).join('');
  const css = output.css.replace(/<\/style/gi, '<\\/style');
  const seo=doc.value.editorState['seo'];
  const metadata=seo&&typeof seo==='object'&&!Array.isArray(seo)?seo:{};
  const head=createPageHead(metadata);
  const canonical=output.localization?.canonicalUrl?`<link rel="canonical" href="${escapeHtmlAttribute(output.localization.canonicalUrl)}">`:'';
  const alternates=(output.localization?.alternates ?? []).map(item=>`<link rel="alternate" hreflang="${escapeHtmlAttribute(item.locale)}" href="${escapeHtmlAttribute(item.url)}">`).join('');
  const xDefault=output.localization?.xDefaultUrl?`<link rel="alternate" hreflang="x-default" href="${escapeHtmlAttribute(output.localization.xDefaultUrl)}">`:'';
  const html = `<!doctype html><html lang="${escapeHtmlAttribute(language)}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}${canonical}${alternates}${xDefault}${stylesheets}<style>${css}</style></head><body>${output.html}${runtimeScript}</body></html>`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  link.download = `${doc.value.documentId ?? 'blockdesign-page'}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
  successMessage.value = output.issues.length
    ? t('export.downloadedWithNotes', 'HTML indirildi · {count} statik çıktı notu var.', { count: output.issues.length })
    : t('export.downloaded', 'Statik HTML indirildi; erişilebilir medya ve stil bağımlılıkları pakete eklendi.');
}

function openConflictRecovery(): void {
  if (!doc.value.documentId) return;
  void loadDocument(doc.value.documentId).then(() => {
    savedState.value = 'saved';
    errorMessage.value = '';
  }).catch((error) => { errorMessage.value = normalizeError(error).message; });
}

function saveRecoveryCopy(): void {
  const contents = JSON.stringify(snapshotDocument(), null, 2);
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  anchor.download = `${doc.value.documentId ?? 'blockdesign-recovery'}.recovery.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function warnIfDirty(event: BeforeUnloadEvent): void {
  if (customBlockDraft.value || savedState.value === 'dirty' || savedState.value === 'saving' || savedState.value === 'error' || savedState.value === 'conflict') {
    event.preventDefault();
    event.returnValue = '';
  }
}

function resizeDevice(next: 'desktop' | 'tablet' | 'mobile'): void { device.value = next; nextTick(() => bridge.value?.resize()); }
function toggleMobilePanel(panel: 'library' | 'inspector'): void { mobilePanel.value = mobilePanel.value === panel ? null : panel; }
function displayValue(value: JsonValue | undefined): string { return value === undefined || value === null ? '' : String(value); }
function rowTitle(repeater: RepeaterDefinition, row: Record<string, JsonValue>): string {
  const firstField = repeater.itemFields[0];
  return displayValue(row[firstField?.key ?? 'question']) || 'Yeni öğe';
}
function rowList(repeater: NonNullable<typeof selectedRepeater.value>): Array<Record<string, JsonValue>> {
  const value = selectedBlock.value?.manualData[repeater.key];
  return Array.isArray(value) ? value.filter((item): item is Record<string, JsonValue> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : [];
}
function layerItems(value: JsonValue | undefined): Array<Record<string, JsonValue>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, JsonValue> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : [];
}
function hasCanvasContent(projectData: Record<string, JsonValue>): boolean {
  const visit = (value: JsonValue): boolean => {
    if (Array.isArray(value)) return value.some(visit);
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value['components']) && value['components'].length > 0) return true;
    return Object.values(value).some(visit);
  };
  return visit(projectData['pages'] ?? []);
}
function blockOrdinal(block: BlockInstance | null): number {
  return block ? doc.value.blocks.findIndex((item) => item.instanceId === block.instanceId) + 1 : 0;
}
function invalid(field: FieldDefinition, value: JsonValue | undefined): string {
  return validateFieldValue(field, value ?? field.defaultValue, field.key)[0]?.message ?? "";
}

function collectTemplateNodeIds(value: JsonValue, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTemplateNodeIds(item, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  const attributes = value['attributes'];
  if (attributes && !Array.isArray(attributes) && typeof attributes === 'object' && typeof attributes['data-bd-node'] === 'string') {
    result.add(attributes['data-bd-node']);
  }
  Object.values(value).forEach((item) => collectTemplateNodeIds(item, result));
  return result;
}

function addMappingForSelection(): void {
  const target = bridge.value?.editor.getSelected();
  const draft = customBlockDraft.value;
  const repeaterDraft = customRepeaterDraft.value;
  const repeaterTarget = Boolean(repeaterDraft?.itemNodeId && selectedIsInsideNode(repeaterDraft.itemNodeId));
  if (!target || !draft || !canMapCustomField.value) {
    errorMessage.value = uiText('Alan eklemek için taslak bloğun içinden bir öğe seç.');
    return;
  }
  const attributes = target.getAttributes();
  const targetNode = attributes['data-bd-node'];
  const element = target.getEl();
  if (typeof targetNode !== 'string' || !element) {
    errorMessage.value = uiText('Seçilen öğe kararlı bir alan kimliği taşımıyor.');
    return;
  }
  const label = mappingDraft.value.label.trim();
  const slug = slugify(mappingDraft.value.key || label);
  if (!label || !slug) { errorMessage.value = uiText('Alan adı ve anahtarı gerekli.'); return; }
  const existingFields = repeaterTarget ? repeaterDraft?.itemFields ?? [] : draft.fields;
  if (existingFields.some((field) => field.key === slug)) { errorMessage.value = uiText('Bu alan anahtarı bu listede zaten kullanılıyor.'); return; }
  if (existingFields.some((field) => field.mappingTarget.nodeId === targetNode)) { errorMessage.value = uiText('Seçili öğe bu taslakta zaten bir alana bağlı.'); return; }
  const type = mappingDraft.value.type;
  const tag = element.tagName.toLowerCase();
  let operation: FieldDefinition['mappingTarget']['operation'] = 'text';
  let property: string | undefined;
  let defaultValue: JsonValue = element.textContent?.trim() ?? '';
  let options: FieldDefinition['options'];
  if (type === 'image') {
    if (tag !== 'img') { errorMessage.value = uiText('Görsel alanı için tuvalde bir görsel öğesi seç.'); return; }
    operation = 'attribute'; property = 'src'; defaultValue = attributes['src'] ?? '';
  } else if (type === 'video') {
    if (tag !== 'video') { errorMessage.value = uiText('Video alanı için bir video öğesi seç.'); return; }
    operation = 'attribute'; property = 'src'; defaultValue = attributes['src'] ?? '';
  } else if (type === 'url' && tag === 'a') {
    operation = 'attribute'; property = 'href'; defaultValue = attributes['href'] ?? '';
  } else if (type === 'color') {
    operation = 'style'; property = 'color';
    defaultValue = element.ownerDocument.defaultView?.getComputedStyle(element).color || '#345b4c';
  } else if (type === 'boolean') {
    operation = 'booleanVisibility'; defaultValue = attributes['hidden'] === true;
  } else if (type === 'number') {
    const parsed = Number(defaultValue); defaultValue = Number.isFinite(parsed) ? parsed : 0;
  } else if (type === 'select') {
    options = mappingDraft.value.options.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
      const [optionLabel, optionValue] = item.includes('=') ? item.split('=', 2) : [item, item];
      return { label: optionLabel!.trim(), value: optionValue!.trim() };
    });
    if (!options.length) { errorMessage.value = uiText('Seçim alanı için virgülle ayrılmış seçenekler gir.'); return; }
    defaultValue = options[0]!.value;
  }
  const field: FieldDefinition = {
    fieldId: makeId('field'), key: slug, label, type, required: mappingDraft.value.required,
    defaultValue, mappingTarget: { nodeId: targetNode, operation, ...(property ? { property } : {}) },
    ...(options ? { options } : {}),
  };
  if (repeaterTarget && repeaterDraft) {
    customRepeaterDraft.value = {
      ...repeaterDraft,
      itemFields: [...repeaterDraft.itemFields, field],
      defaultItemData: { ...repeaterDraft.defaultItemData, [field.key]: structuredClone(defaultValue) },
    };
  } else {
    customBlockDraft.value = {
      ...draft,
      fields: [...draft.fields, field],
      defaultData: { ...draft.defaultData, [field.key]: structuredClone(defaultValue) },
    };
  }
  pendingMapping.value = false;
  errorMessage.value = '';
  successMessage.value = t('region.fieldAdded', '“{name}” alanı taslağa eklendi.', { name: field.label });
}

function removeDraftField(fieldKey: string, scope: 'block' | 'repeater' = 'block'): void {
  const draft = customBlockDraft.value;
  if (!draft) return;
  const repeaterDraft = customRepeaterDraft.value;
  if (scope === 'repeater' && repeaterDraft) {
    const itemFields = repeaterDraft.itemFields.filter((field) => field.key !== fieldKey);
    const defaultItemData = { ...repeaterDraft.defaultItemData };
    delete defaultItemData[fieldKey];
    customRepeaterDraft.value = { ...repeaterDraft, itemFields, defaultItemData };
    return;
  }
  const fields = draft.fields.filter((field) => field.key !== fieldKey);
  const defaultData = { ...draft.defaultData };
  delete defaultData[fieldKey];
  customBlockDraft.value = { ...draft, fields, defaultData };
}

function removeDraftRepeater(repeaterId: string): void {
  const draft = customBlockDraft.value;
  const repeater = draft?.repeaters.find((item) => item.repeaterId === repeaterId);
  if (!draft || !repeater) return;
  const defaultData = { ...draft.defaultData };
  delete defaultData[repeater.key];
  customBlockDraft.value = { ...draft, repeaters: draft.repeaters.filter((item) => item.repeaterId !== repeaterId), defaultData };
}

async function saveCustomBlock(): Promise<void> {
  if (props.options.permissions?.catalogWrite === false) { errorMessage.value=uiText('Host katalog yazmaya izin vermiyor.'); return; }
  const draft = customBlockDraft.value;
  if (!draft) return;
  if (customRepeaterDraft.value) { errorMessage.value = uiText('Kaydetmeden önce açık tekrarlayıcı taslağını ekle veya iptal et.'); return; }
  if (!draft.name.trim()) { errorMessage.value = uiText('Blok adı gerekli.'); return; }
  if (!library.create || !library.capabilities.supported.includes('create')) {
    errorMessage.value = uiText('Bağlı blok kataloğu yeni blok tanımı oluşturmayı desteklemiyor.');
    return;
  }
  const slug = slugify(draft.name);
  if (!slug) { errorMessage.value = uiText('Blok adı geçerli bir anahtar üretmiyor.'); return; }
  const liveRoot = bridge.value?.editor.getWrapper()?.find(`[data-bd-node="${escapeSelector(draft.rootNodeId)}"]`).find((component) => component.getAttributes()['data-bd-node'] === draft.rootNodeId);
  if (!liveRoot) { errorMessage.value = uiText('Blok kapsayıcısı tuvalde bulunamadı. Taslağı iptal edip yeniden başlat.'); return; }
  const componentTemplate = prepareComponentTemplate(liveRoot as unknown as ComponentModelView);
  const templateNodeIds = collectTemplateNodeIds(componentTemplate);
  const listProblems = repeaterDraftProblems(draft.repeaters, templateNodeIds, draft.defaultData);
  if(listProblems.length){errorMessage.value=listProblems.join(' ');return;}
  const missingTargets = [
    ...draft.fields.filter((field) => !templateNodeIds.has(field.mappingTarget.nodeId)).map((field) => field.label),
    ...draft.repeaters.flatMap((repeater) => [
      ...(repeater.mappingTarget && (!templateNodeIds.has(repeater.mappingTarget.containerNodeId) || !templateNodeIds.has(repeater.mappingTarget.itemNodeId)) ? [repeater.label] : []),
      ...repeater.itemFields.filter((field) => !templateNodeIds.has(field.mappingTarget.nodeId)).map((field) => `${repeater.label} / ${field.label}`),
    ]),
  ];
  if (missingTargets.length) { errorMessage.value = `Tuvalde bulunmayan alan eşlemesi: ${missingTargets.join(', ')}. Alanı yeniden eşle.`; return; }
  const sourceDefinition = draft.sourceDefinition;
  const blockId = sourceDefinition?.ref.id ?? `custom.${slug}.${makeId('block')}`;
  const latestVersion = availableDefinitions.value.filter((item) => item.ref.id === blockId).map((item) => item.ref.version).sort(compareVersions).at(-1) ?? sourceDefinition?.ref.version;
  const definition: BlockDefinitionVersion = {
    ...(sourceDefinition ? structuredClone(sourceDefinition) : {}),
    ref: { id: blockId, version: latestVersion ? nextPatchVersion(latestVersion) : '1.0.0' },
    designSystemRef: structuredClone(doc.value.designSystemRef),
    name: draft.name.trim(), description: draft.description.trim(), category: draft.category.trim() || 'Özel bloklar',
    preview: 'custom', componentTemplate,
    ...(draft.css ? { css: draft.css } : {}),
    fields: structuredClone(draft.fields), repeaters: structuredClone(draft.repeaters), defaultData: structuredClone(draft.defaultData),
    defaultSourceBindings: structuredClone(draft.sourceBindings ?? []),
    ...(draft.behavior ? {behavior:structuredClone(draft.behavior)} : {}),
    stylePolicy: { allowedProperties: draft.styleProperties ?? ['color','background-color','background-image','font-size','font-weight','text-align','padding'], structuralEdits: sourceDefinition?.stylePolicy.structuralEdits ?? false },
    sourceCapabilities: structuredClone(sourceDefinition?.sourceCapabilities ?? { modes: ['manual', 'selection', 'query'], target: ['block','field','repeater'] }), archived: false,
  };
  errorMessage.value = '';
  try {
    const ref = await library.create(definition);
    const savedDefinition = { ...definition, ref };
    storedDefinitionRefs.value = new Set([...storedDefinitionRefs.value, definitionKey(ref)]);
    const instance = makeInstance(savedDefinition);
    availableDefinitions.value = [...availableDefinitions.value, savedDefinition];
    bridge.value?.registerDefinition(savedDefinition);
    bridge.value?.convertSelectionToBlock(instance, savedDefinition, draft.rootNodeId);
    commit('block.definition.create', null, (document) => {
      document.blocks.push(instance);
      document.projectData = bridge.value?.captureProjectData() ?? document.projectData;
    });
    bridge.value?.setMode(mode.value);
    customBlockDraft.value = null;
    customRepeaterDraft.value = null;
    pendingMapping.value = false;
    successMessage.value = t('block.catalogSaved', '“{name}” blok kataloğuna kaydedildi.', { name: savedDefinition.name });
    props.options.onCatalogSave?.('block', ref);
  } catch (error) {
    const normalized = normalizeError(error);
    errorMessage.value = normalized.message;
    props.options.onError?.(normalized);
  }
}

const sectionVariant=ref('plain');
let completedStructureDrop=false;
const canvasNodes=computed(() => { generation.value; canvasProjectionRevision.value; selection.value.nodeId; const result:{id:string;label:string}[]=[];const seen=new Set<string>();
  const visit=(value:JsonValue,blockId='',itemId=''):void=>{if(Array.isArray(value)){value.forEach(child=>visit(child,blockId,itemId));return;}if(!value||typeof value!=='object')return;const attrs=value['attributes'];if(attrs&&typeof attrs==='object'&&!Array.isArray(attrs)){blockId=String(attrs['data-bd-block-id']??blockId);itemId=String(attrs['data-bd-item']??itemId);if(typeof attrs['data-bd-node']==='string'){const nodeId=attrs['data-bd-node'],id=JSON.stringify([blockId,itemId,nodeId]);if(!seen.has(id)){seen.add(id);result.push({id,label:String(value['tagName']??'div')+(attrs['class']?' .'+String(attrs['class']).split(' ')[0]:'')+' · '+nodeId.slice(-12)+(itemId?' · öğe '+itemId.slice(-5):'')});}}}if(Array.isArray(value['components']))value['components'].forEach(child=>visit(child,blockId,itemId));};
  const wrapper=bridge.value?.editor.getWrapper();if(wrapper)visit(prepareComponentTemplate(wrapper as unknown as ComponentModelView));return result;
});
const selectedCanvasNodeKey=computed(()=>JSON.stringify([selection.value.blockId??'',selection.value.itemId??'',selection.value.nodeId??'']));
function beginStructureDrag(kind:string,event:MouseEvent):void {
  if(event.button!==0||mode.value!=='designer'||!bridge.value)return;
  const ids:Record<string,string>={section:'bd-section',columns:'bd-columns',heading:'bd-heading',text:'bd-paragraph',image:'bd-image',button:'bd-link',accordion:'bd-drop-blockdesign.accordion-1.0.0'};
  const block=bridge.value.editor.Blocks.get(ids[kind] ?? kind);if(!block)return;
  if(kind!=='accordion'){
    const template=document.createElement('template');template.innerHTML=String(block.get('content'));
    for(const node of template.content.querySelectorAll<HTMLElement>('*')){node.dataset.bdNode=makeId('node');if(['SECTION','DIV','UL','LI'].includes(node.tagName))node.dataset.bdContainer='true';}
    if(kind==='section'&&sectionVariant.value!=='plain')template.content.firstElementChild?.classList.add('bd-section-'+sectionVariant.value);
    block.set('content',template.innerHTML);
  }
  completedStructureDrop=false;
  bridge.value.editor.once('block:drag:stop',(component)=>{completedStructureDrop=Boolean(component);});
  bridge.value.editor.Blocks.startDrag(block,event);
}
function quickStructure(kind:'section'|'columns'|'heading'|'text'|'image'|'button'|'accordion'):void {
  if(completedStructureDrop){completedStructureDrop=false;return;}
  if(kind==='accordion'){const definition=availableDefinitions.value.find(d=>d.ref.id==='blockdesign.accordion');if(definition)addBlock(definition);return;}
  addStructure(kind);
  if(kind==='section'&&sectionVariant.value!=='plain')bridge.value?.editor.getSelected()?.addClass('bd-section-'+sectionVariant.value);
}
const selectedNodeStyles = computed<Record<string, JsonValue>>(() => { generation.value; selection.value.nodeId; const target=bridge.value?.editor.getSelected(); return { ...(target?.getStyle() ?? {}), ...(selectedBlock.value?.styleOverrides ?? {}), ...(selection.value.nodeId ? selectedBlock.value?.nodeStyleOverrides?.[selection.value.nodeId] : {}) } as Record<string,JsonValue>; });
const selectedNodeClasses = computed(() => { generation.value; selection.value.nodeId; return String(bridge.value?.editor.getSelected()?.getAttributes()['class'] ?? ''); });
const authoringTemplate = computed<JsonValue>(() => {
  generation.value; selection.value.nodeId;
  const wrapper=bridge.value?.editor.getWrapper();
  const root=customBlockDraft.value ? wrapper?.find(`[data-bd-node="${escapeSelector(customBlockDraft.value.rootNodeId)}"]`)[0] : sharedRegionDraft.value ? wrapper?.find(`[data-bd-region-ref="${escapeSelector(definitionKey(sharedRegionDraft.value.ref))}"]`)[0] : undefined;
  return root ? prepareComponentTemplate(root as unknown as ComponentModelView) : customBlockDraft.value?.componentTemplate ?? sharedRegionDraft.value?.componentTemplate ?? {};
});
function updateBehaviorSetting(field:FieldDefinition,value:JsonValue):void {
  const current=selectedBlock.value;if(!current||!selectedDefinition.value)return;
  const next={...current,behaviorSettings:{...current.behaviorSettings,[field.key]:value}};
  commit('behavior.settings',null,draft=>{const i=draft.blocks.findIndex(b=>b.instanceId===current.instanceId);if(i>=0)draft.blocks[i]=next;});bridge.value?.syncBlockData(next,selectedDefinition.value);
}
function annotateBehavior(plugin:PreviewBehaviorPlugin,values:Record<string,JsonValue>):void {
  const target=bridge.value?.editor.getSelected();if(!target||mode.value!=='designer')return;
  const attrs={...target.getAttributes(),...plugin.rootAttributes,'data-bd-plugin':plugin.id,'data-bd-behavior-settings':JSON.stringify(Object.fromEntries((plugin.settings ?? []).map(field=>[field.key,values[field.key] ?? field.defaultValue])))};
  target.setAttributes(attrs);
  if(customBlockDraft.value && target.getAttributes()['data-bd-node']===customBlockDraft.value.rootNodeId)customBlockDraft.value={...customBlockDraft.value,behavior:{pluginId:plugin.id,settings:(plugin.settings ?? []).map(field=>({...field,defaultValue:values[field.key] ?? field.defaultValue}))}};
  commit('behavior.bind',null,draft=>{draft.projectData=bridge.value?.captureProjectData()??draft.projectData;});
}
function annotateBehaviorRole(attribute:string):void {
  if(!/^data-bd-[a-z-]+$/.test(attribute)||mode.value!=='designer')return;
  const target=bridge.value?.editor.getSelected();if(!target)return;target.setAttributes({...target.getAttributes(),[attribute]:''});
  commit('behavior.role',null,draft=>{draft.projectData=bridge.value?.captureProjectData()??draft.projectData;});
}
function updateDraftSources(kind:'block'|'region',bindings:SourceBinding[]):void {if(kind==='block'&&customBlockDraft.value)customBlockDraft.value={...customBlockDraft.value,sourceBindings:bindings};if(kind==='region'&&sharedRegionDraft.value)sharedRegionDraft.value={...sharedRegionDraft.value,sourceBindings:bindings};}
function replaceSourceBindings(bindings:SourceBinding[]):void {
  const current=selectedBlock.value;if(!current)return;
  commit('source.binding',null,draft=>{const i=draft.blocks.findIndex(b=>b.instanceId===current.instanceId);if(i>=0)draft.blocks[i]={...current,sourceBindings:bindings};});
}
function selectCanvasNode(nodeId: string): void {
  let blockId=selection.value.blockId??'',itemId='';if(nodeId.startsWith('[')){try{[blockId,itemId,nodeId]=JSON.parse(nodeId) as [string,string,string];}catch{return;}}
  const belongs=(node:Component,name:string,value:string)=>{if(!value)return true;let current:Component|undefined=node;while(current){if(current.getAttributes()[name]===value)return true;current=current.parent()??undefined;}return false;};
  const found=bridge.value?.editor.getWrapper()?.find(`[data-bd-node="${escapeSelector(nodeId)}"]`).find(node=>node.getAttributes()['data-bd-node']===nodeId&&belongs(node,'data-bd-block-id',blockId)&&belongs(node,'data-bd-item',itemId));
  if(found) { let element:HTMLElement|null|undefined = found.getEl(); while(element) { if(element.tagName === 'DETAILS') element.setAttribute('open',''); element=element.parentElement; } bridge.value?.editor.select(found); }
}
function updateCustomSchema(schema: {fields:FieldDefinition[];repeaters:RepeaterDefinition[];values:Record<string,JsonValue>}): void {
  if(!customBlockDraft.value)return;
  customBlockDraft.value={...customBlockDraft.value,fields:schema.fields,repeaters:schema.repeaters,defaultData:schema.values,componentTemplate:structuredClone(authoringTemplate.value)};
  generation.value+=1;
}
function updateRegionSchema(schema: {fields:FieldDefinition[];repeaters:RepeaterDefinition[];values:Record<string,JsonValue>}): void {
  if(!sharedRegionDraft.value)return;
  sharedRegionDraft.value={...sharedRegionDraft.value,fields:schema.fields,repeaters:schema.repeaters,defaultData:schema.values,componentTemplate:structuredClone(authoringTemplate.value)};
  generation.value+=1;
}
function replaceRepeaterData(repeater:RepeaterDefinition,value:JsonValue):void {
  const current=selectedBlock.value;if(!current||!selectedDefinition.value)return;
  const next={...current,manualData:{...current.manualData,[repeater.key]:value}};
  commit('repeater.edit',null,draft=>{const i=draft.blocks.findIndex(b=>b.instanceId===current.instanceId);if(i>=0)draft.blocks[i]=next;});
  bridge.value?.syncBlockData(next,selectedDefinition.value);
}
function updateRegionRepeater(region:SharedRegionDefinition,repeater:RepeaterDefinition,value:JsonValue):void {
  const key=definitionKey(region.ref),values={...doc.value.sharedRegionData?.[key],[repeater.key]:value};
  commit('region.repeater',null,draft=>{draft.sharedRegionData={...draft.sharedRegionData,[key]:values};},{syncRegion:region});
}
function repeaterDraftProblems(repeaters:RepeaterDefinition[],nodeIds:Set<string>,values:Record<string,JsonValue>):string[]{
  const problems:string[]=[];
  function walk(items:RepeaterDefinition[]){for(const item of items){if(!item.mappingTarget||!nodeIds.has(item.mappingTarget.containerNodeId)||!nodeIds.has(item.mappingTarget.itemNodeId))problems.push(`${item.label}: liste kapsayıcısı veya örnek öğe bulunamadı.`);for(const field of item.itemFields)if(!nodeIds.has(field.mappingTarget.nodeId))problems.push(`${item.label}: ${field.label} hedefi bulunamadı.`);walk(item.childRepeaters??[]);}}
  walk(repeaters);for(const item of repeaters)problems.push(...validateRepeaterRows(values[item.key],item,validateFieldValue,item.key).map(issue=>issue.message));return problems;
}
function updateNodeStyle(property:string,value:string):void {
  if(previewing.value||props.options.permissions?.styles===false|| (mode.value!=='designer'&&!selectedBlock.value))return;
  const target=bridge.value?.editor.getSelected();if(!target)return;
  const allowed=selectedDefinition.value?.stylePolicy.allowedProperties ?? [...EDITABLE_STYLE_PROPERTIES];
  if(!allowed.includes(property)||!safeStyleValue(property,value)){errorMessage.value=uiText('Bu stil özelliği veya değeri izin verilen biçimde değil.');return;}
  const block=selectedBlock.value,definition=selectedDefinition.value;
  if(block&&definition){
    const nodeId=target.getAttributes()['data-bd-node'];const isRoot=target.getAttributes()['data-bd-block-id']===block.instanceId;
    const next=isRoot||typeof nodeId!=='string'?{...block,styleOverrides:{...block.styleOverrides,[property]:value}}:{...block,nodeStyleOverrides:{...block.nodeStyleOverrides,[nodeId]:{...block.nodeStyleOverrides?.[nodeId],[property]:value}}};
    commit('style.change','style',draft=>{const i=draft.blocks.findIndex(b=>b.instanceId===block.instanceId);if(i>=0)draft.blocks[i]=next;});
    bridge.value?.syncBlockData(next,definition);
  }else{const styles={...target.getStyle()};if(value)styles[property]=value;else delete styles[property];target.setStyle(styles);commit('node.style','style',draft=>{draft.projectData=bridge.value?.captureProjectData()??draft.projectData;});}
}
function updateNodeClasses(value:string):void {
  if(mode.value!=='designer'||selectedBlock.value||previewing.value)return;
  const target=bridge.value?.editor.getSelected();if(!target)return;
  if(!/^[\w\s-]*$/.test(value)){errorMessage.value=uiText('CSS sınıf adlarını boşlukla ayır.');return;}
  target.setClass(value.trim().split(/\s+/).filter(Boolean));
  commit('node.classes',null,draft=>{draft.projectData=bridge.value?.captureProjectData()??draft.projectData;});
}

function handleBlockStyleChange(event: Event): void {
  if (mode.value !== 'designer' || !bridge.value || !selectedBlock.value || !selectedDefinition.value) return;
  const selected = bridge.value.editor.getSelected();
  if (!selected) return;
  const background = (event.target as HTMLInputElement).value;
  if (typeof background !== 'string') return;
  const instance = selectedBlock.value;
  const nextBlock = { ...instance, styleOverrides: { ...instance.styleOverrides, 'background-color': background } };
  commit('style.change', 'style', (draft) => {
    const index = draft.blocks.findIndex((block) => block.instanceId === instance.instanceId);
    if (index >= 0) draft.blocks[index] = nextBlock;
  });
}

function normalizeError(error: unknown): Error & { code?: string } {
  if (error instanceof Error) return error as Error & { code?: string };
  return new Error(String(error)) as Error & { code?: string };
}
function definitionKey(ref: VersionRef): string { return `${ref.id}@${ref.version}`; }
function escapeSelector(value: string): string { return CSS.escape(value); }
function escapeHtmlAttribute(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character); }
function slugify(value: string): string { return value.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function importedCssFor(component: ComponentModelView): string {
  const scope = component.getAttributes()['data-bd-import'];
  if (typeof scope !== 'string') return '';
  const imported = doc.value.editorState['importedBlockStyles'];
  return imported && !Array.isArray(imported) && typeof imported === 'object' && typeof imported[scope] === 'string' ? imported[scope] as string : '';
}
function makeImportPreview(candidate: HtmlImportAnalysis['candidates'][number]): string {
  const css = `${BASE_CANVAS_CSS}\n${candidate.css}`.replaceAll('<', '\\3C ');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline' https: http:; font-src data: https: http:"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${candidate.html}</body></html>`;
}
</script>

<template>
  <div class="bd-app" :class="{ 'is-preview': previewing }" :lang="uiLocale" :dir="uiDirection">
    <header v-if="props.options.showToolbar !== false" class="bd-topbar" :aria-label="uiText('Editör araç çubuğu')">
      <a v-if="props.options.appearance !== 'embedded'" class="bd-brand" href="#canvas" :aria-label="uiText('BlockDesign ana ekran')">
        <span class="bd-brand-mark" aria-hidden="true"><svg viewBox="0 0 28 28" fill="none"><rect x="3.5" y="3.5" width="9" height="9" rx="2"/><rect x="15.5" y="3.5" width="9" height="9" rx="2"/><rect x="3.5" y="15.5" width="9" height="9" rx="2"/><path d="M16 16h8v8h-8z" rx="2"/><path d="M18 20h4"/></svg></span>
        <span class="bd-brand-name">Block<span>Design</span></span>
      </a>
      <span class="bd-topbar-divider" aria-hidden="true"></span>
      <button class="bd-mobile-panel-button" :class="{ active: mobilePanel === 'library' }" :aria-label="uiText(mobilePanel === 'library' ? 'Blok panelini kapat' : 'Blok panelini aç')" :aria-expanded="mobilePanel === 'library'" :aria-controls="libraryPanelId" @click="toggleMobilePanel('library')"><Icon name="blocks" /></button>
      <button class="bd-mobile-panel-button" :class="{ active: mobilePanel === 'inspector' }" :aria-label="uiText(mobilePanel === 'inspector' ? 'Özellikler panelini kapat' : 'Özellikler panelini aç')" :aria-expanded="mobilePanel === 'inspector'" :aria-controls="inspectorPanelId" @click="toggleMobilePanel('inspector')"><Icon name="edit" /></button>
      <div class="bd-document-label"><span class="bd-status-dot" :class="`is-${savedState}`"></span><span>{{ props.options.workspaceLabel ?? 'SSS · Yeni sayfa' }}</span></div>
      <button class="bd-system-button" :title="uiText('Aktif tasarım sistemi')">{{ designSystemManifest.name }} <Icon name="chevron" /></button>
      <label v-if="configuredLocalization && configuredLocalization.locales.length > 1" class="bd-locale-switcher"><span>{{ t('editor.contentLanguage', 'İçerik dili') }}</span><select :value="contentLocale" :disabled="localeSwitchBusy" :aria-label="t('editor.contentLanguage', 'İçerik dili')" @change="askForLocale(($event.target as HTMLSelectElement).value)"><option v-for="locale in configuredLocalization.locales" :key="locale.code" :value="normalizeLocale(locale.code)">{{ locale.nativeLabel ?? locale.label }}<template v-if="pageLocaleVariants.some(item => normalizeLocale(item.locale) === normalizeLocale(locale.code) && item.status === 'draft')"> {{ uiText('· Taslak') }}</template><template v-else-if="pageLocaleVariants.some(item => normalizeLocale(item.locale) === normalizeLocale(locale.code) && item.status === 'missing')"> {{ uiText('· Çeviri yok') }}</template></option></select></label>
      <div class="bd-topbar-spacer"></div>
      <div class="bd-history-actions" :aria-label="uiText('Düzenleme geçmişi')">
        <button class="bd-icon-button" :disabled="!history.canUndo" :aria-label="t('editor.undo', 'Geri al')" :title="t('editor.undo', 'Geri al')" @click="undo"><Icon name="undo" /></button>
        <button class="bd-icon-button" :disabled="!history.canRedo" :aria-label="t('editor.redo', 'Yinele')" :title="t('editor.redo', 'Yinele')" @click="redo"><Icon name="redo" /></button>
      </div>
      <span class="bd-topbar-divider bd-history-divider" aria-hidden="true"></span>
      <div v-if="!props.options.workspaceStage && props.options.permissions?.design !== false" class="bd-mode-switch" :aria-label="uiText('Düzenleme modu')">
        <button :class="{ active: mode === 'designer' }" @click="setEditorMode('designer')">{{ t('editor.designBlocks', 'Blok tasarla') }}</button>
        <button :class="{ active: mode === 'content' }" @click="setEditorMode('content')">{{ t('editor.editContent', 'İçerik düzenle') }}</button>
      </div>
      <button class="bd-preview-button" :class="{ active: previewing }" @click="togglePreview"><Icon name="eye" /><span>{{ previewing ? t('editor.returnToEditing', 'Düzenlemeye dön') : t('editor.preview', 'Önizle') }}</span></button>
      <button v-if="storage.listRevisions && doc.documentId" type="button" class="bd-outline-button" :disabled="historyBusy" @click="loadRevisions()">Sayfa geçmişi</button>
      <button v-if="props.options.preview" type="button" class="bd-outline-button" @click="openHostPreview">Sitede önizle</button>
      <button class="bd-primary-button" :disabled="savedState === 'saving' || props.options.permissions?.save === false" @click="saveDocument"><Icon name="save" /><span>{{ savedState === 'saving' ? t('editor.saving', 'Kaydediliyor…') : t('editor.save', 'Kaydet') }}</span><kbd>⌘ S</kbd></button>
    </header>

    <section v-if="recoverableDraft" class="bd-feedback" role="status"><p>Bu sayfa için kaydedilmemiş bir taslak bulundu.</p><button type="button" @click="recoverDraft">Taslağı geri getir</button><button type="button" @click="discardDraft">Taslağı at</button></section>
    <section v-if="historyOpen" class="bd-feedback" aria-label="Sayfa sürümleri"><button type="button" @click="historyOpen=false">Geçmişi kapat</button><p>Eski sürümü taslağa almak yayındaki sayfayı değiştirmez. Kaydederek yeni bir sürüm oluşturabilirsin.</p><ul><li v-for="item in revisions" :key="item.revision"><button type="button" @click="previewRevision(item.revision)">Sürüm {{ item.revision }} · {{ new Date(item.savedAt).toLocaleString() }}</button></li></ul><button v-if="historyCursor" type="button" @click="loadRevisions(true)">Daha eski sürümler</button><template v-if="revisionPreview"><p>Seçili sürüm: {{ revisionPreview.revision }} · {{ revisionPreview.blocks.length }} blok; güncel sayfa {{ doc.blocks.length }} blok.</p><button type="button" :disabled="savedState==='saving' || props.options.permissions?.save===false" @click="restoreRevision">Bu sürümü taslağa al</button></template></section>
    <div v-if="pendingLocaleChoice" class="bd-locale-modal-backdrop" @keydown.esc.prevent="finishLocaleChange('stay')">
      <section class="bd-locale-modal" role="dialog" aria-modal="true" aria-labelledby="bd-locale-switch-title" aria-describedby="bd-locale-switch-description">
        <span class="bd-locale-modal-mark" aria-hidden="true"><Icon name="globe" /></span>
        <h2 id="bd-locale-switch-title">{{ t('locale.switchTitle', 'Dil değiştirilsin mi?') }}</h2>
        <p id="bd-locale-switch-description">{{ t('locale.switchBody', 'Açık sayfada kaydedilmemiş değişiklikler var. Diğer dili açmadan önce nasıl ilerleyeceğini seç.') }}</p>
        <p v-if="pendingLocaleChoice.variant?.status === 'missing'" class="bd-locale-modal-note">{{ uiText('Bu dilde henüz sayfa yok. Yeni varyant host uygulama tarafından oluşturulacak.') }}</p>
        <p v-if="localeSwitchIssue" class="bd-field-error" role="alert">{{ localeSwitchIssue }}</p>
        <div class="bd-locale-modal-actions">
          <button class="bd-draft-cancel" :disabled="localeSwitchBusy" @click="finishLocaleChange('stay')">{{ t('locale.stay', 'Burada kal') }}</button>
          <button class="bd-outline-button" :disabled="localeSwitchBusy" @click="finishLocaleChange('discard')">{{ localeVariantCreating ? t('locale.creatingVariant', 'Varyant oluşturuluyor…') : t('locale.discardAndSwitch', 'Kaydetmeden geç') }}</button>
          <button class="bd-primary-button" :disabled="localeSwitchBusy || props.options.permissions?.save === false" @click="finishLocaleChange('save')">{{ localeSwitchBusy ? t('locale.opening', 'Açılıyor…') : t('locale.saveAndSwitch', 'Kaydet ve geç') }}</button>
        </div>
      </section>
    </div>

    <div class="bd-workbench" :data-mode="mode" :data-preview="previewing ? 'true' : 'false'" :data-sidebar="mobilePanel === 'library' ? sidebarMode : 'closed'">
      <aside :id="libraryPanelId" class="bd-library-panel" :aria-label="uiText('Blok kütüphanesi')">
        <div class="bd-sidebar-heading">
          <div class="bd-tabs-minor">
            <button :class="{ selected: sidebarMode === 'blocks' }" @click="sidebarMode = 'blocks'"><Icon name="blocks" /> {{ uiText('Bloklar') }}</button>
            <button :class="{ selected: sidebarMode === 'layers' }" @click="sidebarMode = 'layers'"><Icon name="layers" /> {{ uiText('Katmanlar') }}</button>
          </div>
          <button v-if="mode === 'designer'" class="bd-square-small" :aria-label="uiText('Yapı taşı ekle')" :title="uiText('Yapı taşı ekle')" @click="sidebarMode = 'blocks'"><Icon name="plus" /></button>
        </div>
        <template v-if="sidebarMode === 'blocks'">
          <p class="bd-panel-kicker">{{ uiText('BLOK KÜTÜPHANESİ') }}</p>
          <label class="bd-search"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" stroke-width="1.5"/><path d="m13 13 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><input v-model="blockSearch" type="search" :placeholder="uiText('Blok ara')" :aria-label="uiText('Blok ara')" /></label>
          <template v-if="mode === 'designer' && !blockSearch.trim()">
            <p class="bd-section-label">{{ uiText('YAPI TAŞLARI') }}</p><label class="bd-section-variant">{{ uiText('Bölüm görünümü') }}<select v-model="sectionVariant" :aria-label="uiText('Bölüm görünümü')"><option value="plain">{{ uiText('Düz') }}</option><option value="surface">{{ uiText('Yüzey') }}</option><option value="contrast">{{ uiText('Kontrast') }}</option></select></label>
            <div class="bd-structure-grid">
              <button @mousedown="beginStructureDrag('section',$event)" @click="quickStructure('section')"><Icon name="grid" /><span>{{ uiText('Bölüm') }}</span></button>
              <button @mousedown="beginStructureDrag('columns',$event)" @click="quickStructure('columns')"><span class="bd-columns-glyph"><i></i><i></i></span><span>{{ uiText('İki sütun') }}</span></button>
              <button @mousedown="beginStructureDrag('heading',$event)" @click="quickStructure('heading')"><Icon name="type" /><span>{{ uiText('Başlık') }}</span></button>
              <button @mousedown="beginStructureDrag('text',$event)" @click="quickStructure('text')"><span class="bd-lines-glyph"><i></i><i></i><i></i></span><span>{{ uiText('Metin') }}</span></button>
              <button @mousedown="beginStructureDrag('image',$event)" @click="quickStructure('image')"><Icon name="image" /><span>{{ uiText('Görsel') }}</span></button>
              <button @mousedown="beginStructureDrag('button',$event)" @click="quickStructure('button')"><Icon name="link" /><span>{{ uiText('Buton') }}</span></button>
              <button @mousedown="beginStructureDrag('accordion',$event)" @click="quickStructure('accordion')"><Icon name="rows" /><span>{{ uiText('Akordiyon listesi') }}</span></button>
            </div>
            <button v-if="props.options.permissions?.import !== false" class="bd-import-launch" @click="openHtmlImport"><Icon name="upload" /><span>{{ uiText('HTML / CSS içe aktar') }}</span><small>{{ uiText('Mevcut tasarımdan blok adayı çıkar') }}</small></button>
            <p class="bd-section-label bd-section-spaced">{{ uiText('BİLEŞENLER') }}</p>
          </template>
        </template>
        <!-- GrapesJS owns this node's children; preserve it when switching sidebar tabs. -->
        <div v-show="sidebarMode === 'blocks'" ref="blockRoot" class="bd-block-tools"></div>
        <p v-if="sidebarMode === 'blocks' && blockSearch.trim() && !matchingBlocks.length" class="bd-layer-empty" role="status">{{ uiText('Blok bulunamadı. Başka bir ad veya kategori ara.') }}</p>
        <div v-if="sidebarMode === 'blocks'" class="bd-library-footer" role="status"><span class="bd-live-dot"></span> {{ blockSearch.trim() ? t('editor.librarySearchCount', '{count} sonuç', { count: matchingBlocks.length }) : t('editor.libraryComponentCount', '{count} bileşen', { count: matchingBlocks.length }) }} · {{ props.options.appearance === 'embedded' ? t('editor.embeddedLibrary', 'Bileşen kütüphanesi') : backendAvailable ? t('editor.apiConnected', 'Go API bağlı') : adapterStatus === 'offline' ? t('editor.browserDraft', 'Tarayıcı taslağı') : t('editor.sampleCatalog', 'Örnek katalog') }}</div>
        <template v-if="sidebarMode === 'layers'">
          <p class="bd-panel-kicker">{{ uiText('SAYFA KATMANLARI') }}</p>
          <div class="bd-layer-list">
            <div v-for="(block, index) in doc.blocks" :key="block.instanceId" class="bd-layer-block">
              <button class="bd-layer-row" :class="{ active: selection.blockId === block.instanceId }" @click="selectLayer(block)"><Icon name="grid" /><span>{{ definitionMap.get(definitionKey(block.definitionRef))?.name || uiText('Blok') }}</span><small>{{ index + 1 }}</small></button>
              <div v-if="layerItems(block.manualData.items).length" class="bd-layer-children">
                <button v-for="(row, rowIndex) in layerItems(block.manualData.items)" :key="typeof row.__id === 'string' ? row.__id : rowIndex" @click="selection.blockId !== block.instanceId ? selectLayer(block) : undefined; typeof row.__id === 'string' && selectRepeaterItem(row.__id, 'faq.items')" class="bd-layer-subrow"><span class="bd-layer-indent" aria-hidden="true"></span><span>{{ rowIndex + 1 }} · {{ displayValue(row.question) || uiText('Yeni soru') }}</span></button>
              </div>
            </div>
            <div v-if="!doc.blocks.length" class="bd-layer-empty">{{ uiText('Bloklar tuvale eklendiğinde burada görünür.') }}</div>
          </div>
        </template>
      </aside>

      <main id="canvas" class="bd-stage" :aria-label="uiText('Sayfa tuvali')">
        <div class="bd-stage-toolbar">
          <div class="bd-breadcrumb" :aria-label="uiText('Seçili öğe')">
            <button @click="selection = { blockId: null, definitionRef: null, nodeId: null, itemId: null, repeaterId: null, label: 'Tuval' }">{{ uiText('Sayfa') }}</button>
            <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb}-${index}`"><Icon name="chevron" /><span :class="{ current: index === breadcrumbs.length - 1 }">{{ crumb }}</span></template>
          </div>
          <div class="bd-device-switch" :aria-label="uiText('Önizleme genişliği')">
            <button :class="{ active: device === 'desktop' }" :aria-label="uiText('Masaüstü')" :title="uiText('Masaüstü')" @click="resizeDevice('desktop')"><Icon name="device" /></button>
            <button :class="{ active: device === 'tablet' }" :aria-label="uiText('Tablet')" :title="uiText('Tablet')" @click="resizeDevice('tablet')"><svg viewBox="0 0 24 24" class="bd-icon" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="2.8" width="14" height="18.4" rx="2"/><path d="M11 18h2"/></svg></button>
            <button :class="{ active: device === 'mobile' }" :aria-label="uiText('Telefon')" :title="uiText('Telefon')" @click="resizeDevice('mobile')"><svg viewBox="0 0 24 24" class="bd-icon" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg></button>
          </div>
          <button class="bd-zoom-label" :aria-label="uiText('Yakınlaştırma yüzde yüz')">100%</button>
        </div>
        <div class="bd-stage-scroll" :data-device="device">
          <div class="bd-canvas-frame" :data-device="device">
            <div class="bd-canvas-paper">
              <div v-if="canvasIsEmpty && mode === 'designer'" class="bd-empty-canvas"><span class="bd-empty-canvas-mark"><Icon name="grid" /></span><h1>{{ uiText('Sayfanı kurmaya başla') }}</h1><p>{{ uiText('Sol taraftan bir yapı taşı ekle veya blok kütüphanesinden hazır bir bölüm seç.') }}</p><button class="bd-outline-button" @click="addStructure('columns')"><Icon name="plus" /> {{ uiText('İki sütun ekle') }}</button></div>
              <div ref="host" class="bd-canvas-host" :class="{ 'canvas-is-empty': canvasIsEmpty && mode !== 'designer' }"></div>
            </div>
          </div>
        </div>
        <footer class="bd-stage-footer"><span><Icon name="device" /> {{ t('editor.devicePreview', '{device} önizlemesi', { device: device === 'desktop' ? t('editor.desktop', 'Masaüstü') : device === 'tablet' ? t('editor.tablet', 'Tablet') : t('editor.phone', 'Telefon') }) }}</span><span class="bd-footer-dot"></span><span>{{ mode === 'designer' ? t('editor.designLocks', 'Tasarım kilitleri açık') : t('editor.contentLocks', 'Yapı kilitli · Alanlar düzenlenebilir') }}</span><button v-if="props.options.permissions?.export !== false" class="bd-export-link" @click="downloadExport"><Icon name="arrow" /> {{ uiText('HTML indir') }}</button></footer>
      </main>

      <aside :id="inspectorPanelId" class="bd-inspector-panel" :class="{ 'mobile-open': mobilePanel === 'inspector' }" :aria-label="uiText('Özellikler paneli')">
        <div class="bd-inspector-heading"><div><p v-if="!customBlockDraft && !sharedRegionDraft" class="bd-panel-kicker">{{ uiText('ÖZELLİKLER') }}</p><h2>{{ customBlockDraft?.name || selectedDefinition?.name || sharedRegionDraft?.name || selectedSharedRegion?.name || selectionDisplayLabel || uiText('Sayfa ayarları') }}</h2></div><div v-if="selectedBlock" class="bd-inspector-heading-actions"><button v-if="canSaveBlockSettings" class="bd-square-small" :aria-label="uiText('Blok adını düzenle')" @click="inspectorTab = 'settings'"><Icon name="edit" /></button><button class="bd-square-small" :aria-label="uiText('Seçimi temizle')" @click="selection = { blockId: null, definitionRef: null, nodeId: null, itemId: null, repeaterId: null, regionRef: null, label: 'Tuval' }"><Icon name="close" /></button></div></div>
        <PageMetadataEditor v-if="!selectedBlock && !customBlockDraft && !sharedRegionDraft" :value="pageMetadata" :disabled="previewing || props.options.permissions?.save===false" @update="updatePageMetadata" />
        <label v-if="mode === 'designer'" class="bd-canvas-node-picker"><span>{{ uiText('Tuval öğesi seç') }}</span><select :value="selectedCanvasNodeKey" :aria-label="uiText('Tuval öğesi seç')" @change="selectCanvasNode(($event.target as HTMLSelectElement).value)"><option value="">{{ uiText('Tuvalden seç veya öğe ağacını kullan') }}</option><option v-for="node in canvasNodes" :key="node.id" :value="node.id">{{node.label}}</option></select></label>
        <template v-if="selectedBlock && selectedDefinition">
          <div class="bd-inspector-tabs"><button :class="{ active: inspectorTab === 'content' }" @click="inspectorTab = 'content'">{{ uiText('İçerik') }}</button><button :class="{ active: inspectorTab === 'styles' }" @click="inspectorTab = 'styles'">{{ uiText('Stil') }}</button><button v-if="canSaveBlockSettings" :class="{ active: inspectorTab === 'settings' }" @click="inspectorTab = 'settings'">{{ uiText('Ayarlar') }}</button><span class="bd-instance-tag">{{ blockOrdinal(selectedBlock) }}</span></div>
          <template v-if="inspectorTab === 'content'">
            <div class="bd-inspector-scroll">
              <p class="bd-draft-hint">{{ selectedDefinition.description }}</p>
              <CmsFormInspector v-if="selectedDefinition.ref.id===CMS_FORM_ID" :binding="selectedBlock.formBinding" :providers="props.options.forms?.providers ?? []" :context="sourceRequestContext(null)" :disabled="previewing" @update="updateCmsFormBinding" />
              <p v-if="sourcePreviewBusy[selectedBlock.instanceId]" class="bd-source-preview-status" role="status">{{ uiText('Kaynak verisi yükleniyor…') }}</p>
              <p v-else-if="sourcePreviewErrors[selectedBlock.instanceId]" class="bd-field-error" role="alert">{{ sourcePreviewErrors[selectedBlock.instanceId] }}</p>
              <section v-if="definitionUpgradeDiff" class="bd-version-diff"><b>{{ uiText('Yeni sürüm ·') }} {{ definitionUpgradeDiff.to }}</b><p>{{ definitionUpgradeDiff.addedFields.length }} {{ uiText('yeni alan ·') }} {{ definitionUpgradeDiff.removedFields.length }} {{ uiText('kaldırılan alan') }}</p><button class="bd-outline-button" @click="upgradeSelectedBlock">{{ uiText('Geçişi uygula') }}</button></section>
              <FieldEditor v-for="field in selectedFields" :key="field.fieldId" :field="field" :value="displayedBlock?.manualData[field.key] ?? field.defaultValue" :asset-adapter="assetAdapter" :disabled="previewing || Boolean(effectiveSourceBinding(selectedBlock, field) && effectiveSourceBinding(selectedBlock, field)?.mode !== 'manual')" :error="invalid(field,displayedBlock?.manualData[field.key])" @update="updateBlockField(field,$event)" />
              <SourceConfigEditor v-if="contentProviders.length && selectedDefinition.ref.id!==CMS_FORM_ID" :providers="contentProviders" :fields="supportsSourceTarget('field') ? selectedDefinition.fields : []" :repeaters="supportsSourceTarget('repeater') ? selectedDefinition.repeaters : []" :block-id="selectedDefinition.ref.id" :bindings="selectedBlock.sourceBindings" :disabled="previewing || blockSettingsSaving" :locales="configuredLocalization?.locales ?? []" :current-locale="contentLocale" :default-locale="configuredLocalization?.defaultLocale ?? props.options.language ?? 'tr'" :fallback="configuredLocalization?.fallback ?? { mode: 'none' }" @update="replaceSourceBindings" />
              <template v-for="repeater in selectedDefinition.repeaters" :key="repeater.repeaterId">
                <RepeaterEditor :definition="repeater" :value="displayedBlock?.manualData[repeater.key] ?? []" :asset-adapter="assetAdapter" :disabled="previewing || Boolean(bindingFor(repeater) && bindingFor(repeater)?.mode !== 'manual')" :selected-id="selection.itemId" @update="replaceRepeaterData(repeater,$event)" @select="selectRepeaterItem" />
                <p v-if="bindingFor(repeater) && bindingFor(repeater)?.mode !== 'manual'" class="bd-draft-hint">{{ uiText('Bu listenin önizlemesi bağlı kaynaktan üretilir. Manuel taslak korunur.') }}</p>
              </template>
              <section v-if="selectedDefinition.behavior"><h3>{{ uiText('Davranış ayarları') }}</h3><FieldEditor v-for="field in selectedDefinition.behavior.settings" :key="field.fieldId" :field="field" :value="selectedBlock.behaviorSettings?.[field.key] ?? field.defaultValue" :disabled="previewing" :error="invalid(field,selectedBlock.behaviorSettings?.[field.key] ?? field.defaultValue)" @update="updateBehaviorSetting(field,$event)" /></section>
              <p v-if="selectedBlock.sourceBindings.some(binding => binding.mode !== 'manual')" class="bd-source-preview-status">{{ uiText('Kaynak verisi tuvalde gösterilir; manuel taslak korunur.') }}</p>
              <div v-if="mode === 'designer' && props.options.permissions?.catalogWrite !== false" class="bd-region-actions"><button class="bd-draft-cancel" :disabled="!library.archive" @click="archiveSelectedDefinition">{{ uiText('Bileşen sürümünü arşivle') }}</button><button class="bd-draft-cancel" :disabled="!library.delete" @click="deleteSelectedDefinition">{{ uiText('Kullanılmayan sürümü sil') }}</button></div>
            </div>
          </template>
          <template v-else-if="inspectorTab === 'styles'">
            <div class="bd-inspector-scroll bd-style-panel">
              <NodeStyleEditor :values="selectedNodeStyles" :allowed="selectedDefinition.stylePolicy.allowedProperties" :disabled="props.options.permissions?.styles === false || previewing" :class-name="selectedNodeClasses" :allow-classes="false" @update="updateNodeStyle" @classes="updateNodeClasses" />
            </div>
          </template>
          <template v-else>
            <div class="bd-inspector-scroll bd-block-settings">
              <h3>{{ uiText('Blok bilgileri') }}</h3>
              <label class="bd-field-control"><span class="bd-field-label">{{ uiText('Blok adı') }}</span><input v-model="blockNameDraft" :disabled="blockSettingsSaving" /></label>
              <p class="bd-source-preview-status">{{ uiText('Değişiklikler yeni blok sürümü olarak kaydedilir.') }}</p>
              <button v-if="props.options.workspaceStage !== 'block'" class="bd-primary-button" :disabled="blockSettingsSaving || !blockNameDraft.trim()" @click="saveSelectedBlockSettings">{{ blockSettingsSaving ? t('editor.saving', 'Kaydediliyor…') : t('editor.saveBlockName', 'Blok adını kaydet') }}</button>
            </div>
          </template>
          <div v-if="canSaveBlockSettings && props.options.workspaceStage === 'block'" class="bd-authoring-footer">
            <button class="bd-primary-button bd-draft-save" :disabled="blockSettingsSaving || !blockNameDraft.trim()" @click="saveSelectedBlockSettings"><Icon name="save" /> {{ blockSettingsSaving ? t('editor.saving', 'Kaydediliyor…') : t('editor.saveBlockVersion', 'Yeni blok sürümünü kaydet') }}</button>
          </div>
        </template>
        <div v-else class="bd-inspector-empty" :class="{ 'bd-inspector-authoring': customBlockDraft || sharedRegionDraft }">
          <template v-if="sharedRegionDraft">
            <AuthoringInspector :template="authoringTemplate" :fields="sharedRegionDraft.fields" :repeaters="sharedRegionDraft.repeaters ?? []" :values="sharedRegionDraft.defaultData ?? {}" :selected-node-id="selection.nodeId" @update="updateRegionSchema" @select="selectCanvasNode">
              <template #styles>
                <NodeStyleEditor v-if="selection.nodeId" :values="selectedNodeStyles" :allowed="EDITABLE_STYLE_PROPERTIES.slice()" :class-name="selectedNodeClasses" :allow-classes="sharedRegionStructureEditable" @update="updateNodeStyle" @classes="updateNodeClasses" />
                <p v-else class="bd-authoring-notice">{{ uiText('Stilini değiştirmek için bir tuval öğesi seç.') }}</p>
              </template>
              <template #settings>
                <h3 class="bd-authoring-title">{{ uiText('Bölge bilgileri') }}</h3>
                <label class="bd-field-control"><span class="bd-field-label">{{ uiText('Bölge adı') }}</span><input v-model="sharedRegionDraft.name" /></label>
                <SourceConfigEditor v-if="contentProviders.length || sharedRegionDraft.sourceBindings?.length" :providers="contentProviders" :fields="sharedRegionDraft.fields" :repeaters="sharedRegionDraft.repeaters ?? []" :block-id="sharedRegionDraft.ref.id" :bindings="sharedRegionDraft.sourceBindings ?? []" :locales="configuredLocalization?.locales ?? []" :current-locale="contentLocale" :default-locale="configuredLocalization?.defaultLocale ?? props.options.language ?? 'tr'" :fallback="configuredLocalization?.fallback ?? { mode: 'none' }" @update="updateDraftSources('region',$event)" />
                <details class="bd-authoring-advanced">
                  <summary>{{ uiText('Gelişmiş ayarlar') }}</summary>
                  <div class="bd-schema-row-body">
                    <button class="bd-outline-button" @click="setSharedRegionStructureEditable(!sharedRegionStructureEditable)"><Icon name="edit" /> {{ sharedRegionStructureEditable ? t('editor.lockStructure', 'Yapıyı kilitle') : t('editor.editStructure', 'Yapıyı düzenle') }}</button>
                    <BehaviorDesigner :plugins="props.options.behaviorPlugins ?? []" :node-id="selection.nodeId" @apply="annotateBehavior" @role="annotateBehaviorRole" />
                  </div>
                </details>
              </template>
              <template #actions>
                <button class="bd-primary-button bd-draft-save" @click="saveSharedRegionVersion"><Icon name="save" /> {{ uiText('Yeni sürümü kaydet') }}</button>
                <button class="bd-draft-cancel" @click="cancelSharedRegionDraft">{{ uiText('Taslağı iptal et') }}</button>
              </template>
            </AuthoringInspector>
          </template>
          <template v-else-if="selectedSharedRegion">
            <div class="bd-inspector-scroll bd-page-settings">
              <span class="bd-empty-square"><Icon name="layers" /></span>
              <h3>{{ selectedSharedRegion.region === 'header' ? t('editor.headerRegion', 'Header bölgesi') : t('editor.footerRegion', 'Footer bölgesi') }} · v{{ selectedSharedRegion.ref.version }}</h3>
              <p>{{ uiText('Bu bölge şablon tarafından kilitlenir. İçerik modunda tanımlı alanları düzenle; tasarım modunda yeni bir sürüm oluştur.') }}</p>
              <div v-if="selectedSharedRegion.fields.length" class="bd-region-field-list"><FieldEditor v-for="field in selectedSharedRegion.fields" :key="field.fieldId" :field="field" :value="doc.sharedRegionData?.[definitionKey(selectedSharedRegion.ref)]?.[field.key] ?? field.defaultValue" :disabled="previewing || mode !== 'content'" :error="invalid(field, doc.sharedRegionData?.[definitionKey(selectedSharedRegion.ref)]?.[field.key] ?? field.defaultValue)" :asset-adapter="assetAdapter" @update="updateSharedRegionField(selectedSharedRegion, field, $event)" /></div>
              <p v-else class="bd-draft-hint">{{ uiText('Bu bölgede düzenlenebilir alan tanımlı değil.') }}</p>
              <RepeaterEditor v-for="repeater in selectedSharedRegion.repeaters ?? []" :key="repeater.repeaterId" :definition="repeater" :value="doc.sharedRegionData?.[definitionKey(selectedSharedRegion.ref)]?.[repeater.key] ?? selectedSharedRegion.defaultData?.[repeater.key] ?? []" :asset-adapter="assetAdapter" :disabled="previewing" @update="updateRegionRepeater(selectedSharedRegion,repeater,$event)" />
              <button v-if="mode === 'designer'" class="bd-outline-button" @click="beginSharedRegionDraft(definitionKey(selectedSharedRegion.ref))"><Icon name="edit" /> {{ uiText('Yeni bölge sürümü tasarla') }}</button>
              <button v-if="mode === 'designer' && !selectedSharedRegion.archived && sharedRegionAdapter.capabilities.supported.includes('archive')" class="bd-draft-cancel" @click="archiveSelectedSharedRegion"><Icon name="archive" /> {{ uiText('Bu bölge sürümünü arşivle') }}</button>
              <p v-if="selectedSharedRegion.archived" class="bd-draft-hint">{{ uiText('Bu sürüm arşivli. Mevcut sayfalarda kullanılabilir, yeni şablon seçiminde listelenmez.') }}</p>
              <p class="bd-template-regions"><b>{{ uiText('Tuval seçimi') }}</b><span>{{ selectionDisplayLabel }}{{ selection.nodeId ? ` · ${selection.nodeId}` : '' }}</span></p>
            </div>
          </template>
          <template v-else-if="customBlockDraft">
            <AuthoringInspector :template="authoringTemplate" :fields="customBlockDraft.fields" :repeaters="customBlockDraft.repeaters" :values="customBlockDraft.defaultData" :selected-node-id="selection.nodeId" @update="updateCustomSchema" @select="selectCanvasNode">
              <template #styles>
                <NodeStyleEditor v-if="selection.nodeId" :values="selectedNodeStyles" :allowed="EDITABLE_STYLE_PROPERTIES.slice()" :class-name="selectedNodeClasses" :allow-classes="true" @update="updateNodeStyle" @classes="updateNodeClasses" />
                <p v-else class="bd-authoring-notice">{{ uiText('Stilini değiştirmek için bir tuval öğesi seç.') }}</p>
              </template>
              <template #settings>
                <h3 class="bd-authoring-title">{{ uiText('Blok bilgileri') }}</h3>
                <label class="bd-field-control"><span class="bd-field-label">{{ uiText('Blok adı') }}</span><input v-model="customBlockDraft.name" /></label>
                <details class="bd-schema-tool">
                  <summary>{{ uiText('Katalog bilgileri') }}</summary>
                  <div class="bd-schema-row-body">
                    <label class="bd-field-control"><span class="bd-field-label">{{ uiText('Açıklama') }}</span><textarea v-model="customBlockDraft.description" rows="2" /></label>
                    <label class="bd-field-control"><span class="bd-field-label">{{ uiText('Kategori') }}</span><input v-model="customBlockDraft.category" /></label>
                  </div>
                </details>
                <SourceConfigEditor v-if="contentProviders.length || customBlockDraft.sourceBindings?.length" :providers="contentProviders" :fields="customBlockDraft.fields" :repeaters="customBlockDraft.repeaters" :block-id="customBlockDraft.rootNodeId" :bindings="customBlockDraft.sourceBindings ?? []" :locales="configuredLocalization?.locales ?? []" :current-locale="contentLocale" :default-locale="configuredLocalization?.defaultLocale ?? props.options.language ?? 'tr'" :fallback="configuredLocalization?.fallback ?? { mode: 'none' }" @update="updateDraftSources('block',$event)" />
                <details class="bd-authoring-advanced">
                  <summary>{{ uiText('Gelişmiş ayarlar') }}</summary>
                  <div class="bd-schema-row-body">
                    <h3 class="bd-authoring-title">{{ uiText('İzin verilen stiller') }}</h3>
                    <div class="bd-style-property-grid">
                      <label v-for="property in EDITABLE_STYLE_PROPERTIES" :key="property" class="bd-toggle-row">
                        <input type="checkbox" :checked="customDraftStyleProperties.includes(property)" @change="toggleCustomStyle(property, ($event.target as HTMLInputElement).checked)" />{{ property }}
                      </label>
                    </div>
                    <BehaviorDesigner :plugins="props.options.behaviorPlugins ?? []" :node-id="selection.nodeId" @apply="annotateBehavior" @role="annotateBehaviorRole" />
                  </div>
                </details>
              </template>
              <template #actions>
                <button class="bd-primary-button bd-draft-save" @click="saveCustomBlock"><Icon name="save" /> {{ customBlockDraft.sourceDefinition ? uiText('Yeni sürümü kaydet') : t('editor.catalogSaveBlock', 'Bloğu kataloğa kaydet') }}</button>
                <button class="bd-draft-cancel" @click="cancelCustomBlockDraft">{{ uiText('Taslağı iptal et') }}</button>
              </template>
            </AuthoringInspector>
          </template>
          <template v-else-if="canStartCustomDraft">
            <div class="bd-inspector-scroll bd-page-settings">
              <h3>{{ uiText('Bölüm ayarları') }}</h3>
              <NodeStyleEditor :values="selectedNodeStyles" :allowed="EDITABLE_STYLE_PROPERTIES.slice()" :class-name="selectedNodeClasses" :allow-classes="true" @update="updateNodeStyle" @classes="updateNodeClasses" />
              <p>{{ uiText('Bu bölüm ve içindeki tasarımı tekrar kullanmak için bileşen olarak kaydet.') }}</p>
              <button class="bd-outline-button" @click="beginCustomBlockDraft"><Icon name="plus" /> {{ uiText('Blok taslağı oluştur') }}</button>
            </div>
          </template>
          <template v-else-if="selection.nodeId && mode === 'designer'">
            <div class="bd-inspector-scroll">              <NodeStyleEditor :values="selectedNodeStyles" :allowed="EDITABLE_STYLE_PROPERTIES.slice()" :disabled="previewing" :class-name="selectedNodeClasses" :allow-classes="true" @update="updateNodeStyle" @classes="updateNodeClasses" />
</div>
          </template>
          <template v-else-if="props.options.workspaceStage === 'block'">
            <div class="bd-inspector-scroll bd-page-settings">
              <span class="bd-empty-square"><Icon name="blocks" /></span>
              <h3>{{ uiText('Yeni blok oluştur') }}</h3>
              <p>{{ uiText('Tuvale bir bölüm ekle veya HTML/CSS aktar. Bölümü seçip “Blok taslağı oluştur” ile kataloğa kaydet; metin ve görselleri sonradan düzenlenebilir alanlara eşle.') }}</p>
              <button class="bd-outline-button" @click="sidebarMode = 'blocks'">{{ uiText('Yapı taşlarını aç') }}</button>
            </div>
          </template>
          <template v-else-if="props.options.workspaceStage === 'template'">
            <div class="bd-inspector-scroll bd-page-settings">
              <span class="bd-empty-square"><Icon name="layers" /></span>
              <h3>{{ uiText('Sayfa şablonu') }}</h3>
              <p>{{ props.options.workspaceBaseViewName || uiText('Temel görünüm') }} {{ uiText('görünümünü kullanır. İçerik alanına blokları sürükle; header ve footer seçilen sürümlerde kilitli kalır.') }}</p>
              <section v-if="mode === 'designer' && props.options.permissions?.catalogWrite !== false && templateAdapter.create" class="bd-template-policy" aria-labelledby="bd-workspace-template-policy-title">
                <div><b id="bd-workspace-template-policy-title">{{ uiText('Şablon kuralları') }}</b><small>{{ workspaceTemplateRef ? t('template.newVersionFor', '{name} · v{version} için yeni sürüm', { name: templateName || selectedTemplate?.name || 'Şablon', version: workspaceTemplateRef.version }) : t('template.appliesToNew', 'Yeni şablona uygulanır') }}</small></div>
                <p>{{ uiText('İzin verilen kategorileri boş bırakırsan tüm kategoriler kullanılabilir.') }}</p>
                <fieldset><legend>{{ uiText('İzin verilen blok kategorileri') }}</legend><label v-for="category in templateCategories" :key="category"><input v-model="templateAllowedCategories" type="checkbox" :value="category" />{{ category }}</label><small v-if="!templateCategories.length">{{ uiText('Katalogda kategori bulunamadı.') }}</small></fieldset>
                <fieldset><legend>{{ uiText('Zorunlu bloklar') }}</legend><label v-for="definition in templatePolicyBlocks" :key="definition.ref.id"><input v-model="templateMandatoryBlockIds" type="checkbox" :value="definition.ref.id" />{{ definition.name }}</label><small v-if="!templatePolicyBlocks.length">{{ uiText('Katalogda blok bulunamadı.') }}</small></fieldset>
                <label class="bd-field-control"><span class="bd-field-label">{{ uiText('ŞABLON ADI') }}</span><input v-model="templateName" :placeholder="uiText('Örn. Ana sayfa')" /></label>
                <button class="bd-primary-button bd-draft-save" :disabled="!templateAdapter.capabilities.supported.includes('create')" @click="saveCurrentAsTemplate"><Icon name="save" /> {{ workspaceTemplateRef ? t('editor.saveTemplateVersion', 'Yeni şablon sürümünü kaydet') : t('editor.saveTemplate', 'Şablonu kaydet') }}</button>
              </section>
              <button class="bd-draft-cancel" @click="sidebarMode = 'blocks'">{{ uiText('Blok kataloğunu aç') }}</button>
            </div>
          </template>
          <template v-else-if="props.options.workspaceStage === 'page'">
            <div class="bd-inspector-scroll bd-page-settings">
              <span class="bd-empty-square"><Icon name="layers" /></span>
              <h3>{{ uiText('Sayfa içeriği') }}</h3>
              <p>{{ t('page.templateCopy', 'Bu sayfa “{name}” şablonunun bağımsız kopyasıdır. Buradaki blok ve alan değişiklikleri diğer sayfaları değiştirmez.', { name: selectedTemplate?.name || 'seçili şablon' }) }}</p>
              <div class="bd-template-regions"><b>{{ uiText('Kilitli bölgeler') }}</b><span>{{ uiText('Header ve footer şablon sürümüne bağlıdır. Sayfa içeriğini orta alana sürükleyerek düzenle.') }}</span><small>{{ t('template.regionCount', '{count} sürümlü bölge referansı bağlı', { count: doc.sharedRegionRefs.length }) }}</small></div>
              <button class="bd-draft-cancel" @click="sidebarMode = 'blocks'">{{ uiText('Blok kataloğunu aç') }}</button>
            </div>
          </template>
          <template v-else-if="props.options.workspaceStage === 'base-view'">
            <div class="bd-inspector-scroll bd-page-settings">
              <span class="bd-empty-square"><Icon name="layers" /></span>
              <h3>{{ uiText('Temel görünüm') }}</h3>
              <p>{{ t('workspace.regionDesign', '“{name}” için {region} tasarımını sürümlü olarak düzenle.', { name: props.options.workspaceBaseViewName || 'Bu görünüm', region: props.options.workspaceSharedRegionKind === 'header' ? 'header' : 'footer' }) }}</p>
              <p class="bd-draft-hint">{{ uiText('Tuvalde henüz düzenleme taslağı açık değil. Tasarım sürümü oluşturmak için aşağıdaki düğmeye bas.') }}</p>
              <button v-if="props.options.initialSharedRegionRef" class="bd-outline-button" @click="beginSharedRegionDraft(definitionKey(props.options.initialSharedRegionRef))">{{ uiText('Bölge taslağını aç') }}</button>
            </div>
          </template>
          <template v-else-if="props.options.appearance === 'embedded' && mode === 'content'">
            <div class="bd-inspector-scroll bd-page-settings"><h3>{{ uiText('İçerik düzenle') }}</h3><p>{{ uiText('Tuvalde bir menü, akordiyon, slider veya içerik öğesi seç. Yalnızca o öğenin alanları ve kaynak ayarları açılır.') }}</p></div>
          </template>
          <template v-else>
            <div class="bd-inspector-scroll bd-page-settings">
              <span class="bd-empty-square"><Icon name="layers" /></span>
              <h3>{{ uiText('Sayfa ayarları') }}</h3>
              <p>{{ uiText('Şablon sürümünü seç, header ve footer bölgelerini bağla; içerik alanına blok ekle.') }}</p>
              <label class="bd-field-control"><span class="bd-field-label">{{ uiText('SAYFA ŞABLONU') }}</span><select v-model="templateChoice"><option v-for="template in templates.filter((item) => !item.archived || definitionKey(item.ref) === (doc.templateRef ? definitionKey(doc.templateRef) : ''))" :key="definitionKey(template.ref)" :value="definitionKey(template.ref)">{{ template.name }} · v{{ template.ref.version }}{{ template.archived ? t('editor.archivedCurrentPage', ' · arşivli, mevcut sayfa') : '' }}</option></select></label>
              <label class="bd-field-control"><span class="bd-field-label">{{ uiText('HEADER SÜRÜMÜ') }}</span><select v-model="headerRegionChoice"><option v-for="region in sharedRegions.filter((item) => item.region === 'header' && (!item.archived || doc.sharedRegionRefs.some((ref) => definitionKey(ref) === definitionKey(item.ref))))" :key="definitionKey(region.ref)" :value="definitionKey(region.ref)">{{ region.name }} · v{{ region.ref.version }}{{ region.archived ? t('editor.archivedCurrentPage', ' · arşivli, mevcut sayfa') : '' }}</option></select></label>
              <label class="bd-field-control"><span class="bd-field-label">{{ uiText('FOOTER SÜRÜMÜ') }}</span><select v-model="footerRegionChoice"><option v-for="region in sharedRegions.filter((item) => item.region === 'footer' && (!item.archived || doc.sharedRegionRefs.some((ref) => definitionKey(ref) === definitionKey(item.ref))))" :key="definitionKey(region.ref)" :value="definitionKey(region.ref)">{{ region.name }} · v{{ region.ref.version }}{{ region.archived ? t('editor.archivedCurrentPage', ' · arşivli, mevcut sayfa') : '' }}</option></select></label>
              <button class="bd-outline-button" :disabled="!templateChoice" @click="applySelectedTemplate"><Icon name="layers" /> {{ uiText('Şablonu sayfaya uygula') }}</button>
              <div class="bd-template-regions"><b>{{ uiText('Paylaşılan bölgeler') }}</b><span>{{ uiText('Seçilen header ve footer sürümleri şablona uygulanır; bu alanlar tuvalde kilitli kalır.') }}</span><small>{{ t('template.regionCountStatus', '{count} sürümlü bölge referansı bağlı · {status}', { count: doc.sharedRegionRefs.length, status: sharedRegionAdapter.capabilities.supported.includes('create') ? t('template.catalogSupported', 'katalog destekleniyor') : t('template.catalogReadOnly', 'salt okunur katalog') }) }}</small></div>
              <section class="bd-system-assets">
                <div><b>{{ uiText('Ortak tasarım varlıkları') }}</b><small>{{ designSystemManifest.name }} {{ uiText('· iframe tuvaline bir kez yüklenir') }}</small></div>
                <label class="bd-field-control"><span class="bd-field-label">{{ uiText('TASARIM SİSTEMİ CSS') }}</span><textarea v-model="commonCssDraft" :disabled="mode !== 'designer' || !designSystemAdapter.capabilities.supported.includes('writeManifest')" rows="6" spellcheck="false" placeholder=":root { --brand: #345b4c; }" :aria-label="uiText('Ortak tasarım sistemi CSS')" /></label>
                <label class="bd-field-control"><span class="bd-field-label">{{ uiText('FONT VE STİL DOSYALARI · SATIR BAŞINA BİR ADRES') }}</span><textarea v-model="stylesheetDraft" :disabled="mode !== 'designer' || !designSystemAdapter.capabilities.supported.includes('writeManifest')" rows="3" spellcheck="false" :placeholder="uiText('https://fonts.example.com/site.css')" :aria-label="uiText('Tasarım sistemi stil dosyası adresleri')" /></label>
                <button class="bd-outline-button" :disabled="mode !== 'designer' || designAssetsSaving || !designSystemAdapter.capabilities.supported.includes('writeManifest')" @click="saveDesignSystemAssets"><Icon name="save" /> {{ designAssetsSaving ? t('editor.saving', 'Kaydediliyor…') : t('editor.saveDesignAssets', 'Varlıkları kaydet') }}</button>
                <small v-if="!designSystemAdapter.capabilities.supported.includes('writeManifest')">{{ uiText('Bağlı varlık adapter’ı salt okunur.') }}</small>
              </section>
              <section class="bd-template-policy" aria-labelledby="bd-template-policy-title">
                <div><b id="bd-template-policy-title">{{ uiText('Şablon kuralları') }}</b><small>{{ selectedTemplate ? t('template.draftVersionFor', '{name} · v{version} için yeni sürüm taslağı', { name: selectedTemplate.name, version: selectedTemplate.ref.version }) : t('template.newVersionDraft', 'Yeni şablon sürümüne uygulanır') }}</small></div>
                <p>{{ uiText('İzin verilen kategorileri boş bırakırsan tüm kategoriler kullanılabilir.') }}</p>
                <fieldset><legend>{{ uiText('İzin verilen blok kategorileri') }}</legend><label v-for="category in templateCategories" :key="category"><input v-model="templateAllowedCategories" type="checkbox" :value="category" />{{ category }}</label><small v-if="!templateCategories.length">{{ uiText('Katalogda kategori bulunamadı.') }}</small></fieldset>
                <fieldset><legend>{{ uiText('Zorunlu bloklar') }}</legend><label v-for="definition in templatePolicyBlocks" :key="definition.ref.id"><input v-model="templateMandatoryBlockIds" type="checkbox" :value="definition.ref.id" />{{ definition.name }}</label><small v-if="!templatePolicyBlocks.length">{{ uiText('Katalogda blok bulunamadı.') }}</small></fieldset>
                <label class="bd-field-control"><span class="bd-field-label">{{ uiText('ŞABLON ADI') }}</span><input v-model="templateName" :placeholder="selectedTemplate?.name ?? uiText('Örn. Kampanya sayfası')" /></label>
                <button class="bd-outline-button" :disabled="!templateAdapter.capabilities.supported.includes('create')" @click="saveCurrentAsTemplate"><Icon name="save" /> {{ selectedTemplate ? t('editor.saveTemplateVersion', 'Yeni şablon sürümünü kaydet') : t('editor.saveTemplate', 'Şablonu kaydet') }}</button>
              </section>
              <button v-if="mode === 'designer'" class="bd-draft-cancel" @click="sidebarMode = 'blocks'">{{ uiText('Blok kataloğunu aç') }}</button>
            </div>
          </template>
        </div>
        <footer v-if="selectedDefinition" class="bd-definition-footer"><span class="bd-version-mark">v{{ selectedDefinition.ref.version }}</span><span>{{ selectedDefinition.category }}</span><button v-if="newerDefinition(selectedDefinition)" :title="t('editor.upgrade', 'Yükselt v{version}', { version: newerDefinition(selectedDefinition)?.ref.version ?? '' })" @click="upgradeSelectedBlock"><Icon name="external" /></button><button v-if="mode === 'designer' && library.capabilities.supported.includes('create')" :title="uiText('Yeni blok sürümü oluştur')" @click="createDefinitionVersion"><Icon name="plus" /></button><button v-if="storedDefinitionRefs.has(definitionKey(selectedDefinition.ref)) && !selectedDefinition.archived && library.capabilities.supported.includes('archive')" :title="uiText('Bu sürümü arşivle')" @click="archiveSelectedDefinition"><Icon name="archive" /></button><button v-if="mode === 'designer' && storedDefinitionRefs.has(definitionKey(selectedDefinition.ref)) && library.capabilities.supported.includes('deleteUnused')" :title="uiText('Kullanılmayan sürümü sil')" @click="deleteSelectedDefinition"><Icon name="trash" /></button></footer>
      </aside>
    </div>

    <dialog v-if="importOpen" ref="importDialog" class="bd-import-dialog" aria-labelledby="bd-import-title" @close="onHtmlImportClosed" @cancel="importOpen = false">
      <div class="bd-import-shell">
        <header class="bd-import-header"><div><p class="bd-panel-kicker">{{ uiText('TASARIMI İÇE AKTAR') }}</p><h2 id="bd-import-title">{{ uiText('HTML ve CSS’ten blok oluştur') }}</h2><p>{{ uiText('İçeri alınan kod güvenlik için taranır. Aday bölümü seçip tuvale ekleyebilir, sonra alanlarını eşleyebilirsin.') }}</p></div><button class="bd-square-small" :aria-label="uiText('İçe aktarmayı kapat')" @click="closeHtmlImport"><Icon name="close" /></button></header>
        <div class="bd-import-source-grid">
          <label class="bd-import-source"><span>HTML <small>{{ uiText('Yapıştır veya .html dosyası seç') }}</small></span><input type="file" accept=".html,.htm,text/html" :aria-label="uiText('HTML dosyası seç')" @change="readImportFile($event, 'html')" /><textarea v-model="importHtml" rows="7" spellcheck="false" placeholder="<section>…</section>" :aria-label="uiText('İçe aktarılacak HTML')" @input="invalidateImport" /></label>
          <label class="bd-import-source"><span>CSS <small>{{ uiText('Sayfa içindeki style etiketleri de taranır') }}</small></span><input type="file" accept=".css,text/css" :aria-label="uiText('CSS dosyası seç')" @change="readImportFile($event, 'css')" /><textarea v-model="importCss" rows="7" spellcheck="false" placeholder=".section { … }" :aria-label="uiText('İçe aktarılacak CSS')" @input="invalidateImport" /></label>
          <label class="bd-import-base">{{ uiText('Kaynak taban adresi') }} <span>{{ uiText('Bağıl görsel ve font adreslerini çözmek için') }}</span><input v-model="importBaseUrl" type="url" :placeholder="uiText('https://example.com/pages/')" @input="invalidateImport" /></label>
          <button class="bd-outline-button bd-import-analyze" @click="analyzeImport"><Icon name="search" /> {{ uiText('Adayları bul ve güvenliği incele') }}</button>
        </div>
        <p v-if="importError" class="bd-import-error" role="alert">{{ importError }}</p>
        <div v-if="importAnalysis" class="bd-import-report" aria-live="polite">
          <p>{{ t('import.candidates', '{count} blok adayı · CSS ve içerik iframe içinde yalıtılmış önizlenir', { count: importAnalysis.candidates.length }) }}</p>
          <div class="bd-import-report-groups">
            <section><h3>{{ uiText('Korunan bağımlılıklar') }}</h3><p v-if="!importAnalysis.report.preserved.length">{{ uiText('Ek bağımlılık bulunmadı.') }}</p><ul v-else><li v-for="item in importAnalysis.report.preserved" :key="item">{{ item }}</li></ul></section>
            <section><h3>{{ uiText('Çıkarılan riskli içerik') }}</h3><p v-if="!importAnalysis.report.removed.length">{{ uiText('Riskli içerik bulunmadı.') }}</p><ul v-else><li v-for="item in importAnalysis.report.removed" :key="item">{{ item }}</li></ul></section>
            <section><h3>{{ uiText('Eksik varlıklar') }}</h3><p v-if="!importAnalysis.report.missing.length">{{ uiText('Çözümlenemeyen varlık yok.') }}</p><ul v-else><li v-for="item in importAnalysis.report.missing" :key="item">{{ item }}</li></ul></section>
            <section><h3>{{ uiText('Desteklenmeyen noktalar') }}</h3><p v-if="!importAnalysis.report.unsupported.length">{{ uiText('Desteklenmeyen özellik bulunmadı.') }}</p><ul v-else><li v-for="item in importAnalysis.report.unsupported" :key="item">{{ item }}</li></ul></section>
          </div>
        </div>
        <div v-if="importAnalysis?.candidates.length" class="bd-import-preview-area">
          <nav class="bd-import-candidates" :aria-label="uiText('Blok adayları')"><p class="bd-group-heading">{{ uiText('BLOK ADAYLARI') }}</p><button v-for="candidate in importAnalysis.candidates" :key="candidate.id" :class="{ selected: selectedImportId === candidate.id }" @click="selectedImportId = candidate.id"><strong>{{ candidate.label }}</strong><small>{{ candidate.tagName }} {{ uiText('· CSS bu alana kapsamlanır') }}</small></button></nav>
          <div class="bd-import-preview"><div class="bd-import-preview-heading"><span>{{ uiText('Seçili adayın önizlemesi') }}</span><span>{{ selectedImportCandidate?.tagName }}</span></div><iframe v-if="selectedImportCandidate" :key="selectedImportCandidate.id" :srcdoc="importPreviewSrcdoc" :title="uiText('İçe aktarılan HTML bloğunun güvenli önizlemesi')" sandbox="" /></div>
        </div>
        <footer class="bd-import-footer"><span>{{ uiText('Script, olay işleyicileri ve javascript: adresleri çalıştırılmaz.') }}</span><div><button class="bd-draft-cancel" @click="closeHtmlImport">{{ uiText('Vazgeç') }}</button><button class="bd-primary-button" :disabled="!selectedImportCandidate" @click="addSelectedImport"><Icon name="plus" /> {{ uiText('Seçili bölümü tuvale ekle') }}</button></div></footer>
      </div>
    </dialog>

    <div v-if="savedState === 'saving'" class="bd-toast is-saving" role="status"><span class="bd-toast-spinner"></span> {{ uiText('Kaydediliyor…') }}</div>
    <div v-else-if="successMessage" class="bd-toast is-success" role="status"><Icon name="check" /> {{ successMessage }}</div>
    <section v-if="exportReport?.length" class="bd-export-report" role="status" aria-live="polite" :aria-label="uiText('Statik çıktı raporu')">
      <header><strong>{{ uiText('Statik çıktı notları') }}</strong><button class="bd-alert-close" :aria-label="uiText('Çıktı raporunu kapat')" @click="exportReport = null"><Icon name="close" /></button></header>
      <ul><li v-for="(issue, index) in exportReport" :key="`${issue.code}-${index}`"><strong>{{ issue.code }}</strong> · {{ issue.message }}</li></ul>
    </section>
    <div v-if="errorMessage" class="bd-alert-banner" :class="{ 'is-conflict': savedState === 'conflict' }" role="alert"><Icon name="alert" /><span>{{ errorMessage }}</span><button v-if="savedState === 'conflict'" @click="openConflictRecovery">{{ uiText('Sunucu sürümünü yükle') }}</button><button v-if="savedState === 'conflict' || savedState === 'error'" @click="saveRecoveryCopy">{{ uiText('Yerel taslağı indir') }}</button><button class="bd-alert-close" :aria-label="uiText('Bildirimi kapat')" @click="errorMessage = ''"><Icon name="close" /></button></div>
    <div v-if="validationIssues.length && savedState === 'dirty'" class="bd-validation-flag" role="status"><Icon name="alert" /> {{ issueCount }} {{ uiText('alan doğrulanmalı') }}</div>
  </div>
</template>

