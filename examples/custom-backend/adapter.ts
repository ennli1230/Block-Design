import type {
  BlockDefinitionVersion,
  BlockLibraryAdapter,
  ContentProviderAdapter,
  ContentLocaleContext,
  ContentRecord,
  EditorDocument,
  PageResult,
  ProviderCollection,
  RequestContext,
  SaveResult,
  SourceBinding,
  StorageAdapter,
  VersionRef,
} from '../../packages/contracts/src/index';

/**
 * Example of integrating with an application whose route layout is unrelated
 * to the reference Go API. The session token is requested for each call and is
 * never stored in a document or adapter state.
 */
export interface CustomBackendOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  fetcher?: typeof fetch;
  /** Map canonical BCP 47 tags to backend tags, such as en -> en_US. */
  localeMap?: Record<string, string>;
}

class CustomHttpClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly getAccessToken: () => string | null;
  private readonly localeMap: Record<string, string>;

  constructor(options: CustomBackendOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken ?? (() => null);
    this.localeMap = options.localeMap ?? {};
  }

  mapLocale(locale: string): string { return this.localeMap[locale] ?? locale; }
  mapContentLocale(locale?: ContentLocaleContext): ContentLocaleContext | undefined {
    if (!locale) return undefined;
    return { locale: this.mapLocale(locale.locale), fallback: locale.fallback.mode === 'locale' ? { mode: 'locale', locale: this.mapLocale(locale.fallback.locale) } : { mode: 'none' } };
  }

  async request<T>(path: string, init: RequestInit = {}, context?: RequestContext): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    const token = this.getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      ...(context?.signal ? { signal: context.signal } : {}),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = payload && typeof payload === 'object' ? (payload as { error?: { message?: string } }).error : undefined;
      throw new Error(error?.message ?? `Custom backend request failed (${response.status}).`);
    }
    return payload as T;
  }
}

export class CustomPageStorageAdapter implements StorageAdapter {
  readonly capabilities = { supported: ['load', 'save', 'create', 'optimisticConcurrency'] };
  private readonly http: CustomHttpClient;

  constructor(http: CustomHttpClient) { this.http = http; }

  load(documentId: string, context?: RequestContext): Promise<EditorDocument> {
    return this.http.request(`/v2/editor/pages/${encodeURIComponent(documentId)}`, {}, context);
  }

  save(document: EditorDocument, expectedRevision: string | null, context?: RequestContext): Promise<SaveResult> {
    const creating = !document.documentId;
    if (!creating && !expectedRevision) throw new Error('Existing documents require an expected revision.');
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (expectedRevision) headers.set('If-Match', expectedRevision);
    return this.http.request(creating ? '/v2/editor/pages' : `/v2/editor/pages/${encodeURIComponent(document.documentId!)}`, {
      method: creating ? 'POST' : 'PUT',
      headers,
      body: JSON.stringify(document),
    }, context);
  }
}

export class CustomBlockLibraryAdapter implements BlockLibraryAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'archive'] };
  private readonly http: CustomHttpClient;

  constructor(http: CustomHttpClient) { this.http = http; }

  list(input: { designSystemRef: VersionRef; query?: string; cursor?: string; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<BlockDefinitionVersion>> {
    const query = new URLSearchParams({ designVersion: input.designSystemRef.version });
    if (input.query) query.set('search', input.query);
    if (input.cursor) query.set('after', input.cursor);
    if (input.includeArchived) query.set('archived', 'true');
    return this.http.request(`/v2/editor/design-systems/${encodeURIComponent(input.designSystemRef.id)}/blocks?${query}`, {}, context);
  }

  getVersion(ref: VersionRef, context?: RequestContext): Promise<BlockDefinitionVersion> {
    const query = new URLSearchParams({ version: ref.version });
    return this.http.request(`/v2/editor/blocks/${encodeURIComponent(ref.id)}?${query}`, {}, context);
  }

  create(definition: BlockDefinitionVersion, context?: RequestContext): Promise<VersionRef> {
    const system = definition.designSystemRef;
    return this.http.request(`/v2/editor/design-systems/${encodeURIComponent(system.id)}/blocks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(definition),
    }, context);
  }

  async archive(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void> {
    await this.http.request(`/v2/editor/blocks/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }),
    }, context);
  }
}

export class CustomContentProviderAdapter implements ContentProviderAdapter {
  readonly providerId = 'example.application-content';
  readonly capabilities = { supported: ['collections', 'schema', 'search', 'resolveRecords', 'recordGroups', 'query', 'localization'] };
  private readonly http: CustomHttpClient;

  constructor(http: CustomHttpClient) { this.http = http; }

  listCollections(context?: RequestContext): Promise<ProviderCollection[]> {
    return this.http.request('/v2/editor/content-types', {}, context);
  }

  getSchema(collectionId: string, context?: RequestContext): Promise<ProviderCollection> {
    return this.http.request(`/v2/editor/content-types/${encodeURIComponent(collectionId)}/schema${localeQuery(this.http.mapContentLocale(context?.contentLocale))}`, {}, context);
  }

  search(collectionId: string, query: string, cursor?: string, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    const params = new URLSearchParams({ term: query });
    if (cursor) params.set('after', cursor);
    addLocaleQuery(params, this.http.mapContentLocale(context?.contentLocale));
    return this.http.request(`/v2/editor/content-types/${encodeURIComponent(collectionId)}/search?${params}`, {}, context);
  }

  resolveRecords(collectionId: string, recordRefs: string[], context?: RequestContext): Promise<Array<{ recordId: string; record: ContentRecord | null }>> {
    return this.http.request(`/v2/editor/content-types/${encodeURIComponent(collectionId)}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: recordRefs, ...(this.http.mapContentLocale(context?.contentLocale) ? { contentLocale: this.http.mapContentLocale(context?.contentLocale) } : {}) }),
    }, context);
  }

  listGroups(collectionId: string, context?: RequestContext) {
    return this.http.request<Array<{ groupId: string; collectionId: string; label: string }>>(`/v2/editor/content-types/${encodeURIComponent(collectionId)}/groups${localeQuery(this.http.mapContentLocale(context?.contentLocale))}`, {}, context);
  }

  resolveGroup(collectionId: string, groupId: string, context?: RequestContext) {
    return this.http.request<ContentRecord[]>(`/v2/editor/content-types/${encodeURIComponent(collectionId)}/groups/${encodeURIComponent(groupId)}/records${localeQuery(this.http.mapContentLocale(context?.contentLocale))}`, {}, context);
  }

  query(collectionId: string, query: NonNullable<SourceBinding['query']>, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    return this.http.request(`/v2/editor/content-types/${encodeURIComponent(collectionId)}/preview-query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...query, ...(this.http.mapContentLocale(context?.contentLocale) ? { contentLocale: this.http.mapContentLocale(context?.contentLocale) } : {}) }),
    }, context);
  }
}

export function createCustomBackendAdapters(options: CustomBackendOptions): {
  storageAdapter: StorageAdapter;
  blockLibraryAdapter: BlockLibraryAdapter;
  contentProvider: ContentProviderAdapter;
} {
  const http = new CustomHttpClient(options);
  return {
    storageAdapter: new CustomPageStorageAdapter(http),
    blockLibraryAdapter: new CustomBlockLibraryAdapter(http),
    contentProvider: new CustomContentProviderAdapter(http),
  };
}

function addLocaleQuery(params: URLSearchParams, locale?: ContentLocaleContext): void {
  if (!locale) return;
  params.set('locale', locale.locale);
  if (locale.fallback.mode === 'locale') params.set('fallbackLocale', locale.fallback.locale);
}

function localeQuery(locale?: ContentLocaleContext): string {
  const params = new URLSearchParams();
  addLocaleQuery(params, locale);
  const query = params.toString();
  return query ? `?${query}` : '';
}
