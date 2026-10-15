# Diğer CMS modelleri ve menü bağlantı kontrolü

15 Ekim 2026

Bu çalışma resmi belgelerin karşılaştırılması ve BlockDesign sözleşmesinin yerel testidir. WordPress, Drupal veya Strapi sunucusuna canlı bağlantı kurulmadı.

## Modellerin karşılaştırılması

| Sistem | Kaynak model | BlockDesign’a dönüşüm |
|---|---|---|
| WordPress | Menü ID/slug/adı ile öğeler alınır; sıra `menu_order`, üst öğe `menu_item_parent` ile ifade edilir | CMS backend’i düz kayıtları sıralı ağaca çevirir; başlık → `label`, adres → `url`, alt öğeler → `children` |
| Drupal | Menü adı ve `MenuTreeParameters` ile ağaç yüklenir | CMS backend’i erişim ve sıralama dönüşümlerini uyguladıktan sonra izin verilen ağacı sağlar |
| Strapi 5 | Menü için tanımlanan içerik tipi ve alt öğe ilişkileri | Document Service üzerinden gereken ilişkiler açıkça populate edilir; yayın/dil/yetki kuralları host tarafından uygulanır |
| Kendi Laravel CMS’in | Var olan `menus` / `menu_items` modeli veya eşdeğeri | Seçilen menü kaydı sıralı öğelere dönüştürülür; editör tablo yapısını veya SQL’i bilmez |

Kaynaklar:

- [WordPress: wp_get_nav_menu_items](https://developer.wordpress.org/reference/functions/wp_get_nav_menu_items/) — ID/slug/adı, sıralama ve yayın durumuna ilişkin sözleşme.
- [WordPress: Navigation Menus](https://developer.wordpress.org/themes/classic-themes/functionality/navigation-menus/) — header/footer gibi konumlara menü atama.
- [Drupal: MenuLinkTree::load](https://api.drupal.org/api/drupal/core!lib!Drupal!Core!Menu!MenuLinkTree.php/function/MenuLinkTree::load/11.x) — `load()` tek başına erişim/sıralama kontrolü yapmaz; transform aşaması gerekir.
- [Strapi 5: Document Service populate](https://docs.strapi.io/cms/api/document-service/populate) — ilişkilerin açıkça yüklenmesi gerekir.

Bu modellerden çıkan entegrasyon sonucu: editörün her CMS için tablo veya URL bilmesi yerine, host adapter’ın veriyi ortak kayıt/ağaç sözleşmesine çevirmesi gerekir. Bu, mevcut adapter sınırımızla uyumludur; otomatik olarak her CMS’ye hazır bir connector sağlandığı anlamına gelmez.

## Bizdeki header / hamburger / footer akışı

1. Header bölgesinin kaynak bağı `cms-menus` koleksiyonunda `groupRef: "1"` kaydını seçer.
2. Kayıt çözümleyicisi CMS backend’inden sıralı öğeleri alır. Yerel host bunları SQLite `cms_menus` tablosundan okur.
3. `label` metne, `url` bağlantıya, `children` alt menü listesine eşlenir.
4. Header ve hamburger ayrı veri kopyaları değildir: aynı HTML menüsü ekran genişliğine göre yatay veya açılır panel olarak gösterilir.
5. Davranış kodu yalnızca açık/kapalı durumu, ARIA ilişkileri ve klavyeyi yönetir. Menü öğesi eklemez.
6. Footer sütunları bağımsız olarak ID `2`, `3`, `4` kayıtlarına bağlıdır. Bunlar örnek kurulumun seçimleridir; core belirli ID’leri şart koşmaz.
7. Statik HTML yayınlanırken kaynaklar çözülür ve menü HTML’e yazılır. Sonraki veritabanı değişikliği statik çıktıya ancak yeniden yayınlandığında yansır.

SDK iç içe liste şemalarını destekler; mevcut Scala Nova header tasarımı ana menü + bir alt menü düzeyi içerir. Üçüncü ve daha derin düzeyler için tasarımda karşılık gelen iç içe liste şeması ve açma/kapama davranışı tanımlanmalıdır. Daha derin ağaç var diye mevcut HTML’in otomatik olarak sınırsız mega menüye dönüşeceği varsayılmamalıdır.

## Yeni regresyon testleri ve düzeltmeler

### Farklı CMS kimliklerinin çakışması

`42/a` ile `42?a` kimlikleri eskiden aynı `42-a` parçasına dönüşüyordu. Bu, render edilen liste öğelerinde yinelenen kimlik üretiyordu. Noktalama karakterleri ve kimlik ayırıcıları artık kayıpsız kaçışlanıyor. Manuel kayıt kimlikleri değiştirilmez; geçici kaynak öğelerinin kimlikleri kayıpsız türetilir.

### Alt menü için özel alan eşlemesinin ezilmesi

Üst öğe `title/permalink`, alt öğe `child_title/child_url` kullanıyorsa `children.label` ve `children.url` eşlemeleri üst öğenin kısa alan eşlemesi tarafından gölgeleniyordu. Tam alt liste yolu artık kısa yaprak alan adından öncelikli. Hem liste düzeyindeki hem tüm blok düzeyindeki bağlantı test edildi.

### Hamburger kapanınca klavye odağının gizli içerikte kalması

Escape ile hamburger kapanırken odak menü içinde kalıyordu. Menü kapatılınca odağın hamburger düğmesine geri dönmesi sağlandı ve bağımsız HTML kabul testine bu kontrol eklendi.

### Diğer senaryolar

- `database-menu-999` gibi farklı menü kimlikleri seçilebiliyor; core yalnızca ID 1–4 için çalışmıyor.
- CMS boş menü döndürdüğünde tasarımdaki örnek öğeler kaldırılıyor.
- CMS’nin verdiği öğe sırası korunuyor.
- Manuel belge, kaynak çözümleme sırasında değişmiyor.
- Eksik sağlayıcı, bozuk URL, eksik sabitlenmiş bölge sürümü ve ilgisiz arşivli bölge senaryoları hata izolasyonunu koruyor.

Test dosyası: `packages/core/src/cms-navigation.test.js`. Tarayıcıda bağımsız header/footer HTML’i ve form izolasyonu ayrıca kabul testlerinden geçirilir.

## Son doğrulama sonuçları

- Menü regresyon testleri: **5/5 geçti**.
- Tarayıcı CMS kabul testleri: **4/4 geçti**; Escape sonrası odağın hamburger düğmesine dönmesi dahil.
- Tarayıcı form kabul testleri: **7/7 geçti**.
- Tam `npm test`, TypeScript kontrolü, tüm paketlerin derlenmesi ve bundle bütçeleri geçti.
- Belge denetimi: **33 belge, 1.150 bağlantı, 138 görsel ve 8 form**; denetim kapsamında hata veya uyarı yok.
- Demo JavaScript: **457,7 KiB gzip**, 459 KiB bütçe içinde.

Tarayıcı test kanıtı: [CMS kabul testleri](../../exports/cms-cross-cms-tests.png). Bu sonuçlar yerel host ve ortak sözleşmeyi doğrular; gerçek CMS kurulumunda yetki, dil, yayın durumu ve form gönderimi ayrıca sınanmalıdır.
