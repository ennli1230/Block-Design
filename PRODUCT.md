# BlockDesign — ürün bağlamı

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Kullanıcı tarafından belirlenen teknoloji: Vue 3, TypeScript, Vite, GrapesJS açık kaynak core; Go referans API; repository arkasında SQLite. Studio SDK kullanılmaz. Teknoloji ayrıntıları ve tarihli sürüm araştırması [planda](docs/PLAN.md) tutulur.

## Users

- Tasarımcı: sıfırdan veya kendi HTML/CSS tasarımlarından düzenlenebilir bloklar oluşturur; alan, repeater ve izin verilen stilleri tanımlar.
- İçerik düzenleyen kişi: korunan tasarımın alanlarını doldurur; listeleri ve içerik bağlantılarını yönetir.
- Entegratör: editörü Vue veya normal HTML uygulamasına ekler; kendi backend ve kimlik doğrulama istemcisini adapter üzerinden bağlar.

Bu ayrım kullanıcı/rol sistemine dönüştürülmez; editör modu ve yapılandırmasıyla uygulanır.

## Product Purpose

Bağımsız ve açık kaynak paylaşılabilir görsel blok ve sayfa tasarım editörü. Amaç, tasarımcıya ait HTML/CSS yapılarından yönetilebilir bloklar üretmek ve bunları sayfalarda tekrar kullanmaktır. CMS veya yönetim paneli kapsamda değildir.

## Positioning

Editör backend modellerinden bağımsız sözleşmeler kullanır. İçerik formu, görsel tuval, önizleme ve export ortak belge ve alan eşleme mantığına dayanır. Go yalnızca referans uygulamadır; editörün çalışması için zorunlu değildir.

## Operating Context

- Yeni ve bağımsız çalışma klasörü: `C:/Users/Pc/Desktop/BlockDesign`.
- İlk incelemede klasör boştu ve Git deposu yoktu. Başka projeden kod, veritabanı veya iş kuralı alınmaz.
- İlk ana akış: iki sütunlu SSS oluşturma, alan ve repeater tanımlama, blok olarak kaydetme, sayfada üç soruyla kullanma, yeniden açma ve çalışan statik akordiyon çıktısı.
- Diğer örnekler: banner, slider, kart listesi, ayrı tasarım sistemi ve header/footer içeren sayfa şablonu.
- Yerel referans sunucusu varsayılan olarak yalnızca localhost üzerinden çalışır.

## Capabilities and Constraints

- `mountEditor(element, options)` ile gömme ve tüm kaynakları temizleyen `destroy`.
- Blok tasarlama ve içerik düzenleme modları.
- Manuel içerik, kayıt seçimi ve sağlayıcı capability bilgileriyle sınırlı otomatik sorgu.
- Sürüme bağlı bloklar ve paylaşılan bölgeler; revision ile kaydetme çakışması kontrolü.
- Tasarım sistemine ait ortak varlıklar ve izole blok stilleri.
- Güvenli HTML/CSS import; kullanıcı script'i, event handler ve `javascript:` adresi çalıştırılmaz.
- Yapay zekâ olmadan tam çalışma; AI önerisi ancak dört aşamadan sonra isteğe bağlı olabilir.
- Tam kapsamın değişmez başvuru metni: [docs/ISTEK.md](docs/ISTEK.md).

## Evidence on Hand

Responsive denetiminde ana editör 320, 375 ve 768 CSS piksel genişliklerinde ve 1233×892 varsayılan masaüstü görünümünde yatay taşma olmadan açıldı; mobil Bloklar ve Özellikler düğmeleri iki çekmeceyi de açıp kapatıyor. Bu çalışma alanında doğrulanan tarayıcı Codex In-app Browser'dır; Firefox, Safari ve mobil cihaz motorları için uyumluluk iddiası yoktur.

Tarayıcı kabulü `mountEditor`, üç panelli Vue/GrapesJS tuvalini, alan eşlemeyi, repeater'ı, FAQ önizlemesini, kaynak seçimi/sorgusunu, bağımsız slider'ları, şablon ve paylaşılan bölge akışlarını kapsıyor. Dört hazır blok (FAQ, banner, kartlar, slider), blok/alan/liste kaynak bağları, sürüm şema farkı ve geçiş önizlemesi, şablon izin/zorunlu blok politikası, Go tasarım varlığı manifest'i ve güvenli görsel varlık API'si uygulanmıştır. Go 1.27.2 ile tüm Go testleri çalıştı; API üzerinden belge rev 1 olarak kaydedilip tarayıcı yenilemesinden sonra geri yüklendi. Ayrı HTTP kökeninde statik FAQ çıktısı ve ESM embed ile iki editörün bağımsız mount/destroy yaşam döngüsü doğrulandı. HTML/CSS import aday seçimi, güvenli temizleme ve PostCSS kapsamı testli; desteklenmeyen içe aktarma yapıları raporlanıyor.

## Product Principles

1. İçerik için tek doğruluk kaynağı; diğer temsiller bu kaynaktan türetilir.
2. Adapter üzerinden entegrasyon; backend iş modelleri çekirdeğe sızmaz.
3. Düzenlenebilir alanlar açıkça tanımlanır; içerik modu tasarım yapısını korur.
4. Sürüm ve kaynak değişiklikleri kullanıcı verisini sessizce ezmez.
5. Tamamlanmış özellik iddiası çalışan kabul akışı ve doğrulama kanıtı gerektirir.

## Confirmed Planning Preferences

11 Ekim 2026 tarihli kullanıcı yanıtları:

- “MIT önerisiyle planla.” Proje [MIT lisansı](LICENSE) ile yayımlanacak şekilde hazırlandı.
- “Önce görsel taslak hazırlayalım.” Uygulama kodundan önce editörün görsel taslağı hazırlanıp incelenecek.
- İlk çalışan taslak görüldükten sonra kullanıcı üç panelli stüdyo çalışma tezgâhı kompozisyonunu seçti.
- Proje adı `BlockDesign`, çalışma alanı paket kapsamı `@blockdesign/*`, gömülebilir editör paketinin hedef adı `@blockdesign/editor` olarak sabitlendi. Kök npm workspace özel kalır; paket yayını etkinleştirilmedi.
- MIT lisansındaki mevcut kolektif bildirim `Copyright (c) 2026 BlockDesign contributors` olarak korunur; kişi veya şirket adı verilmediği için tüzel hak sahibi varsayılmaz.

## Release Boundary

İlk doğrulama tabanı Codex In-app Browser ve 320px ve üzeri görünüm genişlikleridir. Diğer motorlar kapsama alınana kadar destek iddiası yapılmaz. Npm yayını açılmadan önce `@blockdesign` registry erişimi, derlenmiş paket girişleri ve lisans sahibi bilgisi yayın denetiminde doğrulanır.
