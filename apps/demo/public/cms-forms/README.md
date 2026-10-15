# CMS form örnekleri

`catalog.json` form seçicinin listesidir. `<formId>/<version>.json` dosyaları
CMS'den gelecek `FormDefinition` sözleşmesinin doğrudan örnekleridir.
`options.json` destinasyon ve tur kayıtlarını sağlar. Tur alanının
`dependencies` tanımı, destinasyon değiştiğinde seçenekleri yeniden sorgular.

Güncel yedi form `1.1.0` sürümündedir. `1.0.0` dosyaları eski şablonların
sabitlenmiş sürümlerini korur. Yayınlanmış bir şema değiştirileceği zaman
yeni sürüm oluşturulur ve katalogdaki referans güncellenir.

Yerel ekran: `http://127.0.0.1:4173/?view=forms`

Bu dosyalar örnek CMS verileridir; harici bir CMS bağlantısı veya başvuru
kayıt servisi değildir. Önizleme alanı hiçbir veri göndermez veya saklamaz.
Gerçek Laravel veya başka CMS entegrasyonunda `FormProviderAdapter` ve
`ContentProviderAdapter` bu sözleşmelere dönüştürülür; gönderim için
`FormActionAdapter` bağlanır. Mevcut `HttpFormProviderAdapter` standart
`GET /forms` ve `GET /forms/{id}/versions/{version}` uçlarını destekler.
