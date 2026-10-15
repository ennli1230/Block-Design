# TR ana sayfa dışa aktarım kontrolü

Kullanıcının gönderdiği `958fe7462249dc3e9a010ade656c170c (2).html` ile `html/tr/index.html` karşılaştırıldı.

Eski çıktı, Studio demo sayfasının `body` için 48 px dış boşluk ve içerik slotu için 1120 px genişlik / 24 × 32 px iç boşluk kurallarını içeriyordu. Bunlar kaynak tasarımın parçası değildi. Eski GrapesJS kayıtlarından gelen bu varsayılanlar da dahil olmak üzere yabancı tasarım sistemlerinde kaldırıldı; özel CSS değerleri korunur. Stil dosyaları artık kullanıcı düzenlemelerinden önce paketlenir.

GrapesJS'in body kapsayıcısı ikinci bir body içine yerleştirilmiyor. Sayfanın kaydedilmiş başlık, açıklama ve canonical bilgileri HTML head içine ekleniyor. Font ve görseller tek dosyaya gömülüyor.

Kaynakta JavaScript ile oluşturulan tur arama dropdown'ları, turlar alt menüsü ve footer B2B / belge alanları kayıtlı kaynak davranışına eklendi. Bu geçici DOM öğeleri önizlemeden çıkıldığında temizlenir; düzenlenebilir blok şemalarına yazılmaz. Dropdown seçimi tarayıcıda doğrulandı, JavaScript hata kaydı oluşmadı.

`tr-anasayfa.html`, düzeltilmiş editörün gerçek HTML indirme akışından alınan dosyadır. Masaüstü 1280 × 720 ve mobil 390 × 844 ekranlarında kaynak ve çıktı ayrı ayrı aynı viewport ile ölçüldü. Sekiz ana bölümün genişlikleri, yükseklikleri ve footer yüksekliği her iki ekran boyutunda birebir eşleşti. Bu ölçüm sonucu `tr-anasayfa-karsilastirma.json` içinde bulunur; byte veya tüm piksel düzeyinde eşitlik iddiası değildir.

TypeScript kontrolü, JavaScript testleri, üç build biçimi ve bundle bütçeleri geçti. Regresyon kontrolleri eski kayıtların varsayılan CSS'ini, özel CSS'nin korunmasını ve kaynak stillerinin kullanıcı stillerinden önce yüklenmesini kapsar.
