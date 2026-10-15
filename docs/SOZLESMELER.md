# BlockDesign — ortak sözleşme taslağı

Tarih: 13 Ekim 2026. Durum: adapter, içerik sağlayıcı, şablon, paylaşılan bölge, tasarım sistemi varlıkları, medya ve çoklu dil sözleşmeleri `packages/contracts` içinde uygulanmıştır. Referans Go API'sinin uygulanan uçları [OpenAPI](openapi.yaml) belgesindedir.

Bu belge [planın](PLAN.md) teknik sınırlarını somutlaştırır. Uygulanan ortak TypeScript tipleri `packages/contracts` altındadır; Go API endpoint'lerinin HTTP biçimi OpenAPI'de ayrıca tanımlanır. Sözleşme sürümü `1`, güncel belge zarfı `3`'tür. Bunlar ürün yayın sürümünden ve GrapesJS sürümünden ayrıdır.

`BlockDefinitionVersion.css` isteğe bağlıdır ve import edilmiş blok köküne kapsamlanmış CSS taşır. Bu alan document `projectData` içindeki GrapesJS CSS'iyle birlikte saklanır; yeni sayfada katalogdan blok eklenirken bridge tanım CSS'ini canvas'a yükler. Tasarım sistemi ortak CSS ve stylesheet URL manifest'i `DesignSystemAdapter` ile sürümlü design system ref başına kaydedilir. Offline demo adapter browser-local storage'a düşebilir; HTTP adapter ve Go API manifest'i If-Match revision kontrolüyle saklar. Asset API görselleri arar, yükler ve çözümler. Statik export CORS ile okunabilen destekli görsel, font ve stylesheet URL'lerini kısıtlı boyutlarla inline paketler; erişilemeyen kaynakları ve CSS `@import` kullanımını raporlar.

## 1. Ortak değerler ve hata modeli

- Kimlik: opaque string; backend sayı kullanıyorsa adapter string'e dönüştürür. Çekirdek tablo adı veya Go struct alanına bağlı değildir.
- VersionRef: `id` ve immutable `version`. Blok, tasarım sistemi, template ve region referanslarında kullanılır.
- Revision: opaque string veya henüz kaydedilmemiş belge için null. Referans Go repository'si sayısal revision'ı dışarıya string olarak sunabilir.
- RequestContext: `AbortSignal`, isteğe bağlı correlation/request kimliği ve içerik kaynakları için `contentLocale` taşır. Auth bilgisi adapter'ın HTTP istemcisinde kalır.
- PageResult: `items`, isteğe bağlı `nextCursor`; toplam kayıt sayısı provider destekliyorsa verilir.
- Capability: açık destek bilgisi ve varsa kısıtlar. Bilinmeyen/eksik capability desteklenmiyor kabul edilir.
- Error: `code`, okunabilir `message`, isteğe bağlı `path`, `details`, `recoverable`, `requestId`. Ham SQL hatası veya kimlik bilgisi UI'ya taşınmaz.

Önerilen hata kodları: `VALIDATION_FAILED`, `UNSUPPORTED_CAPABILITY`, `NOT_FOUND`, `REVISION_CONFLICT`, `VERSION_IN_USE`, `INCOMPATIBLE_VERSION`, `SOURCE_UNAVAILABLE`, `SOURCE_RECORD_MISSING`, `SOURCE_FIELD_MISSING`, `IMPORT_UNSUPPORTED`, `ASSET_UNRESOLVED`, `ABORTED`, `EDITOR_DESTROYED`.

Alan path'i blok/alan/öğe kimliği içerir; sıralama değişince hata yanlış repeater satırına taşınmaz. Eksik capability ile işlemi çağırmak çekirdekte de reddedilir; yalnızca UI'da gizlemek yeterli değildir.

## 2. Gömme giriş noktası

Giriş: **`mountEditor(element, options)`**. Bir host element ve seçenekler alır, hemen EditorHandle döndürür. Async hazırlık `ready` Promise'iyle takip edilir. Hazırlık sırasında destroy ve hata temizliği mümkündür.

| Seçenek | Anlamı |
| --- | --- |
| `initialDocument` | Sürümlü başlangıç zarfı; yoksa açık tasarım sistemiyle boş belge oluşturma akışı |
| `storageAdapter` | Yükleme ve revision kontrollü kaydetme; yoksa kalıcı kayıt kontrolü sunulmaz |
| `blockLibraryAdapter` | Blok kataloğu; salt okunur katalog mümkün |
| `contentProviders` | Benzersiz providerId taşıyan sağlayıcılar; boş olabilir |
| `assetAdapter` | Opsiyonel medya arama/seçme/yükleme |
| `behaviorPlugins` | Güvenilir davranış eklentileri; selector, CSS/JS bağımlılığı ve canvas mount/update/destroy kancaları |
| `language` | Geriye uyumlu eski içerik/export dili seçeneği; yeni entegrasyonlarda `localization` kullanılır |
| `localization` | UI locale, varsayılan/desteklenen locale'ler, fallback policy ve opsiyonel UI translate callback'i |
| `localizationAdapter` | Host'un sayfa çeviri varyantlarını ve gerçek URL'lerini listeler |
| `onLocaleChangeRequested` | Seçilen sayfa varyantını host'tan yükler; başarılı belge dönüşü dil geçişini tamamlar |
| `onCreateLocaleVariant` | Host'a yeni dil taslağını oluşturması için kaynak belge verir |
| `mode` | `designer` veya `content`; içerik modunda blok içi yapı kilidi |
| `designSystemRef` | Boş belge için aktif sistem; mevcut belgede zarfla uyumu doğrulanır |
| `configuration` | Host'un izin verdiği düzenleme/stil policy'si; block policy'sini genişletemez |
| `onChange` | Tamamlanmış transaction sonrası belge/generation ve değişiklik özeti |
| `onSave` | Başarılı kaydetme sonrası id/revision ve kaydedilen generation |
| `onError` | Normalize hata ve işlem bağlamı |

Davranış eklentisi `id` ve desteklediği kök HTML yapısını belirleyen `selector` taşır. `mount(element)` canvas önizlemesinde bağlanır ve cleanup fonksiyonu döndürebilir; `update` yeniden önizlemeye girildiğinde mevcut instance'ı günceller; `destroy` cleanup sonrasında çağrılır. `css` tuval ve export CSS'ine, `exportJs` ise seçici export markup içinde bulunduğunda statik belgeye eklenir. Eklenti kodu entegratörün güvenilir uygulama kodudur; HTML import içindeki kullanıcı script'leri hâlâ temizlenir ve çalıştırılmaz. Slider bu registry'ye kayıtlı ilk hazır davranıştır.

```ts
const counterBehavior = {
  id: 'site.counter',
  selector: '[data-site-counter]',
  css: '[data-site-counter] { display: inline-flex; gap: 0.5rem; }',
  exportJs: `(()=>document.querySelectorAll('[data-site-counter]').forEach(root=>{const value=root.querySelector('[data-counter-value]');const button=root.querySelector('[data-counter-add]');let count=Number(value?.textContent)||0;button?.addEventListener('click',()=>{count++;if(value)value.textContent=String(count)})}))();`,
  mount(root: HTMLElement) {
    const value = root.querySelector<HTMLElement>('[data-counter-value]');
    const button = root.querySelector<HTMLButtonElement>('[data-counter-add]');
    if (!value || !button) return;
    let count = Number(value.textContent) || 0;
    const onClick = () => { count += 1; value.textContent = String(count); };
    button.addEventListener('click', onClick);
    return () => button.removeEventListener('click', onClick);
  },
};

const editor = mountEditor('#editor', {
  behaviorPlugins: [counterBehavior],
});
```

| Handle işlemi | Beklenen davranış |
| --- | --- |
| `ready` | Motor, UI ve başlangıç belge hazırlığının tamamlanması; başarısızlık Promise'i reddeder |
| `getDocument` | İç duruma mutable referans vermeyen tutarlı snapshot |
| `loadDocument` | Zarf veya storage id yükler; dirty veriyi sessizce değiştirmez, replacement policy gerektirir |
| `save` | Validate + snapshot + expectedRevision; yeni revision ile SaveResult döner |
| `setMode` | Policy sınırları içinde mod değiştirir; seçili blok ve taslak alan verisi korunur |
| `preview` | Ortak çözümleme/render pipeline'ı; edit seçimi devre dışı |
| `exportStatic` | Statik paket ve dependency/issue raporu |
| `exportDynamic` | Kaynak ayarlarını koruyan zarf; resolved sonuçları manualData'ya katmaz |
| `destroy` | Async/idempotent temizleme; tekrarı güvenlidir |

Ready öncesi async işlemler hazırlığı bekler. Destroy sonrası yeni işlemler `EDITOR_DESTROYED` ile reddedilir. Callback'ler transaction başına tutarlıdır; UI render başına change event gönderilmez. Hızlı alan girişleri bir kullanıcı işlemi olarak birleştirilebilir.

## 3. StorageAdapter

| İşlem | Girdi | Sonuç |
| --- | --- | --- |
| `load` | documentId, RequestContext | Belge zarfı + revision |
| `save` | documentId veya yeni belge, document, expectedRevision, RequestContext | SaveResult: id, yeni revision, savedAt |

Capability: `load`, `save`, `create`, `optimisticConcurrency`. Kalıcı ortak saklama adapter'ı optimistic concurrency sağlamalıdır; capability yoksa çok sekmeli güvenli kayıt iddiası yapılmaz. Bellek adapter'ı yalnızca demo oturumu içindeki revision kontrolünü sağlar.

Yeni kayıt expectedRevision null ile yalnızca create semantiğinde yapılır; var olan belgeye null göndererek overwrite yapılamaz. Kaydedilen envelope ile dönen revision aynı snapshot'a aittir. Conflict, yeni revision ve son belgeyi yüklemek için id/ref verir. Force overwrite varsayılan API'de yoktur.

StorageAdapter belge içeriğini başka bir CMS modeline dönüştürmek zorunda değildir; kendi backend'i zarfı saklayabilir. Saklama lokasyonu, token ve HTTP header'ları document JSON'una girmez.

## 4. BlockLibraryAdapter

| İşlem | Girdi | Sonuç |
| --- | --- | --- |
| `list` | designSystemRef, category/search, cursor, archive policy | Katalog özetleri |
| `getVersion` | definition VersionRef | Immutable BlockDefinitionVersion |
| `create` | Tasarım sistemi ve ilk geçerli tanım | Tanım id + ilk sürüm |
| `publishVersion` | Definition id, taslak ve beklenen katalog revision | Yeni immutable sürüm |
| `archive` / `restore` | Definition id, expectedRevision | Güncellenmiş archive durumu |
| `getUsage` | Definition id/version | Referans sayıları ve destekleniyorsa güvenli kullanım özeti |
| `deleteUnused` | Definition id/version, expectedRevision | Referans kontrolü sonrası silme veya VERSION_IN_USE |

Capability: `list`, `readVersion`, `create`, `publishVersion`, `archive`, `restore`, `usage`, `deleteUnused`, `search`, `pagination`. İlk aşamada UI sadece uygulanmış işlemleri gösterir; archive/version yönetim ekranları Aşama 4'tür.

Listeler belge tasarım sistemiyle sınırlıdır. Yeni ekleme arşivli tanımı getirmez; `getVersion` mevcut örneği açmak için arşivli sürümü okuyabilir. Usage bilgisi önizlemedir; asıl silme kontrolü repository transaction'ındadır.

## 5. ContentProviderAdapter

ProviderDescriptor: `providerId`, displayName, capability bilgisi. Her koleksiyon kendi schema ve capability kısıtlarını verebilir.

| İşlem | Girdi | Sonuç |
| --- | --- | --- |
| `listCollections` | RequestContext | Koleksiyon descriptor'ları |
| `getSchema` | collectionId, RequestContext | Locale'ye göre etiketler, alan kimlikleri/türleri, schemaVersion ve kısıtlar |
| `search` | collectionId, search text, cursor, RequestContext | Aktif dilde kayıt özetleri ve nextCursor |
| `listGroups` | collectionId, RequestContext | Dil bağlamında kayıt grupları |
| `resolveRecords` | collectionId, ordered record refs, RequestContext | Her ref için yerelleştirilmiş record veya açık missing/error sonucu |
| `resolveGroup` | collectionId, groupRef, RequestContext | Grup ve o dilde sıralı kayıtlar |
| `query` | collectionId, schema tabanlı QuerySpec, RequestContext | İstenen dilde filtrelenmiş/sıralanmış kayıtlar ve varsa cursor |

Capability: `search`, `recordSelection`, `recordGroups`, `query`, `pagination`; query için filtrelenebilir alan/operator'ler, sort alanları, default/max limit. Provider'ın desteklemediği filtre veya query UI'da görünmez ve çağrıda reddedilir.

FieldDescriptor: fieldId/key, label, valueType, required/nullable, cardinality ve varsa enum seçenekleri. Record: opaque recordId, collectionId, fieldId ile ilişkilendirilmiş değerler, isteğe bağlı display/preview/edit URL metadata. Backend property isimlerinin çevirisi adapter'da olabilir.

QuerySpec: typed filtre koşulları, desteklenen mantıksal birleştirme, sort, limit ve cursor. Koşul dili SQL/JS/string-expression taşımaz. Desteklenmeyen backend işlevine düşen filtre gizlenir; query evaluator sessizce tahmini sonuç üretmez.

Resolved sonuçlar providerId, collectionId, schemaVersion, resolvedAt ve issues taşır. Kayıt seçim sırası korunur. Silinmiş kayıt listeden sessizce düşürülmez; ilgili seçim hatası gösterilir. Record/group referanslarının değişken grup üyeliği semantiği UI'da açıkça belirtilir.

İlk sürüm salt okunur: create/update/delete içerik kaydı işlemi yoktur. Edit URL metadata host uygulamaya yönlendirme sağlar; URL policy'sinden geçer.

Her koleksiyon `localization: { mode: 'translated', supportedLocales: [...] }` ya da dilden bağımsızsa `{ mode: 'neutral' }` bildirir. Yerelleştirilmiş kayıt `localeResolution` içinde istenen ve çözülen dili, fallback kullanımını verir. HTTP sağlayıcı bağlamı varsayılan `locale`/`fallbackLocale` query parametrelerine ve POST gövdesine aktarır; özel CMS parametreleri adapter'da eşlenir.

## 6. AssetAdapter

| İşlem | Girdi | Sonuç |
| --- | --- | --- |
| `search` | Tür, arama, cursor | Asset summary listesi |
| `resolve` | Asset ref | URL, MIME, boyut, varsa width/height/alt |
| `upload` | File, izinli MIME/boyut bilgisi | Asset ref ve descriptor |

Capability: `search`, `resolve`, `upload`; accept MIME'leri, max file size, türler ve pagination. Seçim UI işlemi descriptor/ref'i alana uygular. AssetAdapter yoksa güvenli URL girişi ve alt metin yine mümkündür; upload düğmesi yoktur.

İstemci ve referans sunucusu MIME/boyut/URL kurallarını doğrular; kullanıcı dosya adı doğrudan filesystem path'i değildir. SVG ve aktif dosyalar güvenli policy olmadan inline çalıştırılmaz. Signed URL/token kalıcı asset kimliği yerine geçirilmez; çözümleme sırasında yenilenebilir.

## 7. Belge zarfı

| Alan | Kural |
| --- | --- |
| `documentVersion` | Sayısal schema sürümü; bilinmeyen ileri sürüm üzerine yazılmaz |
| `documentId` | İlk kayıt öncesi yok olabilir |
| `documentKind` | `page` veya `blockDraft`; taslak da aynı zarf kurallarını kullanır |
| `engine` | `grapesjs` |
| `engineVersion` | Kaydı üreten sabit motor sürümü |
| `revision` | Son başarılı kayıt revision'ı |
| `designSystemRef` | Tek immutable tasarım sistemi sürümü |
| `templateRef` | Opsiyonel template sürümü |
| `sharedRegionRefs` | Sürüme bağlı bölge yerleşimi ve schema izinli yerel override'lar |
| `localization` | `locale` ve host'un verdiği opsiyonel `pageGroupId`; belge v3 |
| `pageStructure` | Slot düzeni, blok örnek sırası, zorunlu/kilitli bölge ilişkileri |
| `blockInstances` | Her örneğin kimliği, tanım sürümü, verisi ve kaynak ayarları |
| `projectData` | GrapesJS yeniden açma snapshot'ı; mapped içerik canonical kaynaktan tekrar uygulanır |
| `editorState` | Kaydedilmesi uygun viewport/selection/panel durumu; token veya runtime nesnesi yok |

GrapesJS projectData sözleşmelerde JSON değeri olarak taşınır; motorun sınıfları core bağımlılığı değildir. Bilinen schema'nın extension alanları namespaced olur; bilinmeyen extension silinmez. Migration saf/deterministik dönüşüm yapar, orijinal kopyayı korur, kaynak sorgusu çalıştırmaz.

## 8. Tanımlar ve örnekler

**DesignSystemVersion:** id/version, ad, tokens, ortak CSS, fonts, asset manifest, defaults ve dependency sürümleri. Her katalog kaydı bir tasarım sistemine aittir. Yönetimi için opsiyonel DesignSystemAdapter ikinci aşamada eklenebilir.

**BlockDefinitionVersion:** id/version/designSystemRef; name/description/category/preview; engine component template; field schema; default manualData; block CSS/dependencies; edit/style policy; source capability; variants; behavior refs. Archive definition metadata'dır; immutable içerik sürümüne müdahale etmez.

**BlockInstance:** instanceId, definitionRef, seçilen variant, bağımsız manualData, sourceBindings ve izinli styleOverrides. Tanım varsayılanı deep clone ile yeni veriye dönüşür. İki örnekte array/nesne referansı paylaşılmaz. Kopyalama yeni instance/item/DOM kimlikleri üretir.

**SharedRegionVersion:** region id/version, schema, blok yapısı, dependencies ve override policy. Sayfanın yerel izinli override'ı region tanımını değiştirmez.

**PageTemplateVersion:** template id/version, designSystemRef, header/content/footer slot'ları, region refs, mandatory blocks, allowed block/category policy ve slot kilitleri. Yeni sayfa template sürümüne bağlanır; ileride template değişince otomatik güncellenmez. SharedRegionAdapter ve PageTemplateAdapter Aşama 4'te opsiyonel kataloglar olarak ayrılır.

İçerik modunda page slot'u policy izin veriyorsa blok ekleme/silme/sıralama mümkündür; kilit blok içi HTML yapısını korur. Zorunlu blok ve kilitli bölge kısıtları UI yanında çekirdek validator'da uygulanır.

## 9. Alan ve repeater şeması

FieldDefinition: kararlı fieldId, önerilen ama değiştirilebilir key/label, tür, default, required ve type'a özgü validation, mapping target. Alan türleri: text, textarea, richText, URL, image, video, number, boolean, select, color.

MappingTarget: kararlı nodeId, işlem türü (`text`, güvenli `richText`, izinli `attribute` veya izinli style/token), varsa attribute/property adı. UI “Bu başlığın metni”, “Görsel adresi (src)” veya “Bağlantı adresi (href)” gibi açık hedef sunar. Key ve nodeId ayrıdır; kullanıcı anahtarı değiştirince hedef kaybolmaz. Key aynı scope'ta benzersizdir.

Rich text izinli biçimlendirme DOM'una çevrilir; raw HTML/script taşımaz. URL türü protocol policy'sinden, select enum'dan, number min/max'tan, color CSS value parser'ından geçer. Boolean koşullu gösterim/izinli attribute davranışı açıkça tanımlanır. Image/video asset ref veya güvenli URL, ayrı alt/poster alanlarıyla kullanılabilir.

RepeaterDefinition: repeaterId, key/label, containerNodeId, templateItemNodeId, item field schema, minItems/maxItems, `nesting: none | children` ve açık `childRepeaters` şeması. En fazla 8 düzey ve 0–500 öğe sınırı desteklenir. Min/max tutarlılığı oluştururken de kaydederken de doğrulanır. Bir bloktaki bağımsız listeler farklı repeaterId taşır.

RepeaterItem: itemId ve fieldId ile bağlı değerler. Sıra array sırasıdır; itemId sıralamadan türetilmez. Kopyalanmış item yeni id alır. Provider'dan türeyen satır anahtarı provider/ref ve occurrence bilgisiyle kararlıdır; ephemeral resolved değer manualData'ya yazılmaz.

Undo/redo listelere ve DOM referanslarına aynı transaction'ı uygular. Mapping sihirbazının yarım verisi seçili component'in geçici state'ine hapsedilmez; draft store blok/alan kimliğiyle korunur.

## 10. Kaynak bağlama sözleşmesi

SourceBinding: bindingId, target (`block`, fieldId veya repeaterId), active mode, providerId/collectionId, schemaVersion, ordered record/group refs veya QuerySpec, fieldMappings ve açık fallback policy.

`ContentProviderAdapter.listGroups` ve `resolveGroup` opsiyoneldir; yalnızca provider `recordGroups` capability'sini bildirdiğinde ve iki metodu da uyguladığında grup seçimi görünür. Demo provider grubu önce, seçili tekil kayıtları ardından çözer; yinelenen kayıt kimliği bir kez render edilir. Blok genelindeki binding kaynak eşleme panelinden seçilebilir ve tanımlı field/repeater hedeflerine uygulanır; daha özel hedef binding'i blok binding'inin önüne geçer. Unsupported target veya provider capability ihlalinde resolver issue üretir.

FieldMapping: kaynak fieldId → hedef fieldId; yalnızca tanımlı ve type uyumlu dönüşümler. Serbest kod, selector veya hesaplama ifadesi taşımaz. Örnek: `title → question`, `body → answer`, `cover → image`. Görsel UI kaynak ve hedef şemasından seçenek üretir.

Manuel veri ayrı `manualData` içinde korunur; mode değiştirmek bu veriyi silmez. Kayıt/sorgu taslak ayarları da geri dönüş için korunabilir; yalnızca active mode çözülür. Daha özel hedef binding'i blok genel binding'ine üstün gelir. Aynı hedefte belirsiz çakışma doğrulama hatasıdır.

Fallback sessiz değildir: varsayılan olarak eksik zorunlu kaydı/alanı kullanıcıya bildir ve tam export'u engelle. Opsiyonel alan için açık default/empty politikası uygulanabilir. “Son cache'i göster” seçeneği varsa kaynak ve zaman UI'da işaretlenir; cache doğruluk kaynağı olmaz.

## 11. Render, export ve davranışlar

ResolveResult: pinned definitions, etkili içerik, geçici source provenance, issues ve dependency manifest. Preview ve static export aynı ResolveResult/renderer sözleşmesini kullanır. Preview iframe'iyle export farklı motor transform'u kullanıp içerik ayrışması üretmez.

Dependency: id/version/type, URL veya paketlenecek veri, integrity varsa hash, design/block/runtime scope ve gereklilik. Aynı id/version tek kez toplanır; çelişen sürüm veya çözülemeyen zorunlu bağımlılık rapora gider. Bağıl URL çözümlemesi kaynak base URL'siyle yapılır.

BehaviorPlugin: id/version; desteklenen yapı şeması; güvenilir CSS/JS dependencies; initialize, update ve cleanup. Her block instance için ayrı runtime handle. Export entry registry'den gelir; import edilen kullanıcının script'inden gelmez.

StaticExportResult: dosyalar, manifest ve issues; çözümleme anı. DynamicExportResult: sürümlü belge ve gerekli definition/dependency referansları. Dynamic tüketici sağlayıcıları yeniden çözümler. Credentials hiçbir çıktı türüne dahil değildir.

ImportReport: preserved structures/dependencies, removed risky content, unresolved assets, unsupported interactions, mapping candidates ve nesting sorunları. Adaylar kullanıcı onayı olmadan publish edilmez.

## 12. Go referans HTTP eşlemesi

Bu endpoint'ler önerilen referans implementasyon içindir. Özel adapter bunları taklit etmek zorunda değildir. Base URL istemciye enjekte edilir.

| Yol/işlem | Amaç | Aşama |
| --- | --- | --- |
| `GET /api/v1/capabilities` | Gerçek destekler ve contract sürümü | 1 |
| `POST /api/v1/documents` | Yeni zarf kaydı, revision/ETag yanıtı | 1 |
| `GET /api/v1/documents/{id}` | Zarf ve ETag | 1 |
| `PUT /api/v1/documents/{id}` | If-Match ile compare-and-swap kayıt | 1 |
| `GET /api/v1/design-systems` | Sistem listesi ve version refs | 1; yönetim 2 |
| `GET /api/v1/blocks` | Tasarım sistemiyle sınırlı katalog | 1 |
| `GET /api/v1/blocks/{id}/versions/{version}` | Immutable sürüm, arşivliyken de okunabilir | 1 |
| `POST /api/v1/blocks` | İlk blok tanımı ve sürümü | 1 |
| `POST /api/v1/blocks/{id}/versions` | Yeni immutable sürüm | 4 |
| `POST /api/v1/blocks/{id}/archive` | Arşiv durumu; katalog revision kontrolü | 4 |
| `GET /api/v1/blocks/{id}/usage` | Kullanım özeti | 4 |
| `DELETE /api/v1/blocks/{id}/versions/{version}` | Kullanılmayan sürüm silme | 4 |
| `/api/v1/providers/{id}/collections/...` | Schema/search/resolve/group/query; typed contract | 3 |
| `/api/v1/assets/...` | Capability varsa medya operations | 2+ |
| `/api/v1/shared-regions/...`, `/api/v1/templates/...` | Sürümlü bölgeler ve slot kuralları | 4 |

Missing If-Match güncellemede 428; eski revision 412; referanslı silme 409; geçersiz veri 422; bulunamayan kayıt 404. HTTP adapter durumları ortak hata kodlarına dönüştürür. Conflict kurtarma bilgisi hata zarfındadır; başarılı kayıt mesajı gönderilmez.

OpenAPI her uygulanmış endpoint'in payload schema, header, hata, capability ve örneğini belirtir. Henüz uygulanmamış endpoint belgede taslak olarak işaretlenir ve destek capability'si açılmaz.

## 13. Sözleşme değişim politikası

Public sözleşme sürümü, belge schema sürümü, blok/region/template sürümü ve engine sürümü birbirinden bağımsızdır. Kırıcı adapter değişimi major sözleşme sürümü gerektirir. Belge değişimi migration gerektirir. Yeni blok sürümü eski instance referansını kendiliğinden değiştirmez.

Uyumluluk fixture'ları aynı zarfı frontend validator, Go API validator ve load/save roundtrip'ten geçirir. Adapter contract kontrolleri Go HTTP adapter ile özel backend adapter'a aynı davranış beklentilerini uygular. Unsupported özelliği capability'de açmak contract ihlalidir.
# TR kaynak aktarımı ve alan eşleme

`textSegment` eşlemesi, `mappingTarget.property` içindeki sayısal çocuk indeksindeki metni değiştirir. İç içe bağlantı ve vurgular korunur; yeni DOM kapsayıcısı üretilmez. Native boolean HTML özniteliklerinde (`selected`, `checked`, `disabled` vb.) `false` değeri özniteliği kaldırır; `selected="false"` gibi yanlış bir çıktı oluşmaz.

Backend belge listesi `GET /api/v1/documents?systemId=…&systemVersion=…&cursor=…` ile tasarım sistemine göre filtrelenir. Yanıt `items` ve `nextCursor` içerir. Aktarım kayıtları kaynak yoluyla eşleştirilir; tekrar aktarım mevcut sayfa düzenlemelerine dokunmaz. Ayrıntılı API sözleşmesi `openapi.yaml` içindedir.

