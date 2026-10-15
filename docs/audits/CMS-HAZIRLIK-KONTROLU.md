# CMS bağlantısı öncesi kontrol

15 Ekim 2026 · Yerel BlockDesign kurulumu

Yerel veri/kaynak eşleme ve test edilen arayüz akışları doğrulandı. Bu rapor gerçek bir harici CMS’nin, kullanıcı yetkilerinin veya üretim form kayıt servisinin test edildiği anlamına gelmez.

## Kapsam ve sonuç

| Kontrol | Sonuç |
|---|---|
| 32 aktarılmış Türkçe sayfa ve 1 mevcut çalışma belgesi | 33 belgenin referansları, alanları ve ortak bölge listeleri geçerli |
| HTML hedefleri | 1.150 bağlantı, 138 görsel referansı; eksik yerel dosya, bozuk sayfa içi hedef, yinelenen HTML ID veya eksik ARIA hedefi bulunmadı |
| Form bağlantıları | 8 bağlantının sürümlü örnek JSON şemaları mevcut |
| CMS menü kayıtları | 4 kayıt SQLite `cms_menus` tablosundan okunuyor |
| Menü seçici | Footer veri kaynağında ID 4 seçimi ve alan eşlemeleri görüldü |
| Header/hamburger/alt menü | Tuvalde ve bağımsız HTML çıktısında açma/kapama; Escape ile kapatma doğrulandı |
| Kaynak kesintisi | Eksik sağlayıcı hata üretiyor; manuel belge değişmiyor |
| Sürüm izolasyonu | İlgisiz/arşivli bölge sürümleri sayfayı bloke etmiyor; eksik sabitlenmiş bölge raporlanıyor |
| Yayın çıktısı | Doğru header/footer öğeleri ve CMS alt menüleri dışa aktarılan HTML’de mevcut |

Sayısal taramanın ham çıktısı: [cms-readiness.json](cms-readiness.json). Bağlantı sayıları tekrarları içerir. Bu tarama yerel dosya ve HTML hedeflerini doğrular; internetteki her dış bağlantının erişilebilirliğini veya tüm tarayıcı motorlarını kapsamaz.

## Düzeltilenler

1. **Menülerin CMS kaydına bağlı olmaması.** Header/footer artık koleksiyon ve menü ID’siyle bağlanıyor. ID 1 header/hamburger; ID 2 hizmetler; ID 3 kurumsal; ID 4 yasal bağlantılar.
2. **Runtime’ın menü içeriği üretmesi.** Kod içindeki sabit tur alt menüsü, B2B ve belge alanı eklemeleri kaldırıldı. B2B gerçek menü kaydına taşındı; açılan alt menüler CMS `children` listesinden geliyor.
3. **İlgisiz ortak bölge sürümlerinin çözülmesi.** Kaynak çözümleme sayfanın sabitlediği bölge sürümleriyle sınırlandı. Eksik sürüm artık açık kaynak hatasıdır.
4. **Ortak bölge CMS verisinin düzenleme tuvalinde yenilenmemesi.** Header/footer kaynakları da geçici tuval projeksiyonunda çözülüyor; eski async yanıtlar yeni belgeyi ezmiyor.
5. **Kaynak değerlerinde eksik alan doğrulaması.** CMS değerleri mevcut alan doğrulamasından geçiriliyor; uygunsuz URL’ler ve sınır dışı değerler hata veriyor. Telefon bağlantıları desteklendi.
6. **Yanıltıcı demo fallback’i.** Aktif çalışma alanındaki içerik sağlayıcısı için demo verisine sessiz geçiş kaldırıldı.
7. **Yayımlanmamış dil yolları.** Türkçe örnekteki göreli EN/ES seçenekleri kaldırıldı. CMS yayımlanmış dil/URL kayıtlarını daha sonra sağlayabilir.
8. **Yeni alt menü şemasının manuel taslak uyumu.** Geçişte eksik boş alt listeler tamamlandı; ortak bölge doğrulama hataları giderildi. Eski bölge ve şablon sürümleri arşivde kaldı.
9. **HTML importer’ın başlangıç paketine gereksiz alınması.** Sabit tasarım sistemi referansı ayrıldı; importer artık gerçekten gerektiğinde yükleniyor.
10. **Menü seçilmişken “0 kayıt seçili” denmesi.** Grup seçimi ile tekil kayıt sayısı ayrıldı; seçilen grubun öğelerinin CMS’den geldiği açıkça yazıyor.

## Çalıştırılan doğrulamalar

- `npm run typecheck`
- `npm test`
- Go 1.27.2 ile `go test ./...`
- `npm run build:all`
- `npm run measure:bundle`
- `node --experimental-strip-types scripts/audit-cms.mjs`
- Tarayıcıda `cms-acceptance.html`: **4/4 geçti** — veritabanı menü ID’si, kaynak hatası, gerçek HTML ve hamburger/alt menü testleri
- Tarayıcıda `forms-acceptance.html`: **7/7 geçti** — form doğrulama, preview izolasyonu, tekrar gönderim, bağımlı seçenekler, destroy, export ve belgeye ziyaretçi verisi sızmaması

Demo JavaScript ölçümü 457,6 KiB gzip; menü bağlama ve ortak bölge çözümleme ekleri için demo bütçesi 459 KiB oldu. SDK giriş ve runtime bütçeleri değişmedi. Tasarım dedektörünün değişen hedeflerdeki sonucu boş listeydi; bu kapsamlı erişilebilirlik sertifikası değildir.

## Gerçek CMS’de tamamlanacak doğrulama

15 Ekim ek kontrolünde CMS kimlik çakışması, alt menü alan eşleme önceliği ve hamburgerin Escape sonrası odak dönüşü düzeltildi. Tam test/derleme/bütçe ve tarayıcı kabul testleri tekrar geçti. Güncel demo ölçümü 457,7 KiB gzip. Ayrıntılar: [Diğer CMS modelleri ve menü bağlantı kontrolü](DIGER-CMS-MENU-KARSILASTIRMASI.md).

- Menülerin CMS’nin kendi veritabanı modeli, kayıt sırası, dil ve site/tenant filtresiyle eşlenmesi. [Menü entegrasyon sözleşmesi](../CMS-MENU-ENTEGRASYONU.md).
- Örnek form JSON’larının gerçek CMS form kayıtlarına bağlanması; gerçek gönderim ve sunucu doğrulaması. Mevcut önizleme göndermez; bağımsız örnek çıktıda yayın endpoint’i olmaması görünür uyarıdır.
- Blog sağlayıcısındaki yerel örnek verilerin gerçek CMS kayıtlarıyla değiştirilmesi.
- CMS’nin oturum, yetki, CSRF ve yayın kurallarının uygulanması. Yerel Go referansı loopback üzerinde çalışan bir örnektir; üretim yetkilendirmesi içermez.
- Üretim sayfa URL’lerinin CMS’den verilmesi. Yerel `/scalanova-tour/...` yolları kaynak HTML örnekleridir.
- Laravel/Filament örneğinin gerçek Laravel projesinde çalıştırılması. Bu makinede PHP/Composer olmadığı için bu entegrasyon çalıştırılarak doğrulanmadı.

## Veri koruma

Geçişlerden önce `.tools/backups/before-cms-navigation-*.sqlite` yedekleri alındı ve SQLite bütünlüğü doğrulandı. Yeni header/footer sürümü `1.1.0`, güncel şablonlar `1.3.0`. Sayfaların menü dışındaki içerikleri ve mevcut çalışma belgesi korundu. Eski açık sekmelerin yeni revizyonların üzerine yazmasını optimistic concurrency kontrolü engeller; güncel bağlantıları görmek için eski sekmeler yenilenmelidir.
