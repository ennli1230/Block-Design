import type {
  AdapterError,
  AssetAdapter,
  AssetRecord,
  BlockDefinitionVersion,
  BlockLibraryAdapter,
  ContentProviderAdapter,
  ContentRecord,
  ContentRecordGroup,
  ContentLocaleContext,
  DesignSystemAdapter,
  DesignSystemAssetManifest,
  PageTemplateDefinition,
  ProviderCollection,
  SourceBinding,
  EditorDocument,
  JsonValue,
  PageResult,
  RequestContext,
  SaveResult,
  SharedRegionAdapter,
  SharedRegionDefinition,
  StorageAdapter,
  TemplateAdapter,
  VersionRef,
} from '@blockdesign/contracts';

/** A deterministic read-only content source for integration demos and acceptance tests. */
export class DemoContentProvider implements ContentProviderAdapter {
  readonly providerId = 'blockdesign.demo-content';
  readonly capabilities = { supported: ['collections', 'schema', 'search', 'resolveRecords', 'recordGroups', 'query', 'localization'], constraints: { readOnly: true, maxLimit: 50 } };
  private readonly collections: ProviderCollection[] = [
    {collectionId:'menus',label:'Menü öğeleri',schemaVersion:'1',fields:[{fieldId:'label',label:'Menü adı',valueType:'text',required:true,nullable:false},{fieldId:'url',label:'Bağlantı',valueType:'url',required:true,nullable:false},{fieldId:'children',label:'Alt menü kayıtları',valueType:'array',required:false,nullable:true}],capabilities:{search:true,recordSelection:true,recordGroups:true,query:null}},
    {collectionId:'languages',label:'Diller',schemaVersion:'1',fields:[{fieldId:'label',label:'Dil adı',valueType:'text',required:true,nullable:false},{fieldId:'url',label:'Dil sayfası',valueType:'url',required:true,nullable:false},{fieldId:'icon',label:'Dil ikonu',valueType:'image',required:false,nullable:true},{fieldId:'alt',label:'İkon açıklaması',valueType:'text',required:false,nullable:true}],capabilities:{search:true,recordSelection:true,recordGroups:true,query:null}},
    { collectionId: 'faq', label: 'SSS kayıtları', schemaVersion: '1', fields: [
      { fieldId: 'title', label: 'Soru', valueType: 'text', required: true, nullable: false },
      { fieldId: 'body', label: 'Yanıt', valueType: 'textarea', required: true, nullable: false },
      { fieldId: 'category', label: 'Kategori', valueType: 'text', required: false, nullable: true },
    ], capabilities: { search: true, recordSelection: true, recordGroups: true, query: { filterFields: [{ fieldId: 'category', operators: ['eq', 'contains'] }], sortFields: ['title'], maxLimit: 50 } } },
    { collectionId: 'cards', label: 'Kart içerikleri', schemaVersion: '1', fields: [
      { fieldId: 'title', label: 'Başlık', valueType: 'text', required: true, nullable: false },
      { fieldId: 'body', label: 'Açıklama', valueType: 'textarea', required: false, nullable: true },
      { fieldId: 'cover', label: 'Görsel', valueType: 'image', required: false, nullable: true },
      { fieldId: 'url', label: 'Bağlantı', valueType: 'url', required: false, nullable: true },
    ], capabilities: { search: true, recordSelection: true, recordGroups: true, query: { filterFields: [], sortFields: ['title'], maxLimit: 50 } } },
    { collectionId: 'slider', label: 'Slider slaytları', schemaVersion: '1', fields: [
      { fieldId: 'image', label: 'Görsel', valueType: 'image', required: false, nullable: true },
      { fieldId: 'alt', label: 'Görsel alt metni', valueType: 'text', required: false, nullable: true },
      { fieldId: 'title', label: 'Başlık', valueType: 'text', required: true, nullable: false },
      { fieldId: 'description', label: 'Açıklama', valueType: 'textarea', required: false, nullable: true },
      { fieldId: 'url', label: 'Bağlantı', valueType: 'url', required: false, nullable: true },
    ], capabilities: { search: true, recordSelection: true, recordGroups: true, query: { filterFields: [], sortFields: ['title'], maxLimit: 20 } } },
  ];
  private readonly records: ContentRecord[] = [
    {recordId:'menu-home',collectionId:'menus',values:{label:'Ana sayfa',url:'/',children:[],translations:{en:{label:'Home',url:'/en',children:[]}}}},
    {recordId:'menu-about',collectionId:'menus',values:{label:'Hakkımızda',url:'/hakkimizda',children:[{id:'team',label:'Ekibimiz',url:'/ekibimiz'},{id:'contact',label:'İletişim',url:'/iletisim'}],translations:{en:{label:'About us',url:'/en/about',children:[{id:'team',label:'Our team',url:'/en/team'},{id:'contact',label:'Contact',url:'/en/contact'}]}}}},
    {recordId:'language-tr',collectionId:'languages',values:{label:'Türkçe',url:'/',icon:'',alt:'Türkçe'}},
    {recordId:'language-en',collectionId:'languages',values:{label:'English',url:'/en',icon:'',alt:'English'}},
    { recordId: 'faq-start', collectionId: 'faq', values: { title: 'Nasıl başlayabilirim?', body: 'Bir tasarım sistemi seçip ilk sayfanı oluştur.', category: 'Başlangıç', translations: { en: { title: 'How do I get started?', body: 'Choose a design system and create your first page.', category: 'Getting started' } } } },
    { recordId: 'faq-save', collectionId: 'faq', values: { title: 'Sayfalar nasıl kaydedilir?', body: 'Belge adapter üzerinden revision kontrolüyle saklanır.', category: 'Başlangıç', translations: { en: { title: 'How are pages saved?', body: 'Documents are stored through the adapter with revision checks.', category: 'Getting started' } } } },
    { recordId: 'faq-backend', collectionId: 'faq', values: { title: 'Kendi backend’imi bağlayabilir miyim?', body: 'Evet. Kendi ContentProviderAdapter uygulamanı ver.', category: 'Entegrasyon', translations: { en: { title: 'Can I connect my own backend?', body: 'Yes. Provide your own ContentProviderAdapter.', category: 'Integration' } } } },
    { recordId: 'card-design', collectionId: 'cards', values: { title: 'Yeni tasarım sistemi', body: 'Bağımsız stillerle yeni bir sayfa ailesi oluştur.', cover: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900', url: '/tasarim', translations: { en: { title: 'A new design system', body: 'Build a new family of pages with independent styles.', cover: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900', url: '/en/design' } } }, editUrl: '/demo/cards/card-design' },
    { recordId: 'card-editor', collectionId: 'cards', values: { title: 'Görsel editör', body: 'Blokları sayfaya yerleştir ve düzenle.', cover: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900', url: '/demo/editor', translations: { en: { title: 'Visual editor', body: 'Place blocks on a page and edit their content.', cover: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=900', url: '/en/editor' } } }, editUrl: '/demo/cards/card-editor' },
    { recordId: 'slide-route', collectionId: 'slider', values: { image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200', alt: 'Dağ gölü manzarası', title: 'Yeni bir rota', description: 'Her sayfada kendi hikâyeni anlat.', url: '/rotalar/yeni', translations: { en: { image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200', alt: 'Mountain lake view', title: 'A new route', description: 'Tell your story on every page.', url: '/en/routes/new' } } } },
    { recordId: 'slide-design', collectionId: 'slider', values: { image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200', alt: 'Aydınlık tasarım stüdyosu', title: 'Fikirden tasarıma', description: 'Bloklarını bir araya getir ve paylaş.', url: '/tasarim', translations: { en: { image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200', alt: 'Bright design studio', title: 'From idea to design', description: 'Bring your blocks together and share them.', url: '/en/design' } } } },
  ];
  private readonly groups: ContentRecordGroup[] = [
    {groupId:'menus.main',collectionId:'menus',label:'Ana menü'},{groupId:'menus.mobile',collectionId:'menus',label:'Mobil menü'},{groupId:'languages.available',collectionId:'languages',label:'Aktif diller'},
    { groupId: 'faq.getting-started', collectionId: 'faq', label: 'Başlangıç soruları' },
    { groupId: 'faq.integration', collectionId: 'faq', label: 'Entegrasyon soruları' },
    { groupId: 'cards.featured', collectionId: 'cards', label: 'Öne çıkan kartlar' },
    { groupId: 'slider.featured', collectionId: 'slider', label: 'Öne çıkan slaytlar' },
  ];

  async listCollections(): Promise<ProviderCollection[]> { return structuredClone(this.collections.map(collection => ({ ...collection, localization: collection.collectionId === 'languages' ? { mode: 'neutral' as const } : { mode: 'translated' as const, supportedLocales: ['tr', 'en'] } }))); }
  async getSchema(collectionId: string, context?: RequestContext): Promise<ProviderCollection> {
    const found = this.collections.find((item) => item.collectionId === collectionId);
    if (!found) throw new Error(`“${collectionId}” koleksiyonu bulunamadı.`);
    const schema = structuredClone({ ...found, localization: collectionId === 'languages' ? { mode: 'neutral' as const } : { mode: 'translated' as const, supportedLocales: ['tr', 'en'] } });
    if (context?.contentLocale?.locale.toLowerCase().startsWith('en')) {
      const labels: Record<string, string> = { 'Menü öğeleri': 'Menu items', 'Diller': 'Languages', 'SSS kayıtları': 'FAQ entries', 'Kart içerikleri': 'Card content', 'Slider slaytları': 'Slider slides', 'Menü adı': 'Menu label', 'Bağlantı': 'Link', 'Alt menü kayıtları': 'Nested menu items', 'Dil adı': 'Language name', 'Dil sayfası': 'Language page', 'Dil ikonu': 'Language icon', 'İkon açıklaması': 'Icon description', 'Soru': 'Question', 'Yanıt': 'Answer', 'Kategori': 'Category', 'Başlık': 'Title', 'Açıklama': 'Description', 'Görsel': 'Image', 'Görsel alt metni': 'Image alt text' };
      schema.label = labels[schema.label] ?? schema.label;
      schema.fields = schema.fields.map(field => ({ ...field, label: labels[field.label] ?? field.label }));
    }
    return schema;
  }
  async search(collectionId: string, query: string, cursor?: string, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    const offset = Number(cursor ?? 0);
    const normalized = query.trim().toLocaleLowerCase('tr-TR');
    const matches = this.records.filter((item) => item.collectionId === collectionId)
      .filter((item) => !normalized || JSON.stringify(item.values).toLocaleLowerCase('tr-TR').includes(normalized));
    const items = matches.slice(offset, offset + 20);
    return { items: items.map(record => this.localize(record, context?.contentLocale)), nextCursor: offset + 20 < matches.length ? String(offset + 20) : null };
  }
  async resolveRecords(collectionId: string, recordRefs: string[], context?: RequestContext) {
    return recordRefs.map((recordId) => {
      const record = this.records.find((item) => item.collectionId === collectionId && item.recordId === recordId);
      return { recordId, record: record ? this.localize(record, context?.contentLocale) : null, ...(!record ? { error: { code: 'NOT_FOUND', message: `“${recordId}” kaydı bulunamadı.`, recoverable: true } } : {}) };
    });
  }
  async listGroups(collectionId: string, context?: RequestContext): Promise<ContentRecordGroup[]> {
    const english: Record<string, string> = { 'Ana menü': 'Main menu', 'Mobil menü': 'Mobile menu', 'Aktif diller': 'Available languages', 'Başlangıç soruları': 'Getting started questions', 'Entegrasyon soruları': 'Integration questions', 'Öne çıkan kartlar': 'Featured cards', 'Öne çıkan slaytlar': 'Featured slides' };
    return structuredClone(this.groups.filter((group) => group.collectionId === collectionId).map(group => context?.contentLocale?.locale.toLowerCase().startsWith('en') ? { ...group, label: english[group.label] ?? group.label } : group));
  }
  async resolveGroup(collectionId: string, groupId: string, context?: RequestContext): Promise<ContentRecord[]> {
    const group = this.groups.find((item) => item.collectionId === collectionId && item.groupId === groupId);
    if (!group) throw new Error(`“${groupId}” kayıt grubu bulunamadı.`);
    const refs = groupId === 'menus.main' ? ['menu-home','menu-about'] : groupId === 'menus.mobile' ? ['menu-about'] : groupId === 'languages.available' ? ['language-tr','language-en'] : groupId === 'faq.getting-started' ? ['faq-start', 'faq-save']
      : groupId === 'faq.integration' ? ['faq-backend']
        : groupId === 'cards.featured' ? ['card-design', 'card-editor']
          : ['slide-route', 'slide-design'];
    return refs.flatMap((id) => {
      const record = this.records.find((item) => item.collectionId === collectionId && item.recordId === id);
      return record ? [this.localize(record, context?.contentLocale)] : [];
    });
  }
  async query(collectionId: string, query: NonNullable<SourceBinding['query']>, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    const collection = await this.getSchema(collectionId, context);
    const allowedFilters = new Map(collection.capabilities.query?.filterFields.map((field) => [field.fieldId, new Set(field.operators)]) ?? []);
    let items = this.records.filter((item) => item.collectionId === collectionId).map(record => this.localize(record, context?.contentLocale));
    for (const filter of query.filters) {
      if (!allowedFilters.get(filter.fieldId)?.has(filter.operator)) throw new Error(`“${filter.fieldId}” alanı için bu filtre desteklenmiyor.`);
      items = items.filter((record) => {
        const value = record.values[filter.fieldId];
        if (filter.operator === 'eq') return value === filter.value;
        if (filter.operator === 'contains') return typeof value === 'string' && value.toLocaleLowerCase('tr-TR').includes(String(filter.value).toLocaleLowerCase('tr-TR'));
        if (filter.operator === 'gt') return typeof value === 'number' && typeof filter.value === 'number' && value > filter.value;
        return typeof value === 'number' && typeof filter.value === 'number' && value < filter.value;
      });
    }
    if (query.sort) {
      if (!collection.capabilities.query?.sortFields.includes(query.sort.fieldId)) throw new Error(`“${query.sort.fieldId}” ile sıralama desteklenmiyor.`);
      const direction = query.sort.direction === 'asc' ? 1 : -1;
      items = [...items].sort((a, b) => String(a.values[query.sort!.fieldId] ?? '').localeCompare(String(b.values[query.sort!.fieldId] ?? ''), 'tr-TR') * direction);
    }
    const maxLimit = collection.capabilities.query?.maxLimit ?? 50;
    const limit = Math.min(Math.max(1, query.limit ?? maxLimit), maxLimit);
    return { items: structuredClone(items.slice(0, limit)), nextCursor: null };
  }

  private localize(record: ContentRecord, locale?: ContentLocaleContext): ContentRecord {
    if (!locale || record.collectionId === 'languages') return structuredClone(record);
    const requested = localeCode(locale.locale);
    const translationsValue = record.values['translations'];
    const translations = translationsValue && !Array.isArray(translationsValue) && typeof translationsValue === 'object' ? translationsValue as Record<string, JsonValue> : {};
    const values = requested === 'tr' ? stripTranslationValues(record.values, 'translations') : translationFor(translations, requested);
    if (values && !Array.isArray(values) && typeof values === 'object') return { ...structuredClone(record), values: structuredClone(values as Record<string, JsonValue>), localeResolution: { requestedLocale: locale.locale, resolvedLocale: locale.locale, usedFallback: false } };
    if (locale.fallback.mode === 'locale') {
      const fallback = localeCode(locale.fallback.locale);
      const fallbackValues = fallback === 'tr' ? stripTranslationValues(record.values, 'translations') : translationFor(translations, fallback);
      if (fallbackValues && !Array.isArray(fallbackValues) && typeof fallbackValues === 'object') return { ...structuredClone(record), values: structuredClone(fallbackValues as Record<string, JsonValue>), localeResolution: { requestedLocale: locale.locale, resolvedLocale: locale.fallback.locale, usedFallback: true } };
    }
    throw new Error(`“${record.recordId}” kaydında ${locale.locale} dil çevirisi yok.`);
  }
}

export class AdapterRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: AdapterError | null;

  constructor(status: number, error: AdapterError | null, fallback: string) {
    super(error?.message ?? fallback);
    this.name = 'AdapterRequestError';
    this.status = status;
    this.code = error?.code ?? 'HTTP_ERROR';
    this.details = error;
  }
}

export class HttpStorageAdapter implements StorageAdapter {
  async listRevisions(documentId:string, context?:RequestContext):Promise<PageResult<{revision:string;savedAt:string}>>{const params=new URLSearchParams();if(context?.cursor)params.set('cursor',context.cursor);return this.readJson(await this.fetcher(`${this.baseUrl}/documents/${encodeURIComponent(documentId)}/revisions?${params}`,{headers:this.headers(),...(context?.signal?{signal:context.signal}:{})}),'Belge geçmişi yüklenemedi.');}
  async loadRevision(documentId:string,revision:string,context?:RequestContext):Promise<EditorDocument>{return this.readJson(await this.fetcher(`${this.baseUrl}/documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revision)}`,{headers:this.headers(),...(context?.signal?{signal:context.signal}:{})}),'Eski sürüm yüklenemedi.');}
  readonly capabilities = {
    supported: ['load', 'save', 'create', 'optimisticConcurrency'],
    constraints: { concurrencyHeader: 'If-Match', conflictStatus: 412 },
  };
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly headers: () => HeadersInit;

  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit } = {}) {
    this.baseUrl = (input.baseUrl ?? '/api/v1').replace(/\/$/, '');
    this.fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
    this.headers = input.headers ?? (() => ({}));
  }

  async load(documentId: string, context?: RequestContext): Promise<EditorDocument> {
    const response = await this.fetcher(`${this.baseUrl}/documents/${encodeURIComponent(documentId)}`, {
      ...(context?.signal ? { signal: context.signal } : {}),
      headers: withHeaders(this.headers(), { Accept: 'application/json' }),
    });
    return this.readJson<EditorDocument>(response, 'Belge yüklenemedi.');
  }

  async save(document: EditorDocument, expectedRevision: string | null, context?: RequestContext): Promise<SaveResult> {
    const isCreate = !document.documentId;
    if (!isCreate && !expectedRevision) {
      throw new AdapterRequestError(428, { code: 'REVISION_REQUIRED', message: 'Mevcut belgeyi kaydetmek için revision bilgisi gerekli.', recoverable: true }, 'Revision eksik.');
    }
    const response = await this.fetcher(
      isCreate ? `${this.baseUrl}/documents` : `${this.baseUrl}/documents/${encodeURIComponent(document.documentId!)}`,
      {
        method: isCreate ? 'POST' : 'PUT',
        ...(context?.signal ? { signal: context.signal } : {}),
        headers: withHeaders(this.headers(), {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(isCreate ? {} : { 'If-Match': expectedRevision! }),
        }),
        body: JSON.stringify({ ...document, revision: expectedRevision }),
      },
    );
    return this.readJson<SaveResult>(response, 'Belge kaydedilemedi.');
  }

  private async readJson<T>(response: Response, fallback: string): Promise<T> {
    const contentType = response.headers.get('content-type') ?? '';
    let body: unknown = null;
    if (contentType.includes('json')) {
      try { body = await response.json(); } catch { /* use the normalized status below */ }
    }
    if (!response.ok) {
      const payload = body && typeof body === 'object' ? body as { error?: AdapterError } : {};
      throw new AdapterRequestError(response.status, payload.error ?? null, fallback);
    }
    if (!body || typeof body !== 'object') throw new AdapterRequestError(response.status, null, 'Sunucu geçerli bir JSON yanıtı vermedi.');
    return body as T;
  }
}

export class HttpBlockLibraryAdapter implements BlockLibraryAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'search', 'create', 'archive', 'deleteUnused'] };
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly headers: () => HeadersInit;

  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit } = {}) {
    this.baseUrl = (input.baseUrl ?? '/api/v1').replace(/\/$/, '');
    this.fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
    this.headers = input.headers ?? (() => ({}));
  }

  async list(input: { designSystemRef: VersionRef; query?: string; cursor?: string; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<BlockDefinitionVersion>> {
    const params = new URLSearchParams({ systemId: input.designSystemRef.id, systemVersion: input.designSystemRef.version });
    if (input.query) params.set('q', input.query);
    if (input.cursor) params.set('cursor', input.cursor);
    if (input.includeArchived) params.set('includeArchived', 'true');
    return this.read(await this.fetcher(`${this.baseUrl}/blocks?${params}`, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Blok kataloğu yüklenemedi.');
  }

  async getVersion(ref: VersionRef, context?: RequestContext): Promise<BlockDefinitionVersion> {
    return this.read(await this.fetcher(`${this.baseUrl}/blocks/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Blok sürümü bulunamadı.');
  }

  async create(definition: BlockDefinitionVersion, context?: RequestContext): Promise<VersionRef> {
    return this.read(await this.fetcher(`${this.baseUrl}/blocks`, { method: 'POST', ...(context?.signal ? { signal: context.signal } : {}), headers: withHeaders(this.headers(), { 'Content-Type': 'application/json' }), body: JSON.stringify(definition) }), 'Blok kaydedilemedi.');
  }

  async archive(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void> {
    await this.read(await this.fetcher(`${this.baseUrl}/blocks/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`, {
      method: 'PATCH', ...(context?.signal ? { signal: context.signal } : {}),
      headers: withHeaders(this.headers(), { 'Content-Type': 'application/json' }), body: JSON.stringify({ archived }),
    }), 'Blok arşiv durumu değiştirilemedi.');
  }

  async delete(ref: VersionRef, context?: RequestContext): Promise<void> {
    await this.read(await this.fetcher(`${this.baseUrl}/blocks/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`, {
      method: 'DELETE', ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers(),
    }), 'Blok sürümü silinemedi.');
  }

  private async read<T>(response: Response, fallback: string): Promise<T> {
    let body: unknown = null;
    try { body = await response.json(); } catch { /* normalized below */ }
    if (!response.ok) {
      const payload = body && typeof body === 'object' ? body as { error?: AdapterError } : {};
      throw new AdapterRequestError(response.status, payload.error ?? null, fallback);
    }
    return body as T;
  }
}

export class HttpContentProviderAdapter implements ContentProviderAdapter {
  readonly providerId: string;
  readonly capabilities = { supported: ['collections', 'schema', 'search', 'resolveRecords', 'recordGroups', 'query', 'queryPage', 'localization'] };
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly headers: () => HeadersInit;
  private readonly localeParameter: string | null;
  private readonly fallbackParameter: string | null;
  private readonly mapLocale: (locale: string) => string;

  constructor(input: { providerId?: string; baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit; localeParameter?: string | null; fallbackParameter?: string | null; mapLocale?: (locale: string) => string } = {}) {
    this.providerId = input.providerId ?? 'blockdesign.demo-content';
    this.baseUrl = (input.baseUrl ?? '/api/v1').replace(/\/$/, '');
    this.fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
    this.headers = input.headers ?? (() => ({}));
    this.localeParameter = input.localeParameter === undefined ? 'locale' : input.localeParameter;
    this.fallbackParameter = input.fallbackParameter === undefined ? 'fallbackLocale' : input.fallbackParameter;
    this.mapLocale = input.mapLocale ?? (locale => locale);
  }
  async listCollections(context?: RequestContext): Promise<ProviderCollection[]> {
    return this.read(await this.fetcher(`${this.baseUrl}/content/collections`, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Koleksiyonlar yüklenemedi.');
  }
  async getSchema(collectionId: string, context?: RequestContext): Promise<ProviderCollection> {
    return this.read(await this.fetcher(this.url(`/content/collections/${encodeURIComponent(collectionId)}`, context), { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Alan şeması yüklenemedi.');
  }
  async search(collectionId: string, query: string, cursor?: string, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    const params = new URLSearchParams({ q: query }); if (cursor) params.set('cursor', cursor);
    const endpoint = this.url(`/content/collections/${encodeURIComponent(collectionId)}/records`, context, params);
    return this.read(await this.fetcher(endpoint, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Kayıtlar aranamadı.');
  }
  async resolveRecords(collectionId: string, recordRefs: string[], context?: RequestContext): Promise<Array<{ recordId: string; record: ContentRecord | null; error?: AdapterError }>> {
    return this.read(await this.fetcher(this.url(`/content/collections/${encodeURIComponent(collectionId)}/resolve`, context), { method: 'POST', ...(context?.signal ? { signal: context.signal } : {}), headers: withHeaders(this.headers(), { 'Content-Type': 'application/json' }), body: JSON.stringify({ recordRefs, ...(context?.contentLocale ? { contentLocale: this.mapContentLocale(context.contentLocale) } : {}) }) }), 'Kayıtlar çözümlenemedi.');
  }
  async listGroups(collectionId: string, context?: RequestContext): Promise<ContentRecordGroup[]> {
    return this.read(await this.fetcher(this.url(`/content/collections/${encodeURIComponent(collectionId)}/groups`, context), { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Kayıt grupları yüklenemedi.');
  }
  async resolveGroup(collectionId: string, groupId: string, context?: RequestContext): Promise<ContentRecord[]> {
    return this.read(await this.fetcher(this.url(`/content/collections/${encodeURIComponent(collectionId)}/groups/${encodeURIComponent(groupId)}/records`, context), { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Kayıt grubu çözümlenemedi.');
  }
  async query(collectionId: string, query: NonNullable<SourceBinding['query']>, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    return this.read(await this.fetcher(this.url(`/content/collections/${encodeURIComponent(collectionId)}/query`, context), { method: 'POST', ...(context?.signal ? { signal: context.signal } : {}), headers: withHeaders(this.headers(), { 'Content-Type': 'application/json' }), body: JSON.stringify({ ...query, ...(context?.contentLocale ? { contentLocale: this.mapContentLocale(context.contentLocale) } : {}) }) }), 'Kaynak sorgusu başarısız oldu.');
  }
  private url(path: string, context?: RequestContext, params = new URLSearchParams()): string {
    if (context?.contentLocale && this.localeParameter) params.set(this.localeParameter, this.mapLocale(context.contentLocale.locale));
    if (context?.contentLocale?.fallback.mode === 'locale' && this.fallbackParameter) params.set(this.fallbackParameter, this.mapLocale(context.contentLocale.fallback.locale));
    const query = params.toString();
    return `${this.baseUrl}${path}${query ? `?${query}` : ''}`;
  }
  async queryPage(collectionId: string, query: NonNullable<SourceBinding['query']>, cursor?: string, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    return this.read(await this.fetcher(this.url(`/content/collections/${encodeURIComponent(collectionId)}/query`, context), {method:'POST',...(context?.signal?{signal:context.signal}:{}),headers:withHeaders(this.headers(),{'Content-Type':'application/json'}),body:JSON.stringify({...query,cursor,page:context?.page,...(context?.contentLocale?{contentLocale:this.mapContentLocale(context.contentLocale)}:{})})}), 'Liste sayfası yüklenemedi.');
  }
  private mapContentLocale(locale: NonNullable<RequestContext['contentLocale']>) {
    return { locale: this.mapLocale(locale.locale), fallback: locale.fallback.mode === 'locale' ? { mode: 'locale' as const, locale: this.mapLocale(locale.fallback.locale) } : { mode: 'none' as const } };
  }
  private async read<T>(response: Response, fallback: string): Promise<T> {
    let body: unknown = null; try { body = await response.json(); } catch { /* normalized below */ }
    if (!response.ok) {
      const payload = body && typeof body === 'object' ? body as { error?: AdapterError } : {};
      throw new AdapterRequestError(response.status, payload.error ?? null, fallback);
    }
    return body as T;
  }
}

/**
 * Adapts records that store complete language variants under `values.translations`.
 * Translation values replace the base values as a whole to prevent mixed-language fields.
 */
export class TranslatedFieldsContentProviderAdapter implements ContentProviderAdapter {
  readonly providerId: string;
  readonly capabilities: ContentProviderAdapter['capabilities'];
  private readonly source: ContentProviderAdapter;
  private readonly baseLocale: string;
  private readonly translationsKey: string;
  private readonly supportedLocales: string[] | undefined;
  private readonly neutralCollections: Set<string>;
  private readonly queryLocaleAware: boolean;

  constructor(source: ContentProviderAdapter, input: { baseLocale: string; translationsKey?: string; supportedLocales?: string[]; neutralCollections?: string[]; queryLocaleAware?: boolean }) {
    this.source = source;
    this.providerId = source.providerId;
    this.baseLocale = input.baseLocale;
    this.translationsKey = input.translationsKey ?? 'translations';
    this.supportedLocales = input.supportedLocales;
    this.neutralCollections = new Set(input.neutralCollections ?? []);
    this.queryLocaleAware = input.queryLocaleAware ?? false;
    this.capabilities = { ...source.capabilities, supported: [...new Set([...source.capabilities.supported.filter(capability => this.queryLocaleAware || !['query','queryPage'].includes(capability)), 'localization'])] };
  }

  async listCollections(context?: RequestContext): Promise<ProviderCollection[]> {
    return (await this.source.listCollections(withoutContentLocale(context))).map(collection => ({ ...collection, capabilities: { ...collection.capabilities, query: this.queryLocaleAware ? collection.capabilities.query : null }, localization: this.neutralCollections.has(collection.collectionId) ? { mode: 'neutral' } : { mode: 'translated', ...(this.supportedLocales ? { supportedLocales: this.supportedLocales } : {}) } }));
  }
  getSchema(id: string, context?: RequestContext): Promise<ProviderCollection> {
    return this.source.getSchema(id, withoutContentLocale(context)).then(collection => ({ ...collection, capabilities: { ...collection.capabilities, query: this.queryLocaleAware ? collection.capabilities.query : null }, localization: this.neutralCollections.has(collection.collectionId) ? { mode: 'neutral' } : { mode: 'translated', ...(this.supportedLocales ? { supportedLocales: this.supportedLocales } : {}) } }));
  }
  async search(id: string, query: string, cursor?: string, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    const result = await this.source.search(id, query, cursor, withoutContentLocale(context));
    return { ...result, items: this.localizeRecords(result.items, context?.contentLocale) };
  }
  async resolveRecords(id: string, refs: string[], context?: RequestContext) {
    const rows = await this.source.resolveRecords(id, refs, withoutContentLocale(context));
    return rows.map(row => ({ ...row, ...(row.record ? { record: this.localize(row.record, context?.contentLocale) } : {}) }));
  }
  listGroups(id: string, context?: RequestContext): Promise<ContentRecordGroup[]> {
    return this.source.listGroups ? this.source.listGroups(id, withoutContentLocale(context)) : Promise.resolve([]);
  }
  async resolveGroup(id: string, groupId: string, context?: RequestContext): Promise<ContentRecord[]> {
    if (!this.source.resolveGroup) throw new Error('Sağlayıcı kayıt grubu çözümlemeyi desteklemiyor.');
    return this.localizeRecords(await this.source.resolveGroup(id, groupId, withoutContentLocale(context)), context?.contentLocale);
  }
  async query(id: string, query: NonNullable<SourceBinding['query']>, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    if (!this.source.query) throw new Error('Sağlayıcı otomatik sorguyu desteklemiyor.');
    if (!this.queryLocaleAware) throw new Error('Translations nesnesi için otomatik sorgu host adapter’ında dile göre uygulanmalı.');
    const result = await this.source.query(id, query, context);
    return { ...result, items: this.localizeRecords(result.items, context?.contentLocale) };
  }

  private localizeRecords(records: ContentRecord[], locale?: ContentLocaleContext): ContentRecord[] {
    return records.map(record => this.localize(record, locale));
  }
  async queryPage(id:string,query:NonNullable<SourceBinding['query']>,cursor?:string,context?:RequestContext):Promise<PageResult<ContentRecord>> {
    if(!this.source.queryPage||!this.queryLocaleAware)throw new Error('Sayfalı sorgu host adapter’ında dile göre uygulanmalı.');
    const result=await this.source.queryPage(id,query,cursor,context);return {...result,items:this.localizeRecords(result.items,context?.contentLocale)};
  }
  private localize(record: ContentRecord, locale?: ContentLocaleContext): ContentRecord {
    if (!locale || this.neutralCollections.has(record.collectionId)) return record;
    const translationsValue = record.values[this.translationsKey];
    const translations = translationsValue && !Array.isArray(translationsValue) && typeof translationsValue === 'object' ? translationsValue as Record<string, JsonValue> : {};
    const base = localeCode(this.baseLocale);
    const requested = localeCode(locale.locale);
    if (record.localeResolution && record.localeResolution.requestedLocale === locale.locale) return record;
    const requestedValues = requested === base ? stripTranslationValues(record.values, this.translationsKey) : translationFor(translations, requested);
    if (requestedValues && !Array.isArray(requestedValues) && typeof requestedValues === 'object') {
      return { ...record, values: structuredClone(requestedValues as Record<string, JsonValue>), localeResolution: { requestedLocale: locale.locale, resolvedLocale: locale.locale, usedFallback: false } };
    }
    if (locale.fallback.mode === 'locale') {
      const fallback = localeCode(locale.fallback.locale);
      const fallbackValues = fallback === base ? stripTranslationValues(record.values, this.translationsKey) : translationFor(translations, fallback);
      if (fallbackValues && !Array.isArray(fallbackValues) && typeof fallbackValues === 'object') {
        return { ...record, values: structuredClone(fallbackValues as Record<string, JsonValue>), localeResolution: { requestedLocale: locale.locale, resolvedLocale: locale.fallback.locale, usedFallback: true } };
      }
    }
    throw new Error(`“${record.recordId}” kaydında ${locale.locale} dil çevirisi yok.`);
  }
}

/** Maps canonical record/group references and locale codes to a host CMS's per-language IDs. */
export class LocaleMappedContentProviderAdapter implements ContentProviderAdapter {
  readonly providerId: string;
  readonly capabilities: ContentProviderAdapter['capabilities'];
  private readonly source: ContentProviderAdapter;
  private readonly mapLocale: (locale: string) => string;
  private readonly mapRecordRef: (collectionId: string, canonicalRef: string, locale: string) => string;
  private readonly mapGroupRef: (collectionId: string, canonicalRef: string, locale: string) => string;
  private readonly canonicalRecordRef: (collectionId: string, localizedRef: string, locale: string) => string;
  private readonly canonicalGroupRef: (collectionId: string, localizedRef: string, locale: string) => string;
  private readonly canonicalLocale: (localizedLocale: string) => string;
  private readonly supportedLocales: string[] | undefined;
  private readonly neutralCollections: Set<string>;

  constructor(source: ContentProviderAdapter, input: {
    mapLocale: (locale: string) => string;
    mapRecordRef: (collectionId: string, canonicalRef: string, locale: string) => string;
    mapGroupRef?: (collectionId: string, canonicalRef: string, locale: string) => string;
    canonicalRecordRef?: (collectionId: string, localizedRef: string, locale: string) => string;
    canonicalGroupRef?: (collectionId: string, localizedRef: string, locale: string) => string;
    canonicalLocale?: (localizedLocale: string) => string;
    supportedLocales?: string[];
    neutralCollections?: string[];
  }) {
    this.source = source;
    this.providerId = source.providerId;
    this.capabilities = { ...source.capabilities, supported: [...new Set([...source.capabilities.supported, 'localization'])] };
    this.mapLocale = input.mapLocale;
    this.mapRecordRef = input.mapRecordRef;
    this.mapGroupRef = input.mapGroupRef ?? ((_collection, ref) => ref);
    this.canonicalRecordRef = input.canonicalRecordRef ?? ((_collection, ref) => ref);
    this.canonicalGroupRef = input.canonicalGroupRef ?? ((_collection, ref) => ref);
    this.canonicalLocale = input.canonicalLocale ?? (locale => locale);
    this.supportedLocales = input.supportedLocales;
    this.neutralCollections = new Set(input.neutralCollections ?? []);
  }
  async listCollections(context?: RequestContext): Promise<ProviderCollection[]> {
    return (await this.source.listCollections(this.mapContext(context))).map(collection => this.localizeCollection(collection));
  }
  async getSchema(id: string, context?: RequestContext): Promise<ProviderCollection> {
    return this.localizeCollection(await this.source.getSchema(id, this.mapContext(context)));
  }
  async search(id: string, query: string, cursor?: string, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    const locale = context?.contentLocale?.locale ?? '';
    const result = await this.source.search(id, query, cursor, this.mapContext(context));
    return { ...result, items: result.items.map(record => this.canonicalizeRecord(id, record, locale)) };
  }
  async resolveRecords(id: string, refs: string[], context?: RequestContext) {
    const locale = context?.contentLocale?.locale ?? '';
    const localizedRefs = refs.map(ref => this.mapRecordRef(id, ref, locale));
    const rows = await this.source.resolveRecords(id, localizedRefs, this.mapContext(context));
    const canonicalRefs = new Map(localizedRefs.map((ref, index) => [ref, refs[index]!]));
    return rows.map(row => ({ ...row, recordId: canonicalRefs.get(row.recordId) ?? this.canonicalRecordRef(id, row.recordId, locale), ...(row.record ? { record: this.canonicalizeRecord(id, row.record, locale) } : {}) }));
  }
  async listGroups(id: string, context?: RequestContext): Promise<ContentRecordGroup[]> {
    if (!this.source.listGroups) return [];
    const locale = context?.contentLocale?.locale ?? '';
    return (await this.source.listGroups(id, this.mapContext(context))).map(group => ({ ...group, groupId: this.canonicalGroupRef(id, group.groupId, locale) }));
  }
  async resolveGroup(id: string, groupId: string, context?: RequestContext): Promise<ContentRecord[]> {
    if (!this.source.resolveGroup) throw new Error('Sağlayıcı kayıt grubu çözümlemeyi desteklemiyor.');
    const locale = context?.contentLocale?.locale ?? '';
    const rows = await this.source.resolveGroup(id, this.mapGroupRef(id, groupId, locale), this.mapContext(context));
    return rows.map(record => this.canonicalizeRecord(id, record, locale));
  }
  async query(id: string, query: NonNullable<SourceBinding['query']>, context?: RequestContext): Promise<PageResult<ContentRecord>> {
    if (!this.source.query) throw new Error('Sağlayıcı otomatik sorguyu desteklemiyor.');
    const locale = context?.contentLocale?.locale ?? '';
    const result = await this.source.query(id, query, this.mapContext(context));
    return { ...result, items: result.items.map(record => this.canonicalizeRecord(id, record, locale)) };
  }
  private canonicalizeRecord(collectionId: string, record: ContentRecord, locale: string): ContentRecord {
    const localeResolution = record.localeResolution ? {
      ...record.localeResolution,
      requestedLocale: locale || record.localeResolution.requestedLocale,
      resolvedLocale: record.localeResolution.usedFallback ? this.canonicalLocale(record.localeResolution.resolvedLocale) : (locale || this.canonicalLocale(record.localeResolution.resolvedLocale)),
    } : undefined;
    return { ...record, recordId: this.canonicalRecordRef(collectionId, record.recordId, locale), ...(localeResolution ? { localeResolution } : {}) };
  }
  async queryPage(id:string,query:NonNullable<SourceBinding['query']>,cursor?:string,context?:RequestContext):Promise<PageResult<ContentRecord>> {
    if(!this.source.queryPage)throw new Error('Sağlayıcı sayfalı sorguyu desteklemiyor.');
    const locale=context?.contentLocale?.locale??'';const result=await this.source.queryPage(id,query,cursor,this.mapContext(context));return {...result,items:result.items.map(record=>this.canonicalizeRecord(id,record,locale))};
  }
  private mapContext(context?: RequestContext): RequestContext | undefined {
    if (!context?.contentLocale) return context;
    const locale = context.contentLocale;
    return { ...context, contentLocale: { locale: this.mapLocale(locale.locale), fallback: locale.fallback.mode === 'locale' ? { mode: 'locale', locale: this.mapLocale(locale.fallback.locale) } : { mode: 'none' } } };
  }
  private localizeCollection(collection: ProviderCollection): ProviderCollection {
    if (this.neutralCollections.has(collection.collectionId)) return { ...collection, localization: { mode: 'neutral' } };
    return this.supportedLocales
      ? { ...collection, localization: { mode: 'translated', supportedLocales: this.supportedLocales } }
      : collection;
  }
}

function localeCode(locale: string): string { return Intl.getCanonicalLocales(locale)[0]!.toLowerCase(); }
function translationFor(translations: Record<string, JsonValue>, locale: string): JsonValue | undefined {
  const key = Object.keys(translations).find(candidate => localeCode(candidate) === locale)
    ?? Object.keys(translations).find(candidate => localeCode(candidate).split('-', 1)[0] === locale.split('-', 1)[0]);
  return key ? translations[key] : undefined;
}
function stripTranslationValues(values: Record<string, JsonValue>, translationsKey: string): Record<string, JsonValue> {
  const copy = structuredClone(values);
  delete copy[translationsKey];
  return copy;
}
function withoutContentLocale(context?: RequestContext): RequestContext | undefined {
  if (!context) return undefined;
  const { contentLocale: _contentLocale, ...rest } = context;
  return rest;
}

/** Reference HTTP asset provider for image search, upload, and stable asset URLs. */
export class HttpAssetAdapter implements AssetAdapter {
  readonly capabilities = { supported: ['search', 'resolve', 'upload'], constraints: { maxBytes: 8 * 1024 * 1024, mimeTypes: ['image/jpeg', 'image/png', 'image/gif'] } };
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly headers: () => HeadersInit;

  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit } = {}) {
    this.baseUrl = (input.baseUrl ?? '/api/v1').replace(/\/$/, '');
    this.fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
    this.headers = input.headers ?? (() => ({}));
  }

  async search(query: string, context?: RequestContext): Promise<PageResult<AssetRecord>> {
    const params = new URLSearchParams({ q: query });
    if(context?.cursor)params.set('cursor',context.cursor);
    const page = await this.read<PageResult<AssetRecord>>(await this.fetcher(`${this.baseUrl}/assets?${params}`, {
      ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers(),
    }), 'Medya aranamadı.');
    return { ...page, items: page.items.map((asset) => this.withAssetUrl(asset)) };
  }

  async resolve(assetId: string, context?: RequestContext): Promise<AssetRecord> {
    const asset = await this.read<AssetRecord>(await this.fetcher(`${this.baseUrl}/assets/${encodeURIComponent(assetId)}`, {
      ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers(),
    }), 'Medya kaydı bulunamadı.');
    return this.withAssetUrl(asset);
  }

  async upload(file: File, context?: RequestContext): Promise<AssetRecord> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('alt', file.name);
    const asset = await this.read<AssetRecord>(await this.fetcher(`${this.baseUrl}/assets`, {
      method: 'POST', ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers(), body: form,
    }), 'Medya yüklenemedi.');
    return this.withAssetUrl(asset);
  }

  private withAssetUrl(asset: AssetRecord): AssetRecord {
    if (/^https?:\/\//i.test(asset.url)) return asset;
    const relative = asset.url.replace(/^\/+/, '');
    try { return { ...asset, url: new URL(relative, `${this.baseUrl}/`).href }; }
    catch { return { ...asset, url: `${this.baseUrl}/${relative}` }; }
  }

  private async read<T>(response: Response, fallback: string): Promise<T> {
    let body: unknown = null;
    try { body = await response.json(); } catch { /* normalize below */ }
    if (!response.ok) {
      const payload = body && typeof body === 'object' ? body as { error?: AdapterError } : {};
      throw new AdapterRequestError(response.status, payload.error ?? null, fallback);
    }
    return body as T;
  }
}

export class DemoContentProviderFallback implements ContentProviderAdapter {
  readonly providerId: string;
  readonly capabilities = { supported: ['collections', 'schema', 'search', 'resolveRecords', 'recordGroups', 'query', 'localization'], constraints: { readOnly: true, fallback: 'in-memory-demo' } };
  private readonly remote: ContentProviderAdapter;
  private readonly fallback: ContentProviderAdapter;
  private remoteAvailable: boolean | null = null;
  constructor(remote: ContentProviderAdapter, fallback: ContentProviderAdapter = new DemoContentProvider()) { this.remote = remote; this.fallback = fallback; this.providerId = remote.providerId; }
  async listCollections(context?: RequestContext) { return this.call(() => this.remote.listCollections(context), () => this.fallback.listCollections(context)); }
  async getSchema(id: string, context?: RequestContext) { return this.call(() => this.remote.getSchema(id, context), () => this.fallback.getSchema(id, context)); }
  async search(id: string, query: string, cursor?: string, context?: RequestContext) { return this.call(() => this.remote.search(id, query, cursor, context), () => this.fallback.search(id, query, cursor, context)); }
  async resolveRecords(id: string, refs: string[], context?: RequestContext) { return this.call(() => this.remote.resolveRecords(id, refs, context), () => this.fallback.resolveRecords(id, refs, context)); }
  async listGroups(id: string, context?: RequestContext) {
    if (!this.remote.listGroups || !this.fallback.listGroups) return this.fallback.listGroups?.(id, context) ?? [];
    return this.call(() => this.remote.listGroups!(id, context), () => this.fallback.listGroups!(id, context));
  }
  async resolveGroup(id: string, groupId: string, context?: RequestContext) {
    if (!this.remote.resolveGroup || !this.fallback.resolveGroup) return this.fallback.resolveGroup?.(id, groupId, context) ?? [];
    return this.call(() => this.remote.resolveGroup!(id, groupId, context), () => this.fallback.resolveGroup!(id, groupId, context));
  }
  async query(id: string, query: NonNullable<SourceBinding['query']>, context?: RequestContext) {
    if (!this.remote.query || !this.fallback.query) throw new Error('Otomatik sorgu bu provider adapter’ında kullanılamıyor.');
    return this.call(() => this.remote.query!(id, query, context), () => this.fallback.query!(id, query, context));
  }
  getStatus(): 'available' | 'offline' | 'unknown' { return this.remoteAvailable === null ? 'unknown' : this.remoteAvailable ? 'available' : 'offline'; }
  private async call<T>(remote: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.remoteAvailable === false) return fallback();
    try { const result = await remote(); this.remoteAvailable = true; return result; }
    catch (error) {
      if (error instanceof AdapterRequestError && error.status !== 404 && !canFallBack(error)) throw error;
      if (!(error instanceof TypeError) && !(error instanceof AdapterRequestError)) throw error;
      this.remoteAvailable = false;
      return fallback();
    }
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly capabilities = { supported: ['load', 'save', 'create', 'optimisticConcurrency'], constraints: { persistence: 'browser-local' } };
  private readonly storage: Storage;
  private readonly prefix: string;

  constructor(storage: Storage = globalThis.localStorage, prefix = 'blockdesign:document:') {
    this.storage = storage;
    this.prefix = prefix;
  }

  cache(document: EditorDocument): void {
    if (!document.documentId || !document.revision) return;
    this.storage.setItem(`${this.prefix}${document.documentId}`, JSON.stringify(document));
  }

  cacheSave(document: EditorDocument, result: SaveResult): void {
    this.cache({ ...document, documentId: result.documentId, revision: result.revision });
  }

  async load(documentId: string): Promise<EditorDocument> {
    const saved = this.storage.getItem(`${this.prefix}${documentId}`);
    if (!saved) throw new AdapterRequestError(404, { code: 'NOT_FOUND', message: 'Bu tarayıcıda belge bulunamadı.', recoverable: true }, 'Belge bulunamadı.');
    return JSON.parse(saved) as EditorDocument;
  }

  async save(document: EditorDocument, expectedRevision: string | null): Promise<SaveResult> {
    const documentId = document.documentId || crypto.randomUUID();
    const key = `${this.prefix}${documentId}`;
    const previous = this.storage.getItem(key);
    if (!document.documentId && previous) throw new AdapterRequestError(412, null, 'Belge kimliği çakıştı.');
    if (document.documentId) {
      if (!previous) throw new AdapterRequestError(404, { code: 'NOT_FOUND', message: 'Kaydedilecek belge artık bulunamıyor.', recoverable: true }, 'Belge bulunamadı.');
      const current = JSON.parse(previous) as EditorDocument;
      if (current.revision !== expectedRevision) {
        throw new AdapterRequestError(412, { code: 'REVISION_CONFLICT', message: 'Bu belge başka bir sekmede değiştirildi.', details: { revision: current.revision }, recoverable: true }, 'Belge revision uyuşmazlığı.');
      }
    } else if (expectedRevision !== null) {
      throw new AdapterRequestError(428, null, 'Yeni belgede beklenen revision boş olmalı.');
    }
    const revision = String(document.documentId ? Number(expectedRevision) + 1 : 1);
    this.storage.setItem(key, JSON.stringify({ ...document, documentId, revision }));
    return { documentId, revision, savedAt: new Date().toISOString() };
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  readonly capabilities = { supported: ['load', 'save', 'create', 'optimisticConcurrency'], constraints: { persistence: 'editor-lifetime' } };
  private readonly documents = new Map<string, EditorDocument>();

  constructor(initial: EditorDocument[] = []) {
    for (const document of initial) {
      if (document.documentId) this.documents.set(document.documentId, structuredClone(document));
    }
  }

  async load(documentId: string): Promise<EditorDocument> {
    const document = this.documents.get(documentId);
    if (!document) throw new AdapterRequestError(404, { code: 'NOT_FOUND', message: 'Belge bulunamadı.', recoverable: true }, 'Belge bulunamadı.');
    return structuredClone(document);
  }

  async save(document: EditorDocument, expectedRevision: string | null): Promise<SaveResult> {
    const documentId = document.documentId || crypto.randomUUID();
    const current = this.documents.get(documentId);
    if (current && current.revision !== expectedRevision) throw new AdapterRequestError(412, { code: 'REVISION_CONFLICT', message: 'Belge başka bir yerde değiştirildi.', recoverable: true }, 'Revision uyuşmazlığı.');
    if (!current && expectedRevision !== null) throw new AdapterRequestError(412, null, 'Yeni belge için revision bulunmamalı.');
    const revision = String(current ? Number(current.revision) + 1 : 1);
    this.documents.set(documentId, structuredClone({ ...document, documentId, revision }));
    return { documentId, revision, savedAt: new Date().toISOString() };
  }
}

export class DemoStorageAdapter implements StorageAdapter {
  listRevisions(documentId:string,context?:RequestContext){return this.remote.listRevisions(documentId,context);}
  loadRevision(documentId:string,revision:string,context?:RequestContext){return this.remote.loadRevision(documentId,revision,context);}
  readonly capabilities = { supported: ['load', 'save', 'create', 'optimisticConcurrency'] };
  private readonly remote: HttpStorageAdapter;
  private readonly local: LocalStorageAdapter;
  private readonly onBackendState: ((available: boolean) => void) | undefined;
  private remoteState: 'unknown' | 'available' | 'offline' = 'unknown';

  constructor(input: { baseUrl?: string; onBackendState?: (available: boolean) => void } = {}) {
    this.remote = new HttpStorageAdapter(input.baseUrl ? { baseUrl: input.baseUrl } : {});
    this.local = new LocalStorageAdapter();
    this.onBackendState = input.onBackendState;
  }

  getStatus(): 'available' | 'offline' | 'unknown' { return this.remoteState; }

  async load(documentId: string, context?: RequestContext): Promise<EditorDocument> {
    try {
      const document = await this.remote.load(documentId, context);
      this.local.cache(document);
      this.setState(true);
      return document;
    } catch (error) {
      if (error instanceof AdapterRequestError && error.status === 404) this.setState(true);
      if (!this.canFallBack(error)) throw error;
      this.setState(false);
      return this.local.load(documentId);
    }
  }

  async save(document: EditorDocument, expectedRevision: string | null, context?: RequestContext): Promise<SaveResult> {
    if (this.remoteState !== 'offline') {
      try {
        const result = await this.remote.save(document, expectedRevision, context);
        this.local.cacheSave(document, result);
        this.setState(true);
        return result;
      } catch (error) {
        if (!this.canFallBack(error)) throw error;
        this.setState(false);
      }
    }
    return this.local.save(document, expectedRevision);
  }

  private canFallBack(error: unknown): boolean {
    return error instanceof TypeError || (error instanceof AdapterRequestError && ([502, 503, 504].includes(error.status) || (error.status === 500 && error.details === null)));
  }

  private setState(available: boolean): void {
    this.remoteState = available ? 'available' : 'offline';
    this.onBackendState?.(available);
  }
}

export class MemoryBlockLibraryAdapter implements BlockLibraryAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'archive', 'restore'] };
  private definitions = new Map<string, BlockDefinitionVersion>();

  constructor(initial: BlockDefinitionVersion[] = []) {
    for (const definition of initial) this.definitions.set(key(definition.ref), structuredClone(definition));
  }

  async list(input: { designSystemRef: VersionRef; query?: string; includeArchived?: boolean }): Promise<PageResult<BlockDefinitionVersion>> {
    const query = input.query?.toLocaleLowerCase('tr-TR');
    return {
      items: [...this.definitions.values()]
        .filter((item) => key(item.designSystemRef) === key(input.designSystemRef))
        .filter((item) => input.includeArchived || !item.archived)
        .filter((item) => !query || `${item.name} ${item.description} ${item.category}`.toLocaleLowerCase('tr-TR').includes(query))
        .map((item) => structuredClone(item)),
      nextCursor: null,
    };
  }

  async getVersion(ref: VersionRef): Promise<BlockDefinitionVersion> {
    const definition = this.definitions.get(key(ref));
    if (!definition) throw new AdapterRequestError(404, { code: 'NOT_FOUND', message: 'Blok sürümü bulunamadı.', recoverable: true }, 'Blok bulunamadı.');
    return structuredClone(definition);
  }

  async create(definition: BlockDefinitionVersion): Promise<VersionRef> {
    const definitionKey = key(definition.ref);
    if (this.definitions.has(definitionKey)) throw new AdapterRequestError(409, { code: 'ALREADY_EXISTS', message: 'Bu blok sürümü zaten var.', recoverable: true }, 'Blok sürümü çakışması.');
    this.definitions.set(definitionKey, structuredClone(definition));
    return structuredClone(definition.ref);
  }
}

export class LocalStorageBlockLibraryAdapter implements BlockLibraryAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'search', 'archive', 'deleteUnused'], constraints: { persistence: 'browser-local', immutableVersions: true, referenceCheckedDelete: true } };
  private readonly storage: Storage;
  private readonly prefix: string;

  constructor(storage: Storage = globalThis.localStorage, prefix = 'blockdesign:block:') {
    this.storage = storage;
    this.prefix = prefix;
  }

  async list(input: { designSystemRef: VersionRef; query?: string; includeArchived?: boolean }): Promise<PageResult<BlockDefinitionVersion>> {
    const query = input.query?.toLocaleLowerCase('tr-TR');
    const items: BlockDefinitionVersion[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(this.prefix)) continue;
      const value = this.storage.getItem(key);
      if (!value) continue;
      try {
        const definition = JSON.parse(value) as BlockDefinitionVersion;
        if (keyOf(definition.designSystemRef) !== keyOf(input.designSystemRef)) continue;
        if (!input.includeArchived && definition.archived) continue;
        if (query && !`${definition.name} ${definition.description} ${definition.category}`.toLocaleLowerCase('tr-TR').includes(query)) continue;
        items.push(definition);
      } catch {
        // A damaged local catalog entry is skipped and never prevents other blocks from loading.
      }
    }
    return { items, nextCursor: null };
  }

  async getVersion(ref: VersionRef): Promise<BlockDefinitionVersion> {
    const value = this.storage.getItem(`${this.prefix}${keyOf(ref)}`);
    if (!value) throw new AdapterRequestError(404, { code: 'NOT_FOUND', message: 'Blok sürümü bulunamadı.', recoverable: true }, 'Blok bulunamadı.');
    return JSON.parse(value) as BlockDefinitionVersion;
  }

  async create(definition: BlockDefinitionVersion): Promise<VersionRef> {
    const key = `${this.prefix}${keyOf(definition.ref)}`;
    if (this.storage.getItem(key)) throw new AdapterRequestError(409, { code: 'ALREADY_EXISTS', message: 'Bu blok sürümü zaten var.', recoverable: true }, 'Blok sürümü çakışması.');
    this.storage.setItem(key, JSON.stringify(definition));
    return structuredClone(definition.ref);
  }

  async archive(ref: VersionRef, archived: boolean): Promise<void> {
    const definition = await this.getVersion(ref);
    this.storage.setItem(`${this.prefix}${keyOf(ref)}`, JSON.stringify({ ...definition, archived }));
  }

  async delete(ref: VersionRef): Promise<void> {
    this.assertDeletable(ref);
    const storageKey = `${this.prefix}${keyOf(ref)}`;
    if (!this.storage.getItem(storageKey)) throw new AdapterRequestError(404, { code: 'NOT_FOUND', message: 'Blok sürümü bulunamadı.', recoverable: true }, 'Blok bulunamadı.');
    this.storage.removeItem(storageKey);
  }

  assertDeletable(ref: VersionRef): void {
    if (hasLocalReference(this.storage, ref)) throw new AdapterRequestError(409, { code: 'VERSION_IN_USE', message: 'Bu sürüm bir belge veya şablon tarafından kullanılıyor.', recoverable: true }, 'Blok sürümü kullanımda.');
  }
}

export class LocalStorageTemplateAdapter implements TemplateAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'archive'], constraints: { persistence: 'browser-local', immutableVersions: true } };
  private readonly storage: Storage;
  private readonly prefix: string;
  constructor(storage: Storage = globalThis.localStorage, initial: PageTemplateDefinition[] = [], prefix = 'blockdesign:template:') {
    this.storage = storage; this.prefix = prefix;
    for (const template of initial) if (!this.storage.getItem(`${this.prefix}${keyOf(template.ref)}`)) this.storage.setItem(`${this.prefix}${keyOf(template.ref)}`, JSON.stringify(template));
  }
  async list(input: { designSystemRef: VersionRef; includeArchived?: boolean }): Promise<PageResult<PageTemplateDefinition>> {
    const items: PageTemplateDefinition[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index); if (!key?.startsWith(this.prefix)) continue;
      const value = this.storage.getItem(key); if (!value) continue;
      try {
        const template = JSON.parse(value) as PageTemplateDefinition;
        if (keyOf(template.designSystemRef) !== keyOf(input.designSystemRef) || (!input.includeArchived && template.archived)) continue;
        items.push(template);
      } catch { /* damaged local entry is ignored */ }
    }
    return { items, nextCursor: null };
  }
  async getVersion(ref: VersionRef): Promise<PageTemplateDefinition> {
    const value = this.storage.getItem(`${this.prefix}${keyOf(ref)}`);
    if (!value) throw new AdapterRequestError(404, { code: 'NOT_FOUND', message: 'Sayfa şablonu bulunamadı.', recoverable: true }, 'Şablon bulunamadı.');
    return JSON.parse(value) as PageTemplateDefinition;
  }
  async create(template: PageTemplateDefinition): Promise<VersionRef> {
    const key = `${this.prefix}${keyOf(template.ref)}`;
    if (this.storage.getItem(key)) throw new AdapterRequestError(409, { code: 'ALREADY_EXISTS', message: 'Bu şablon sürümü zaten var.', recoverable: true }, 'Şablon sürümü çakışması.');
    this.storage.setItem(key, JSON.stringify(template)); return structuredClone(template.ref);
  }
  async archive(ref: VersionRef, archived: boolean): Promise<void> {
    const template = await this.getVersion(ref);
    this.storage.setItem(`${this.prefix}${keyOf(ref)}`, JSON.stringify({ ...template, archived }));
  }
}

export class HttpTemplateAdapter implements TemplateAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'archive'] };
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly headers: () => HeadersInit;
  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit } = {}) {
    this.baseUrl = (input.baseUrl ?? '/api/v1').replace(/\/$/, '');
    this.fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
    this.headers = input.headers ?? (() => ({}));
  }
  async list(input: { designSystemRef: VersionRef; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<PageTemplateDefinition>> {
    const params = new URLSearchParams({ systemId: input.designSystemRef.id, systemVersion: input.designSystemRef.version });
    if (input.includeArchived) params.set('includeArchived', 'true');
    return this.read(await this.fetcher(`${this.baseUrl}/templates?${params}`, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Şablonlar yüklenemedi.');
  }
  async getVersion(ref: VersionRef, context?: RequestContext): Promise<PageTemplateDefinition> {
    return this.read(await this.fetcher(`${this.baseUrl}/templates/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Şablon sürümü bulunamadı.');
  }
  async create(template: PageTemplateDefinition, context?: RequestContext): Promise<VersionRef> {
    return this.read(await this.fetcher(`${this.baseUrl}/templates`, { method: 'POST', ...(context?.signal ? { signal: context.signal } : {}), headers: withHeaders(this.headers(), { 'Content-Type': 'application/json' }), body: JSON.stringify(template) }), 'Şablon kaydedilemedi.');
  }
  async archive(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void> {
    await this.read(await this.fetcher(`${this.baseUrl}/templates/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`, { method: 'PATCH', ...(context?.signal ? { signal: context.signal } : {}), headers: withHeaders(this.headers(), { 'Content-Type': 'application/json' }), body: JSON.stringify({ archived }) }), 'Şablon arşivlenemedi.');
  }
  private async read<T>(response: Response, fallback: string): Promise<T> {
    let body: unknown = null; try { body = await response.json(); } catch { /* use normalized HTTP error */ }
    if (!response.ok) { const payload = body && typeof body === 'object' ? body as { error?: AdapterError } : {}; throw new AdapterRequestError(response.status, payload.error ?? null, fallback); }
    return body as T;
  }
}

export class DemoTemplateAdapter implements TemplateAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'archive'], constraints: { offlineFallback: 'browser-local' } };
  private readonly remote: HttpTemplateAdapter;
  private readonly local: LocalStorageTemplateAdapter;
  private remoteState: 'unknown' | 'available' | 'offline' = 'unknown';
  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit; storage?: Storage; initial?: PageTemplateDefinition[] } = {}) {
    this.remote = new HttpTemplateAdapter(input);
    this.local = new LocalStorageTemplateAdapter(input.storage, input.initial);
  }
  getStatus(): 'available' | 'offline' | 'unknown' { return this.remoteState; }
  async list(input: { designSystemRef: VersionRef; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<PageTemplateDefinition>> {
    if (this.remoteState !== 'offline') {
      try {
        const [remote, local] = await Promise.all([this.remote.list(input, context), this.local.list(input)]);
        this.remoteState = 'available';
        const items = new Map<string, PageTemplateDefinition>();
        for (const item of [...local.items, ...remote.items]) items.set(keyOf(item.ref), item);
        return { items: [...items.values()], nextCursor: remote.nextCursor };
      } catch (error) { if (!canFallBack(error)) throw error; this.remoteState = 'offline'; }
    }
    return this.local.list(input);
  }
  async getVersion(ref: VersionRef, context?: RequestContext): Promise<PageTemplateDefinition> {
    if (this.remoteState !== 'offline') {
      try { const result = await this.remote.getVersion(ref, context); this.remoteState = 'available'; return result; }
      catch (error) {
        if (error instanceof AdapterRequestError && error.status === 404) return this.local.getVersion(ref);
        if (!canFallBack(error)) throw error;
        this.remoteState = 'offline';
      }
    }
    return this.local.getVersion(ref);
  }
  async create(template: PageTemplateDefinition, context?: RequestContext): Promise<VersionRef> {
    if (this.remoteState !== 'offline') {
      try {
        const result = await this.remote.create(template, context); this.remoteState = 'available';
        try { await this.local.create(template); } catch (error) { if (!(error instanceof AdapterRequestError && error.status === 409)) throw error; }
        return result;
      } catch (error) { if (!canFallBack(error)) throw error; this.remoteState = 'offline'; }
    }
    return this.local.create(template);
  }
  async archive(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void> {
    if (this.remoteState !== 'offline') {
      try {
        await this.remote.archive(ref, archived, context); this.remoteState = 'available';
        try { await this.local.archive(ref, archived); } catch { /* remote-only version */ }
        return;
      } catch (error) {
        if (error instanceof AdapterRequestError && error.status === 404) { await this.local.archive(ref, archived); return; }
        if (!canFallBack(error)) throw error;
        this.remoteState = 'offline';
      }
    }
    await this.local.archive(ref, archived);
  }
}

export class LocalStorageSharedRegionAdapter implements SharedRegionAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'archive'], constraints: { persistence: 'browser-local', immutableVersions: true } };
  private readonly storage: Storage;
  private readonly prefix: string;
  constructor(storage: Storage = globalThis.localStorage, initial: SharedRegionDefinition[] = [], prefix = 'blockdesign:region:') {
    this.storage = storage; this.prefix = prefix;
    for (const region of initial) if (!this.storage.getItem(`${this.prefix}${keyOf(region.ref)}`)) this.storage.setItem(`${this.prefix}${keyOf(region.ref)}`, JSON.stringify(region));
  }
  async list(input: { designSystemRef: VersionRef; includeArchived?: boolean }): Promise<PageResult<SharedRegionDefinition>> {
    const items: SharedRegionDefinition[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const storageKey = this.storage.key(index); if (!storageKey?.startsWith(this.prefix)) continue;
      const value = this.storage.getItem(storageKey); if (!value) continue;
      try { const region = JSON.parse(value) as SharedRegionDefinition; if (keyOf(region.designSystemRef) !== keyOf(input.designSystemRef) || (!input.includeArchived && region.archived)) continue; items.push(region); } catch { /* ignore damaged local entry */ }
    }
    return { items, nextCursor: null };
  }
  async getVersion(ref: VersionRef): Promise<SharedRegionDefinition> {
    const value = this.storage.getItem(`${this.prefix}${keyOf(ref)}`);
    if (!value) throw new AdapterRequestError(404, { code: 'NOT_FOUND', message: 'Paylaşılan bölge sürümü bulunamadı.', recoverable: true }, 'Bölge bulunamadı.');
    return JSON.parse(value) as SharedRegionDefinition;
  }
  async create(region: SharedRegionDefinition): Promise<VersionRef> {
    const storageKey = `${this.prefix}${keyOf(region.ref)}`;
    if (this.storage.getItem(storageKey)) throw new AdapterRequestError(409, { code: 'ALREADY_EXISTS', message: 'Bu bölge sürümü zaten var.', recoverable: true }, 'Bölge sürümü çakışması.');
    this.storage.setItem(storageKey, JSON.stringify(region)); return structuredClone(region.ref);
  }
  async archive(ref: VersionRef, archived: boolean): Promise<void> {
    const region = await this.getVersion(ref); this.storage.setItem(`${this.prefix}${keyOf(ref)}`, JSON.stringify({ ...region, archived }));
  }
}

export class HttpSharedRegionAdapter implements SharedRegionAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'archive'] };
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly headers: () => HeadersInit;
  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit } = {}) {
    this.baseUrl = (input.baseUrl ?? '/api/v1').replace(/\/$/, '');
    this.fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
    this.headers = input.headers ?? (() => ({}));
  }
  async list(input: { designSystemRef: VersionRef; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<SharedRegionDefinition>> {
    const params = new URLSearchParams({ systemId: input.designSystemRef.id, systemVersion: input.designSystemRef.version });
    if (input.includeArchived) params.set('includeArchived', 'true');
    return this.read(await this.fetcher(`${this.baseUrl}/shared-regions?${params}`, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Paylaşılan bölgeler yüklenemedi.');
  }
  async getVersion(ref: VersionRef, context?: RequestContext): Promise<SharedRegionDefinition> {
    return this.read(await this.fetcher(`${this.baseUrl}/shared-regions/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() }), 'Paylaşılan bölge sürümü bulunamadı.');
  }
  async create(region: SharedRegionDefinition, context?: RequestContext): Promise<VersionRef> {
    return this.read(await this.fetcher(`${this.baseUrl}/shared-regions`, { method: 'POST', ...(context?.signal ? { signal: context.signal } : {}), headers: withHeaders(this.headers(), { 'Content-Type': 'application/json' }), body: JSON.stringify(region) }), 'Paylaşılan bölge kaydedilemedi.');
  }
  async archive(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void> {
    await this.read(await this.fetcher(`${this.baseUrl}/shared-regions/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}`, { method: 'PATCH', ...(context?.signal ? { signal: context.signal } : {}), headers: withHeaders(this.headers(), { 'Content-Type': 'application/json' }), body: JSON.stringify({ archived }) }), 'Paylaşılan bölge arşivlenemedi.');
  }
  private async read<T>(response: Response, fallback: string): Promise<T> {
    let body: unknown = null; try { body = await response.json(); } catch { /* use normalized HTTP error */ }
    if (!response.ok) { const payload = body && typeof body === 'object' ? body as { error?: AdapterError } : {}; throw new AdapterRequestError(response.status, payload.error ?? null, fallback); }
    return body as T;
  }
}

export class DemoSharedRegionAdapter implements SharedRegionAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'archive'], constraints: { offlineFallback: 'browser-local' } };
  private readonly remote: HttpSharedRegionAdapter;
  private readonly local: LocalStorageSharedRegionAdapter;
  private remoteState: 'unknown' | 'available' | 'offline' = 'unknown';
  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit; storage?: Storage; initial?: SharedRegionDefinition[] } = {}) {
    this.remote = new HttpSharedRegionAdapter(input);
    this.local = new LocalStorageSharedRegionAdapter(input.storage, input.initial);
  }
  getStatus(): 'available' | 'offline' | 'unknown' { return this.remoteState; }
  async list(input: { designSystemRef: VersionRef; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<SharedRegionDefinition>> {
    if (this.remoteState !== 'offline') {
      try {
        const [remote, local] = await Promise.all([this.remote.list(input, context), this.local.list(input)]);
        this.remoteState = 'available';
        const items = new Map<string, SharedRegionDefinition>();
        for (const item of [...local.items, ...remote.items]) items.set(keyOf(item.ref), item);
        return { items: [...items.values()], nextCursor: remote.nextCursor };
      } catch (error) { if (!canFallBack(error)) throw error; this.remoteState = 'offline'; }
    }
    return this.local.list(input);
  }
  async getVersion(ref: VersionRef, context?: RequestContext): Promise<SharedRegionDefinition> {
    if (this.remoteState !== 'offline') {
      try { const result = await this.remote.getVersion(ref, context); this.remoteState = 'available'; return result; }
      catch (error) { if (error instanceof AdapterRequestError && error.status === 404) return this.local.getVersion(ref); if (!canFallBack(error)) throw error; this.remoteState = 'offline'; }
    }
    return this.local.getVersion(ref);
  }
  async create(region: SharedRegionDefinition, context?: RequestContext): Promise<VersionRef> {
    if (this.remoteState !== 'offline') {
      try {
        const result = await this.remote.create(region, context); this.remoteState = 'available';
        try { await this.local.create(region); } catch (error) { if (!(error instanceof AdapterRequestError && error.status === 409)) throw error; }
        return result;
      } catch (error) { if (!canFallBack(error)) throw error; this.remoteState = 'offline'; }
    }
    return this.local.create(region);
  }
  async archive(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void> {
    if (this.remoteState !== 'offline') {
      try { await this.remote.archive(ref, archived, context); this.remoteState = 'available'; try { await this.local.archive(ref, archived); } catch { /* remote-only version */ } return; }
      catch (error) { if (error instanceof AdapterRequestError && error.status === 404) { await this.local.archive(ref, archived); return; } if (!canFallBack(error)) throw error; this.remoteState = 'offline'; }
    }
    await this.local.archive(ref, archived);
  }
}

export class DemoBlockLibraryAdapter implements BlockLibraryAdapter {
  readonly capabilities = { supported: ['list', 'readVersion', 'create', 'search', 'archive', 'deleteUnused'], constraints: { offlineFallback: 'browser-local', referenceCheckedDelete: true } };
  private readonly remote: HttpBlockLibraryAdapter;
  private readonly local: LocalStorageBlockLibraryAdapter;
  private remoteState: 'available' | 'offline' | 'unknown' = 'unknown';
  private readonly onBackendState: ((available: boolean) => void) | undefined;

  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit; storage?: Storage; onBackendState?: (available: boolean) => void } = {}) {
    this.remote = new HttpBlockLibraryAdapter(input);
    this.local = new LocalStorageBlockLibraryAdapter(input.storage);
    this.onBackendState = input.onBackendState;
  }

  getStatus(): 'available' | 'offline' | 'unknown' { return this.remoteState; }

  async list(input: { designSystemRef: VersionRef; query?: string; cursor?: string; includeArchived?: boolean }, context?: RequestContext): Promise<PageResult<BlockDefinitionVersion>> {
    try {
      const [remote, local] = await Promise.all([this.remote.list(input, context), this.local.list(input)]);
      this.setState(true);
      const merged = new Map<string, BlockDefinitionVersion>();
      for (const item of [...local.items, ...remote.items]) merged.set(keyOf(item.ref), item);
      return { items: [...merged.values()], nextCursor: remote.nextCursor };
    } catch (error) {
      if (!canFallBack(error)) throw error;
      this.setState(false);
      return this.local.list(input);
    }
  }

  async getVersion(ref: VersionRef, context?: RequestContext): Promise<BlockDefinitionVersion> {
    if (this.remoteState !== 'offline') {
      try {
        const definition = await this.remote.getVersion(ref, context);
        this.setState(true);
        return definition;
      } catch (error) {
        if (error instanceof AdapterRequestError && error.status === 404) return this.local.getVersion(ref);
        if (!canFallBack(error)) throw error;
        this.setState(false);
      }
    }
    return this.local.getVersion(ref);
  }

  async create(definition: BlockDefinitionVersion, context?: RequestContext): Promise<VersionRef> {
    if (this.remoteState !== 'offline') {
      try {
        const ref = await this.remote.create(definition, context);
        await this.local.create(definition);
        this.setState(true);
        return ref;
      } catch (error) {
        if (!canFallBack(error)) throw error;
        this.setState(false);
      }
    }
    return this.local.create(definition);
  }

  async archive(ref: VersionRef, archived: boolean, context?: RequestContext): Promise<void> {
    if (this.remoteState !== 'offline') {
      try {
        await this.remote.archive(ref, archived, context);
        this.setState(true);
        try { await this.local.archive(ref, archived); } catch { /* the version may only exist on the remote backend */ }
        return;
      } catch (error) {
        if (error instanceof AdapterRequestError && error.status === 404) { await this.local.archive(ref, archived); return; }
        if (!canFallBack(error)) throw error;
        this.setState(false);
      }
    }
    await this.local.archive(ref, archived);
  }

  async delete(ref: VersionRef, context?: RequestContext): Promise<void> {
    this.local.assertDeletable(ref);
    if (this.remoteState !== 'offline') {
      try {
        await this.remote.delete(ref, context);
        this.setState(true);
        try { await this.local.delete(ref); } catch { /* version may only exist remotely */ }
        return;
      } catch (error) {
        if (error instanceof AdapterRequestError && error.status === 404) { await this.local.delete(ref); return; }
        if (!canFallBack(error)) throw error;
        this.setState(false);
      }
    }
    await this.local.delete(ref);
  }

  private setState(available: boolean): void {
    this.remoteState = available ? 'available' : 'offline';
    this.onBackendState?.(available);
  }
}

function key(ref: VersionRef): string {
  return `${ref.id}@${ref.version}`;
}

/** Browser-local persistence for common design-system CSS and stylesheet dependencies. */
export class LocalStorageDesignSystemAdapter implements DesignSystemAdapter {
  readonly capabilities = { supported: ['readManifest', 'writeManifest'], constraints: { persistence: 'browser-local', revisionCheck: true } };
  private readonly storage: Storage;
  private readonly prefix: string;
  constructor(storage: Storage = globalThis.localStorage, prefix = 'blockdesign:design-system:') { this.storage = storage; this.prefix = prefix; }
  async load(ref: VersionRef): Promise<DesignSystemAssetManifest> {
    const raw = this.storage.getItem(`${this.prefix}${keyOf(ref)}`);
    if (!raw) return { ref: structuredClone(ref), name: ref.id, commonCss: '', stylesheets: [], revision: null };
    const manifest = JSON.parse(raw) as DesignSystemAssetManifest;
    if (keyOf(manifest.ref) !== keyOf(ref)) throw new AdapterRequestError(409, { code: 'DESIGN_SYSTEM_REF_MISMATCH', message: 'Tasarım sistemi varlık kaydı farklı bir sürüme ait.', recoverable: false }, 'Tasarım sistemi kaydı geçersiz.');
    return manifest;
  }
  async save(manifest: DesignSystemAssetManifest, expectedRevision: string | null): Promise<{ revision: string }> {
    const storageKey = `${this.prefix}${keyOf(manifest.ref)}`;
    const currentRaw = this.storage.getItem(storageKey);
    const current = currentRaw ? JSON.parse(currentRaw) as DesignSystemAssetManifest : null;
    if ((current?.revision ?? null) !== expectedRevision) throw new AdapterRequestError(409, { code: 'REVISION_CONFLICT', message: 'Tasarım sistemi varlıkları başka bir yerde değiştirildi.', recoverable: true }, 'Tasarım sistemi varlık sürümü çakıştı.');
    const revision = String((Number(current?.revision ?? 0) || 0) + 1);
    this.storage.setItem(storageKey, JSON.stringify({ ...manifest, revision }));
    return { revision };
  }
  cache(manifest: DesignSystemAssetManifest): void {
    this.storage.setItem(`${this.prefix}${keyOf(manifest.ref)}`, JSON.stringify(manifest));
  }
}

export class HttpDesignSystemAdapter implements DesignSystemAdapter {
  readonly capabilities = { supported: ['readManifest', 'writeManifest', 'optimisticConcurrency'] };
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly headers: () => HeadersInit;
  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit } = {}) {
    this.baseUrl = (input.baseUrl ?? '/api/v1').replace(/\/$/, '');
    this.fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
    this.headers = input.headers ?? (() => ({}));
  }
  async load(ref: VersionRef, context?: RequestContext): Promise<DesignSystemAssetManifest> {
    const response = await this.fetcher(`${this.baseUrl}/design-systems/${encodeURIComponent(ref.id)}/versions/${encodeURIComponent(ref.version)}/assets`, { ...(context?.signal ? { signal: context.signal } : {}), headers: this.headers() });
    return this.read(response, { ref: structuredClone(ref), name: ref.id, commonCss: '', stylesheets: [], revision: null }, 'Tasarım sistemi varlıkları yüklenemedi.');
  }
  async save(manifest: DesignSystemAssetManifest, expectedRevision: string | null, context?: RequestContext): Promise<{ revision: string }> {
    const headers = withHeaders(this.headers(), { 'Content-Type': 'application/json' });
    if (expectedRevision === null) headers.set('If-None-Match', '*');
    else headers.set('If-Match', `"${expectedRevision}"`);
    return this.read<{ revision: string }>(await this.fetcher(`${this.baseUrl}/design-systems/${encodeURIComponent(manifest.ref.id)}/versions/${encodeURIComponent(manifest.ref.version)}/assets`, {
      method: 'PUT', ...(context?.signal ? { signal: context.signal } : {}), headers,
      body: JSON.stringify({ ref: manifest.ref, name: manifest.name, commonCss: manifest.commonCss, stylesheets: manifest.stylesheets }),
    }), undefined, 'Tasarım sistemi varlıkları kaydedilemedi.');
  }
  private async read<T>(response: Response, fallbackValue: T | undefined, fallback: string): Promise<T> {
    let body: unknown = null; try { body = await response.json(); } catch { /* normalize the HTTP error below */ }
    if (!response.ok) {
      if (response.status === 404 && fallbackValue !== undefined) return fallbackValue as T;
      const payload = body && typeof body === 'object' ? body as { error?: AdapterError } : {};
      throw new AdapterRequestError(response.status, payload.error ?? null, fallback);
    }
    return body as T;
  }
}

/** Remote reference API with browser-local persistence when the API cannot be reached. */
export class DemoDesignSystemAdapter implements DesignSystemAdapter {
  readonly capabilities = { supported: ['readManifest', 'writeManifest', 'optimisticConcurrency'], constraints: { offlineFallback: 'browser-local', revisionCheck: true } };
  private readonly remote: HttpDesignSystemAdapter;
  private readonly local: LocalStorageDesignSystemAdapter;
  private remoteState: 'unknown' | 'available' | 'offline' = 'unknown';
  constructor(input: { baseUrl?: string; fetcher?: typeof fetch; headers?: () => HeadersInit; storage?: Storage } = {}) {
    this.remote = new HttpDesignSystemAdapter(input);
    this.local = new LocalStorageDesignSystemAdapter(input.storage);
  }
  getStatus(): 'available' | 'offline' | 'unknown' { return this.remoteState; }
  async load(ref: VersionRef, context?: RequestContext): Promise<DesignSystemAssetManifest> {
    if (this.remoteState !== 'offline') {
      try {
        const manifest = await this.remote.load(ref, context);
        this.remoteState = 'available';
        if (manifest.revision === null) return { ...(await this.local.load(ref)), revision: null };
        this.local.cache(manifest);
        return manifest;
      } catch (error) { if (!canFallBack(error)) throw error; this.remoteState = 'offline'; }
    }
    return this.local.load(ref);
  }
  async save(manifest: DesignSystemAssetManifest, expectedRevision: string | null, context?: RequestContext): Promise<{ revision: string }> {
    if (this.remoteState !== 'offline') {
      try {
        const result = await this.remote.save(manifest, expectedRevision, context);
        this.remoteState = 'available';
        this.local.cache({ ...manifest, revision: result.revision });
        return result;
      } catch (error) { if (!canFallBack(error)) throw error; this.remoteState = 'offline'; }
    }
    return this.local.save(manifest, expectedRevision);
  }
}

function keyOf(ref: VersionRef): string { return `${ref.id}@${ref.version}`; }

function canFallBack(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof AdapterRequestError && ([502, 503, 504].includes(error.status) || (error.status === 500 && error.details === null)));
}

function withHeaders(initial: HeadersInit, additions: Record<string, string>): Headers {
  const headers = new Headers(initial);
  for (const [name, value] of Object.entries(additions)) headers.set(name, value);
  return headers;
}

function hasLocalReference(storage: Storage, ref: VersionRef): boolean {
  for (let index = 0; index < storage.length; index += 1) {
    const storageKey = storage.key(index);
    if (!storageKey || !['blockdesign:document:', 'blockdesign:template:', 'blockdesign:region:', 'blockdesign:block:'].some((prefix) => storageKey.startsWith(prefix))) continue;
    const value = storage.getItem(storageKey);
    if (!value) continue;
    try { if (containsLocalBlockRef(JSON.parse(value), ref)) return true; } catch { /* damaged entry cannot establish a reference */ }
  }
  return false;
}

function containsLocalBlockRef(value: unknown, ref: VersionRef): boolean {
  if (Array.isArray(value)) return value.some((item) => containsLocalBlockRef(item, ref));
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const definitionRef = record['definitionRef'];
  if (definitionRef && typeof definitionRef === 'object' && !Array.isArray(definitionRef)) {
    const target = definitionRef as Record<string, unknown>;
    if (target['id'] === ref.id && target['version'] === ref.version) return true;
  }
  const mandatory = record['mandatoryBlockIds'];
  if (Array.isArray(mandatory) && mandatory.includes(ref.id)) return true;
  const attributes = record['attributes'];
  if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) {
    const target = attributes as Record<string, unknown>;
    if (target['data-bd-block-id'] === ref.id && (target['data-bd-block-version'] == null || target['data-bd-block-version'] === ref.version)) return true;
  }
  return Object.values(record).some((item) => containsLocalBlockRef(item, ref));
}
export { HttpFormProviderAdapter, HttpFormActionAdapter, validateFormActionResult } from './forms.ts';
export type { FormHttpOptions } from './forms.ts';
