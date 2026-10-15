# CMS menü entegrasyonu

15 Ekim 2026

Menü bağlantısı bir veritabanı kaydı seçer. Blok kataloğunda olduğu gibi editör, verinin hangi sunucu veya tablo uygulamasından geldiğini bilmez. HTML için `providerId`, `collectionId`, `groupRef` ve alan eşlemeleri saklanır. Editörde harici API adresi girilmez.

Yerel referansta `cms_menus` tablosu kullanılır. Gerçek CMS, kendi `menus` ve `menu_items` tablolarını veya mevcut menü modelini aynı sözleşmeye dönüştürür. Veritabanına CMS backend’i erişir. Tarayıcıdaki editör SQL çalıştırmaz; yerel demodaki `/api/v1/content/...` yolları uygulamanın kendi backend köprüsüdür ve harici bir servis bağımlılığı değildir.

## Mevcut kayıtlar

| Menü ID | HTML alanı |
|---|---|
| `1` | Header ve hamburger içeriği; aynı kayıt, farklı ekran yerleşimi |
| `2` | Footer hizmetler sütunu |
| `3` | Footer kurumsal sütunu; B2B bağlantısı da bu kayıttadır |
| `4` | Footer yasal bağlantılar |

Menü kimlikleri opaque string’dir. CMS sayı kullanıyorsa `String(menu.id)` ile eşlenir. ID’ler bu yerel kurulumun örnekleridir; SDK bu dört ID’ye bağlı değildir.

## Editörde seçim

**Temel görünümler → Footer düzenle → Ayarlar → Veri kaynağı** yolunda:

1. Alan/liste olarak footer sütununu seç.
2. Kaynak koleksiyonu olarak **CMS · Menü kayıtları** seç.
3. Veri seçimini **Kayıt / menü seç** yap.
4. Kayıt grubundan örneğin **Footer · Yasal bağlantılar · ID 4** seç.
5. `url` alanını bağlantı adresine, `label` alanını bağlantı metnine eşle.
6. Bölgenin yeni sürümünü kaydet; kullanacak temel görünüm/şablon/sayfalara bu sürümü açıkça uygula.

Header’da `children` listesi alt menülere eşlenir. Runtime yalnızca açma/kapama, Escape ve ARIA durumunu yönetir; menü adı veya bağlantı eklemez. Menü kayıtları değişince kaynak bir sonraki çözümlemede okunur. Bu, kendiliğinden arka planda güncellenen canlı abonelik anlamına gelmez.

## Adapter sözleşmesi

```ts
const menuBinding = {
  mode: 'selection',
  providerId: 'registered-cms-provider',
  collectionId: 'menus',
  groupRef: '4',
  recordRefs: [],
  // bindingId, target, schemaVersion ve alan eşlemeleri de normal SourceBinding içindedir.
};

// Host'un ContentProviderAdapter uygulaması:
// listGroups('menus', context) → CMS menü kayıtlarının kimlik ve adları
// resolveGroup('menus', '4', context) → o menüye ait sıralı öğeler
```

Bir öğenin dönüş biçimi:

```json
{
  "recordId": "menu-item-21",
  "collectionId": "menus",
  "values": {
    "label": "Turlar",
    "url": "/tr/turlar/",
    "children": [
      { "id": "menu-item-22", "label": "Özel turlar", "url": "/tr/ozel-turlar/" }
    ]
  }
}
```

Sağlayıcı, `recordGroups` ve `resolveRecords` yeteneklerini; koleksiyon da `recordGroups` ve `recordSelection` desteğini ilan eder. `getSchema` içinde dil desteği belirtilir. Yalnızca grup seçilmişse ayrıca tüm tekil kayıtlar sorgulanmaz.

Host; CMS menü sırasını, yayımlanma durumunu, site/tenant sınırını ve dilini kendi sorgusunda uygular. Provider kimliğinin belgede saklanması bir yetkilendirme mekanizması değildir. Kimlik doğrulama veya veritabanı erişimi frontend belge JSON’una yazılmaz.

## Hata ve yayın davranışı

- Kayıt bulunamaması veya sağlayıcının bağlı olmaması görünür kaynak hatasıdır. Aktif çalışma alanı, CMS hatasını genel demo menüsüyle gizlemez.
- Sayfanın kullanmadığı arşivli bölge sürümleri çözümlenmez. Eksik sabitlenmiş sürüm `SOURCE_REGION_MISSING` üretir.
- Kaynak değerleri alan türü, gerekli alan, sınır ve URL kurallarından geçer. `javascript:` gibi bağlantılar kabul edilmez; telefon bağlantıları için `tel:` desteklenir.
- Çözümleme manuel taslağı değiştirmez; veri geçici bir kopyaya uygulanır. Editör içindeki ortak bölge projeksiyonunda geç gelen eski yanıtlar elenir.
- Önizleme hata halinde mevcut taslağı korur ve hata gösterir. `exportStatic`/`renderPageDocument` sorunları `issues` içinde döndürür; host bunları kontrol etmeden yayınlamamalıdır. Laravel örneğindeki `render` fonksiyonu sorun varsa yayını reddeder.
- Statik çıktı, yayın anında çözülen menüleri içerir; sonradan CMS’ye otomatik olarak menü sorgusu atmaz. Menü değişikliklerini statik sitede göstermek için yeniden yayın yapılır.

Yerel `/scalanova-tour/...` bağlantıları kaynak HTML örneklerine gider. Gerçek CMS kendi yayın URL’lerini `url` alanından sağlar; kaynak dosya adresleri üretim rotası varsayılmamalıdır.

Diğer CMS modellerinin karşılaştırması, header/hamburger akışı ve farklı alan adlarıyla yapılan ek testler [karşılaştırma raporunda](audits/DIGER-CMS-MENU-KARSILASTIRMASI.md) yer alır. Alt liste eşlemelerinde `children.label` gibi tam yollar kısa alan eşlemelerinden önceliklidir; CMS öğe kimlikleri noktalama karakterleri farklıysa da birbirinden ayrı kalır.
