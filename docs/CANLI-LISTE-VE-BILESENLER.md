# Canlı listeler ve etkileşimli bileşenler

15 Ekim 2026. Gerçek CMS bağlantısı kurulmadan ortak editör ve frontend sözleşmeleri uygulanmıştır.

## Deneme

- [Çalışan örnekler](http://127.0.0.1:4173/interactive-examples.html)
- [Tarayıcı kabul testleri](http://127.0.0.1:4173/interactive-acceptance.html)

Örnekler yerel, salt okunur sağlayıcı kullanır. Mevcut sayfalara veya CMS’ye kayıt yapmaz. Aynı veri sözleşmesi CMS adapter’ı tarafından veritabanından doldurulur. Örnek sayfa üretim derlemesine de dahildir.

## Sayfalama / ziyaretçi filtresi

Liste, HTML’de kapsayıcı ve örnek öğesi eşlenmiş bir repeater olmalıdır. Kaynak panelinde sorgu modunu seçip **Canlı listede sayfalama ve filtreler** seçeneğini aç. Ziyaretçiye sunulacak filtreleri sağlayıcının izin verdiği alanlardan seç. Kaynak sorgusundaki kayıt sınırı sayfa boyutudur.

```ts
const binding = {
  // Normal SourceBinding providerId/collectionId/schemaVersion/fieldMappings alanları…
  target: {scope: 'repeater', id: 'posts.items'},
  mode: 'query',
  query: {
    filters: [{fieldId: 'category', operator: 'eq', value: {$context: 'page.route.category'}}],
    sort: {fieldId: 'title', direction: 'asc'},
    limit: 12,
  },
  live: {
    filters: [{fieldId: 'title', label: 'Başlıkta ara', operator: 'contains'}],
    syncUrl: true,
  },
};
```

Sabit/bağlamsal filtreler ziyaretçi filtrelerine eklenir; ziyaretçi filtreleri bu koşulları silemez. Ziyaretçi için yalnız açıkça seçilen alanlar kullanılır. Sayı alanları sayıya çevrilir; bilinmeyen alan, izin verilmeyen operatör, desteklenmeyen sıralama veya fazla kayıt reddedilir. HTML metni text olarak yazılır; URL ve rich text içerikleri güvenli alt kümeyle işlenir. Canlı listede stil eşleme desteklenmez; stil tasarımda kalır. Liste alan eşlemeleri text, textSegment, safeRichText, izinli attribute ve booleanVisibility olabilir.

Provider, normal ilk sayfa sorgusuna ek olarak şu metodu ve `queryPage` capability’sini sunar:

```ts
async queryPage(collectionId, query, cursor, context) {
  return cmsDatabase.listForEditor({
    collectionId, filters: query.filters, sort: query.sort,
    limit: query.limit, cursor, locale: context?.contentLocale,
    page: context?.page, signal: context?.signal,
  }); // {items: ContentRecord[], nextCursor: string | null}
}
```

Cursor opaktır; editör offset hesaplamaz ve bütün kayıtları tarayıcıya indirmez. Sıralama, filtre, dil ve sunucu yetkisi her sayfada aynı uygulanır. Kararlı sıralamada CMS benzersiz kayıt kimliği gibi bir tie-breaker kullanmalıdır. Toplam sayı bilinmediği için uydurma “10 sayfa” göstergesi yoktur. Önceki cursor’lar tarayıcı history state’inde tutulur; yeni sekmede doğrudan derin cursor açılırsa önceki cursor bilinmediğinden **İlk sayfa** eylemi sunulur.

Filtre değişince ilk sayfaya dönülür. Liste başına ayrı URL namespace’i vardır: `bd.<bindingId>.<alan>` ve `bd.<bindingId>.cursor`. Tarayıcı geri/ileri hareketleri filtreyi ve cursor’ı geri yükler. Önizleme host URL’sini değiştirmez. Yükleniyor/boş/hata/yeniden dene durumları, eski yanıt koruması ve destroy sırasında AbortSignal/DOM cleanup vardır. Hata halinde mevcut içerik korunur ve hata görünür; sessiz demo verisine geçilmez.

## Route ve sayfa bağlamı

```ts
mountEditor(root, {
  requestContext: () => ({
    page: {documentId: page.id, siteId: site.id, recordId: page.recordId,
      route: {category: router.currentCategory}, preview: true},
  }),
  contentProviders: [cmsProvider],
});
```

Bağlam, kaynak çözümleme ve canlı liste isteklerine aktarılır. Kaynak panelindeki **Sayfa bağlamı alanı** ile `page.recordId`, `page.route.category` gibi bir alan seçilebilir. Yalnız açık `$context` referansı çözülür; JavaScript ifadesi veya serbest SQL çalıştırılmaz. Eksik bağlam hatadır. `siteId`/`recordId` yetki kanıtı değildir; CMS backend’i oturum/site koşulunu kendisi uygular.

SPA route değişiminde host yeni sayfa belgesini yükler veya ilgili frontend root’unu destroy/init eder. Aynı DOM’da route değiştiğinde kendiliğinden yeni CMS kaydı seçildiği varsayılmaz.

Editör önizleme behavior’ına `update(root)` çağrıldığında page/contentLocale bağlamı da karşılaştırılır; bağlam değişmişse önceki istek iptal edilerek liste yeniden yüklenir. Bağlam ve yapılandırma aynıysa ek istek yapılmaz.

## Önizleme ve statik yayın

```ts
mountEditor(root, {
  contentProviders: [cmsProvider],
  collections: {publication: {
    baseUrl: '/public-editor',
    context: {page: {route: {category: 'culture'}},
      contentLocale: {locale: 'tr', fallback: {mode: 'none'}}},
  }},
});
```

Bu adres yalnız host yapılandırmasında verilir; kullanıcı belgeye API adresi yazmaz. Editörün özel auth/header callback’leri export edilmez. Yayında provider seçimi, schemaVersion, query/cursor ve halka açık bağlam `POST <baseUrl>/content/collections/<collectionId>/query` ile kendi CMS backend’ine taşınır. Backend veritabanından okur ve izinli yayın kayıtlarını döndürür; tarayıcının yolladığı alanlara veya tenant kimliğine güvenmez. Birden fazla CMS varsa host `providerId` üzerinden yönlendirir.

Yayın runtime’ı her yüklemede önce `GET <baseUrl>/content/collections/<collectionId>?providerId=...` üzerinden halka açık koleksiyon şemasını alır. Şema `schemaVersion`, `fields[].valueType` ve `capabilities.query` alanlarını döndürmelidir. Önizleme ile yayın aynı `loadCollectionPage` doğrulamasını kullanır: sayısal filtreler sayıya çevrilir; şema sürümü, izinli filtre/operatör, sıralama ve sayfa sınırı kontrol edilir. Sabit dil seçimi hem `$context` çözümlemesine hem şema/sorgu isteklerine uygulanır. Dil `locale`/`fallbackLocale` URL parametrelerinde, sorguda ayrıca `contentLocale` gövdesinde taşınır. Bu endpoint de host CMS’nin veritabanına bağlanır.

Yayın bağlantısı yoksa `COLLECTION_PUBLICATION_UNCONFIGURED` üretilir. `assertPublishable(output)` bu hatayla yayınlamayı engeller. Statik çıktı ilk sayfayı içerir; etkileşim runtime’ı yalnız canlı liste bulunan sayfaya eklenir. `window.BlockDesignCollections.init(root)` / `destroy(root)` SPA için kullanılabilir. Headless DOM gerektiren mevcut renderer sınırı devam eder; PHP içinde JS renderer çalıştırıldığı iddia edilmez.

Tarayıcıya sunulan context’in halka açık olduğu unutulmamalı; oturum bilgisi, auth token veya gizli preview anahtarı buraya yazılmaz.

## Sekme, modal, galeri

Katalogda yeni **Sekmeler**, **Modal pencere**, **Görsel galerisi** bileşenleri bulunur. Temiz CMS kataloğuna kendiliğinden örnek içerik eklenmez; host isterse `tabsWidget`, `modalWidget`, `galleryWidget` tanımlarını kütüphanesine kaydeder veya bir extension’ın `blocks` alanında verir.

- Sekmeler: `data-bd-tablist`, `data-bd-tab`, `data-bd-tabpanel`; ARIA ilişkileri ve örnek başına benzersiz ID; ok/Home/End tuşları.
- Modal: native `<dialog data-bd-dialog>`, açma/kapatma düğmeleri `data-bd-modal-open` / `data-bd-modal-close`; native odak sınırı, Escape ve tetikleyiciye odak dönüşü.
- Galeri: `data-bd-gallery-item` görsel bağlantıları; alternatif metin, önceki/sonraki, ok tuşları ve native dialog. Büyük görsel adresi boşsa thumbnail adresi kullanılır. Yükleme medya adapter’ına aittir.

Bu davranışlar **Etkileşim** panelinden uygun HTML yapılarına da bağlanabilir. Örneğin modal rolü için gerçekten `dialog` öğesi gerekir; rastgele div’e rol eklemek yeterli değildir. Tuval düzenlemesinde modal açılmaz; önizleme ve bağımsız HTML’de çalışır. Yeniden mount/destroy nitelikleri ve listener’ları temizler. Üçü de aynı güvenilir behavior registry’si üzerinden seçiciye göre export edilir; ithal HTML script’leri çalıştırılmaz.

## Sonraki rapor eksikleri için eklenen altyapı

```ts
mountEditor(root, {
  appearance: 'embedded',
  storageAdapter,
  autosave: {debounceMs: 1500},
  recovery: {key: `editor:${siteId}:${userId}:${pageId}`},
  preview: {open: async (document, context) => cmsPreview.open(document, context)},
  extensions: [{id:'host.widgets',version:'1.0.0',apiVersion:1,
    blocks:[tabsWidget,modalWidget,galleryWidget]}],
});
```

- Gömülü kayıt host URL’sini/global son belge anahtarını değiştirmez; başlatmada bu anahtardan belge seçmez.
- Otomatik kayıt isteğe bağlıdır. Kurtarma anahtarı host/site/kullanıcı/sayfa kapsamında verilmelidir. Tarayıcı depolaması kullanılamazsa normal kayıt çalışmaya devam eder. Recovery visitor form değerlerini içermez; canonical belge taslağını saklar. Ayrı blok/bölge authoring taslakları için kalıcı kurtarma kapsamı iddia edilmez.
- `StorageAdapter.listRevisions/loadRevision` varsa sayfa geçmişi açılır. Restore yeni bir taslaktır; güncel revision ile kaydedilerek yeni sürüm oluşturur. Eski revision ile üzerine yazılmaz. Go referansında migration 006 kayıt snapshot’larını atomik trigger ile tutar; geçiş öncesindeki kaybolmuş tarihçe yeniden üretilemez. Eski blok referansları da silme kontrolüne dahildir.
- Yayın kapısı: `assessPublication` / `assertPublishable`; bilinmeyen issue varsayılan engelleyicidir. Kısmi indirme gerekiyorsa host açıkça `publicationPolicy:'permissive'` seçebilir. Gerçek yayın sunucuda tekrar doğrulanır.
- Sayfa/SEO paneli title, description, canonical, robots, Open Graph ve JSON-LD saklar. `createPageHead(output.metadata)` host renderer’ında kullanılabilir. URL/slug/sitemap yönetimi CMS’nindir.
- `richText` inspector’ında Kalın/İtalik/Bağlantı araçları ve güvenli biçimlendirme alt kümesi vardır. Keyfi HTML, medya embed veya script kabul edilmez.
- Medya aramasında eski yanıt/abort koruması, cursor geçiş noktası ve provider MIME sınırına uygun dosya seçimi vardır. Klasör/kırpma/CDN dönüşümü için CMS medya servisi veya extension alan editörü kullanılmalıdır; referans Go medya araması hâlâ en çok 50 sonuç döndürür.
- Extension manifest’i API sürümü/kimlik çakışmasını kontrol eder. `blocks`, `behaviors`, `fieldEditors` ve ek belge doğrulaması desteklenir. Alan editörleri kayıtlı scalar türlerin görünümünü değiştirir; bilinmeyen bir form alanı otomatik desteklenmiş sayılmaz. Özel davranışın bağımsız export JS’i ayrıca sağlanmalıdır.
- Form runtime mesajları host `forms.messages` / public `publication.messages` sözlüğüyle değiştirilebilir; yayındaki HTML İngilizceyse temel runtime kontrol metinlerinin İngilizce karşılığı vardır. CMS alan etiketleri ve sunucu doğrulama mesajlarının dili provider’a aittir.

Rol/yetki ve olası Spatie kullanımı: [CMS yetki sözleşmesi](CMS-YETKI-SOZLESMESI.md). Paket kurulmadı ve gerçek CMS’ye bağlanılmadı.

## Henüz tamamlanmış sayılmayanlar

Gelişmiş formlar (dosya, multiselect, koşul, adımlar), tam medya/DAM, yorum/onay/gerçek zamanlı ortak düzenleme, hazır PHP yayın worker’ı ve Firefox/Safari/gerçek cihaz doğrulaması bu uygulamanın tamamlanmış özellikleri değildir. Bunlar önceki rapordaki ihtiyaç bazlı sonraki aşamalardır. Bu değişiklikler gerçek CMS yetkilerini veya üretim yayın entegrasyonunu test edilmiş hale getirmez; kullanıcı isteğiyle bağlantı aşaması ertelendi.
