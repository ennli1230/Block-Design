# Çoklu dil ve proje entegrasyonu planı

Durum: planlanan ortak çoklu dil akışı uygulandı. Belge locale migrasyonu, kaynak bağlamı, HTTP ve demo provider'ları, REST/translations/locale-ID adapter'ları, editörde sayfa varyantı geçişi, dil menüsü, editör panelleri için Türkçe/İngilizce sözlük ve yayın metadata'sı hazır. Host özel `translate` callback'i ile sözlük girdilerini değiştirebilir. RTL yönü mantıksal yerleşim özellikleriyle sağlandı ve editörde görsel olarak doğrulandı. CMS modeli, gerçek URL'ler ve yayın kararları host adapter'ında kalır.

## Hedef

Aynı blok ve şablon tasarımını farklı dillerde kullanmak; içerikleri ev sahibi projenin CMS/API dil modelinden almak; dil seçicinin mevcut sayfanın gerçek çevirisine gitmesini sağlamak. Yeni bir proje editor çekirdeğini değiştirmeden konfigurasyon ve adapter ekleyerek bağlanabilmeli.

Tasarım sistemi içerik dilinden bağımsızdır. Studio/Scala Nova kataloglarını ortak kullanmak çeviri ilişkisi kurmaz. Aynı tasarım sistemi birden fazla dili destekleyebilir.

## Uygulanan kapsam

- `EditorDocument` v3 `localization.locale` ve opsiyonel `pageGroupId` taşır. V1/v2 belgeler bellekte `legacy language → host default → tr` sırasıyla yükseltilir; kendiliğinden kaydedilmez.
- `SourceBinding.locale` sabit dili veya sayfa dilini izlemeyi seçer. `RequestContext.contentLocale` schema, search, records, group, query, block/shared-region preview ve export boyunca taşınır.
- Locale kodları BCP 47 olarak normalize edilir. HTTP, demo ve Scala Nova sağlayıcıları destekledikleri dilleri bildirir; fallback ve desteklenmeyen dil sonuçları açık metadata/issue üretir.
- Editör dili ile sayfa içeriği dili ayrıdır. Varyant adapter'ı host'un gerçek sayfalarını listeler; dil değişimi yalnızca yeni belge yüklendikten sonra tamamlanır. Kirli taslakta kaydet, kaydetmeden geç veya kal seçenekleri vardır.
- REST locale parametresi, tam `translations` nesnesi ve her dil için farklı CMS kimlikleri için yeniden kullanılabilir provider adapter'ları vardır. Host kendi kimlik/URL/yayın ilişkilerini korur.
- Statik çıktı `lang`/`dir` ve makine tarafından okunabilir locale issue'ları taşır. Dil menüsü yalnızca yayımlanmış, gerçek URL'si olan varyantları kullanır.
- İngilizce UI sözlüğü tüm statik editör etiketlerini kapsar; dinamik mesajlar adlandırılmış workflow anahtarları kullanır. RTL panel yerleşimi yön duyarlıdır.

## Temel kararlar

1. **Arayüz dili ve içerik dili ayrı.** `uiLocale` menüleri belirler; belgenin `localization.locale` değeri kaynak ve yayın içeriğini belirler. UI dili içerik dilini değiştirmez.
2. **Dil kodları standart ve string.** `tr`, `en`, `en-GB`, `pt-BR`, `zh-Hant` gibi BCP 47 etiketleri kabul edilir; sabit iki harf regex'i kaldırılır. Normalizasyon ve desteklenen dil denetimi tek yardımcıda yapılır. Yön için host açık `ltr`/`rtl` verir.
3. **Blok tanımı ve şema ortak.** `title_tr`, `title_en` veya dil başına kopya blok şeması üretilmez. Adapter her dil için aynı `title`, `body`, `image`, `url` alanlarını döndürür.
4. **Sayfa varyantlarının kaydı host'a ait.** Her dil varyantı kendi belgesi ve manuel içeriğini taşır; aynı `pageGroupId` ile ilişkilendirilir. Şablon/blok definitionRef'leri ortak kullanılabilir, yerleşim varyantları gerektiğinde ayrışabilir. Core tüm dilleri tek `manualData` nesnesine gömmez.
5. **Dil değiştirmek çeviri üretmez.** Başka dilde belge yoksa host açık “Bu dilde sayfa oluştur” akışı sunar. Başlangıç yerleşimi kopyalanabilir; içerik taslak durumunda kalır, otomatik yayınlanmaz.
6. **Kaynak kimliği diller arasında kararlı.** `recordRefs` mantıksal içerik kimlikleridir. Dile özgü CMS kayıt kimliklerine dönüşümü adapter yapar. Repeater sırası ve öğe kimlikleri çeviri yüzünden değişmez.

## Uygulanan public sözleşme

```ts
type LocaleCode = string;

interface LocaleDefinition {
  code: LocaleCode;
  label: string;
  nativeLabel?: string;
  direction: 'ltr' | 'rtl';
}

// MountEditorOptions'a eklenmiştir; tek dilli projelerde isteğe bağlıdır.
interface LocalizationOptions {
  uiLocale?: LocaleCode;
  defaultLocale: LocaleCode;
  locales: LocaleDefinition[];
  fallback: { mode: 'none' } | { mode: 'locale'; locale: LocaleCode };
  translate?: (key: string, locale: string, values?: Record<string, string | number>) => string | undefined;
}

// EditorDocument üzerindeki kalıcı metadata.
interface DocumentLocalization {
  locale: LocaleCode;
  pageGroupId?: string;
}

// RequestContext üzerindeki kaynak çözümleme bağlamı.
interface ContentLocaleContext {
  locale: LocaleCode;
  fallback: { mode: 'none' } | { mode: 'locale'; locale: LocaleCode };
}

// SourceBinding.locale isteğe bağlı; varsayılan inherit.
type BindingLocale =
  | { mode: 'inherit' }
  | { mode: 'fixed'; locale: LocaleCode };

interface PageLocaleVariant {
  locale: LocaleCode;
  documentId?: string;
  url?: string;                 // Host'un gerçek public URL'si.
  status: 'draft' | 'published' | 'missing';
  xDefault?: boolean;           // Host açıkça x-default URL'sini seçer.
}

// İsteğe bağlı: sayfa ilişkileri ve public dil bağlantıları için.
interface LocalizationAdapter {
  getPageVariants(
    pageGroupId: string,
    context?: RequestContext,
  ): Promise<PageLocaleVariant[]>;
}
```

`RequestContext.contentLocale?: ContentLocaleContext` locale ve fallback policy'yi istekler boyunca taşır. İçerik provider'larında `localization` capability ve desteklenen diller ilan edilir. Yerelleştirilmiş `ContentRecord` sonucuna `{ requestedLocale, resolvedLocale, usedFallback }` metadata'sı eklenir; eksik kayıt için mevcut error/null sonucu korunur. Metadata kaynak başına farklı dil kullanıldığını editörde görünür kılar.

Öncelik: binding.fixed → document.localization.locale → host.defaultLocale → eski language → tr. Fallback zinciri ayrı değerlendirilir; UI dili bu zincire girmez. Desteklenmeyen veya geçersiz dil sessizce başka dile dönüştürülmez.

Provider `search`, `resolveRecords`, `resolveGroup`, `query`, gerektiğinde `getSchema` çağrılarında aynı locale bağlamını alır. Kodlar ve alan kimlikleri değişmez; şema etiketleri isteğe bağlı yerelleşebilir. Nötr sağlayıcılar bağlamı yok sayabilir. Yerelleştirilmiş sağlayıcı desteklenmeyen dili somut bir issue ile bildirir; eski sağlayıcıya yanlışlıkla çeviri destekliymiş gibi davranılmaz.

## Yeni proje için minimum entegrasyon

```ts
// Çalışan API'nin host tarafındaki kullanım deseni.
const handle = mountEditor('#editor', {
  initialDocument: {
    ...page,
    localization: { locale: 'tr', pageGroupId: 'travel.cappadocia' },
  },
  localization: {
    uiLocale: 'tr',
    defaultLocale: 'tr',
    locales: [
      { code: 'tr', label: 'Türkçe', direction: 'ltr' },
      { code: 'en', label: 'English', direction: 'ltr' },
    ],
    fallback: { mode: 'none' },
  },
  contentProviders: [cmsProvider],
  localizationAdapter: pageTranslations,
  // Host, ilgili kaydedilmiş belgeyi yükleyip editöre döndürür.
  onLocaleChangeRequested: async (_locale, variant) =>
    variant?.documentId ? cms.pages.loadForEditor(variant.documentId) : null,
});
```

Salt içerik entegrasyonunda `localizationAdapter` ve sayfa geçiş callback'i gerekmez: host zaten doğru dilde belgeyi yükler. Public dil seçici veya editörde sayfa varyantı geçişi isteniyorsa eklenir. Adapter'ın proje/tenant kapsamını host'un oluşturduğu adapter örneği taşır; tüm projeleri global bir registry'ye koyma zorunluluğu yoktur.

Dil geçişi mevcut belgeyi yeniden etiketlemez. Selector aktif dili ancak yeni belge başarıyla yüklenince değiştirir. Açık taslak/dirty belge varsa “Kaydet ve geç / Kaydetmeden geç / Kal” seçenekleri sunulur; kaydetmek zorunlu değildir. Kaydetmeden geç yalnızca açık varyantın düzenlemelerini bırakır. Host callback hatası mevcut belgeyi ve dili korur. Entegre uygulama bu akışı kendi UI'siyle üstlenebilir.

## Farklı backend modelleri

| Dış sistemin modeli | Adapter'ın görevi |
|---|---|
| `/posts/id?locale=en` | Bağlamdaki kodu projenin parametresine çevirip kaydı almak |
| `translations: { tr: ..., en: ... }` | İstenen varyantı seçip ortak alanlara normalize etmek |
| Her dilde ayrı kayıt/koleksiyon | Ortak içerik kimliğini dildeki kayıt/koleksiyon kimliğine eşlemek |
| Dil kodları `tr_TR` / `eng` / sayısal ID | Host'un localeMap konfigürasyonuyla standart kodu dönüştürmek |
| Tek dilli veya dilden bağımsız kayıtlar | Nötr capability bildirmek; dil filtresi uygulamamak |

Core URL oluşturmaz veya belirli CMS şeması bilmez. HTTP adapter'ın mevcut fetcher/headers enjeksiyonu korunur. Referans API locale değerini kabul eder; üçüncü taraf API'nin endpoint ve parametreleri adapter'da kalır. Hazır wrapper'lar ve locale parametreli REST, translations nesnesi, dil başına ID eşlemesi için örnekler sağlanır.

Eski dil bazlı recordRefs için otomatik ilişki tahmini yapılmaz. Host kimlik eşlemesi sağlar veya kullanıcı bir kez ortak kaydı yeniden seçer. Grup ve menü kimlikleri için de aynı kural uygulanır.

## Editör ve yayın davranışı

- Araç çubuğunda içerik dili seçici; blok ve repeater varsayılan olarak sayfa dilini izler. “Sabit dil kullan” yalnızca gelişmiş kaynak ayarındadır.
- Kaynakta kayıt seçimi aktif dilde etiket gösterir, ortak kimliği saklar. Görsel/alt metin, bağlantı ve menü kayıtları aynı locale bağlamında çözülür. İç içe repeater'lar da bağlamı miras alır.
- Header/footer yerleşimi ortak olabilir; kaynak verisi sayfa dilinde çözülür. Manuel ortak bölge içeriği için host dildeki region sürümünü veya o varyantın sharedRegionData değerlerini verir; çeviri uydurulmaz.
- Manuel içerik aktif sayfa varyantına aittir. Blok tasarım ekranının örnek dili host tarafından verilir; başka dil önizlemesi kataloğun defaultData değerlerini değiştirmez.
- Fallback varsayılanı `none`. Eksik çeviri açık issue üretir; yayımlama başarısı taklit edilmez. Host açıkça fallback locale seçerse adapter doğru dilde tam kaydı döndürür; alan bazında sessiz TR/EN karışımı yapılmaz. Fallback uyarısı tüm belgeyi manuel önizlemeye döndürmez.
- Repeater'da eksik çevirili öğeyi sessiz silmek varsayılan değildir. Seçim sırası korunur, eksik öğe raporlanır; eksikler çözülmeden strict export başarılı sayılmaz. Query yalnızca istenen dilde uygun kayıtları döndürür.
- Locale/cache anahtarında provider, collection, ortak kayıt/grup/sorgu, locale ve fallback policy bulunur. Dil geçişinde önceki async cevaplar iptal edilir veya yok sayılır; diğer dilin tuvali üzerine yazılmaz.
- `loadDocument` geçişinde blockId aynı kalsa da belge kimliği/locale değişimi kaynak önizleme epoch'unu yeniler. Yalnızca blok verisi değişikliğini izlemek yeterli değildir. Export bir belge ve dil snapshot'ı üzerinden çalışır; devam ederken dil değişse bile çıktısı karışmaz.
- Canlı tuval, tam önizleme, renderPageDocument ve exportStatic aynı çözücüyü kullanır. `PreviewExport` dil, yön ve çeviri issue metadata'sını döndürür; indirilen HTML `lang`/`dir` değerlerini buradan alır.
- Public dil seçici yalnızca yayımlanmış, gerçek URL'si olan varyantları bağlar. Çeviri yoksa dil gizlenir veya bağlantısız gösterilir; ana sayfa URL'si tahmin edilmez. Editör taslak varyantlarını ayrıca gösterebilir.
- Canonical/hreflang girdilerini host'un varyant adapter'ı gerçek URL'lerle sağlar. Yalnızca yayımlanmış mutlak HTTP(S) URL'leri export'a girer. Aktif varyant canonical olur; `editorState.seo.canonical` bunu geçersiz kılabilir. `x-default` için host tek yayımlanmış varyantta `xDefault: true` verir.
- Statik yayında dil değişimi host'un diğer yayın URL'sine navigasyondur. Client tarafında canlı locale çözümlemesi ayrı host runtime entegrasyonudur; statik HTML'ye editor/backend bağımlılığı eklenmez.

Çözümleme issue'ları warning/error olarak ayrılır: açık ve başarılı fallback warning, eksik çeviri veya provider hatası error'dır. Önizleme sorunları gösterebilir; strict export hata bulunduğunda başarılı çıktı durumu vermemelidir. Mevcut issue listesiyle partial export davranışı geriye uyumlu seçenek olarak kalır; yayın onayını host verir. Bu politika `PreviewExport` sonucunda makine tarafından okunabilir olmalı, yalnızca toast metnine dayanmamalıdır.

## Geriye uyumluluk ve veri geçişi

Yeni belgeler için documentVersion 3; v1/v2 yükleme ve migrasyon desteği korunur. Açık locale metadata'sı olmayan eski belgede host content defaultLocale veya legacy language kullanılır; `tr` son fallback olur. Eski belge açılınca otomatik kaydedilmez. Çeviri grubu bilinmiyorsa pageGroupId türetilmez; sayfa tek dilli çalışır.

`language` geriye uyum için tutulur ve deprecated işaretlidir; yeni boş belgelerde varsayılan içerik dili olarak, export'ta da fallback olarak kullanılır. `localization.defaultLocale` ve document locale daha açık kaynaklardır. UI sözlükleri ayrıca uygulanır; içerik dilini değiştirmek UI çeviri kapsamını tamamlamış sayılmaz.

Mevcut adapter metod imzaları optional context ile genişler; tek dilli provider implementasyonları çalışmaya devam eder. OpenAPI, Go referans provider ve save/load round-trip yeni alanları korur. Kalıcı belge ve kaynak bağlamı dil seçimlerini taşır; çözülmüş kaynak çıktıları belgeye yazılmaz.

## Uygulama aşamaları

| Aşama | Durum | Teslim |
|---|---|---|
| 1. Sözleşme ve migrasyon | Tamamlandı | Contracts, locale yardımcıları, v3 migrasyon, eski dil önceliği |
| 2. Kaynak çözümleme | Tamamlandı | Core bağlam aktarımı, HTTP/demo provider'ları, fallback issue'ları ve yarış koruması |
| 3. Host entegrasyonu | Tamamlandı | LocalizationAdapter, REST/translations/farklı kimlik wrapper'ları, Vue/vanilla/Laravel örnekleri |
| 4. Editör akışı | Tamamlandı | Dil seçici, host varyant geçişi, missing/dirty/error durumları |
| 5. Yayın ve dil menüsü | Tamamlandı | Export metadata, gerçek URL'ler, lang/dir, canonical/hreflang ve isteğe bağlı x-default |
| 6. UI sözlükleri ve örnek proje | Tamamlandı | Statik kontroller TR/EN çevrilebilir; locale yönü panellere uygulanır; host sözlüğü override edebilir |

Çalışan örnek kapsam TR/EN ve locale parametreli REST'tir. RTL `lang`/`dir` metadata'sı ve editörün yön duyarlı panelleri desteklenir. Bu genel depoda gerçek bir CMS hesabına bağlanılmaz; Laravel ve vanilla örnekleri host adapter'ının gerçek varyant URL'lerini sağlaması gereken yeri gösterir. Otomatik çeviri hizmeti, çeviri editörü ve yayınlama sistemi host'un mevcut araçlarına bırakılır.

## Kabul senaryoları

1. Aynı blok tanımı TR ve EN sayfada farklı başlık/URL getirir; definitionRef ve schema değişmez.
2. UI Türkçe iken içerik İngilizce olabilir. `en-GB`/`zh-Hant` round-trip ve export'ta korunur.
3. Tek kayıt, üç öğeli repeater, grup, query, alt liste ve header/footer doğru dili kullanır.
4. Farklı fiziksel ID'li çeviriler ortak kimlik ile seçilir; öğe sırası ve stabil ID korunur.
5. Eksik çeviri default durumda açık issue verir. Açık fallback doğru resolvedLocale bilgisini döndürür; bağlantı hatası fallback gibi sunulmaz.
6. Hızlı TR→EN→TR geçişinde eski yanıt tuvali değiştiremez; export aktif belgenin dilini kullanır.
7. Manuel değişiklikler yalnızca aktif varyantta kaydedilir; locale değiştirmek katalog defaultData'sını bozmaz.
8. Dil seçici aynı sayfanın yayımlanmış varyantına gider; missing/draft URL'ler public bağlantı olmaz.
9. Sayfa geçişi kaydet, kaydetmeden geç ve kal seçeneklerini; provider/variant yükleme hatasını kapsar.
10. V1/V2 belgeler, locale metadata'sız kaynaklar ve mevcut custom provider'lar eski davranışlarıyla çalışır.
11. Ayrı projelere ait adapter/cache örnekleri kayıtları birbirine karıştırmaz. Normal HTML ve Vue host örnekleri aynı sözleşmeyi kullanır.

## Host'a kalan bağlantı

Bu depoda ortak çoklu dil sözleşmesi, editör, kaynak çözümleme, yayın çıktısı ve vanilla/Laravel adapter kalıpları hazırdır. Her entegrasyon projesi `getPageVariants` içinde CMS'in çeviri ilişkilerini, yayımlanma durumunu ve gerçek mutlak URL'lerini döndürür. Ürün bu veriden canonical/hreflang üretir; host kimlik doğrulama, route yetkileri ve yayın kararlarını yönetir.
