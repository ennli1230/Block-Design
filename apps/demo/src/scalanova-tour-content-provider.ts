import type { ContentProviderAdapter, ContentRecord, ProviderCollection, RequestContext, SourceBinding } from '@blockdesign/contracts';

const collection: ProviderCollection = {
  collectionId: 'scalanova-blog-posts',
  label: 'Scala Nova · Blog yazıları',
  schemaVersion: '1',
  fields: [
    { fieldId: 'title', label: 'Başlık', valueType: 'text', required: true, nullable: false },
    { fieldId: 'body', label: 'Özet', valueType: 'textarea', required: true, nullable: false },
    { fieldId: 'cover', label: 'Kapak görseli', valueType: 'image', required: false, nullable: true },
    { fieldId: 'category', label: 'Kategori', valueType: 'text', required: false, nullable: true },
    { fieldId: 'readingTime', label: 'Okuma süresi', valueType: 'text', required: false, nullable: true },
    { fieldId: 'url', label: 'Yazı bağlantısı', valueType: 'url', required: true, nullable: false },
    { fieldId: 'publishedAt', label: 'Yayın tarihi', valueType: 'text', required: false, nullable: true },
  ],
  capabilities: {
    search: true,
    recordSelection: true,
    recordGroups: false,
    query: {
      filterFields: [{ fieldId: 'category', operators: ['eq', 'contains'] }],
      sortFields: ['publishedAt', 'title'],
      maxLimit: 50,
    },
  },
  localization: { mode: 'translated', supportedLocales: ['tr'] },
};

const records: ContentRecord[] = [
  {
    recordId: 'scalanova-kusadasi-one-day',
    collectionId: collection.collectionId,
    values: {
      title: 'Kuşadası’nda bir gün: rotanızı nasıl kurmalısınız?',
      body: 'Liman, çarşı ve sahil arasında bir gün planlarken başlangıç noktanızı, yürüyüş temponuzu ve dönüş saatinizi birlikte düşünün.',
      cover: '/scalanova-tour/assets/images/kusadasi-coast.jpg',
      category: 'Rota fikirleri',
      readingTime: '2 dk okuma',
      url: '/scalanova-tour/tr/rehber/kusadasinda-bir-gun/index.html',
      publishedAt: '2026-09-30',
    },
  },
  {
    recordId: 'scalanova-ephesus-preparation',
    collectionId: collection.collectionId,
    values: {
      title: 'Efes gezisine hazırlık: yola çıkmadan önce',
      body: 'Yürüyüş temposu, rehberlik, isteğe bağlı duraklar ve yanınıza alacaklarınız için Efes ziyaretinizi kolaylaştıracak bir hazırlık rehberi.',
      cover: '/scalanova-tour/assets/images/ephesus-celsus.jpg',
      category: 'Kültür & tarih',
      readingTime: '2 dk okuma',
      url: '/scalanova-tour/tr/rehber/efes-gezisine-hazirlik/index.html',
      publishedAt: '2026-09-30',
    },
  },
  {
    recordId: 'scalanova-kusadasi-cruise-planning',
    collectionId: collection.collectionId,
    values: {
      title: 'Kruvaziyerle Kuşadası: karadaki zamanı planlamak',
      body: 'Gemi varışı, limanda buluşma, özel rota ve dönüş payını tek bir plan içinde ele alan kruvaziyer gezisi notları.',
      cover: '/scalanova-tour/assets/images/priene.jpg',
      category: 'Kruvaziyer',
      readingTime: '2 dk okuma',
      url: '/scalanova-tour/tr/rehber/kusadasi-kruvaziyer-turu-planlama/index.html',
      publishedAt: '2026-09-30',
    },
  },
];

export class ScalanovaTourContentProvider implements ContentProviderAdapter {
  readonly providerId = 'scalanova-tour.local-content';
  readonly capabilities = {
    supported: ['collections', 'schema', 'search', 'resolveRecords', 'query', 'queryPage', 'localization'],
    constraints: { readOnly: true, maxLimit: 50 },
  };

  async listCollections(): Promise<ProviderCollection[]> {
    return [structuredClone(collection)];
  }

  async getSchema(collectionId: string): Promise<ProviderCollection> {
    this.assertCollection(collectionId);
    return structuredClone(collection);
  }

  async search(collectionId: string, query: string, cursor?: string, context?: RequestContext) {
    this.assertCollection(collectionId);
    const normalized = query.trim().toLocaleLowerCase('tr-TR');
    const offset = Number(cursor ?? 0);
    const matches = records.filter((record) => !normalized || JSON.stringify(record.values).toLocaleLowerCase('tr-TR').includes(normalized));
    const items = matches.slice(offset, offset + 20);
    return { items: items.map(record => this.localize(record, context?.contentLocale)), nextCursor: offset + 20 < matches.length ? String(offset + 20) : null };
  }

  async resolveRecords(collectionId: string, recordRefs: string[], context?: RequestContext) {
    this.assertCollection(collectionId);
    return recordRefs.map((recordId) => {
      const record = records.find((item) => item.recordId === recordId) ?? null;
      return {
        recordId,
        record: record ? this.localize(record, context?.contentLocale) : null,
        ...(!record ? { error: { code: 'NOT_FOUND', message: 'Blog yazısı bulunamadı.', recoverable: true } } : {}),
      };
    });
  }

  async query(collectionId: string, query: NonNullable<SourceBinding['query']>, context?: RequestContext) {
    this.assertCollection(collectionId);
    const allowedFilters = new Map(collection.capabilities.query?.filterFields.map((item) => [item.fieldId, new Set(item.operators)]) ?? []);
    let items = records.map(record => this.localize(record, context?.contentLocale));
    for (const filter of query.filters) {
      if (!allowedFilters.get(filter.fieldId)?.has(filter.operator)) throw new Error(`“${filter.fieldId}” filtresi desteklenmiyor.`);
      items = items.filter((record) => {
        const actual = String(record.values[filter.fieldId] ?? '').toLocaleLowerCase('tr-TR');
        const expected = String(filter.value ?? '').toLocaleLowerCase('tr-TR');
        return filter.operator === 'eq' ? actual === expected : actual.includes(expected);
      });
    }
    if (query.sort) {
      if (!collection.capabilities.query?.sortFields.includes(query.sort.fieldId)) throw new Error(`“${query.sort.fieldId}” sıralaması desteklenmiyor.`);
      const direction = query.sort.direction === 'asc' ? 1 : -1;
      items.sort((left, right) => String(left.values[query.sort!.fieldId] ?? '').localeCompare(String(right.values[query.sort!.fieldId] ?? ''), 'tr-TR') * direction);
    }
    const limit = Math.max(1, Math.min(query.limit ?? 50, collection.capabilities.query?.maxLimit ?? 50));
    return { items: structuredClone(items.slice(0, limit)), nextCursor: null };
  }

  private assertCollection(collectionId: string): void {
    if (collectionId !== collection.collectionId) throw new Error(`“${collectionId}” koleksiyonu bulunamadı.`);
  }
  async queryPage(collectionId:string, query:NonNullable<SourceBinding['query']>, cursor?:string, context?:RequestContext){
    const offset=Number(cursor??0);if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Sayfa anahtarı geçersiz.');
    const all=await this.query(collectionId,{...query,limit:50},context);const limit=query.limit??20;
    if(!Number.isInteger(limit)||limit<1||limit>50)throw new Error('Sayfa boyutu geçersiz.');
    return {items:all.items.slice(offset,offset+limit),nextCursor:offset+limit<all.items.length?String(offset+limit):null};
  }

  private localize(record: ContentRecord, locale?: RequestContext['contentLocale']): ContentRecord {
    if (!locale) return structuredClone(record);
    if (locale.locale.toLowerCase().startsWith('tr')) return { ...structuredClone(record), localeResolution: { requestedLocale: locale.locale, resolvedLocale: locale.locale, usedFallback: false } };
    if (locale.fallback.mode === 'locale' && locale.fallback.locale.toLowerCase().startsWith('tr')) return { ...structuredClone(record), localeResolution: { requestedLocale: locale.locale, resolvedLocale: locale.fallback.locale, usedFallback: true } };
    throw new Error(`Scala Nova içeriği ${locale.locale} dilinde mevcut değil.`);
  }
}
