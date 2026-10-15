# CMS form entegrasyonu

14 Ekim 2026. Ortak TypeScript sözleşmeleri, renderer, editör bağlantı paneli, HTTP adapter’ları, demo CMS ve yerel veri geçişi uygulanmıştır. Laravel/Filament örneği ayrı host projesinde çalıştırılır.

## Host uygulamaya bağlama

```ts
import { mountEditor, HttpContentProviderAdapter } from '@blockdesign/editor';
import { HttpFormProviderAdapter, HttpFormActionAdapter } from '@blockdesign/editor/forms';

const headers = () => ({
  'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
});

const editor = mountEditor('#editor', {
  // Normal storage/library/template adapter’ları burada da host tarafından sağlanır.
  forms: {
    providers: [new HttpFormProviderAdapter({
      providerId: 'laravel', baseUrl: '/editor', headers,
    })],
    actions: [new HttpFormActionAdapter({
      adapterId: 'laravel', baseUrl: '/public', headers,
    })],
  },
  contentProviders: [new HttpContentProviderAdapter({baseUrl: '/editor', headers})],
});
await editor.ready;
```

Form yardımcıları bundler’da `@blockdesign/editor/forms`, doğrudan ESM dağıtımında `dist/esm/blockdesign-forms.js` üzerinden alınır. Vanilla dağıtımındaki `BlockDesign` nesnesi form yardımcılarını da sunar. Ana ESM editör girişi 3.2 KiB ham sınırını korur; yeni form runtime’ı ve paneli için toplam JS bütçeleri ölçülen yaklaşık 13 KiB gzip artışa göre güncellendi.

`FormDefinition.action.adapterId` kayıtlı action adapter kimliğiyle eşleşmelidir. Uzak seçeneklerdeki `providerId`, kayıtlı content provider kimliğiyle eşleşir. Tekrar kullanılabilir blok tanımı `createCmsFormDefinition(designSystemRef)` ile alınabilir. Editör form provider’ı verildiğinde bu bileşeni kütüphanede sunar.

Editörde **CMS Formu → Form kaynağı → CMS formu ve sürümü → Form bağlantısını uygula** akışı kullanılır. Alanların sırası, türleri, zorunlulukları, etiketleri ve seçenekleri seçilen şemadan gelir. Görünüm ve sabit sayfa bağlamı ayrı ayarlanır. Yeni sürüm seçildiğinde eklenen, kaldırılan ve değişen alanlar gösterilir.

## Şema ve kaynaklar

`packages/contracts/src/forms.ts` tam sözleşmedir. `validateFormDefinition` desteklenmeyen türleri, hatalı alanları, yinelenen kimlikleri ve döngüsel bağımlılıkları reddeder. Çekirdekte form alanları, blok içerik alanlarından ayrı tutulur.

İlk alan türleri: text, email, tel, textarea, number, date, select, radio ve checkbox. Küçük listeler doğrudan değer/etiket çiftleridir. Uzak seçenekler mevcut `ContentProviderAdapter` ile sağlanır. Aranabilir bağımsız koleksiyonlarda cursor ile devam edilir; seçili kayıt ilk sonuç sayfasında olmasa da kimliğiyle çözülür. Bağımlı listeler yalnızca sağlayıcının ilan ettiği `eq` filtrelerini kullanır; sonuçlar tek sayfaya sığmıyorsa sessiz kesilmez ve host için açık hata verilir. Bu sürümde bağımlı liste üzerinde ek arama/pagination desteklenmez.

Alanların ve kayıtların kimlikleri dilden bağımsız tutulur. Provider’a sayfanın `RequestContext.contentLocale` bağlamı aktarılır. Demo CMS şu anda Türkçe form tanımları sunar; başka dil için açık hata verir. Renderer’ın standart durum ve doğrulama metinleri Türkçedir; çok dilli runtime mesaj kataloğu henüz eklenmedi.

## Önizleme ve gönderim

- Düzenleme tuvalinde alanlar gösterilir ve etkileşim kapalıdır.
- Önizleme varsayılan olarak gönderimi simüle eder. `allowPreviewSubmission: true` yalnızca host’un açık test ortamı içindir.
- `mountCmsForm(root, services)` editör olmadan da kullanılabilir. Yayımlanmış embed için mode `published` ve gerçek action servisleri verilir.
- Gönderimde aynı oturumdaki eşzamanlı ikinci istek engellenir. Belirsiz ağ hatasından sonra aynı veriyle yeniden denemede işlem kimliği korunur. Oturum kapatılıp yeniden açılırsa bu kimlik korunmaz; kalıcı ziyaretçi taslağı tutulmaz.
- Sunucu idempotency uygular. `accepted` yalnızca başvurunun kabul edildiğini belirtir; e-posta teslimi anlamına gelmez.
- Hatalar alan kimliğiyle geri döner. HTTP 200 içinde `{ok:true}` gibi tanınmayan bir yanıt başarı sayılmaz. Gönderimler tarayıcı-local adapter’a düşmez ve otomatik tekrar edilmez.
- Yönlendirme varsayılan olarak aynı origin içindeki HTTP(S) adresleriyle sınırlıdır.

Form değerleri DOM runtime closure’ında kalır. Editör belgesine yalnızca `formBinding` kaydedilir; ziyaretçi değerleri `manualData`, `projectData` veya localStorage’a taşınmaz. Form runtime’ı kapanınca istekler iptal edilir ve özgün placeholder geri yüklenir. Başka form seçildiğinde ziyaretçi durumu yeni forma taşınmaz.

## Statik yayın

`exportStatic` ve `renderPageDocument` her bağlı formun tam sürümünü provider’dan çözer ve halka açık şema kopyasını çıktıya alır. Şema alınamazsa `FORM_SCHEMA_UNAVAILABLE` issue üretilir. Kaynak form tanımları yalnızca halka açık alan metadatası taşımalı; kişi/model verisini veya sır içeren varsayılanları döndürmemelidir.

Host, statik formun kullanacağı açık bağlantıları `forms.publication` ile tanımlar:

```ts
forms: {
  providers: [formProvider],
  publication: {
    schemaBaseUrl: '/public',
    actionBaseUrl: '/public',
    contentBaseUrl: '/public',
  },
}
```

Şema sürümü export’a sabitlendiği için form açılırken yeniden şema indirmek gerekmez. `actionBaseUrl` altında `POST /forms/{id}/versions/{version}/submissions`; content base altında mevcut `/content/collections/...` sözleşmesi kullanılır. Statik HTTP bootstrap’ı şu anda form seçenekleri için aynı public content base’i kullanır; birden fazla uzak CMS varsa host bunları bu ortak endpoint altında yönlendirir.

Özel header/auth callback’leri ve erişim anahtarları dışa aktarılmaz. Statik endpoint’ler public form bağlamında çalışmalıdır. Oturum/CSRF gerektiren özel frontend için host’un verdiği runtime servisleriyle embed kullanılır. Public endpoint’in izinleri, güncel seçenek doğrulaması, spam/limit kuralları ve kayıt işlemi host’un sorumluluğudur.

Yayın bağlantısı yoksa `FORM_PUBLICATION_UNCONFIGURED` issue oluşur, çıktıdaki gönderim düğmesi devre dışıdır. JavaScript bağımlılığı yalnızca form bulunan sayfalara eklenir. Export’taki `window.BlockDesignForms.init(root)` ve `destroy(root)` SPA mount/unmount için kullanılabilir.

## Laravel ve Filament

`examples/laravel/forms` Filament 5 alanlarından ortak şema üretimi, native doğrulama, controller, idempotency tablosu ve PHP testlerini içerir. Aynı güvenilir alan fabrikası şemayı dışa aktarmak ve sunucu doğrulaması için kullanılır. Dinamik select için açık content provider eşlemesi gerekir. Filament’ın özel frontend’i editörün içine gömülmez.

Bu repository bir Laravel uygulaması veya gerçek CMS hesabı içermez. Bu ortamda PHP/Composer bulunmadığından PHP testleri burada çalıştırılmadı. Host projesinde `composer install` ve `composer test` ile doğrulanmalıdır. Canlı CMS bağlantısı host route’ları ve `FormRegistry` uygulaması sağlandığında tamamlanır.

## Yerel demo geçişi ve doğrulama

```sh
node --experimental-strip-types scripts/prepare-cms-forms.mjs
python scripts/migrate-cms-forms.py          # salt okunur önizleme
python scripts/migrate-cms-forms.py --apply  # önce doğrulanmış SQLite yedeği
```

Geçiş mevcut sayfa kimliklerini, form dışı içerikleri ve bağımsız belgeleri korur. Şablonlar 1.1.0 olarak oluşturulur; önceki sürümler ve eski form tanımları referanslarıyla birlikte arşivde tutulur. Sayfa revision’ları yükselir; eski açık editörün eski revision ile üzerine yazması engellenir. Yeni HTML aktarımları da aynı CMS form bileşenini kullanır.

`apps/demo/forms-acceptance.html` tarayıcıda şu yedi kontrolü çalıştırır: geçersiz girişin engellenmesi, güvenli önizleme, çift gönderim/timeout, eski seçenek yanıtı yarışı, destroy/abort, bağımsız statik runtime ve ziyaretçi değerinin editör snapshot’ına girmemesi. Birim testlerinde şema farkı, dependency cycle, seçenek capability kontrolü, seçili kayıt çözümleme, HTTP hata normalleştirme ve auth/idempotency aktarımı ayrıca denetlenir.
