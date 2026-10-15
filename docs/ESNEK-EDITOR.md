# Esnek editör kapsamı — 12 Ekim 2026

## Kullanıcının istediği akış

HTML/CSS bir kez içe alınır. Logo, bağlantı, menü öğesi/alt menü, dil seçici, mobil menü, slider ve akordiyon alanları elle eşlenebilir. Kaynaklar host CMS adapter'larından gelir. Section, başlık, açıklama ve akordiyon ayrı öğelerdir; tamamlanmış SSS yerleşimi zorunlu değildir. Host CMS kendi kabuğunu, yetkilerini, API'sini ve yayınlama sistemini yönetir. Go yalnızca referans backend'dir.

## Kod incelemesinde görülen boşluklar

- Blok Stil kontrolü `styleOverrides` kaydederken render/tuval bağlantısı eksikti. Ham öğe stil paneli yoktu.
- Liste tanımları yalnızca düz liste kabul ediyordu; alt menü tasarımını veri ağacına eşlemek mümkün değildi.
- Paylaşılan bölgeler yalnızca scalar alanlara sahipti; header menüsü için liste/kaynak tanımı eksikti.
- Tam FAQ demo bölümü ile ham akordiyon iki ayrı yoldu. Akordiyonun kendi kaynak ve alan ayarları olan bileşik olmayan bir öğe olması gerekiyor.
- Aynı yapı taşları Vue hızlı ekleme alanı ve GrapesJS kataloğunda tekrar görünüyordu.
- Import/alan seçimi büyük, iç içe HTML'de görsel tıklamaya fazla bağımlıydı; node ağacından elle seçim gerekli.
- Embed girişi ve adapter'lar var; host görünümü ve izinlerin açık yapılandırılması gerekiyor.
- Kaydetme JSON saklıyor. HTML export tarayıcıda çalışıyor; host'un yayın pipeline'ı açık şekilde belgelenmeli.

## Uygulama sırası

1. Bağımsız öğe kataloğu; mevcut belgelerin eski sürümlerini koruma.
2. Hiyerarşik liste şeması, kararlı kimlikler, doğrulama, kaynak çözümleme ve render.
3. Görsel/node ağacı üzerinden alan ve alt liste eşleme; paylaşılan bölgelerde aynı model.
4. Seçili section/öğe stil paneli ve styleOverrides render bağlantısı.
5. Güvenilir kayıtlı davranışlar ve ayarları; import edilmiş keyfi script çalıştırılmaz.
6. CMS görünümü/izin seçenekleri ve Laravel entegrasyon örneği.
7. Kaydet/aç/önizle/export tutarlılığı için hedefli testler ve gerçek tarayıcı kabulü.

## Sınırlar

Bu çalışma Laravel uygulaması, CMS kullanıcı/rol ekranları veya AI servisi oluşturmaz. Adapter üzerinden host yetkileri ve içerik kaynakları bağlanır. AI otomasyonu manuel eşleme akışının yerine geçmeden daha sonra eklenebilir. Herhangi bir HTML/JS kütüphanesinin otomatik ve eksiksiz dönüştürüldüğü iddia edilmez; davranışlar host tarafından kayıtlı plugin'lerle sağlanır.

## Kabul durumu

Uygulanan editör kapsamı:

- Akordiyon yalnızca soru/yanıt listesi olarak eklenir. Section, başlık ve açıklama bağımsız yapı taşlarıdır. Önceki tam FAQ/banner tanımları eski belgeler için okunabilir; varsayılan ekleme kataloğunda gösterilmez.
- Düz/yüzey/kontrast bölüm seçenekleri; arka plan, görsel, boşluk, ölçü ve yazı kontrolleri. Ham bölüm CSS'i ve yönetilen bileşenin kök/alt öğe stil override'ları JSON'a gider. Sayfa açılırken mevcut CSS'i silen hata giderildi.
- Menü öğeleri ve açık alt liste şemaları: 8 düzey sınırı, bağımsız örnek kimlikleri, kopyalama/sıralama/silme, alan ve URL doğrulaması. Ana menü, dropdown ve hamburger görünümü ayrı bileşen örneklerine bağlanabilir.
- Dil adları, bağlantıları, isteğe bağlı ikonları ve ikon açıklamaları ayrı alanlardır. Logo/görseller host medya adapter'ını kullanır.
- HTML import header/footer adaylarını da tanır. Öğe ağacından seçim, aynı bağlantıya metin ve URL eşleme, liste kapsayıcısı/örnek öğe ve alt liste tanımlama/kaldırma vardır. Liste tanımlarken bir örnek öğe alınır; gerçek kayıtlar manuel panelden veya sağlayıcıdan gelir.
- Paylaşılan header/footer'da alanlar, alt listeler, kaynak bağları, varsayılan veri ve CSS sürümlenir. GrapesJS'in kaydettiği `frames` biçimi de kaynak çözümlemede desteklenir.
- Manuel/seçili kayıt/grup/sorgu kaynakları capability'lere göre açılır. Kaynak çözümleme manuel taslağı değiştirmez; hatalı çocuk kayıtlar rapor üretir.
- Slider otomatik oynatma/süre/döngü ayarları ve kayıtlı aç/kapat davranışı. HTML'den gelen keyfi JavaScript çalıştırılmaz; özel davranışlar host tarafından plugin olarak kayıt edilir.
- Gömülü mod: host teması, izinler, kendi toolbar'ı ve kendi katalogları. Üretim HTTP adapter'ları demo/offline kaynaklarına sessiz geçmez.
- Belge sürümü 2; sürüm 1 okunur, bilinmeyen gelecek sürümler reddedilir. Kaydetme düzenlenebilir JSON'u korur; ayrı `renderPageDocument` aynı resolver üzerinden HTML/CSS/JS yayın çıktısı üretir.

Doğrulama: 54 JavaScript testi, tüm TypeScript/Vue tip kontrolleri, Go testleri ve demo/ESM/vanilla build'leri geçti. Bundle ölçümü geçti. Yeni şema panelleri ve yayın girişi nedeniyle demo CSS bütçesi 24 KiB gzip, ESM giriş 3 KiB ham, ESM toplamı 445 KiB gzip olarak güncellendi; ölçümler sırasıyla 23.3, 2.6 ve 436.0 KiB. Diğer bütçeler korunur. Impeccable detector değişen arayüz dosyalarında bulgu üretmedi.

Gerçek tarayıcı kabulü: `/cms.html` üzerinde bölüm rengi değiştirildi, menü `Ana menü` API grubuna bağlandı, JSON Go API'ye revizyonla kaydedildi ve yeni sekmede aynı belge kimliğiyle tekrar yüklendi. Renk korundu; önizlemede API'deki `Ekibimiz/İletişim` alt öğeleri, dil listesi ve slider geçişi çalıştı. Yayın çıktısı `issues: []` döndürdü; CSS rengi ve alt menü HTML'i çıktıda bulundu. Ayrıca ayrı bir taslakta header HTML/CSS import edildi ve logo öğesi ağaçtan görsel alanına elle eşlendi.

Entegrasyon örneği: `examples/laravel/editor.ts` ve README. Çalışan CMS kabuğu: `http://127.0.0.1:4173/cms.html`. Bu kabul Laravel uygulamasıyla yapılmadı; referans Go API ve Codex tarayıcısı kullanıldı. Laravel route'ları, sunucu yetkilendirmesi/şema doğrulaması, veritabanı migration'ları, yayın worker'ı ve cache invalidation host entegrasyonunun işidir. AI eşleme ve PHP SSR renderer bu sürüme dahil değildir.
