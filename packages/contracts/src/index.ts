export type JsonPrimitive = string | number | boolean | null;
export type * from './forms.ts';
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richText'
  | 'url'
  | 'image'
  | 'video'
  | 'number'
  | 'boolean'
  | 'select'
  | 'color';

export interface VersionRef {
  id: string;
  version: string;
}

export interface FieldDefinition {
  fieldId: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: JsonValue;
  mappingTarget: {
    nodeId: string;
    operation: 'text' | 'textSegment' | 'safeRichText' | 'attribute' | 'style' | 'booleanVisibility';
    property?: string;
  };
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
}

export interface RepeaterDefinition {
  repeaterId: string;
  key: string;
  label: string;
  minItems: number;
  maxItems: number;
  itemFields: FieldDefinition[];
  mappingTarget?: {
    containerNodeId: string;
    itemNodeId: string;
    replaceChildren?: boolean;
  };
  nesting: 'none' | 'children';
  /** Explicit child lists with their own template container and item schema. */
  childRepeaters?: RepeaterDefinition[];
}

export interface BlockDefinitionVersion {
  ref: VersionRef;
  designSystemRef: VersionRef;
  name: string;
  description: string;
  category: string;
  preview: string;
  componentTemplate: JsonValue;
  /** CSS parsed and scoped to the block root during import. */
  css?: string;
  fields: FieldDefinition[];
  repeaters: RepeaterDefinition[];
  defaultData: Record<string, JsonValue>;
  defaultSourceBindings?: SourceBinding[];
  behavior?: { pluginId: string; settings: FieldDefinition[] };
  stylePolicy: {
    allowedProperties: string[];
    structuralEdits: boolean;
  };
  sourceCapabilities: {
    modes: Array<'manual' | 'selection' | 'query'>;
    target: 'block' | 'field' | 'repeater' | Array<'block' | 'field' | 'repeater'>;
  };
  archived: boolean;
}

export interface SourceBinding {
  /** Opt-in interactive query list; saved query remains the initial/default query. */
  live?: { filters: Array<{ fieldId: string; label: string; operator: 'eq' | 'contains' | 'gt' | 'lt' }>; syncUrl?: boolean };
  bindingId: string;
  target: { scope: 'block' | 'field' | 'repeater'; id: string };
  mode: 'manual' | 'selection' | 'query';
  providerId: string | null;
  collectionId: string | null;
  schemaVersion: string | null;
  recordRefs: string[];
  groupRef: string | null;
  query: {
    filters: Array<{
      fieldId: string;
      operator: 'eq' | 'contains' | 'gt' | 'lt';
      value: JsonValue;
    }>;
    sort: { fieldId: string; direction: 'asc' | 'desc' } | null;
    limit: number | null;
  } | null;
  fieldMappings: Array<{ from: string; to: string }>;
  /** Defaults to the page's content locale. */
  locale?: { mode: 'inherit' } | { mode: 'fixed'; locale: string };
}

export interface BlockInstance {
  formBinding?: import('./forms.ts').FormBinding;
  instanceId: string;
  definitionRef: VersionRef;
  variant: string | null;
  manualData: Record<string, JsonValue>;
  sourceBindings: SourceBinding[];
  styleOverrides: Record<string, JsonValue>;
  nodeStyleOverrides?: Record<string, Record<string, JsonValue>>;
  behaviorSettings?: Record<string, JsonValue>;
}

export interface EditorDocument {
  documentVersion: number;
  documentId?: string;
  documentKind: 'page' | 'blockDraft';
  engine: 'grapesjs';
  engineVersion: string;
  revision: string | null;
  designSystemRef: VersionRef;
  templateRef: VersionRef | null;
  sharedRegionRefs: VersionRef[];
  /** Per-page values for version-pinned shared-region fields, keyed by `id@version`. */
  sharedRegionData?: Record<string, Record<string, JsonValue>>;
  blocks: BlockInstance[];
  projectData: Record<string, JsonValue>;
  editorState: Record<string, JsonValue>;
  /** Locale and optional translation-family identity for this page variant. */
  localization?: { locale: string; pageGroupId?: string };
}

export interface Capability {
  supported: string[];
  constraints?: Record<string, JsonValue>;
}

export interface RequestContext {
  cursor?: string;
  /** Host-owned context. These values are never authorization credentials. */
  page?: { documentId?: string; siteId?: string; recordId?: string; route?: Record<string, string>; preview?: boolean };
  signal?: AbortSignal;
  requestId?: string;
  contentLocale?: ContentLocaleContext;
}

export interface ContentLocaleContext {
  locale: string;
  fallback: { mode: 'none' } | { mode: 'locale'; locale: string };
}

export interface LocaleDefinition {
  code: string;
  label: string;
  nativeLabel?: string;
  direction: 'ltr' | 'rtl';
}

export interface LocalizationOptions {
  uiLocale?: string;
  defaultLocale: string;
  locales: LocaleDefinition[];
  fallback: ContentLocaleContext['fallback'];
  /** Prevent the editor's download action when a source has an error-level locale issue. */
  strictExport?: boolean;
  /** Host-owned UI dictionary lookup, separate from the page's content language. */
  translate?: (key: string, locale: string, values?: Record<string, string | number>) => string | undefined;
}

export interface PageLocaleVariant {
  locale: string;
  documentId?: string;
  url?: string;
  status: 'draft' | 'published' | 'missing';
  /** Marks this published public URL as the explicit hreflang="x-default" target. */
  xDefault?: boolean;
}

export interface LocalizationAdapter {
  getPageVariants(pageGroupId: string, context?: RequestContext): Promise<PageLocaleVariant[]>;
}

export interface ContentLocaleResolution {
  requestedLocale: string;
  resolvedLocale: string;
  usedFallback: boolean;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AdapterError {
  code: string;
  message: string;
  path?: string;
  details?: JsonValue;
  recoverable: boolean;
  requestId?: string;
}

export interface SaveResult {
  documentId: string;
  revision: string;
  savedAt: string;
}

export interface StorageAdapter {
  listRevisions?(documentId: string, context?: RequestContext): Promise<PageResult<{revision:string;savedAt:string}>>;
  loadRevision?(documentId: string, revision:string, context?: RequestContext): Promise<EditorDocument>;
  readonly capabilities: Capability;
  getStatus?(): 'available' | 'offline' | 'unknown';
  load(documentId: string, context?: RequestContext): Promise<EditorDocument>;
  save(
    document: EditorDocument,
    expectedRevision: string | null,
    context?: RequestContext,
  ): Promise<SaveResult>;
}

export interface BlockLibraryAdapter {
  readonly capabilities: Capability;
  list(input: {
    designSystemRef: VersionRef;
    query?: string;
    cursor?: string;
    includeArchived?: boolean;
  }, context?: RequestContext): Promise<PageResult<BlockDefinitionVersion>>;
  getVersion(ref: VersionRef, context?: RequestContext): Promise<BlockDefinitionVersion>;
  create?(definition: BlockDefinitionVersion, context?: RequestContext): Promise<VersionRef>;
  archive?(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void>;
  delete?(ref: VersionRef, context?: RequestContext): Promise<void>;
}

export interface SharedRegionDefinition {
  ref: VersionRef;
  designSystemRef: VersionRef;
  name: string;
  region: 'header' | 'footer' | 'custom';
  componentTemplate: JsonValue;
  css?: string;
  fields: FieldDefinition[];
  repeaters?: RepeaterDefinition[];
  defaultData?: Record<string, JsonValue>;
  sourceBindings?: SourceBinding[];
  archived: boolean;
}

export interface PageTemplateDefinition {
  ref: VersionRef;
  designSystemRef: VersionRef;
  name: string;
  description: string;
  /** Demo workspace base view this template was created from. */
  baseViewId?: string;
  /** Optional starter block instances authored as part of this page template. */
  blocks?: BlockInstance[];
  layout: JsonValue;
  contentSlotId: string;
  sharedRegionRefs: VersionRef[];
  allowedBlockCategories: string[];
  mandatoryBlockIds: string[];
  archived: boolean;
}

export interface TemplateAdapter {
  readonly capabilities: Capability;
  list(input: { designSystemRef: VersionRef; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<PageTemplateDefinition>>;
  getVersion(ref: VersionRef, context?: RequestContext): Promise<PageTemplateDefinition>;
  create?(template: PageTemplateDefinition, context?: RequestContext): Promise<VersionRef>;
  archive?(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void>;
}

export interface SharedRegionAdapter {
  readonly capabilities: Capability;
  list(input: { designSystemRef: VersionRef; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<SharedRegionDefinition>>;
  getVersion(ref: VersionRef, context?: RequestContext): Promise<SharedRegionDefinition>;
  create?(region: SharedRegionDefinition, context?: RequestContext): Promise<VersionRef>;
  archive?(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void>;
}

export interface ProviderField {
  fieldId: string;
  label: string;
  valueType: FieldType | 'object' | 'array';
  required: boolean;
  nullable: boolean;
  options?: string[];
}

export interface ProviderCollection {
  collectionId: string;
  label: string;
  schemaVersion: string;
  fields: ProviderField[];
  capabilities: {
    search: boolean;
    recordSelection: boolean;
    recordGroups: boolean;
    query: {
      filterFields: Array<{ fieldId: string; operators: string[] }>;
      sortFields: string[];
      maxLimit: number;
    } | null;
  };
  localization?: { mode: 'translated' | 'neutral'; supportedLocales?: string[] };
}

export interface ContentRecord {
  recordId: string;
  collectionId: string;
  values: Record<string, JsonValue>;
  editUrl?: string;
  localeResolution?: ContentLocaleResolution;
}

export interface ContentRecordGroup {
  groupId: string;
  collectionId: string;
  label: string;
}

export interface ContentProviderAdapter {
  readonly providerId: string;
  readonly capabilities: Capability;
  listCollections(context?: RequestContext): Promise<ProviderCollection[]>;
  getSchema(collectionId: string, context?: RequestContext): Promise<ProviderCollection>;
  search(
    collectionId: string,
    query: string,
    cursor?: string,
    context?: RequestContext,
  ): Promise<PageResult<ContentRecord>>;
  resolveRecords(
    collectionId: string,
    recordRefs: string[],
    context?: RequestContext,
  ): Promise<Array<{ recordId: string; record: ContentRecord | null; error?: AdapterError }>>;
  listGroups?(collectionId: string, context?: RequestContext): Promise<ContentRecordGroup[]>;
  resolveGroup?(collectionId: string, groupId: string, context?: RequestContext): Promise<ContentRecord[]>;
  query?(
    collectionId: string,
    query: NonNullable<SourceBinding['query']>,
    context?: RequestContext,
  ): Promise<PageResult<ContentRecord>>;
  /** Cursor is opaque. Must apply the same filters, ordering, locale and authorization on every page. */
  queryPage?(collectionId: string, query: NonNullable<SourceBinding['query']>, cursor?: string, context?: RequestContext): Promise<PageResult<ContentRecord>>;
}

export interface AssetRecord {
  assetId: string;
  url: string;
  mimeType: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface AssetAdapter {
  readonly capabilities: Capability;
  search(query: string, context?: RequestContext): Promise<PageResult<AssetRecord>>;
  resolve(assetId: string, context?: RequestContext): Promise<AssetRecord>;
  upload?(file: File, context?: RequestContext): Promise<AssetRecord>;
}

/** Shared design-system resources. Page documents pin `ref`; the adapter owns persistence. */
export interface DesignSystemAssetManifest {
  ref: VersionRef;
  name: string;
  commonCss: string;
  stylesheets: string[];
  revision: string | null;
}

export interface DesignSystemAdapter {
  readonly capabilities: Capability;
  load(ref: VersionRef, context?: RequestContext): Promise<DesignSystemAssetManifest>;
  save(manifest: DesignSystemAssetManifest, expectedRevision: string | null, context?: RequestContext): Promise<{ revision: string }>;
}

export type EditorMode = 'designer' | 'content';

export interface EditorChangeEvent {
  document: EditorDocument;
  generation: number;
  reason: string;
}
