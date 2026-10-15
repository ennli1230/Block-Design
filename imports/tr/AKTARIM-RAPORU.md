# TR aktarım raporu

14 Ekim 2026 · `system.scalanova-tr@1.0.0` · aktarım sürümü 7

Eski çalışma alanı yedeklenip sıfırlandı. 32 Türkçe sayfa, 41 blok, 6 şablon ve 2 ortak bölge yeniden kaydedildi. Studio Neutral ve eski deneme kayıtları etkin katalogdan çıkarıldı.

Tek bir Açıklama bloğu vardır: tek alan ve Lorem ipsum örnek değeri. Başlık ve üst başlık da birer ortak tanım kullanır. Sayfalardaki özgün Türkçe içerik bağımsız örnek verisi olarak korunur; her metin için yeni katalog bloğu oluşturulmaz. Section, p, başlık etiketleri ve CSS sınıfları sayfa yerleşiminde kalır. Paragraf içindeki bağlantılar ve vurgular korunur.

Kategoriler: Metin; Medya; Kartlar ve listeler; Formlar; Gezinme ve eylemler; Etkileşim. Tek seferlik butonlar ve rastgele yaprak metinler katalog bloğuna dönüşmez. Formlar amaçlarına, listeler içerik yapılarına göre adlandırılır. Farklı kart ve liste HTML yapıları ayrı tasarım varyantları olarak korunur.

Her sayfa kaydında kendi içerikleri, şablon sürümü, header/footer alanları ve SEO bilgileri bulunur. Aktarım açık bir yönetim işlemiyle başlatılır. Tekrar çalıştırıldığında kaynak yoluna göre mevcut belgeler bulunur ve kullanıcı düzenlemelerinin üstüne yazılmaz.

İlk kayıttan önce tüm belgeler sözleşme doğrulamasından geçer ve 32 sayfanın form dışındaki ana içerik metni kaynak HTML ile karşılaştırılır (boşluklar hariç). Form alanları CMS tanımından üretildiği için kaynak HTML form metniyle karşılaştırılmaz. Tam bölüm örnekleri imports/tr/pages içinde referans olarak tutulur; tam bölümler blok kataloğuna dönüşmez.

Katalogda tek CMS Formu bileşeni vardır. Önceki bağımsız form tanımları ve eski şablonlar arşivdedir; güncel şablonlar 1.3.0 sürümünü kullanır. Yedi örnek form, /cms-forms/ altındaki 1.1.0 JSON tanımlarından HTTP ile yüklenir. Form örnekleri ekranında form seçilebilir, JSON görülebilir ve ilgili sayfaya geçilebilir. Önizlemede gerçek başvuru gönderilmez. Gerçek gönderim için host form adapter’ı gerekir. HTML içindeki rastgele JavaScript yürütülmez.

Header/footer 1.1.0 sürümleri CMS menü kayıtlarına bağlıdır: ID 1 header ve hamburger; ID 2 footer hizmetler; ID 3 footer kurumsal; ID 4 footer yasal bağlantılar. Yerel referansta menüler SQLite cms_menus tablosundan çözülür. Runtime kodu menü öğesi veya B2B bağlantısı eklemez; alt menüler kaydın children listesinden oluşur.

## Bileşen türleri

| Tür | Tasarım varyantı |
|---|---:|
| Akordeon | 1 |
| Aktivite kartları | 1 |
| Aktivite sayfa yolu | 1 |
| Ayrıntılı tur rotası | 1 |
| Açıklama | 1 |
| Başlık | 1 |
| Bronz eylem bağlantısı | 1 |
| CMS Formu | 1 |
| Dahil olan hizmetler | 1 |
| Dahil olmayan hizmetler | 1 |
| Destinasyon kartları | 1 |
| Destinasyon sayfa yolu | 1 |
| Eylem bağlantısı | 1 |
| Fotoğraf ve açıklama | 1 |
| Gezilecek yerler | 1 |
| Görsel | 1 |
| Görsel bağlantısı | 1 |
| Hizmet kartları | 2 |
| Madde listesi | 1 |
| Ok bağlantılı metin | 1 |
| Rehber bağlantı kartı | 1 |
| Rehber kapak görseli | 1 |
| Rehber kartları | 3 |
| Rehber sayfa yolu | 2 |
| Satır içi bağlantı | 2 |
| Slider | 1 |
| Sıralı liste | 1 |
| Tur bilgileri | 1 |
| Tur sayfa yolu | 1 |
| Tur tanıtım görseli | 1 |
| Ziyaret noktaları | 1 |
| Önerilen içerikler | 1 |
| Üst başlık | 1 |
| İlgili sayfalar | 1 |
| İstatistikler | 1 |
| İçindekiler | 1 |

## Kaydedilmiş sayfalar

| Kaynak | Belge kimliği |
|---|---|
| /html/tr/acente-ve-belgeler/index.html | `83320154cdc28d9a433c5d7c8572e082` |
| /html/tr/aktiviteler/balon-turu/index.html | `2625149f483dd713938eb439cb4caffa` |
| /html/tr/aktiviteler/index.html | `43591118b51aa43ae8c27bb70d5cf6d2` |
| /html/tr/aktiviteler/tekne-gezisi/index.html | `e176f12cdadc673103afa08d258814f0` |
| /html/tr/aktiviteler/yamac-parasutu/index.html | `3edf87c793671e05179be452ee53dfa9` |
| /html/tr/aktiviteler/yeme-icme-sarap/index.html | `73ef0be51cf7bf59c848cccdbaf081f0` |
| /html/tr/b2b/index.html | `cdb48ae3747356c659f22efeb54892a7` |
| /html/tr/cerez-politikasi/index.html | `90e6a3733344ed081b2bf05492330358` |
| /html/tr/destinasyonlar/didim/index.html | `595f484c5fdd0a130d028d1a4b53945b` |
| /html/tr/destinasyonlar/efes/index.html | `1b899e1c5aa97e05132e4d23cae39350` |
| /html/tr/destinasyonlar/index.html | `15db4e77df95d21fc4fe1597ecad061a` |
| /html/tr/destinasyonlar/kusadasi/index.html | `eed8f5c79b4954d7928e1dbddc6d63b0` |
| /html/tr/destinasyonlar/milet/index.html | `f2caa84b8d1d2a7c45aa4d25850cd9bf` |
| /html/tr/destinasyonlar/pamukkale/index.html | `f3c7de63640bc20224c14813e2d59d19` |
| /html/tr/destinasyonlar/priene/index.html | `629062c0c6002558d5eec31f4bff5096` |
| /html/tr/destinasyonlar/selcuk/index.html | `1c6962f472eef38608df432c56f03059` |
| /html/tr/destinasyonlar/sirince/index.html | `ebed6060d6cf1dd9d6dab6bb45f40cf4` |
| /html/tr/erisilebilirlik/index.html | `4f0a0cf87aeccd0b3dd2fe09ad5982f4` |
| /html/tr/hakkimizda/index.html | `e4feecf26adc4ae8a8bb58bfdd3beef1` |
| /html/tr/iletisim/index.html | `67e84ae98fbf7785813720a257fc397a` |
| /html/tr/index.html | `9738cc9fb1c3f371d6459ba8ae7d6335` |
| /html/tr/kisiye-ozel/index.html | `a6061d81c799a6e2658037f95a459e8a` |
| /html/tr/kullanim-kosullari/index.html | `6aaad2992ed4a1a9b93e91c25ae87fb3` |
| /html/tr/kvkk-aydinlatma/index.html | `c22a7dc8c93bd24e9ba225700dc43ea1` |
| /html/tr/liman-turlari/index.html | `3b14c3c34c8900692def6ad568b29e80` |
| /html/tr/rehber/efes-gezisine-hazirlik/index.html | `ae9b5854154066f510f10cf1f46651cb` |
| /html/tr/rehber/index.html | `1a927803acbd4fa419f036779347d110` |
| /html/tr/rehber/kusadasi-kruvaziyer-turu-planlama/index.html | `492aa57de45a4dc94d9bbcf0449718c2` |
| /html/tr/rehber/kusadasinda-bir-gun/index.html | `1f1cf9b6dccea571809d84260b9d80b9` |
| /html/tr/transferler/index.html | `256cc9dad17ba61f6cb8ee5ec322da62` |
| /html/tr/turlar/efes-ozel-turu/index.html | `0a7c3bfa4affffcd08ce1870ea8e6056` |
| /html/tr/turlar/index.html | `75ddf4314a755e5a884d7057c3a1ad3d` |
