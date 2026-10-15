# Laravel veya başka bir CMS'e bağlama

CMS’nin alanlarını ve zorunluluklarını yönettiği ziyaretçi formları için [form adapter örneği](forms/README.md) ve [entegrasyon rehberi](../../docs/CMS-FORM-ENTEGRASYONU.md) eklendi.

`editor.ts` host tarafındaki giriş örneğidir. Bu depo bir Laravel uygulaması içermez. Laravel uygulamasında editörün ES module/vanilla dağıtımını kullan; mevcut admin sayfasına `mountEditor` ile göm. CMS'in kendi sayfa listesi, toolbar'ı, tema ve kullanıcı yetkileri korunur.

## İki API yolu

1. Laravel, `docs/openapi.yaml` içindeki Go referans sözleşmesini uygularsa aynı `Http*Adapter` sınıfları kullanılır. API prefix, fetch ve header callback'leri enjekte edilir.
2. Laravel farklı route/response yapıları kullanırsa `StorageAdapter`, `BlockLibraryAdapter`, `ContentProviderAdapter`, `AssetAdapter`, `TemplateAdapter`, `SharedRegionAdapter` ve `DesignSystemAdapter` uygulanır. `examples/custom-backend/adapter.ts` farklı URL'lerin dönüştürüldüğü çalışan TypeScript örneğidir.

JSON'a CSRF/token/yetki bilgisi yazılmaz. Host API oturum, sahiplik ve yetkiyi her istekte doğrular. `permissions` yalnızca editörün arayüz ve handle davranışını sınırlar; sunucu kontrolü yerine geçmez. Üretimde `Demo*Adapter` kullanılmaz: onlar tarayıcı taslağına geri dönebilir. Bu örnek doğrudan HTTP adapter'ları kullanır.

## Saklama

Sayfa tablosunda `id`, `revision` ve `payload` JSON bulunur. `payload` bütün `EditorDocument` zarfıdır; `projectData` yanında alan verileri, kaynak bağları ve sürüm referansları da saklanır. Yeni kayıtta revizyon 1, güncellemede `If-Match` ile eski revizyon karşılaştırılarak atomik artış uygulanır. Eski revizyon için 409/412 dönülür. Blok/bölge/şablon tabloları `id + version` ile sürümlenir; bir sürüm sessizce değiştirilmez.

## Menü ve dil kaynakları

ContentProvider koleksiyonlarının fieldId değerleri CMS model adlarından bağımsızdır. Menü kaydı örneği:

```json
{"recordId":"about","collectionId":"menus","values":{"label":"Hakkımızda","url":"/hakkimizda","children":[{"id":"team","label":"Ekibimiz","url":"/ekibimiz"}]}}
```

`children` şemada `valueType: "array"` olarak ilan edilir. Menü kök alanları `label/url`, alt liste anahtarı `children` olarak eşlenir. Çocuk kayıtlar alt liste alan anahtarlarını kullanır veya üst listeyle aynı leaf eşlemesini paylaşır. Mevcut ScalaNova örneğinde header ve hamburger aynı menü kaydını kullanır; farklı HTML tasarımlarında bağımsız bağlar da tanımlanabilir. Dil koleksiyonu `label/url/icon/alt` alanlarını döndürebilir. Grup/arama/sorgu yalnızca adapter capability'si varsa gösterilir.

## Yayınlama / frontend çevirici

- Düzenleme: Laravel JSON'u yükler → editör açar → kullanıcı değiştirir → `save()` JSON'u API'ye gönderir.
- Yayın: host, veritabanından kaydedilmiş JSON ve sabit sürümlü tanımları alır → `renderPageDocument(document, adapters)` aynı kaynak çözümleme ve export yolunu çalıştırır → `{html,css,js,stylesheets,issues}` çıkar.
- `renderPageDocument` tarayıcı DOM'u gerektirir; Laravel'in headless Chromium yayın worker'ında veya frontend render sürecinde çalıştırılabilir. PHP içinde çalıştırılan bir fonksiyon değildir. Hazır PHP renderer/worker bu depoya eklenmemiştir.
- Host worker çıktıda `issues` varsa yayın kararını vermeli; eksik veri/varlık için sessiz başarı varsaymamalıdır. Tarayıcıdan gönderilen keyfi HTML/JS'yi güvenilir yayın çıktısı saymak yerine worker kayıtlı JSON'dan üretir.
- HTML bundle statiktir. Veri güncellendiğinde host yeniden render/publish/cache invalidation yapar. Canlı SSR/dinamik frontend için aynı şemayı okuyan sunucu renderer'ı ayrı bir host entegrasyonudur.
- Yayın HTML'i düzenleme kaydı olarak kullanılmaz; sonraki düzenleme yine JSON'dan açılır.

`apps/demo/cms.html` mevcut CMS kabuğunun altında çalışan editör ve ayrı yayın girişini gösterir. `http://127.0.0.1:4173/cms.html` adresinde Go referans API kullanılır. Kaydettikten sonra URL'ye belge kimliği eklenir; sayfayı yeniden açmak aynı JSON'u API'den yükler.
