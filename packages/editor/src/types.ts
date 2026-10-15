import type {
  AssetAdapter,
  BlockDefinitionVersion,
  BlockLibraryAdapter,
  ContentProviderAdapter,
  LocalizationAdapter,
  LocalizationOptions,
  DesignSystemAdapter,
  EditorChangeEvent,
  EditorDocument,
  EditorMode,
  SaveResult,
  SharedRegionAdapter,
  StorageAdapter,
  TemplateAdapter,
  VersionRef,
} from '@blockdesign/contracts';

export type EditorWorkspaceStage = 'block' | 'base-view' | 'template' | 'page';
import type { CanvasBridgeOptions, CanvasSelection, PreviewBehaviorPlugin } from '@blockdesign/grapesjs-bridge';

export interface MountEditorOptions {
  extensions?: import('./extensions').EditorExtension[];
  preview?: { open(document: EditorDocument, context?: import('@blockdesign/contracts').RequestContext): Promise<void> };
  autosave?: { debounceMs?: number };
  /** Explicit host/site/user/document scoped key. Visitor form values are never included. */
  recovery?: { key: string };
  publicationPolicy?: 'strict' | 'permissive';
  requestContext?: () => import('@blockdesign/contracts').RequestContext;
  collections?: { publication?: { baseUrl: string; context?: import('@blockdesign/contracts').RequestContext } };
  /** The host owns navigation and branding in embedded mode. */
  appearance?: 'standalone' | 'embedded';
  showToolbar?: boolean;
  theme?: { surface?: string; text?: string; muted?: string; accent?: string; border?: string; fontFamily?: string };
  /** UI capability restrictions; the host API still enforces authorization. */
  permissions?: { styles?: boolean; design?: boolean; save?: boolean; import?: boolean; export?: boolean; catalogWrite?: boolean };
  initialDocument?: EditorDocument;
  /** Enables the focused, multi-step demo workspace rather than the legacy all-in-one editor. */
  workspaceStage?: EditorWorkspaceStage;
  workspaceLabel?: string;
  workspaceBaseViewId?: string;
  workspaceBaseViewName?: string;
  workspaceTemplateName?: string;
  workspaceExistingTemplateRef?: VersionRef;
  workspaceExistingBlockDefinition?: BlockDefinitionVersion;
  workspaceSharedRegionKind?: 'header' | 'footer';
  initialSharedRegionRef?: VersionRef;
  storageAdapter?: StorageAdapter;
  blockLibraryAdapter?: BlockLibraryAdapter;
  /** Additional design-system catalogs available for reuse alongside the current document's blocks. */
  blockLibraryDesignSystemRefs?: VersionRef[];
  /** Disable sample widgets when the host supplies a clean catalog. */
  includeDemoBlocks?: boolean;
  localization?: LocalizationOptions;
  localizationAdapter?: LocalizationAdapter;
  contentProviders?: ContentProviderAdapter[];
  forms?: Omit<import('@blockdesign/contracts').FormRuntimeOptions,'mode'|'contentProviders'|'context'>;
  assetAdapter?: AssetAdapter;
  templateAdapter?: TemplateAdapter;
  sharedRegionAdapter?: SharedRegionAdapter;
  designSystemAdapter?: DesignSystemAdapter;
  /** Trusted interactive behaviors for registered HTML structures. */
  behaviorPlugins?: PreviewBehaviorPlugin[];
  /** @deprecated Use localization.defaultLocale and initialDocument.localization.locale. */
  language?: string;
  mode?: EditorMode;
  canvas?: Partial<Omit<CanvasBridgeOptions, 'element' | 'blockManagerRoot' | 'document' | 'mode' | 'behaviorPlugins' | 'onSelection' | 'onDocumentChange' | 'onBlockDrop' | 'onBlockRemove'>>;
  http?: {
    headers?: () => HeadersInit;
    fetcher?: typeof fetch;
    baseUrl?: string;
  };
  onChange?: (event: EditorChangeEvent) => void;
  onSave?: (result: SaveResult) => void;
  onCatalogSave?: (kind: 'block' | 'template' | 'shared-region', ref: VersionRef) => void;
  onError?: (error: Error) => void;
  onLocaleChangeRequested?: (locale: string, variant: import('@blockdesign/contracts').PageLocaleVariant | null) => Promise<EditorDocument | null>;
  onCreateLocaleVariant?: (locale: string, source: EditorDocument) => Promise<EditorDocument | null>;
}

export type PreviewExport = {
  html: string;
  css: string;
  js: string;
  stylesheets: string[];
  issues: Array<import('./publication').PublicationIssue>;
  localization?: {
    locale: string;
    direction: 'ltr' | 'rtl';
    issues: Array<{ code: string; message: string; severity: 'warning' | 'error' }>;
    canonicalUrl?: string;
    alternates?: Array<{ locale: string; url: string }>;
    xDefaultUrl?: string;
  };
  exportedAt: string;
  metadata?: import('./page-metadata').PageMetadata;
};

export interface EditorHandle {
  readonly ready: Promise<void>;
  getDocument(): Promise<EditorDocument>;
  loadDocument(document: EditorDocument | string): Promise<EditorDocument>;
  save(): Promise<SaveResult>;
  setMode(mode: EditorMode): Promise<void>;
  setPreview(active: boolean): Promise<void>;
  exportStatic(): Promise<PreviewExport>;
  destroy(): Promise<void>;
}

export interface EditorRuntimeBindings {
  options: MountEditorOptions;
  onReady(runtime: InnerEditorRuntime): void;
  onError(error: Error): void;
}

export interface InnerEditorRuntime {
  getDocument(): EditorDocument;
  loadDocument(document: EditorDocument | string): Promise<EditorDocument>;
  save(): Promise<SaveResult>;
  setMode(mode: EditorMode): void;
  setPreview(active: boolean): Promise<void>;
  exportStatic(): Promise<PreviewExport>;
}

export interface SelectionState extends CanvasSelection {}
