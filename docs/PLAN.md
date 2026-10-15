# BlockDesign — mimari ve geliştirme planı

Tarih: 13 Ekim 2026, Europe/Istanbul. Durum: TypeScript ve Go testleri ile üç üretim paketi daha önce başarılıydı; çoklu dil uygulaması sonrasında `npm run typecheck` de başarılı. Go HTTP API ile belge kaydı/yeniden yükleme, ayrı HTTP kökeninde statik FAQ export'u, ESM entegrasyonu ve iki editörün bağımsız mount/destroy akışı tarayıcıda doğrulandı. Statik export varlık paketleme, şablon policy ve şema geçişi, Go medya API'si ve üçüncü taraf lisans kayıtları tamamlandı. Çoklu dil kaynak ve sayfa varyantı akışı ile Vue/vanilla/Laravel örnekleri eklendi.

Başvuru belgeleri: [orijinal istek](ISTEK.md), [sözleşmeler](SOZLESMELER.md), [ürün bağlamı](../PRODUCT.md), [çoklu dil ve proje entegrasyonu planı](COKLU-DIL-PLANI.md).

14 Ekim 2026 form uygulaması: [CMS kaynaklı form altyapısı](CMS-FORM-ALTYAPISI-PLANI.md) ve [entegrasyon rehberi](CMS-FORM-ENTEGRASYONU.md). Ortak JSON sözleşmesi, tek CMS formu bileşeni, runtime, bağımlı seçenekler, editör bağlantı paneli ve HTTP adapter’ları eklendi. Yerel veriler yedeklenip şablonlar sürümlenerek taşındı. Laravel/Filament 5 örneği ayrı host entegrasyonudur; bu ortamda PHP testleri çalıştırılamadı.

## 1. Hedef ve mevcut durum

Bağımsız bir görsel blok ve sayfa editörü geliştirilecek. Entegratör kendi uygulamasını Vue'ya çevirmeden editörü gömebilecek; Go sunucusu yalnızca çalışan referans backend olacak.

İlk incelemede `C:/Users/Pc/Desktop/BlockDesign` yalnızca plan belgelerini içeriyordu; ayrı bir çalışma alanı olarak Git başlatıldı. npm workspace, TypeScript/Vue/GrapesJS editörü ve katmanlı Go/SQLite referans API'si burada oluşturuldu. Başka proje klasörüne yazılmadı.

Kullanıcı önce plan istemiş, ardından kodlamaya başlamamız için yön vermiştir. MIT lisansı ve `BlockDesign contributors` telif bildirimi dosyalara işlendi. Kullanıcı görsel yön olarak üç panelli, tuval merkezli stüdyo çalışma tezgâhını seçti; [DESIGN.md](../DESIGN.md) bu kararı ve uygulamadaki karşılığını kaydeder.

Kapsam dışı: CMS, yönetim paneli, giriş/kayıt, kullanıcı/rol ekranları, alan modellerine gömülü blog/ürün/tur mantığı, Studio SDK, keyfi SQL veya kullanıcı JavaScript'i. AI dört aşamanın tamamlanmasından sonra isteğe bağlıdır.

## 2. Mimari kararlar

| Katman | Sorumluluk | Bağımlılık sınırı |
| --- | --- | --- |
| Ortak sözleşmeler | Belge zarfı, referanslar, alanlar, adapter capability bilgileri, hata tipleri | Vue, Go, SQL ve GrapesJS runtime import etmez |
| TypeScript çekirdek | Belge doğrulama, komutlar/geçmiş, manuel veri, alan eşleme, repeater, kaynak çözümleme | Yalnızca sözleşmeler ve enjekte edilen adapter/port'lar |
| GrapesJS köprüsü | Component kayıtları, iframe, seçim, stil kilitleri, yapı değişikliği ve render | Çekirdek komutlarını ve motor port'unu kullanır |
| Vue arayüzü | Katalog, katmanlar, formlar, eşleme sihirbazı, kaynak seçimi, durum/hata akışları | Adapter URL'lerini ve repository modelini bilmez |
| Embed paketi | `mountEditor`, Vue mount/unmount, CSS, yaşam döngüsü | Kendi Vue runtime'ını taşıyan normal HTML dağıtımı |
| HTTP adapter paketi | Referans Go API ile iletişim ve HTTP hata dönüşümü | URL ve auth bilgisi enjekte edilebilir; çekirdeğe Go modeli taşımaz |
| Go referans sunucusu | HTTP handler → application service → repository; demo provider | SQLite yalnızca repository uygulamasında |
| Örnekler | Vue, normal HTML, Go'suz kullanım, özel backend/provider | Aynı public sözleşmeleri kullanır |

Tek depo, küçük çalışma alanı paketleri kullanır. npm workspaces ve tek frontend lockfile yeterlidir. `@blockdesign/*` çalışma alanı kapsamı ve `@blockdesign/editor` gömülebilir paket hedefi sabitlendi; kök workspace özel kalır ve npm yayını açılmadan önce derlenmiş paket girişleri ile registry erişimi ayrıca doğrulanır.

Mevcut dizinler: `packages/contracts`, `packages/core`, `packages/grapesjs-bridge`, `packages/editor`, `packages/adapters`, `apps/demo`, `examples/vanilla`, `server/cmd/demo`, `server/internal/httpapi`, `server/internal/application`, `server/internal/repository/migrations`, `docs`.

İlk tarayıcı dikey dilimi özel blok taslağı, görsel alan eşleme, repeater, katalog, sayfaya ekleme ve yeniden açmayı kapsıyor. HTML/CSS import, PostCSS ile selector kapsamı, URL çözümleme ve rapor; native accordion, kayıtlı slider davranışı; source adapters ve Go'suz özel backend örneği eklendi. Ortak CSS/font manifest'i HTTP/SQLite ve browser-local adapter'larıyla saklanır; Go görsel API'si upload, search ve resolve destekler. Statik export uygun MIME ve CORS erişimi olan kaynakları sınırlar içinde paketler, paketleyemediğini raporlar. Go API/repository Go 1.27.2 ile derlendi ve test edildi.

## 3. Teknoloji ve sürüm politikası

- Resmi indirme listesinde 11 Ekim 2026 kontrolüyle en güncel kararlı Go **1.27.2**; yayın tarihi 8 Ekim 2026. Referans sunucusunun `go.mod` dosyasında `go 1.27.2` belirtildi. Bu sürümün yerel toolchain'iyle `go test ./...` başarılıdır; sonraki desteklenen sürüme geçiş kontrollü bağımlılık güncellemesi olacak. [İndirme listesi](https://go.dev/dl/?mode=json), [yayın ve destek politikası](https://go.dev/doc/devel/release).
- Vue 3, TypeScript 6.0.3 ve Vite 8.3.4 npm workspace'e sabit sürümlerle eklendi. Vite'ın Node engine koşulu kontrol edildi; uygulama Node 24.15.0 ile typecheck/build aldı. [Vite kurulum belgesi](https://vite.dev/guide/).
- GrapesJS açık kaynak core kullanılacak. Yeniden düzenleme için `projectData` korunacak; HTML/CSS çıktısı editörün kayıt formatı olarak kullanılmayacak. Motor sürümü belgeye yazılacak ve değişiminde uyumluluk fixture'ları çalıştırılacak. [GrapesJS storage belgesi](https://grapesjs.com/docs/modules/Storage.html).
- SQLite için önerilen sabit sürüm **modernc.org/sqlite v1.60.1**. Paket sayfasında 29 Eylül 2026 yayını ve BSD-3-Clause lisansı görünüyor; bu, yakın tarihli bakım faaliyetinin kanıtıdır, gelecekte bakım garantisi değildir. Paket sayfası daha yeni sürüm uyarısı da gösterdiğinden v1.60.1'e “en güncel” denmeyecek. İlk kurulum öncesi geri çekilme ve güvenlik duyuruları tekrar kontrol edilecek. [Sürümlü paket kaydı](https://pkg.go.dev/modernc.org/sqlite@v1.60.1).
- Seçilen driver'ın kendi `go.mod` kaydı Go 1.26.0 ve `modernc.org/libc v1.77.1` kullanıyor. Libc sürümü driver ile uyumlu tutulacak; bağımsız rastgele yükseltilmeyecek. `go.sum` ve lisans bildirimleri oluşturulup `go mod verify` ile doğrulandı. [Sürümlü go.mod](https://raw.githubusercontent.com/modernc-org/sqlite/v1.60.1/go.mod), [sürümlü lisans](https://raw.githubusercontent.com/modernc-org/sqlite/v1.60.1/LICENSE).
- CSS dönüşümünde PostCSS AST ve selector/value parser kullanılacak. HTML sanitization, ZIP export ve test araçları uygulama öncesi bakım/lisans incelemesiyle seçilecek. [PostCSS](https://postcss.org/).
- Kullanıcı tercihi: MIT lisansı önerisiyle ilerle. [LICENSE](../LICENSE) oluşturuldu; mevcut telif bildirimi `Copyright (c) 2026 BlockDesign contributors` olarak sabitlendi. Kişi veya şirket adı verilmediği için lisans satırında hak sahibi uydurulmaz. Go ve npm üçüncü taraf bildirimleri tutulur.

## 4. Belge, içerik ve geçmiş

Altı ayrı kavram korunur: tasarım sistemi, blok tanımı/sürümü, blok örneği, paylaşılan bölge/sürümü, sayfa şablonu/sürümü ve editör belgesi. Sayfa ilk sürümde tek tasarım sistemine bağlıdır. CSS/varlık değişikliklerinin mevcut sayfaları sessizce değiştirmemesi için tasarım sistemi referansı da bir sürüm içerir.

Tek zarf: `documentVersion`, `engine`, `engineVersion`, `revision`, `designSystemRef`, `templateRef`, `sharedRegionRefs`, sayfa alanları ve blok örnekleri, `projectData`, kalıcı editör görünüm durumu. Motor yapısı ile iş alanı verisi birbirine karıştırılmaz.

`manualData` blok alan ve repeater içeriklerinin tek doğruluk kaynağıdır. Paylaşılan bölge alanları belge zarfındaki `sharedRegionData[id@version]` içinde yaşar. Tuval alan formunun çıktısıdır; alan değişince hedef GrapesJS modeli yerinde güncellenir, eski canvas snapshot'ı canonical verinin üstüne yazılmaz. Çekirdek testleri alanın belge → tuval dönüşümünü, tarayıcı denetimi header marka alanının canlı canvas'a yansımasını doğrular.

Kaydetme: bekleyen alan girişleri ve motor güncellemeleri tamamlanır → belge/alan/sayı sınırları doğrulanır → aynı belge generation'ından `projectData` snapshot'ı alınır → adapter'a expectedRevision ile gönderilir. Açmada referanslar ve uyumluluk doğrulanır; eşlenmiş içerik tekrar canonical veriden tuvale uygulanır. Geçersiz belge orijinali korunarak hatayla açılmayı reddeder.

Kaynak sonuçları manuel veriye yazılmaz. ProjectData içindeki kaynakla üretilmiş içerik kalıcı kayıttan arındırılır veya placeholder'a dönüştürülür; yeniden açmada yeniden çözümlenir. Önizleme cache'i geçicidir ve kaynak kimliği/zamanı görünürdür.

İşlem geçmişi tek komut yöneticisinde tutulur. GrapesJS'in bağımsız undo geçmişiyle yarışan ikinci bir geçmiş oluşturulmaz; köprü motor değişikliklerini transaction olarak kaydeder. Repeater ekleme/silme/kopyalama/sıralama ve sürüm geçişi ayrı ayrı tek undo/redo adımıdır.

Alan kimlikleri anahtardan, repeater öğe kimlikleri sıralamadan bağımsızdır. Kopyalamada yeni kimlikler üretilir. DOM id ve `for`, `aria-controls`, `aria-labelledby`, `aria-describedby`, yerel fragment gibi referanslar aynı dönüşüm tablosuyla güncellenir. Alan hedefi kararlı component/node kimliğidir; kullanıcıdan selector istenmez.

İlk sürümde bir blokta birden fazla bağımsız repeater vardır. İç içe repeater yoktur: sihirbaz ve kaydetme doğrulaması bunu açıkça reddeder; import raporu desteklenmeyen yapıyı belirtir. Bu sınır şema capability bilgisine yazılır.

## 5. Editor gömme ve yaşam döngüsü

`mountEditor(element, options)` başlangıç belgesi, StorageAdapter, BlockLibraryAdapter, provider listesi, isteğe bağlı AssetAdapter, DesignSystemAdapter, TemplateAdapter, SharedRegionAdapter, dil, mod ve change/save/error callback'lerini kabul eder.

Dönen handle hazır olma, belgeyi alma/yükleme, kaydetme, mod değiştirme, önizleme, export ve destroy işlemlerini sağlar. Hatalar hem Promise sonucu hem normalize callback ile bildirilebilir; aynı işlem için callback tekrarları önlenir. `onSave` yalnızca adapter'ın başarılı yanıtından sonra tetiklenir.

Vue örneği embed paketini component lifecycle'ına bağlar. Normal HTML örneği dağıtılmış ESM veya IIFE JS ve CSS dosyalarını kullanır; runtime dağıtımın içindedir, host uygulama Vue bağımlılığı eklemek zorunda kalmaz. Ağ/CDN zorunluluğu yoktur. Editor CSS'i host'tan ayrılan kök kapsayıcıda tutulur; GrapesJS tuvali iframe'dedir.

Go'suz örnek bellek adapter'larıyla temel akışı gösterir; kalıcılık garantisi açıkça belirtilir. Sağlanmayan veya desteklenmeyen adapter özelliği UI'da sunulmaz. HTTP istemcisi dışarıdan fetch/auth header/credential politikasını kabul eder; kimlik doğrulama bilgileri belgeye yazılmaz.

Destroy idempotent olacak: bekleyen istekleri iptal et, event subscription'larını kaldır, davranış eklentilerini kapat, timer/observer/object URL'leri temizle, GrapesJS destroy çağır, iframe ve Vue mount'unu kaldır. Mount başarısızlığında da kısmi kaynaklar temizlenir. Aynı sayfada iki editörün durumları ve cleanup işlemleri bağımsızdır. [Motor destroy API'si](https://grapesjs.com/docs/api/editor.html).

## 6. Arayüz ve görsel taslak adımı

Kullanıcı görsel taslağı istemiş ve daha sonra kodlamaya başlamamız için yön vermiştir. İlk ekran, SSS içeriği, katalog, tuval ve özellik paneliyle çalışan uygulama içinde mockup olarak oluşturuluyor. Tarayıcı görüntüsü alındıktan sonra scroll davranışı ve responsive yerleşim kontrol edilecek.

Önerilen iş akışı yerleşimi:

- Üst alan: belge/tasarım sistemi, açık mod bilgisi, undo/redo, önizleme, kaydetme ve gerçek kayıt durumu.
- Sol alan: hazır blok kataloğu, yapı taşları ve katmanlar; tasarım/ içerik moduna göre gösterim.
- Orta alan: responsive tuval; üstünde seçili öğe → üst blok breadcrumb ve cihaz görünümü.
- Sağ alan: seçili bloğun İçerik, Alanlar ve izin verilen Stil kontrolleri; kaynak işlemleri ilgili alan/liste içinde.

Kullanıcı üç panelli, tuval merkezli stüdyo düzenini onayladı. Boş ekran doğrudan ilk section/iki sütun adımına götürür. Banner'da repeater paneli görünmez. İçerik modunda yapı düzenleme kontrolleri bulunmaz; çekirdek de bu işlemleri reddeder. Mod yapılandırması authentication yerine geçmez.

Alan eşleme sihirbazı: öğeyi seç → “Düzenlenebilir alan yap” → önerilen etiket/anahtar → tür → metin veya attribute hedefini insan dilinde göster → doğrula. Repeater sihirbazı: kapsayıcı → örnek öğe → alanlar → min/max → örnek veriyle doğrula. Başka öğe seçilince yarım kalmış taslak blok/alan kimliğiyle korunur; değişen panel formu sıfırlamaz.

Düzenlemede link/akordiyon/slider tıklaması seçime hizmet eder. Önizlemede seçim kapatılır ve kayıtlı davranışlar çalışır. Sol/sağ paneller bağımsız scroll alanlarıdır; tuvalin scroll'u paneli ve host sayfayı istemeden kaydırmaz. Küçük ekranlarda paneller drawer olarak açılır; dar ekranda tam masaüstü üretim deneyimi iddia edilmez.

Yükleniyor, boş katalog, validation hatası, sağlayıcı hatası, kaydedilmemiş, kaydediliyor, kaydedildi, başarısız ve çakışma durumları taslağa dahil edilir. Klavye seçim/sıralama, görünür focus, form label'ları ve anlaşılır durum duyuruları hedeflenir.

## 7. Import, CSS ve varlıklar

HTML/CSS metin veya dosyadan alınır; tam sayfada section/article adayları görsel olarak sunulur. Kullanıcı bölüm ve alan eşlemelerini doğrular. Şema otomatik olarak kusursuz çıkarılmış sayılmaz.

HTML önce güvenli DOM'a dönüştürülür: script, event attribute, tehlikeli URL ve aktif gömülü içerik ayıklanır. Video ilk sürümde güvenli medya URL'si ve izinli provider dönüşümleriyle sınırlıdır; keyfi embed HTML çalıştırılmaz. Allowlist kuralları import yanında rich text, yükleme ve export girişlerinde de uygulanır. CSS içindeki ağ/URL bağımlılıkları da kaydedilir ve policy kontrolünden geçer.

Ortak CSS ve stylesheet URL manifest'i browser-local DesignSystemAdapter üzerinden düzenlenip iframe'e bir kez eklenir ve export'a taşınır; blok CSS'i sürümlü blokta kalır. Uzak dosyalar kendiliğinden indirilip paketlenmez. Blok CSS'i definition/version kökü altında scope edilir; instance stil override'ları ayrıca instance köküyle sınırlandırılır. Selector, media/supports kuralları ve CSS value dönüşümleri parser üzerinden yapılır. `html/body/:root` gibi global selector'lar kontrollü kök/token dönüşümü veya rapor gerektirir; sessizce yanlış scope edilmez.

CSS custom property'leri, keyframe ve animation-name referansları, font-face ve font kullanım referansları dependency manifest'inde korunur. Çakışan blok animasyon/font adları tutarlı namespace dönüşümü alır. Kaynak base URL'siyle HTML/CSS bağıl adresleri çözülür; çözülmemiş veya erişilemeyen varlık rapora yazılır. Tarayıcıda CORS ile alınamayan varlık sessizce paketlenmiş sayılmaz.

Import raporu: korunan yapılar/bağımlılıklar, çıkarılan riskli içerik, eksik varlıklar, desteklenmeyen JS etkileşimleri ve kullanıcı eşlemesi bekleyen öğeler. Karmaşık üçüncü taraf widget'ları, uygulama JS'ine bağlı slider'lar ve tüm HTML çeşitleri için tam destek iddiası yoktur.

## 8. İçerik kaynakları, render ve çıktı

Kaynak bağlama bütün blok, tek alan veya repeater hedefinde mümkündür. Öncelik: daha özel hedef bağlantısı → blok bağlantısı → manuel alan. Aynı hedefte birden fazla aktif bağlantı veya dairesel çözümleme reddedilir.

Manuel taslak daima korunur. Kayıt seçiminde ordered record/group referansları tutulur. Otomatik sorgu yalnızca provider'ın koleksiyon şemasındaki filtre operator'leri, sort alanları ve limit aralığını kullanır. Alan eşleme şema/type uyumuyla doğrulanır; keyfi ifade/SQL çalışmaz.

Demo provider alan şeması olan genel koleksiyonlar ve hayali örnek kayıtlar sunar. Eksik alan, silinmiş kayıt, timeout ve schema değişimi ayrı sorun olarak gösterilir. Eski istek sonucu yeni kaynağa uygulanmaz; istek iptali/generation kontrolü yapılır. Kaynak yazma API'si ilk sürümde yoktur; varsa güvenli edit URL'si host uygulamayı açar.

Ortak pipeline: belge doğrula → sabit definition sürümlerini çöz → kaynakları çöz → type uyumlu alan eşlemelerini uygula → güvenli render modelini oluştur → motor renderer'ı ile HTML/CSS üret → bağımlılıkları topla. Önizleme ve statik export aynı pipeline ve çözümleme snapshot'ını kullanır.

Statik çıktı `index.html`, CSS, kayıtlı runtime JS'i ve varlık manifest/paketinden oluşur. Eksik zorunlu veri veya varlık export'u başarısız kılar; kullanıcı isteyerek kısmi çıktı seçerse eksiklikler raporda kalır. Bir statik paket dinamik provider'a çağrı yapmak zorunda değildir.

Dinamik çıktı orijinal sürümlü belgeyi, kaynak referanslarını, sorguyu ve mapping'leri taşır; tüketici aynı çözümleme/render sözleşmesini uygular. Preview cache'i manuel içerik diye kaydedilmez. Export HTML'i tekrar editör belgesi olarak yüklenmez.

Davranış registry'si yalnızca geliştiricinin kaydettiği güvenilir eklentileri içerir. Eklenti: HTML yapı contract'ı, CSS/JS manifest'i, mount/update/destroy. Native details/summary FAQ için yeterlidir. Slider her blok kökünde bağımsız başlatılır; repeater değişiminde update veya destroy/remount uygulanır. Ortak bağımlılık sayfada tek kez eklenir, instance durumu paylaşılmaz.

## 9. Go API, SQLite ve çakışma yönetimi

Standart `net/http` tabanlı handler; application katmanında validation/revision/referans kuralları; repository arayüzünde SQLite transaction'ları. Frontend tablo veya Go struct bilgisi taşımaz. Ortak JSON Schema fixture'ları Go ve TypeScript doğrulamasını aynı contract'a karşı sınar.

Yerel sunucu `127.0.0.1`/localhost üzerinde çalışır. Geliştirme origin'leri açık allowlist ile belirlenir. Başka backend'in aynı URL düzenini uygulama zorunluluğu yoktur; referans HTTP adapter Go API'nin endpoint'lerini bilir. İstemci enjekte edilebilir.

Referans saklama modeli: documents/envelope, design systems/versions/assets, definitions/immutable versions, shared regions/versions, templates/versions ve normalize kullanım referansları. İlk migration yalnızca ilk aşama tablolarını oluşturur; sonraki tablolar ilerleyen migration'larla gelir. Demo kayıtları editör çekirdeğinin alan modeline dönüştürülmez.

Revision kaydetme atomik compare-and-swap olacak: gönderilen expectedRevision veritabanındaki revision ile aynıysa güncelle ve revision artır. Belge/referans index güncellemeleri aynı transaction'da tutulur. HTTP adapter bunu ETag/If-Match'e dönüştürür; eski revision 412 ile reddedilir. Conflict yanıtı yeni revision ve kurtarma için yükleme bilgisi taşır.

Kaydederken yeni yerel değişiklik oluşursa başarılı kayıt bütün belgeyi temiz saymaz: yalnızca gönderilmiş generation kaydedildi kabul edilir. İstekler seri yürür; başarısızlıkta dirty durumu korunur. Çakışma seçenekleri: yerel kurtarma kopyası indir, sunucu sürümünü ayrı incele, yeni belge olarak kaydet; ilk sürümde otomatik merge yoktur.

SQLite migration sürümleri takip edilir; foreign key'ler açık, transaction'lar ve uygun busy timeout/WAL ayarları kullanılır. Server restart sonrası kayıtlar geri gelir. Referans kontrolü ve silme aynı transaction'dadır. Yalnızca belge referansları değil, template/region/definition bağımlılıkları da silmeyi engelleyebilir.

Tanım sürümleri immutable'dır. Yeni sürüm yayımlamak eski belgeleri değiştirmez. Geçiş kullanıcı seçimiyle: eski/yeni schema farkı → uyumsuz alanlar → dönüşüm önizlemesi → manuel veriyi koruyan tek işlem. Arşiv yeni eklemeyi kapatır, mevcut sürümü okumayı kapatmaz. Kullanılan sürüm fiziksel silinmez.

OpenAPI belge, sürümlü hata zarfı, capability ve örnek request/response'lar her endpoint ile birlikte yazılır; son aşamaya bırakılmaz.

## 10. Geliştirme aşamaları ve çıkış koşulları

### Hazırlık — plan ve görsel taslak

Bu tur: orijinal metin, mimari, sözleşmeler ve kabul planı. Sonraki adım: SSS örneğiyle editörün görsel taslağı; tasarım modu, içerik modu ve kayıt durumları. Ardından yeni Git deposu ve çalışma alanı iskeleti kurulur; sürüm/lisans kontrolleri yeniden yapılır.

### Aşama 1 — oluştur, alan tanımla, kaydet ve yeniden aç

1. [x] Contracts/çekirdek ve document validator; command/transaction/history temeli.
2. [x] Embed giriş noktası, Vue kabuk, GrapesJS bridge, cleanup ve Go'suz bellek adapter örneği.
3. [x] Go belge/katalog API'si, SQLite migration'ı, revision kontrolü ve OpenAPI.
4. [x] Section/container, responsive satır/sütun, başlık, metin, görsel, link/button, details/summary, listeli/repeater yapı taşları.
5. [x] İki mod, seçim/breadcrumb, görsel alan eşleme, alan tipleri, min/max ve validation.
6. [x] Çoklu bağımsız repeater; ekle/sil/kopyala/sırala ve tek işlem undo/redo.
7. [x] Tasarlanan bloğu katalogda saklama; birbirinden bağımsız FAQ/banner örnekleri; Vue ve normal HTML başlangıç örnekleri.

Çıkış: FAQ belgesi üç soru ve kararlı item kimlikleriyle Go API'ye kaydedildi; server süreci kapatılıp aynı SQLite dosyasıyla yeniden açıldı; belge revision 1 olarak ve aynı soru sırasıyla geri yüklendi. Repeater/örnek bağımsızlığı çekirdek testlerinde, aynı sayfadaki bağımsız editörler ESM yaşam döngüsü kabulinde doğrulandı. Statik export kabulü Aşama 2'de tamamlandı.

### Aşama 2 — import, önizleme ve statik çıktı

1. [x] HTML metin/dosya alımı, script/event handler/tehlikeli URL temizliği, section/article aday listesi ve sandbox iframe preview.
2. [x] PostCSS AST ile selector kapsamı, responsive at-rule'lar, keyframe namespace'i ve bağıl URL çözümü var. Ortak CSS/style URL manifest'i kaydedilip export'a taşınıyor; uygun MIME, CORS ve boyut sınırlarını geçen görsel/font/stylesheet kaynakları paketleniyor. Erişilemeyen URL ve CSS `@import` issue olarak kalır.
3. [x] Korunan, çıkarılan, çözümlenemeyen ve desteklenmeyen import bulguları; tasarım sistemi manifest izolasyonu ve export issue listesine aktarılıyor. Import ve export varlık davranışı fixture testleriyle doğrulandı.
4. [x] Aynı source resolver ile preview ve statik HTML/CSS/JS üretiliyor; FAQ export'u ayrı HTTP kökeninde açılıp accordion davranışı doğrulandı. Eksik alt metin, CORS ve desteklenmeyen varlıklar raporlanıyor.
5. [x] Güvenilir davranış registry'si: selector ile HTML kök yapısı, güvenilir CSS/statik JS bağımlılığı, mount/update/destroy ve canvas cleanup; hazır slider aynı sözleşmeyi kullanıyor. Önizlemede iki slider'ın bağımsız ilerlemesi tarayıcıda doğrulandı.

Çıkış: Aşama 1 FAQ belgesini statik paket olarak aç; tasarım, responsive düzen ve akordiyon çalışsın. Slider değişince runtime doğru güncellensin. CSS/font/animation/runtime bağımlılıkları çıktıdayken UI CSS'i ve editör runtime'ı çıktıdan dışarıda kalsın. Kullanıcı script'leri çalışmasın.

### Aşama 3 — kaynaklar ve özel backend

1. [x] Provider capability/schema keşfi, arama, kayıt/grup seçimi, sıralama ve otomatik sorgu.
2. [x] Blok/alan/repeater hedef bağlama, backend alan eşleme ve type doğrulama.
3. [x] Manuel taslağı koruyan mod değişimi; hata, silinmiş kayıt ve eksik alan durumları.
4. [x] Go demo provider ve kart listesi; FAQ soruları/slider slaytları için provider örnekleri.
5. [x] Go endpoint yapısını paylaşmayan özel Storage/Library/Provider adapter örneği.

Çıkış: başlık manuel, FAQ listesi kaynaktan; manuel → kayıt → sorgu → manuel geçişinde eski manuel veri geri gelir. Query sonuçları manuel kayda dönüşmez. Özel adapter ile Go sunucusu olmadan aynı editör çalışır.

### Aşama 4 — şablonlar, yaşam döngüsü ve dağıtım

1. [x] Sürümlü header/footer, içerik modunda düzenlenebilir alanlar, tasarım modunda yeni bölge sürümü, archive, template slot'ları, izin verilen kategori ve zorunlu blok policy editörü ve uygulama kuralları var.
2. [x] Şablondan sayfa oluşturma, kilitli bölgeler ve compatible key'leri koruyan explicit region version migration.
3. [x] Blok/bölge sürüm archive/upgrade UI'si, şema farkı ve migration preview, referans kontrollü silme, Go transaction testleri mevcut.
4. [x] ESM/IIFE/CSS paketleri; install, embed, adapter/provider, migration, uyumluluk ve lisans belgeleri. ESM browser ve lifecycle kabul sayfaları çalışır.
5. [x] README, `.env.example`, OpenAPI, dört hazır blok, npm/Go üçüncü taraf bildirimleri ve bundle bütçe denetimi tamamlandı.

Çıkış: yeni sürüm eski sayfayı değiştirmez; uyumsuz geçiş açıkça gösterilir; archive edilmiş örnek açılır; kullanılan sürüm silinmez. Temiz ortamda README komutlarıyla kurulum ve iki gömme örneği çalışır.

## 11. Doğrulama planı

Çekirdek için anlamlı unit/integration kontrolleri, repository/API için Go testleri, kullanıcı akışı için tarayıcı acceptance kontrolleri önerilir. Kesin araç sürümleri uygulama başlangıcında seçilir. Sırf uygulamayı taklit eden test yazılmaz.

| Kontrol | Kanıt | Aşama |
| --- | --- | --- |
| Zarf ve motor uyumluluğu | Geçerli/geçersiz fixture; ileri documentVersion reddi ve migration'ın orijinali koruması | 1, 4 |
| Tek içerik kaynağı | Panel → tuval → kayıt → yeniden açma; tuval → panel değişikliği ve tek undo | 1 |
| Kalıcı kayıt ve revision | Server restart; iki paralel beklenen revision'dan yalnızca biri başarılı | 1 |
| Repeater | Kararlı kimlik, sıra, iki liste, copy IDREF dönüşümü, min/max, undo/redo | 1 |
| Alan eşleme taslağı | Başka öğe seçme ve geri dönmede form verisi korunur | 1 |
| Çoklu örnek ve cleanup | İki FAQ/iki editör; mount/destroy tekrarında iframe/listener/runtime kaynağı kalmaz | 1, 2 |
| Import güvenliği ve CSS | Script/event/URL corpus; karmaşık selector/at-rule/font/keyframe fixture'ları | 2 |
| Export/preview eşliği | Aynı resolved snapshot içerik ve dependency manifest'i; statik paket tarayıcıda çalışır | 2 |
| Slider | İki bağımsız instance, repeater güncellemesi, klavye ve cleanup | 2 |
| Kaynaklar | Manuel taslak geri dönüşü, ordered kayıtlar, iptal/eski response, eksik alan/kayıt ve timeout | 3 |
| Version/archive/delete | Explicit upgrade, uyumsuz schema, arşivli okuma ve referanslı silme transaction'ı | 4 |
| Template ve tasarım sistemi | Kilitli slot; zorunlu/izinli bloklar; diğer sistemin CSS/verisinin değişmemesi | 2, 4 |
| Scroll ve erişim | Uzun panel ve uzun tuval; farklı viewport; focus, label, klavye reorder | Her UI aşaması |
| Dağıtım | Temiz kurulum; Vue ve normal HTML build; özel backend; üçüncü taraf bildirimleri | 4 |

Ana kabul akışı Aşama 2 sonunda bütün olarak tekrar yürütülür: boş tuval → iki sütun → sol başlık/açıklama → sağ akordiyon → soru/yanıt repeater → katalogda blok → örnek sayfada üç soru → kaydet/yeniden aç → statik paketi tarayıcıda aç → tasarım ve akordiyonu doğrula.

Her aşama raporu üç şey söyler: gerçekten çalışan akışlar, çalıştırılan kontrol ve sonucu, kalan gerçek sınırlamalar. Henüz uygulanmamış alanlar “tamamlandı” işaretlenmez.

## 12. Kapsam izleme ve açık kararlar

| Orijinal istek bölümü | Plandaki karşılığı |
| --- | --- |
| 1. Teknoloji/mimari | §2, §3, §5 |
| 2. Backend bağımsızlığı | §2, §5, §9 ve sözleşmeler |
| 3. Veri modeli | §4 ve sözleşmeler |
| 4. Düzenleme modları | §6 |
| 5. Görsel yapı taşları | §10 / Aşama 1 |
| 6. HTML/CSS import | §7, Aşama 2 |
| 7. Alan/repeater | §4, §6, Aşama 1 |
| 8. İçerik kaynakları | §8, Aşama 3 |
| 9. Preview/export | §8, Aşama 2 |
| 10. Sürüm/archive/kayıt | §9, Aşama 1 ve 4 |
| 11. Kullanım örnekleri | Aşama çıkış koşulları ve §11 |
| 12. Teslimat/kabul | §10 ve §11 |

Ürün adı ve paket adlandırması `BlockDesign` / `@blockdesign/*` / `@blockdesign/editor` olarak karara bağlandı. Lisans bildirimi `BlockDesign contributors` olarak sabit; gerçek bir kişi/şirket telif sahibi sonradan belirlenirse kamuya açık yayından önce güncellenir. Responsive doğrulama Codex In-app Browser'da varsayılan 1233×892 masaüstü ile 320, 375 ve 768px görünüm genişliklerinde yapıldı. Kapsam bu doğrulanan tarayıcı yüzeyiyle sınırlıdır. ESM, vanilla ve CSS ölçüm bütçeleri aşağıda kayıtlıdır.

## 13. Geliştirme durumu

- [x] Bağımsız proje deposu, orijinal istek, mimari, sözleşmeler, OpenAPI ve MIT lisansı eklendi.
- [x] Vue 3/TypeScript/Vite editörü, GrapesJS core, public `mountEditor`/idempotent `destroy`, ESM ve vanilla IIFE/CSS dağıtım çıktıları hazırlandı.
- [x] Go HTTP/application/SQLite katmanları belge, blok, şablon, paylaşılan bölge, tasarım sistemi manifest'i, provider ve medya API'lerini uygular; revision compare-and-swap, migration, referans denetimi ve restart kalıcılığı testlidir.
- [x] FAQ/banner/cards/slider blokları, repeaters, canonical alanlar, block/field/repeater source binding, demo sorgu/group provider, template policy ve region/schema migration preview tamamlandı.
- [x] HTML/CSS import güvenliği ve issue raporu; statik export; uygun MIME/CORS/boyut koşullarındaki görsel/font/stylesheet paketleme ve erişilebilirlik uyarıları tamamlandı.
- [x] Özel backend adapter, ESM/vanilla entegrasyon örnekleri, README ve npm/Go üçüncü taraf lisans metinleri hazırlandı.
- [x] Çoklu dil sözleşmeleri, v1/v2 belge migrasyonu, locale taşıyan kaynak adapter'ları, host sayfa varyantı akışı, TR/EN demo verisi ve entegrasyon örnekleri eklendi. İngilizce UI sözlüğü temel panellerle sınırlı; kalan arayüz çevirisi ve RTL görsel doğrulaması açık.
- [x] `npm run typecheck`, `npm test`, `npm run build:all`, `npm run measure:bundle` ve `cd server && go test ./...` başarılı.
- [x] Browser acceptance: FAQ export'u bağımsız HTTP kökeninde açıldı; ESM örneği başladı; iki embed aynı sayfada bağımsız mount oldu ve tek tek destroy edildi; API ile kaydedilen belge yenileme sonrasında yüklendi; demo 320/375/768px responsive ölçülerinde yatay taşma vermedi.

12 Ekim 2026 geliştirmesi açık alt liste şemalarıyla en fazla 8 düzey repeater destekler; içe aktarılan keyfi JavaScript çalıştırılmaz. Export, CORS ile okunamayan uzak kaynakları ve CSS `@import` zincirlerini güvenle inline edemez; bunlar issue olarak görünür ve kısmi çıktıda URL olarak kalabilir. Çoklu dil kaynak ve yayın akışı için bundle bütçeleri güncellendi: ESM giriş 3.2 KiB ham, demo JS 430 KiB gzip, ESM toplamı 456 KiB, ESM en büyük parça 335 KiB, vanilla runtime 414 KiB, CSS 25 KiB (demo) ve 22 KiB (embed). Responsive demo en az 320 CSS piksel genişliğini destekler. Bu destek iddiası yalnızca burada doğrulanan Codex In-app Browser içindir; Firefox, Safari ve mobil cihaz motorları doğrulanmamıştır.

## 14. Doğrulama sonuçları

- `npm test`: 39 test başarılı (core 13, adapters 18, GrapesJS bridge 6, editor export assets 2); test başarısızlığı yok.
- `npm run typecheck`: başarılı (core, bridge, editor, demo ve custom backend örneği).
- Çoklu dil değişikliklerinden sonra `npm run typecheck`: başarılı (core, bridge, editor, demo ve custom backend örneği).
- `npm run build:all`: demo, ESM ve vanilla paketleri başarılı.
- Çoklu dil değişiklikleriyle `npm run build:all` başarılı. Son ölçüm: demo JS 427.0 KiB gzip, demo CSS 24.6 KiB; ESM giriş 3.1 KiB ham, ESM toplamı 452.9 KiB gzip (en büyük parça 310.6 KiB); vanilla JS 410.8 KiB gzip, CSS 21.9 KiB. `scripts/measure-bundles.mjs` bütçeleri bu ölçümlere küçük pay bırakacak şekilde güncellendi.
- `cd server && go test ./...`: application, httpapi ve repository paket testleri başarılı; SQLite migration/restart ve revision testleri dahil.
- Browser source test: demo FAQ provider'ı `category=Başlangıç` sorgusunda iki kaydı çözdü; preview yalnızca bu iki kaydı alfabetik sırayla gösterdi ve kaydedilmiş manuel taslak ayrı kaldı.
- Browser field-source test: FAQ başlığı bir seçili demo kaydının `title` alanına eşlendi ve preview'da güncellendi; düzenleme tuvaline dönünce kaydedilmiş manuel başlık özgün değerinde kaldı.
- Browser group test: FAQ repeater'ında “Başlangıç soruları” grubu seçildi; preview'da sıralı iki kayıt gösterildi. Demo provider için grup + tekil kayıt birleştirme core test'i var.
- Browser slider test: aynı sayfaya iki ayrı slider yerleştirildi. İlk Sonraki slayt düğmesine basınca sayaçlar `1/2, 1/2` durumundan `2/2, 1/2` durumuna; ikinci slider ilerletilince `2/2, 2/2` durumuna geçti. Son behavior plugin kodu ile mount/update/cleanup akışı tarayıcıda tekrar denendi.
- Browser template test: Studio template header/footer ve content slot'u gösterdi; blok content slot'una sürüklenebildi; iki shared-region referansı belgeye eklendi. Bölge sürümü değiştirme ve kilit metadata'sı bu dilimde çekirdek testinde doğrulandı.
- Browser field test: header seçildi ve `Marka adı` `Northstar Studio` yapıldı; panel ile iframe aynı değeri gösterdi. Bu doğrulama stale GrapesJS snapshot'ının canonical alan değerini ezmemesini kapsıyor.
- Browser preview test: iframe belge yüklemesinden sonra event listener yaşayan frame'e yeniden bağlandı; FAQ sorusu önizlemede açılıp kapandı ve yanıt görünür oldu. GrapesJS'in iframe dışı `Element` tür kontrolünün frame düğümlerini elemediğini doğrulayan üç regresyon testi eklendi.
- Static export: indirilmiş `blockdesign-page.html` ayrı `http://127.0.0.1` kökeninde açıldı; üç SSS sorusu render oldu, accordion mouse ve Enter ile açılıp kapandı. Export issue raporunda paketlenemeyen URL'ler ve alt metin eksikleri tutulur.
- ESM: doğrudan browser integration sayfası ESM/CSS dağıtım paketini yükledi. Lifecycle kabul sayfası aynı anda iki editörü başlattı, mobil panel `aria-controls` hedeflerinin örnekler arasında benzersiz olduğunu, ilk destroy'ın ikincinin belge API'sini etkilemediğini ve bütün root'ların son destroy'dan sonra temizlendiğini doğruladı.
- Responsive: Codex In-app Browser'da varsayılan 1233×892 masaüstü ve 320–1233px arasındaki örnek genişliklerle 640/641, 820/821, 1080/1081px kırılma noktaları kontrol edildi. Belge yatay taşmadı; dar üç sütun eşiği 641px'te düzeltildi. Mobil Bloklar ve Özellikler düğmeleri çekmeceleri açıp kapattı; 320px üst araç çubuğunda taşma ve konsol hatası yoktu. Demo kökünün minimum genişliği 320px'e indirildi.
- Go: document revision 1 HTTP API üzerinden kaydedildi ve tarayıcı yenilemesinden sonra yüklendi; SQLite repository restart testi `go test ./...` içinde geçti. Block archive, provider capability, template/region revision, referanslı silme ve migration route testleri Go testlerinde başarılı.
- `npx prettier docs/openapi.yaml --check`: başarılı; YAML/OpenAPI belgesi biçim denetiminden geçti.

İlk görsel yön kullanıcı tarafından seçildi ve [DESIGN.md](../DESIGN.md) dosyasında kaydedildi. Seçilen üç panelli tuval merkezli çalışma alanı mevcut uygulama ekranında kullanılıyor.
