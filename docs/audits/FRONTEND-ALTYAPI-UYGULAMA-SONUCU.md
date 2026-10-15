# Frontend altyapısı uygulama sonucu

15 Ekim 2026

## Öncelikli iki alan

1. **Canlı frontend listesi:** cursor sayfalama, ziyaretçi filtrelerinin whitelist’i, varsayılan sorguyla birlikte çalışan filtreler, host sayfa/route bağlamı, URL geri/ileri durumu, boş/yükleniyor/hata/yeniden deneme, iptal ve eski yanıt koruması uygulandı. Editör kaynak panelinde etkinleştirilebilir; önizleme ve bağımsız HTML aynı runtime’ı kullanır.
2. **Etkileşimli bileşenler:** sekme, native modal ve galeri tanımları/rolleri eklendi. Klavye, ARIA/odak, örnek izolasyonu, mount/destroy ve seçiciye göre bağımsız export mevcut behavior registry’sine bağlandı. Mevcut akordiyon ve slider korunur.

[Çalışan örnek](http://127.0.0.1:4173/interactive-examples.html) · [Kullanım/entegrasyon rehberi](../CANLI-LISTE-VE-BILESENLER.md)

## Rapordan ayrıca ele alınanlar

| Bulgu | Uygulama |
|---|---|
| Şema sürümü değişikliği | Selection, query ve canlı listede değişiklik kontrolü; yeniden eşleme hatası |
| Gömülü kayıt yan etkisi | Host URL ve global son belge anahtarına yazma/başlangıçta okuma kaldırıldı |
| Kayıt yarışı | Eski belgeye ait geç save cevabı yeni açılan belgeyi güncelleyemez |
| Otomatik kayıt | Host’un açabildiği debounce politikası; mevcut revision/validation akışını kullanır |
| Taslak kurtarma | Açık ve kapsamlı host anahtarıyla browser recovery; başarılı güncel kayıtta temizleme |
| Sayfa geçmişi | Optional adapter/UI; Go referansında atomik revision snapshot, listeleme ve eski payload; güncel revision üstünde restore taslağı |
| Yayın kapısı | Machine-readable severity ve `assessPublication/assertPublishable`; bilinmeyen sorun engelleyici |
| SEO / rich text | Metadata paneli ve güvenli head/JSON-LD; temel biçimlendirme araçları ve canonical node alt kümesi |
| Eklenti sınırı | API sürümü/kimlik doğrulamalı extension, block/behavior/field editor ve host validation kaydı |
| Medya araması | Eski cevap/abort koruması, cursor geçişi, provider MIME sınırına uygun seçim |
| Dil | Sayfalama locale wrapper’larından geçer; form runtime mesaj sözlüğü ve temel İngilizce kontroller |
| Gerçek site önizlemesi | Host’un gerçek route/signed preview akışını bağlayacağı `preview.open` callback’i |
| Rol/yetki | Paket bağımsız boolean izin sözleşmesi ve Laravel Gate/Policy–Spatie uyumlu örnek; paket kurulmadı |

Gerçek CMS bağlantısı kullanıcı isteğiyle ertelendi. Bu tablo hazır bir Laravel CMS, gerçek kullanıcı/tenant yetkilendirmesi, public yayın endpoint’i veya üretim e-posta teslimi kurulduğu anlamına gelmez.

## Doğrulama

- `npm test`: bütün paket testleri başarılı; kaynak şema değişimi, cursor/bağlam/filtre, locale adapter geçişi, güvenli rich text, extension ve yayın denetimi regresyonları dahil.
- `npm run typecheck`: başarılı.
- `npm run build:all`: demo, ESM ve IIFE başarılı; örnek sayfa demo üretim çıktısına dahil.
- `npm run measure:bundle`: bütün bütçeler başarılı. Demo JS 472,5/476 KiB gzip, ESM toplamı 493,4/496 KiB, vanilla 445,6/449 KiB. Yeni özellikler nedeniyle toplam bütçeler ölçülerek artırıldı; ESM editör başlangıcı 3,2 KiB ham sınırında kaldı.
- Go `go test ./...`: başarılı; history restart/stale write ve cursor overlap testleri dahil.
- Tarayıcı yeni frontend kabulü: **11/11**; CMS menü kabulü: **4/4**; form kabulü: **7/7**.
- URL geri/ileri hareketi ve yeni sekmede cursor’dan ilk sayfaya dönüş ayrıca gözlendi.
- Mobil örnekte 390 px viewport kontrolünde 375 px client genişliği ve 375 px içerik genişliği; yatay taşma yok. Bu yalnız kullanılan in-app Chromium motorunun sonucudur.
- Mevcut veri denetimi: 33 belge, 1.150 bağlantı, 138 görsel, 8 form; hata/uyarı yok.
- Go referansı yeniden başlatılmadan önce `.tools/backups/before-editor-runtime-20261015-013907.sqlite` yedeği alındı; SQLite integrity check başarılı.

Görseller: [masaüstü](../../exports/live-components-desktop.png), [mobil](../../exports/live-components-mobile.png).

## 15 Ekim ek düzeltme kontrolü

- Yayınlanan canlı listeler önizleme ile aynı sorgu doğrulamasına geçirildi. Sabit dil, `$context` dil referansları, sayı filtresi dönüşümü ve şema/operatör/sayfa sınırı denetimi yayında da uygulanır. Public şema endpoint sözleşmesi entegrasyon belgesine eklendi.
- Aynı önizleme DOM’unda page/contentLocale değişimi artık behavior update sırasında listeyi yeniler; değişmeyen bağlam ek istek üretmez.
- Liste runtime’ı kaldırılırken özgün `aria-busy` niteliği geri yüklenir.
- Genişletilen 11 tarayıcı senaryosu, tüm paket testleri, typecheck ve üç üretim derlemesi başarılı. Bütçeler değiştirilmeden geçti: demo 472,8/476 KiB, ESM 493,5/496 KiB, vanilla 445,8/449 KiB gzip.
- Derlenmiş ESM SDK’sının ürettiği bağımsız HTML tarayıcıda ayrıca çalıştırıldı: sabit İngilizce dil/bağlam ve sayısal `42` filtresi doğrulandı. [Kontrol görüntüsü](../../exports/production-runtime-fixes.png).

## Açık kapsam

Önceki rapordaki dosyalı/adımlı/koşullu gelişmiş formlar, tam DAM, medya aramasında Go tarafının 50 kayıt sınırı, hazır PHP yayın worker’ı, editoryal yorum/onay/ortak düzenleme ve Firefox/Safari/gerçek cihaz doğrulaması tamamlanmış sayılmaz. Host adapter/extension bağlantıları bunların eklenmesine zemin hazırlar; özelliklerin kendisiyle karıştırılmaz. Ayrı blok/bölge authoring taslaklarının kalıcı recovery’si de mevcut sayfa recovery kapsamına dahil değildir.

Bu açıklar ilk iki önceliğin çalışmasını engellemez; CMS bağlantısı öncesi sonraki iş sırası olarak [ana raporun](CMS-FRONTEND-EDITOR-YETERLILIK-RAPORU.md) P1/P2 kapsamıyla birlikte takip edilir.
