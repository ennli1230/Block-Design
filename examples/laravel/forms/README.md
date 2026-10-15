# Filament 5 → BlockDesign formları

Bu klasör mevcut Laravel host’una alınacak entegrasyon örneğidir. Ana editör ve form runtime’ı CMS’den bağımsızdır. Filament 5, PHP tarafındaki alan tanımını otomatik üretmek için örnek paket olarak kullanılır. Resmî kaynaklar: [form tanımlama](https://filamentphp.com/docs/5.x/forms/overview), [alan doğrulama](https://filamentphp.com/docs/5.x/forms/validation).

## Tek alan fabrikası

```php
use Filament\Forms\Components\{Select, TextInput, Textarea};
use Filament\Schemas\Schema;
use BlockDesign\Forms\FilamentFormBridge;

// Gerçek uygulamada bu fabrika CMS form kaydından veya paket tanımından gelir.
// Aynı fabrika, gönderilen verinin bağlamıyla sunucu doğrulamasında da kullanılır.
$fields = Schema::make()->components([
    TextInput::make('full-name')->label('Adınız soyadınız')->required()->maxLength(120),
    TextInput::make('email')->label('E-posta')->email()->required(),
    Select::make('destination')->label('Destinasyon')->options(['efes' => 'Efes']),
    Textarea::make('message')->label('Mesaj')->required()->maxLength(3000),
])->getComponents();

$bridge = new FilamentFormBridge;
$definition = $bridge->definition('contact', '1.0.0', 'İletişim', $fields);
// POST sırasında aynı alan fabrikasından:
$validated = $bridge->validate($fields, $request->input('values', []));
```

Flat text/email/tel/number, textarea, select, radio, checkbox ve date alanları desteklenir. Gruplar, repeater, özel component’ler ve dosya/ödeme gibi türler açık hata verir. Koşullu görünürlük gibi daha geniş Filament özellikleri için host açık şema dönüştürücüsü sağlamalıdır; tam Filament davranış uyumluluğu iddiası yoktur. Sunucuya özel validation kuralları native Laravel tarafında çalışır. Model state/default closure’ları public şemaya çıkarılmaz.

Uzak veya bağımlı select için `definition` metodunun `optionSources` parametresi kullanılır:

```php
['tour' => [
    'providerId' => 'cms-content',
    'collectionId' => 'tours',
    'labelField' => 'title',
    'dependencies' => [['fieldId' => 'destination', 'filterField' => 'destinationId']],
]]
```

Filament formunun native seçenek/validation fabrikası, seçilen turun gerçekten seçilen destinasyona ait olduğunu sunucuda da doğrulamalıdır. Tarayıcıdan gelen `context` veya gizli alanlar yetki kaynağı değildir.

## Host bağlama

1. `src` sınıflarını uygulamanın autoload yapısına ekleyin; `FormRegistry` sözleşmesini CMS’nizle uygulayıp service container’a bind edin. Her işlemde exact form/sürüm ve tenant/actor yetkisini registry doğrulamalı.
2. `database/create_form_receipts.php` dosyasını normal tarihli bir Laravel migration dosyası olarak ekleyin ve migrate edin.
3. GET `/editor/forms`, GET `/editor/forms/{id}/versions/{version}` route’larını `FormController::index/show` metodlarına bağlayın; editör auth middleware’ini uygulayın.
4. POST `/public/forms/{id}/versions/{version}/submissions` route’unu `FormController::submit` metoduna bağlayın. Host’un public form, throttle ve oturum/CSRF politikasını uygulayın.
5. `FormRegistry::execute` içindeki iş kayıtlarını aynı DB bağlantısı ve transaction içinde yapın; dış sistem işlerini transaction commit sonrasında çalıştırın. Unique receipt rezervasyonu yarışan isteklerin aynı iş kaydını iki kez oluşturmasını engeller. Farklı bağlantı/dış servis için host transactional outbox veya eşdeğer garanti sağlamalıdır.

`FormRegistry::scope`, scope’u oturum/yetkili kullanıcı/tenant gibi sunucu kaynaklarından üretir. Receipt tablosunda ziyaretçi payload’ı tutulmaz; yalnızca fingerprint ve işlem sonucu saklanır. Kayıtların saklama süresini host belirler.

Paket ve test bağımlılıkları bu alt klasörün `composer.json` dosyasındadır. PHP/Composer bulunan bir ortamda:

```sh
composer install
composer test
```

Bu çalışma alanında PHP/Composer yoktur; PHP testleri çalıştırılmamıştır. TypeScript HTTP adapter’ları ve browser runtime kabul testleri ana projede çalıştırılır. [Tam entegrasyon rehberi](../../../docs/CMS-FORM-ENTEGRASYONU.md).
