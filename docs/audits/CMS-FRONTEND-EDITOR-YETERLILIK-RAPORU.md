# CMS için frontend editörü yeterlilik raporu

15 Ekim 2026 · BlockDesign 0.1.0 · Mevcut yerel kod ve testler

**Uygulama sonrası not:** Aşağıdaki tablo inceleme anının kaydıdır. Canlı sayfalama/filtre/route bağlamı ve sekme/modal/galeri sonradan uygulandı. Şema sürüm kontrolü, gömülü kayıt izolasyonu, otomatik taslak/kurtarma, kalıcı geçmiş, yayın kapısı, SEO/rich text ve extension altyapısı da eklendi. Güncel kapsam ve kalanlar: [Canlı liste ve bileşenler](../CANLI-LISTE-VE-BILESENLER.md), [yetki sözleşmesi](../CMS-YETKI-SOZLESMESI.md). Gerçek CMS bağlantısı kullanıcı isteğiyle bu aşamada yapılmaz.

## Karar

**CMS’ye entegrasyon geliştirmeye ve kontrollü bir pilot kullanıma başlamak için yeterli bir editör çekirdeği var. Genel kullanıma açılacak, birden fazla editörün içerik yönettiği üretim sistemi için henüz yeterli değil.**

Güçlü alanlar HTML’den blok üretme, alan/liste eşleme, CMS kaynaklarını adapter ile bağlama, şablonlar, sabit sürümlü ortak bölgeler ve bağımsız HTML çıktısıdır. Asıl açık daha fazla hazır widget sayısı değil; veri kaybını önleyen kayıt akışı, yayınlama sınırı, gerçek CMS üzerinde doğrulama ve editoryal araçların tamamlanmasıdır.

Bu karar bir özellik sayımı veya yüzde puanı değildir. Bir özelliğin sözleşmesinin bulunması, yerel örnekte çalışması ve gerçek CMS’de üretim için doğrulanması ayrı değerlendirilmiştir. CMS’nin zaten sağladığı kullanıcı, yayın, SEO ve medya hizmetlerini editörün içine yeniden yazmak gerekmiyor; bunlara bağlanılacak noktalar ve hata davranışları tamamlanmalı.

## Kapsam ve kanıt

- Sözleşmeler, çekirdek resolver, editör handle’ı/arayüzü, medya alanı, form altyapısı, davranış eklentileri, HTTP adapter’ları, Go depolama ve Laravel örnekleri incelendi.
- Bu turda `npm test`, `npm run typecheck` ve Go `go test ./...` tekrar çalıştırıldı; hepsi başarılı. Go sonuçları cache üzerinden doğrulandı.
- Ek bir salt okunur çalışma zamanı deneyiyle kaynak şema sürümünün kontrol edilmemesi hem selection hem query modunda yeniden üretildi; ayrıntı aşağıda.
- Önceki turdaki tarayıcı kanıtı: CMS kabulü 4/4, formlar 7/7. Önceki derleme/bundle kontrolleri başarılı. Bunlar bu turda yeniden çalıştırılmış gibi sayılmamıştır.
- WordPress/Gutenberg, Elementor, GrapesJS, Storyblok ve Strapi’nin resmi belgeleri karşılaştırıldı. Rakip ürünler kurulup aynı test setiyle çalıştırılmadı. Bazı karşılaştırılan özellikler ücretli paketlere aittir.
- Gerçek Laravel, WordPress, Drupal veya Strapi kurulumu bu projeye bağlı değil. PHP/Composer testleri bu ortamda çalıştırılmadı. Bu rapor kapsamlı bir güvenlik veya erişilebilirlik sertifikası değildir.

## Özellik ve eklenti karşılaştırması

| Alan | Karşılaştırma ölçütü | BlockDesign’ın mevcut durumu | Değerlendirme |
|---|---|---|---|
| Görsel blok düzenleme | Gutenberg blokları, GrapesJS components/blocks | Alan eşleme, seçim, katmanlar, liste ekle/sil/kopyala/sırala ve undo/redo var | Pilot için yeterli |
| HTML/CSS içe aktarma | Tasarımdan tekrar kullanılabilir içerik modeli çıkarma | HTML temizliği, section adayları, CSS kapsamı ve import raporu var; keyfi script çalıştırılmaz | Güçlü; her HTML özelliği korunmaz |
| Dinamik içerik | Elementor dynamic tags ve CMS alanları | Blok, tek alan ve repeater; kayıt, grup ve sınırlı sorgu bağlama var | Temel ihtiyaçlar güçlü; mevcut sayfa bağlamı eksik |
| İlişkili içerik / listeler | Blog arşivi, ilgili içerik, ürün/tur listesi | İç içe listeler ve filtre/sıralama var | Canlı frontend pagination, kullanıcı filtresi ve route bağlamı için ortak çözüm yok |
| Formlar | Elementor form widget’ı | CMS şeması, 10 alan tipi, zorunluluk/sınırlar, bağımlı seçenekler, action sonucu, tekrar gönderim kontrolü var | Basit iletişim/arama/teklif formuna uygun; gelişmiş form paketi değil |
| Gelişmiş form özellikleri | Dosya, çoklu seçim, adımlar ve ek işlemler | Dosya alanı, dizi değerli multiselect, adımlı form ve koşullu görünürlük sözleşmesi yok | İhtiyaca göre eklenmeli |
| Menü / header / hamburger | CMS menü kaydı ve alt öğeler | DB kayıt seçimi; aynı header menüsü mobilde hamburger olur; footer grupları ayrı seçilebilir | Mevcut tasarım için yeterli; header bir alt menü düzeyi |
| Şablonlar ve ortak içerik | WordPress patterns/template parts/synced patterns | Sürümlü şablon, ortak header/footer/custom bölge, zorunlu/izinli blok politikası var | Güçlü; sabit sürüm nedeniyle güncelleme açık geçiş gerektirir |
| Görsel / medya | Strapi Media Library, GrapesJS Asset Manager | Arama, yükleme, çözümleme ve alt metin kaydı var | CMS medya seçicisine bağlanabilir; tam medya kütüphanesi değil |
| Gelişmiş medya | Klasör, kırpma, odak noktası, responsive varyant | Ortak sözleşmede klasör, crop/focal point, srcset/sizes ve medya güncelleme yok | Görsel ağırlıklı üretimde eksik |
| Zengin metin | Editoryal biçimlendirme araçları | `richText` alanı inspector’da textarea kullanıyor; güvenli rich text eşleme var | İçerik editörü açısından kısmi; araç çubuklu alan düzenleyici gerekli |
| İnteraktif bileşenler | Akordiyon, slider, sekmeler, modal, galeri | Native details/summary, slider ve güvenilir behavior plugin yaşam döngüsü var | Genişletilebilir; bütün widget’lar hazır değil |
| Eklenti sistemi | GrapesJS plugins | Adapter’lar ve selector tabanlı mount/update/destroy davranışları var | Genel eklenti SDK’sı, özel alan renderer kaydı ve uyumluluk manifest’i eksik |
| Çoklu dil | CMS locale ve sayfa varyantları | UI/içerik dili ayrımı, adapter’lar, fallback, yayınlanmış dil URL’leri, canonical/hreflang var | Altyapı güçlü; form runtime mesajları Türkçe, RTL/motor testi eksik |
| SEO | Sayfa metadata ve CMS SEO eklentisi | Export title/description ve canonical/hreflang okuyabiliyor | Ortak SEO paneli, Open Graph/robots/JSON-LD ve route yönetimi tamamlanmış değil |
| Kayıt güvenliği | Autosave, draft recovery, revisions | Manuel save, revision çatışması, oturum içi undo/redo, çıkış uyarısı, JSON kurtarma indirmesi var | Üretim için otomatik taslak/kurtarma eksik |
| Kalıcı geçmiş | WordPress revisions | Blok/bölge/şablon sürümleri var; belge tablosu yalnız son payload’ı saklıyor | Sayfa geçmişi, fark ve geri yükleme yok |
| Yayınlama | Strapi Draft & Publish/Releases | HTML üretimi ve issue listesi var | Draft/published ayrımı, atomik yayın, zamanlama ve cache invalidation host’ta kurulmalı |
| Gerçek frontend önizlemesi | Storyblok / Strapi preview | Editör tuvali ve statik çıktı önizlemesi var | CMS’nin gerçek route/render/oturum bağlamını doğrulayan preview bridge yok |
| Yetki ve çoklu site | CMS rol/nesne/site izinleri | UI izin bayrakları ve auth header enjeksiyonu var | Sunucu yetkilendirmesi host’a ait; Go örneğinde üretim yetki/tenant sınırı yok |
| Ekip çalışması | Onay, yorum, kilit, audit log | Revision çatışması aynı verinin ezilmesini önlüyor | Kullanıcı görünürlüğü, belge kilidi, yorum, onay ve denetim izi yok |
| Dağıtım / entegrasyon | Gömülebilir editör SDK’sı | ESM, IIFE, mount/destroy, özel backend ve Laravel örnekleri var | Pilot uygun; bağımsız paket kurulum ve gerçek CMS uyumluluk testi gerekli |
| Kalite / ölçek | Motorlar, erişilebilirlik, büyük belgeler | Yerel testler, bundle bütçeleri ve önceki responsive kontroller var | Firefox/Safari, gerçek cihaz, tam klavye/ekran okuyucu ve ölçek testi açık |

Formdaki CAPTCHA, spam limiti, e-posta/CRM teslimi ve sunucu doğrulaması action host’unun işi olabilir. Eksik olması editörde hepsinin yeniden uygulanmasını gerektirmez. Aynı şekilde ödeme, üyelik, stok ve sipariş yönetimi bir sayfa editörünün çekirdek sorumluluğu değildir.

## Öncelikli teknik bulgular

### 1. Kaynak şema sürümü kaydediliyor fakat çözümlemede karşılaştırılmıyor — yüksek

**Kanıt:** `SourceBinding.schemaVersion` ve `ProviderCollection.schemaVersion` sözleşmede bulunuyor. `packages/core/src/sources.ts` içindeki `resolveSelection` ve `resolveQuery`, `getSchema()` sonucunun dil ve capability bilgisini kontrol ediyor; sürümleri karşılaştırmıyor.

Bu turda iki modda da aynı deney çalıştırıldı:

```json
[
  {"mode":"selection","pinnedSchema":"1","providerSchema":"2","resolvedTitle":"Schema v2 content","issues":[]},
  {"mode":"query","pinnedSchema":"1","providerSchema":"2","resolvedTitle":"Schema v2 content","issues":[]}
]
```

Alan tipi değişirse mevcut doğrulama bunu yakalayabilir. Ancak aynı tipteki bir alanın anlamı değiştiğinde veya kaynak modeli yenilendiğinde kullanıcı değişikliği fark etmeyebilir. Gerekli çözüm: sürüm değişikliğini bildirmek; uyumluluk değerlendirmesi ve yeniden eşleme/onay akışı sağlamak. Her sürüm farkının koşulsuz engellenmesi şart değildir.

### 2. Gömülü editörde başarılı kayıt host URL’sini değiştiriyor — yüksek entegrasyon önceliği

**Kod kanıtı:** `packages/editor/src/EditorShell.vue`, `saveDocument()` içinde `window.history.replaceState` ile mevcut URL’ye `document` parametresi yazıyor; `appearance: 'embedded'` ayrımı yok. Aynı yerde global `blockdesign:last-document` localStorage anahtarı yazılıyor.

CMS router’ı bu parametreyi kendisi yönetiyorsa çakışma doğabilir; iki editör aynı anahtarı paylaşır. Bu, bu turda router içinde yeniden üretilmiş bir arıza değil, doğrudan kodda görülen koşulsuz yan etkidir. SDK, yönlendirmeyi host callback’ine bırakmalı; yerel hatırlama anahtarı isteğe bağlı ve site/editör kapsamında olmalı.

### 3. Yayınlamayı engelleyen ortak kalite kapısı yok — yüksek

**Kanıt:** `PreviewExport.issues` yalnız `code/message` taşıyor. `exportStatic()` hata notlarıyla çıktı döndürebiliyor. `downloadExport()` katı çoklu dil seçeneği için indirmeyi engelliyor; bütün form/medya/kaynak sorunlarını kapsayan genel yayın politikası yok.

Kısmi HTML indirebilmek yararlı bir özellik olabilir. Üretimde gereken ayrım: önizleme/indirme ile yayımlanabilir çıktı. Host’un engelleyici hataları tanıyabileceği severity, path ve ilgili blok/kaynak kimliği; `validateForPublish` benzeri tek sonuç ve kontrollü override akışı gerekli.

### 4. Otomatik taslak ve kalıcı belge geçmişi yok — yüksek

**Kanıt:** GrapesJS köprüsünde `autosave: false`; editörün kendi otomatik kayıt politikası bulunmuyor. `DocumentHistory` bellekte tutuluyor. `documents` tablosu son payload ve revision sayısını saklıyor; güncelleme eski payload’ı değiştiriyor. Revision sayısı çakışma denetimidir, geçmiş arşivi değildir.

Host otomatik kaydı `onChange` ve `save()` üzerinden ekleyebilir. Ancak debouncing, uçuşan kayıt, yeni düzenleme sırasında gelen cevap, çevrimdışı taslak, oturum süresi dolması ve yeniden açmada kurtarma kuralları ortaklaştırılmalı. Eski kaydı karşılaştırma ve geri alma için host geçmiş adapter’ı/sözleşmesi gerekli.

### 5. Medya seçici küçük kütüphaneye göre tasarlanmış — orta

**Kanıt:** `FieldEditor.vue` aramanın yalnız `items` alanını okuyor; devam cursor’ını tüketmiyor. `AssetAdapter.search` girişinde cursor yok. Referans SQLite araması 50 sonuçla sınırlı. İki arama eşzamanlı sonuçlanırsa eski cevabı eleyen request kimliği/abort denetimi bu alanda yok.

Bu bulgular kod incelemesidir; bu turda geciktirilmiş medya sağlayıcısıyla tarayıcıda yeniden üretilmedi. Üretim için sayfalama/host medya modal’i, eski yanıt koruması ve stable asset referansı gerekli. Şu an görsel seçimi çoğunlukla URL saklıyor; CMS dosyayı başka adrese taşıdığında merkezi asset ID’den tekrar çözümleme akışı tamamlanmış değil.

Referans yükleme JPEG/PNG/GIF ve 8 MB ile sınırlı. UI’nin `image/*` filtresi WebP/AVIF gibi backend’in kabul etmediği dosyaları da seçtirebilir. Kabul edilen türler adapter constraint’lerinden UI’ye yansıtılmalı. Importer `srcset` özelliğini desteklenmeyen olarak raporlayıp kaldırıyor.

### 6. Dinamik bileşen için sayfa/kayıt bağlamı eksik — orta

**Kanıt:** `RequestContext` signal/requestId/locale taşıyor; ortak page/site/record/preview bağlamı tanımlı değil. `SourceBinding.query` sabit değerli filtreler ve limit kullanıyor. Bu yüzden “şu anki turun ID’sine bağlı ilgili turlar”, “aktif kategori”, “arama sonucunun ikinci sayfası” gibi ihtiyaçlar host’a özel closure veya yeni entegrasyon kodu gerektiriyor.

Öneri: host’un doğruladığı sayfa bağlamı, typed binding değişkenleri ve frontend liste etkileşimi için ayrı sözleşme. SQL veya serbest API adresi editöre açılmamalı. Veritabanı okuması yine CMS backend’inde kalmalı.

### 7. Genel eklenti uyumluluğu iddia edilemez — orta

GrapesJS motorunu kullanmak, onun bütün eklentilerinin BlockDesign belge modeliyle uyumlu olduğu anlamına gelmez. Mevcut `behaviorPlugins` özel HTML’in etkileşimini ekliyor; özel içerik alanı, inspector paneli, serializer, validator ve migration için bütünleşik kayıt sistemi sağlamıyor. PHP tarafındaki herhangi bir Filament alanı da otomatik olarak render edilemiyor; ortak form sözleşmesindeki tiplerden birine dönüştürülmeli veya sözleşme genişletilmeli.

Yeni eklenti için asgari kabul: kaydet → yeniden aç → undo/redo → kaynak çöz → önizle → statik yayınla → destroy. Ayrıca sürüm uyumluluğu, ad çakışması ve bağımlılık davranışı belgelenmeli.

### 8. Belgelerde eski kabullerin kalması — düşük

`README.md` çoklu dil paragrafını iki kez içeriyor; API kesilince içerik fallback’i açıklaması aktif demo sağlayıcı seçimiyle tam örtüşmüyor. `examples/laravel/README.md` header/hamburger örneklerini bağımsız diye tanımlıyor; mevcut ScalaNova runtime aynı menüyü kullanıyor. `docs/PLAN.md` geçmiş test sayısı ve bütçeleri içeriyor. Entegratör için tek, güncel destek matrisi ve doğrulama tarihi gerekli. Bu turda uygulama veya eski belgeler değiştirilmedi; bulgular bu raporda toplandı.

## Sorumlulukların doğru bölünmesi

| Editör çekirdeği | CMS/backend | Ortak entegrasyon |
|---|---|---|
| Blok/alan/listeler, şema doğrulama, seçim ve history | Veritabanı, oturum, nesne/site yetkisi, yayın durumu | Adapter capability ve hata sözleşmesi |
| Tuval, önizleme, çıktı ve issue üretme | URL/slug, SEO kayıtları, medya/CDN dönüşümü | Medya seçicisi, SEO paneli ve gerçek route preview |
| Form görünümü ve ziyaretçi etkileşimi | Form doğrulama/kaydı, spam limiti, idempotency, teslim | Form şeması, seçenek ve action adapter’ları |
| Şablon ve sürüm geçişlerinin arayüzü | Kalıcı geçmiş, yayın snapshot’ı, görev kuyruğu/cache | Taslak/kurtarma, geçmiş/restore ve yayın kalite kapısı |

## Uygulama önceliği ve kabul ölçütleri

### P0 — gerçek CMS’ye ilk bağlantı

1. **Gömülü kayıt izolasyonu:** CMS router URL’si kayıttan sonra değişmemeli; iki editör birbirinin belge kimliğini/yerel anahtarını etkilememeli.
2. **Şema değişimi:** selection ve query’de sürüm değişikliği görünür olmalı; uyumsuz alan yayınlanmamalı; kullanıcı yeniden eşleyebilmeli.
3. **Yayın kapısı ve snapshot:** kaynak/form/varlık hatası yayınlamayı engelleyebilmeli. Aynı kayıtlı belge ve sabit tanımlar güvenilir worker’da üretilmeli; başarısız iş mevcut yayını bozmamalı.
4. **Gerçek CMS yetki testi:** kaydetme, kütüphane yazma, medya ve yayın için rol/nesne/site denetimi sunucuda uygulanmalı. 401/403, süresi dolmuş oturum ve CSRF hatası açıkça gösterilmeli; üretimde demo fallback’i kullanılmamalı.
5. **Gerçek form gönderimi:** backend alan doğrulaması, seçenek aidiyeti, aynı submission ID ile tekrar, eski şema ve teslim sonucu sınanmalı. Önizleme gerçek başvuru oluşturmamalı.

### P1 — içerik ekibine açılmadan önce

6. Otomatik taslak/kurtarma ve sayfa geçmişi/geri yükleme; bağlantı kopması ve tarayıcı çökmesi senaryoları.
7. CMS medya modal’i veya cursor’lı medya adapter’ı; format uyumu ve eski arama yanıtının elenmesi.
8. Araç çubuklu rich text, iç sayfa/kayıt link seçici ve CMS SEO paneline bağlantı.
9. Gerçek frontend route’unda taslak önizleme; draft/published ve site/dil bağlamı korunmalı.
10. Firefox/Safari, klavye ve ekran okuyucu; 50/200 blok ve 100/1.000/10.000 kayıtlı CMS kütüphanelerinde performans ölçümü. Bunlar henüz doğrulanmış kapasite rakamları değildir, önerilen test ölçekleridir.

### P2 — kullanım ihtiyacına göre

- Koşullu alanlar, multiselect, dosya ve adımlı formlar.
- Sekme/modal/galeri/map gibi ortak behavior eklentileri.
- Genişletilebilir alan/panel SDK’sı ve sürüm uyumluluk test kiti.
- Belge kilidi, yorum/onay ve audit log için host bağlantıları. Gerçek zamanlı ortak düzenleme ayrı ürün kapsamıdır; ilk sürümün ön koşulu olmak zorunda değildir.

## Başvuru kaynakları

Kaynaklar 15 Ekim 2026 tarihinde kontrol edildi. Özellik ve plan sınırları değişebilir.

- [WordPress patterns ve template parts](https://wordpress.org/documentation/article/comparing-patterns-template-parts-and-reusable-blocks/): tekrar kullanılabilir yapı ile senkron içerik ayrımı. Bizde sabit sürüm ve açık migration tercih edildiği için güncellemeler otomatik site geneline yayılmaz.
- [WordPress revisions](https://wordpress.org/documentation/article/revisions/): kalıcı belge geçmişi ve karşılaştırma ölçütü.
- [WordPress roles/capabilities](https://wordpress.org/documentation/article/roles-and-capabilities/): tasarım, içerik ve yayın işlemlerinin ayrı izinlerle sınırlandırılması.
- [Elementor dynamic tags](https://elementor.com/help/dynamic-tags-pro/): CMS alanlarını tasarım elemanlarına bağlama ölçütü.
- [Elementor Form widget](https://elementor.com/help/form-widget/): çoklu seçim, dosya ve çok adımlı form gibi gelişmiş ihtiyaçlara örnek. Bunların tümü bizim ilk sürüm kapsamımızda değil.
- [GrapesJS Storage Manager](https://grapesjs.com/docs/modules/Storage.html): otomatik kayıt ve JSON’un düzenleme kaydı olması. BlockDesign kendi canonical belgesini kullanır; ham motor autosave’ini açmak tek başına çözüm değildir.
- [GrapesJS plugins](https://grapesjs.com/docs/modules/Plugins.html): motor eklentisi genişletme modeli; BlockDesign ile otomatik uyumluluk taahhüdü değildir.
- [GrapesJS Asset Manager](https://grapesjs.com/docs/modules/Assets.html): asset/upload entegrasyonu.
- [Storyblok Visual Editor](https://www.storyblok.com/docs/manuals/visual-editor): gerçek site önizlemesinden blok düzenleme ve ekran genişliği seçimi.
- [Strapi Preview](https://docs.strapi.io/cms/features/preview): gerçek frontend önizleme entegrasyonu. Live Preview ücretli paketlerde; belgede deneysel kısıtları da açıklanıyor.
- [Strapi Media Library](https://docs.strapi.io/cms/features/media-library): klasör, arama, responsive türev ve kırpma/odak yönetimi ölçütü.
- [Strapi Review Workflows](https://docs.strapi.io/cms/features/review-workflows): Enterprise paketindeki onay aşamaları; temel editörün zorunlu ücretsiz özelliği gibi değerlendirilmedi.
- [Strapi Releases](https://docs.strapi.io/cms/features/releases): Growth/Enterprise paketlerindeki toplu/zamanlı yayın akışı.

## Kodda başlıca kanıt noktaları

- `packages/contracts/src/index.ts`: SourceBinding, StorageAdapter, AssetAdapter, RequestContext ve locale sözleşmeleri.
- `packages/contracts/src/forms.ts`: desteklenen form tipleri ve action/publication sözleşmesi.
- `packages/core/src/sources.ts`: kaynak çözümleme, capability/dil denetimi ve şema sürümü açığı.
- `packages/core/src/history.ts`: oturum içi undo/redo.
- `packages/editor/src/types.ts`: host seçenekleri, izinler ve handle sınırları.
- `packages/editor/src/EditorShell.vue`: saveDocument, exportStatic, downloadExport ve recovery akışları.
- `packages/editor/src/FieldEditor.vue`: richText textarea, medya arama/yükleme ve URL seçimi.
- `packages/grapesjs-bridge/src/index.ts`: behavior plugin ve motor storage ayarı.
- `packages/grapesjs-bridge/src/html-import.ts`: script/iframe/form temizliği ve srcset sınırı.
- `server/internal/repository/migrations/001_initial.sql` ve `repository.go`: tek son payload, revision karşılaştırması ve 50 sonuçlu medya araması.
- `server/internal/httpapi/handler.go`: referans host endpoint’leri; üretim yetkilendirmesi içermez.
- `examples/laravel/README.md`: DOM gerektiren renderer ve henüz hazır olmayan PHP/headless yayın worker’ı.
