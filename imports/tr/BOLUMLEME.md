# Scala Nova Türkçe içeriğin yeniden kurulması

Bu klasör backend'e yeniden import edilmiş bir site değildir. `html/tr` kaynaklarının bölüm dilimleri, küçük bileşen örnekleri ve sayfa sıralarıdır. Kaynak HTML/CSS/JS değiştirilmedi. Önceki otomatik import devre dışıdır.

## Katmanlar

| Katman | İçerik | Yönetim |
|---|---|---|
| Tasarım sistemi | Ortak CSS, fontlar, görseller, ikonlar | Tek manifest; sayfa başına CSS kopyalanmaz |
| Ortak bölgeler | Site header ve footer | Bir temel görünüm; logo, ana/mobil menü, dil ve footer grupları ayrı veri bağları |
| Küçük bileşenler | Slider öğesi, kart, akordeon, form, breadcrumb | Bir tanım + gerçek tasarım varyantları; farklı yazı veya kayıt sayısı yeni blok oluşturmaz |
| Sayfa şablonu | Section düzeni, sütunlar, bileşen konumları | Ana sayfa, liste, detay, rehber yazısı, yasal ve form odaklı şablon aileleri |
| Sayfa kaydı | Başlık, açıklama, görseller, listeler, SEO ve kaynak bağları | Şablondan bağımsız içerik; JSON olarak kaydedilir |

## İlk kurulacak bileşenler

1. **Header:** mevcut `header.site-header` korunur. `img.brand-logo` logo alanıdır; `[data-nav-links]` ana menü şablonudur; `[data-language-select]` dil kaynağıdır. `[data-menu-toggle]` mobil aç/kapat kontrolü aynı menüyü veya bağımsız mobil menü kaynağını kullanabilir. Menü item ve children ayrı şemalarla eşlenir; bu HTML'in mevcut menüsüne yapay alt menü eklenmez.
2. **Footer:** logo/açıklama, hizmet bağlantıları, kurumsal bağlantılar, iletişim durumu, rehber bağlantısı ve yasal bağlantılar ayrı alan/gruplardır. Bütün sayfalarda ayrı footer blokları üretilmez.
3. **Section:** normal ve paper yüzeyleri, iç container ve gerekli sütun yerleşimleri. Heading/eyebrow/açıklama birer alan veya küçük öğedir. CTA bandı, istatistik şeridi ve görsel/metin yerleşimi gerçek yapısal varyantlardır.
4. **Akordeon:** mevcut `.faq-list` ve örnek `details` kullanılır. Sorular/yanıtlar bir listeye bağlanır. SSS başlığı ve açıklaması akordeon tanımının içine zorunlu olarak konmaz; section içinde ayrı yerleştirilir.
5. **Kart listeleri:** hizmet/tur kartı, aktivite satırı, destinasyon kartı ve rehber kartı ayrı işlev aileleridir. Kart kabı ve bir örnek öğe eşlenir; kayıtlar listeden gelir. Başlık, açıklama, görsel, alt metin, URL ve gerekiyorsa kategori/süre alanları ayrılır.
6. **Slider:** `.hero-slide` bir örnek öğedir. Görsel, başlık, açıklama ve CTA liste verisidir. Mevcut prev/next/dot kontrolleri ve autoplay/zamanlama davranışı ayrıca eşlenir; import sırasında `app.js` doğrudan çalıştırılmaz.
7. **Formlar:** tur arama, iletişim, özel seyahat ve rezervasyon/talep formları ayrı iş akışlarıdır. Etiket/seçenek/hata/durum alanları eşlenir. Demo formun JavaScript mesajı gerçek gönderim sayılmaz; Laravel form endpoint'i, doğrulama ve başarı/hata davranışı ayrıca bağlanır.
8. **Detay içeriği:** tur programı satırları ve aç/kapat kontrollü güzergâh, bilgi listeleri, makale gövdesi ve breadcrumb. Program satırı liste, makale gövdesi içerik alanıdır; her paragraf yeni katalog bloğu olmaz.

## Sayfa şablonları

| Aile | Kaynak örnekleri | Düzen |
|---|---|---|
| Ana sayfa | `tr/index.html` | Hero slider → arama → kartlar → istatistik → görsel/metin → CTA → SEO → SSS → rehber |
| Liste | turlar, aktiviteler, destinasyonlar, rehber | Sayfa tanıtımı → filtre/kart listesi → yardımcı içerik/SSS |
| Detay | Efes turu, aktivite ve destinasyon detayları | Tanıtım/breadcrumb → görsel ve metin → bilgi/program → talep/CTA → SSS |
| Rehber yazısı | Üç rehber makalesi | Makale/meta → CTA → ilgili yazılar |
| Kurumsal / form | hakkımızda, iletişim, kişiye özel, B2B, transferler | Tanıtım → metin/özellikler → ilgili form veya CTA |
| Yasal | KVKK, çerez, kullanım, erişilebilirlik, belgeler | Tanıtım → metin ve içerik navigasyonu; gerekiyorsa çerez tercihleri |

Bu aileler sayfaların özgün bölüm sırasını zorlamaz. Her sayfanın tam sırası `ENVANTER.md` ve `manifest.json` içindedir. Bir bölüm sırf `section` olduğu için yeni blok sayılmaz. Tam sayfa HTML'i tek blok yapılmaz.

## Dosyalar ve doğrulama

- `pages/**/header.html`, `footer.html`, `head.html`: sayfa kaynağının ortak bölge/SEO referansları; 32 farklı katalog kaydı anlamına gelmez.
- `pages/**/01-*.html` vb.: sıralı ana içerik dilimleri.
- `pages/**/main-reference.html`: orijinal ana içerik, karşılaştırma için.
- `components/**`: özgün HTML'den çıkarılmış küçük bileşen örnekleri. Aynı türdeki örnekler içerik/kayıt sayısı farkı nedeniyle henüz birleştirilmemiş olabilir; sayıları nihai katalog boyutu değildir.
- `manifest.json`: kaynak, parça hash'leri, sıra, liste adayları, davranış işaretleri ve bileşen örneğinin çıktığı sayfa.
- `scripts/prepare-tr-import.py`: bu envanteri tekrar üretir. `--reset-backend` ayrıca SQLite yedeği alıp eski aktarım kayıtlarını temizler; yeni kayıt oluşturmaz.

Bu sıra uygulandı: ortak tasarım varlıkları → header/footer alan eşleme → akordeon ve kart/slider liste eşleme → şablon aileleri → 32 sayfanın içerik kayıtları. Tamamlanan aktarımın sayıları, doğrulamaları ve sayfa kimlikleri [AKTARIM-RAPORU.md](AKTARIM-RAPORU.md) içinde yer alır.

## Temizlik kaydı

12 Ekim 2026: Go SQLite'dan eski aktarım ve bağımlıları olan 65 belge, 55 blok tanımı, 1 şablon ve 2 ortak bölge kaldırıldı. SQLite'ın tamamı `.tools/backups/before-tr-reset-20261012T174425354926Z.sqlite` dosyasında yedeklendi. Bu aktarım dışında kalan 3 backend belgesi korundu. Tarayıcıdaki eski aktarım önbelleği de tek seferlik, yedekli temizlendi; genel demo yapı taşları ve ilgisiz kayıtlar korunur. Site açılışında eski aktarımı yeniden oluşturan kod kaldırıldı.
