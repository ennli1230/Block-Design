# CMS yetki ve yayın entegrasyon sınırı

15 Ekim 2026. Gerçek CMS bağlantısı veya rol/yetki paketi kurulumu yapılmaz; bu belge entegrasyon sözleşmesidir.

Laravel için olası paket `spatie/laravel-permission`. Editör bu pakete veya rol adına bağımlı değildir. Laravel Gate/Policy sonucundan gelen `save/styles/design/import/catalogWrite/export` boolean değerlerini kullanır. `examples/laravel/EditorPermissions.php` bu dönüşümün örneğidir. Publish, asset upload ve kayıt okuma izinlerini backend kendi endpoint’lerinde ayrıca kontrol eder.

| İşlem | Önerilen permission | Ek sunucu kontrolü |
|---|---|---|
| Belge yükleme / geçmiş | `editor.pages.view` | PagePolicy view, site/tenant ve kayıt kapsamı |
| Belge kaydetme / restore | `editor.pages.edit` | PagePolicy update, revision/If-Match |
| Yapı / stil / HTML import | `editor.layout.manage` | Kaydedilen yapı sunucuda doğrulanır |
| Blok / şablon / bölge yazma | `editor.catalog.manage` | Katalog/site kapsamında policy |
| Medya yükleme | `editor.assets.upload` | Dosya doğrulama, kota, site kapsamı |
| HTML dışa aktarma | `editor.pages.export` | Kayıt okuma, kaynak erişimi |
| Yayınlama | `editor.pages.publish` | Policy, yayın kalite kapısı, kayıtlı snapshot |

Frontend’de gizlenen düğme yetkilendirme değildir. Laravel route/controller her istekte Gate/Policy uygular. Rol değişikliği veya oturum süresi dolması 401/403 döndürmeli; editör başarılı kayıt veya demo fallback’i göstermemeli. Public canlı liste ve form endpoint’leri admin oturumuna dayanmaz; yalnız yayımlanmış ve izinli alanları döndürür. İstemciden gelen `page.siteId`, route filtresi veya form context’i yetki kanıtı sayılmaz.

Canlı liste `queryPage(collectionId, query, cursor, context)` üzerinden host’a bağlanır. `page.route` ve `page.recordId` veri filtreleme bağlamıdır; backend tenant/site koşullarını oturum veya doğrulanmış yayın yapılandırmasından yeniden uygular. Veritabanı modelinin/SQL’in editör belgesine açılması gerekmez.

Gerçek site önizlemesi için `preview.open(document, context)` callback’i CMS taslak kaydı/signed URL/gerçek route akışını yönetir. Gizli preview token’ı belge JSON’una veya statik yayın yapılandırmasına yazılmaz. Statik yayın işçisi kaydedilmiş JSON’u çözümler ve `assertPublishable(output)` sonucundan sonra atomik olarak yayınlar; hata mevcut yayını bozmamalıdır.

Resmi kaynaklar: [Spatie: Gate ile kullanım](https://spatie.be/docs/laravel-permission/v8/introduction), [rol yerine permission kontrolü](https://spatie.be/docs/laravel-permission/v8/best-practices/roles-vs-permissions), [middleware](https://spatie.be/docs/laravel-permission/v8/basic-usage/middleware). Gerçek CMS kurulurken uygun Laravel/PHP/paket sürümü ayrıca seçilmelidir; bu örnek kurulu bir sürüm taahhüt etmez.
