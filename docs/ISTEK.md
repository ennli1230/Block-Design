# Orijinal proje isteği

Kayıt tarihi: 11 Ekim 2026 (Europe/Istanbul).

Aşağıdaki metin kullanıcının ilk proje mesajıdır. Plan ve uygulama kararları ayrı belgelerde tutulur; bu metin sonraki kapsam kontrolleri için korunur.

---

Bu verdiğim metni daha sonra kontrol etmek için md dosyasında da kaydet, kod yazmadan önce plan oluştur öyle kod yazmaya başlayacağız
Sıfırdan, açık kaynak olarak paylaşılabilecek ve farklı uygulamalara eklenebilecek bağımsız bir görsel blok ve sayfa tasarım editörü geliştir.

Bu proje yeni ve bağımsız bir projedir. Mevcut başka bir uygulamadan kod, veritabanı, içerik modeli veya iş kuralı kopyalama.

Amacımız bir CMS veya yönetim paneli geliştirmek değildir. Amacımız kendi HTML/CSS tasarımlarından yönetilebilir bloklar oluşturabilen ve bu bloklarla sayfa tasarlayabilen, farklı backend’lere bağlanabilen bir editör geliştirmektir.

1. TEKNOLOJİ VE MİMARİ

- Backend referans uygulaması Go ile yazılacak.
- Uygulama sırasında güncel ve desteklenen kararlı Go sürümünü doğrula; sürümü go.mod içinde belirt.
- Frontend Vue 3, TypeScript ve Vite kullanacak.
- Görsel düzenleme motoru GrapesJS açık kaynak core olacak.
- GrapesJS Studio SDK kullanma.
- Go sunucusu örnek API, kalıcı saklama ve demo içerik sağlayıcısını sunacak.
- Editörün çalışması Go sunucusuna zorunlu olarak bağlı olmayacak.
- Başka backend’ler editörün adapter sözleşmelerini uygulayarak bağlanabilecek.

Editörü başka uygulamalara eklenebilen bir modül olarak hazırla:

  mountEditor(element, options)

Bu giriş noktası en az şu seçenekleri desteklesin:
- Başlangıç belgesi
- Saklama adapter’ı
- Blok kütüphanesi adapter’ı
- İçerik sağlayıcıları
- İsteğe bağlı medya sağlayıcısı
- Dil
- Düzenleme modu
- Değişiklik, kaydetme ve hata callback’leri

Açılan editör için destroy/cleanup işlemi bulunsun. Event listener, iframe ve çalışma zamanı bileşenleri temizlenebilsin.

Vue uygulaması içinde kullanımın yanında, normal bir HTML sayfasına JavaScript/CSS dosyalarıyla ekleme örneği de sun. Entegratörün kendi frontend’ini Vue’ya çevirmesi gerekmesin.

Kod sorumluluklarını ayır:
- TypeScript editör çekirdeği: belge, şema, alan eşleme, repeater ve içerik bağlantıları.
- GrapesJS entegrasyonu: component modelleri ve tuval.
- Vue arayüzü: paneller, formlar, katalog ve kullanıcı akışları.
- Go referans sunucusu: API, saklama ve demo sağlayıcılar.
- Ortak sözleşmeler ve örnekler.

Bu aşamada giriş, kayıt, kullanıcı ve rol ekranları oluşturma. Yerel örnek sunucu varsayılan olarak localhost üzerinden çalışsın. Başka uygulamalar kendi kimlik doğrulama bilgilerini adapter’ın HTTP istemcisi üzerinden iletebilsin.

2. BACKEND BAĞIMSIZLIĞI

Frontend içinde SQL tabloları, Go struct’ları veya belirli bir CMS’in modellerine bağlı kod bulunmasın.

Şu adapter’ları ayrı tanımla:
- StorageAdapter: belge yükleme ve kaydetme.
- BlockLibraryAdapter: blok tanımlarını listeleme ve yönetme.
- ContentProviderAdapter: koleksiyon, alan şeması, arama, kayıt çözümleme ve sorgu.
- AssetAdapter: isteğe bağlı medya arama, seçme ve yükleme.

Desteklenmeyen özellikler capability bilgisiyle belirtilsin. Arayüz yalnızca gerçekten kullanılabilir özellikleri sunsun.

Go API için hazır HTTP adapter’ı yaz. Başka backend’in aynı URL yapısını kullanması zorunlu olmasın; kendi adapter’ını verebilsin.

Go örnek API’sini OpenAPI ile belgele. HTTP handler, uygulama mantığı ve repository sorumluluklarını ayır.

Yerel kurulum için SQLite ile kalıcı saklama sağla. Veritabanını repository arayüzünün arkasında tut. Driver’ın bakım ve lisans durumunu kontrol ederek bağımlılık sürümünü sabitle.

3. VERİ MODELİ

Aşağıdaki kavramları birbirinden ayır:

Tasarım sistemi:
- Bir HTML/CSS tasarım ailesi, ortak varlıkları ve blok kütüphanesidir.
- Farklı siteler için farklı tasarım sistemleri oluşturulabilir.
- Her sayfa ilk sürümde bir tasarım sistemi kullanır.
- Bir sistemdeki değişiklik başka sistemi etkilemez.

Blok tanımı:
- Ad, açıklama, kategori ve önizleme.
- GrapesJS component yapısı.
- Alan şeması ve varsayılan veriler.
- Bloka özgü CSS ve ortak tasarım bağımlılıkları.
- İzin verilen düzenleme ve stil özellikleri.
- İçerik kaynağı yetenekleri.
- Sürüm ve arşiv durumu.

Blok örneği:
- Belirli bir blok tanımı sürümüne bağlıdır.
- Manuel içeriği, kaynak ayarları ve alan eşlemeleri vardır.
- Aynı bloktan iki örnek bırakıldığında içerikleri bağımsızdır.

Paylaşılan bölge:
- Header veya footer gibi yeniden kullanılabilen bölgedir.
- Düzenlenebilir alanları ve sürümü vardır.

Sayfa şablonu:
- Header, içerik ve footer alanlarını tanımlar.
- Yerleşimi, zorunlu blokları ve izin verilen içerik alanlarını belirler.
- Kaydedilip farklı örnek sayfalarda kullanılabilir.

Editör belgesi:
- Sayfa yapısını, kullanılan sürümleri, blok örneklerini ve editör durumunu birlikte saklar.

Tek bir sürümlü belge zarfı kullan:
- documentVersion
- engine ve engineVersion
- revision
- designSystemRef
- şablon ve paylaşılan bölge referansları
- blok örnekleri, içerikleri ve kaynak ayarları
- GrapesJS projectData

GrapesJS project JSON’u yeniden açma için sakla. HTML/CSS çıktısı yeniden düzenleme formatı değildir.

İçerik verisinin tek bir doğruluk kaynağı olsun. Görsel tuval değişikliği, alan formu değişikliği ve kaydetme sırasında birbirinden kopmuş iki içerik kopyası oluşmasın.

4. TASARIMCI VE İÇERİK DÜZENLEME MODLARI

İki anlaşılır düzenleme modu oluştur:

Blok tasarlama:
- HTML yapısı ve yerleşim düzenlenebilir.
- Alanlar ve repeater’lar tanımlanır.
- Kullanıcının değiştirebileceği stiller seçilir.
- Blok varyantları oluşturulabilir.

İçerik düzenleme:
- Kullanıcı tanımlanmış alanları doldurur.
- Repeater öğelerini ekler, siler ve sıralar.
- İçerik kaynağını seçer.
- Yalnızca izin verilen stilleri değiştirebilir.
- Kilitli tasarım yapısı korunur.

Bu ayrımı ilk sürümde kullanıcı/rol sistemiyle değil, editör modu ve yapılandırmasıyla sağla.

Tuvalde bloğun içindeki bir alt öğeye tıklanınca ait olduğu bloğun içerik paneline erişilebilsin. Seçili öğe ve üst blok ilişkisini breadcrumb ile göster.

Düzenleme sırasında seçim davranışı; önizleme sırasında akordiyon, bağlantı ve slider etkileşimi çalışsın.

5. SIFIRDAN GÖRSEL BLOK OLUŞTURMA

Kullanıcı HTML import etmeden de blok oluşturabilsin.

En az şu yapı taşlarını sun:
- Section
- Container
- Satır ve responsive sütunlar
- Başlık
- Metin
- Görsel
- Bağlantı ve buton
- Akordiyon/listeli içerik
- Tekrarlanan kart veya öğe alanı

Kullanıcı section oluşturup iki sütun ekleyebilsin. Solda başlık/açıklama, sağda akordiyon yerleştirerek kendi SSS bloğunu oluşturabilsin.

Yapı taşlarının varsayılan görünümü tasarım sisteminden gelsin. Tasarımcı CSS sınıfları ve izin verilen stil kontrolleri üzerinden düzenleyebilsin.

6. HTML/CSS’TEN BLOK OLUŞTURMA

Kullanıcı:
- HTML/CSS yapıştırabilsin veya dosyadan içeri alabilsin.
- Tam sayfa import ettiğinde section/article gibi blok adaylarını görebilsin.
- Adayın görsel önizlemesini seçebilsin.
- İlgili bölümü blok tanımına dönüştürebilsin.

HTML’den tüm veri şemasını otomatik anladığını varsayma. Sistem öneriler üretebilir; kullanıcı görsel eşlemeyi doğrulayabilir.

CSS yönetimini iki düzeyde kur:
- Tasarım sisteminin ortak CSS, font ve diğer varlıkları.
- Bloka özgü CSS ve yerel değişiklikler.

Ortak CSS’i sayfada bir kez yükle. Canvas iframe’i editör arayüzünü izole etsin. Aynı sayfadaki blokların stillerinin birbirini bozmasını engelle.

CSS dönüşümü gerekiyorsa gerçek CSS parser kullan; karmaşık selector ve at-rule dönüşümlerini regex ile yapma.

Responsive kurallar, CSS değişkenleri, fontlar ve animasyon bağımlılıklarını yönet. Bağıl varlık adreslerini kaynak taban adresiyle çözümle.

Her HTML’in eksiksiz desteklendiğini iddia etme. Import raporu şunları göstersin:
- Korunan alanlar ve bağımlılıklar.
- Çıkarılan riskli içerik.
- Eksik varlıklar.
- Desteklenmeyen etkileşimler.
- Kullanıcıdan eşleme bekleyen noktalar.

7. GÖRSEL ALAN VE REPEATER TANIMLAMA

Kullanıcı HTML/CSS selector veya JSON yazmak zorunda kalmasın.

Bir öğeyi seçip “Düzenlenebilir alan yap” diyebilsin:
- Etiket ve anahtar önerilsin.
- Alan türü seçilebilsin.
- Hangi metin veya HTML niteliğinin değişeceği açıkça gösterilsin.

En az text, textarea, güvenli rich text, URL, image, video, number, boolean, select ve color alanlarını destekle.

Repeater tanımlarken:
- Liste kapsayıcısı seçilir.
- Örnek öğe seçilir.
- Örnek öğenin içindeki alanlar eşlenir.
- Minimum/maksimum öğe sayısı belirlenir.
- Öğe ekleme, silme, kopyalama ve sıralama çalışır.

Bir blokta birden fazla bağımsız repeater bulunabilsin. İç içe repeater desteğinin kapsamını açıkça belirle; desteklenmeyen yapıların sessizce bozulmasına izin verme.

Kararlı alan ve öğe kimlikleri kullan. Kopyalanan HTML’de id, label-for, aria-controls ve ilgili referansların çakışmasını önle.

Repeater işlemleri geri al/yinele geçmişinde tek bir kullanıcı işlemi olarak ele alınsın. Sayı sınırları ve alan doğrulamaları kaydetmede de kontrol edilsin.

Alan eşleme sırasında başka öğeye tıklamak doldurulmuş form verisini kaybettirmesin.

8. BLOK İÇERİK KAYNAKLARI

Bu özellik yalnızca görsel seçmekle ilgili değildir. Kullanıcı seçili bloğun İçerik panelinden veriyi nasıl sağlayacağını belirler.

Desteklenen modlar:

Manuel:
- Kullanıcı alanları ve repeater satırlarını kendisi doldurur.

Kayıt seçimi:
- Bağlı içerik sağlayıcısında arama yapar.
- Belirli kayıtları veya kayıt grubunu seçer.
- Seçim sırasını düzenleyebilir.

Otomatik sorgu:
- Sağlayıcının desteklediği filtre, sıralama ve limit seçeneklerini kullanır.
- Örneğin son eklenenler veya belirli kategorideki kayıtlar.
- Keyfi SQL veya backend kodu çalıştırma.

Kaynak bir bloğun tamamına veya belirli veri alanına/listeye bağlanabilsin. Örneğin SSS başlığı manuel kalırken sorular bir kayıt grubundan gelebilir.

Backend alanlarıyla blok alanları eşlenebilsin:
- question ← kayıt.title
- answer ← kayıt.body
- image ← kayıt.cover

İçerik sağlayıcısı koleksiyon şemasını ve desteklediği işlemleri bildirsin. Eksik alan, silinmiş kayıt ve kaynak hatası arayüzde anlaşılır biçimde gösterilsin.

Kaynak modu değişince önceki manuel verileri sessizce silme. Kullanıcı geri döndüğünde manuel taslağı korunabilsin.

İlk sürümde kaynak verisi salt okunur olsun. Kaynağı düzenlemek için ilgili uygulamaya yönlendirme bilgisi desteklenebilir.

Demo sağlayıcıyla kayıt seçimi ve otomatik sorgu akışlarını göster. Gerçek blog, ürün veya tur modellerini editör çekirdeğine gömme.

9. ÖNİZLEME VE DIŞA AKTARMA

Önizleme ile export aynı veri çözümleme, alan eşleme ve render mantığını kullansın.

İki çıktı türünü ayır:

Statik çıktı:
- O anda çözümlenmiş içerikle HTML/CSS/JS ve gerekli varlıkları üretir.

Dinamik belge:
- Kaynak kimliği, kayıt referansları, sorgu ayarları ve alan eşlemelerini saklar.
- Entegrasyon sırasında sağlayıcı bu kayıtları yeniden çözümler.

Dinamik sorgu sonuçlarını kalıcı manuel içerik gibi saklama. Önizleme cache’i varsa kaynağı ve güncellenme zamanı belli olsun.

Slider ve benzeri etkileşimler için kayıtlı davranış eklentileri oluştur. Eklentiler:
- Destekledikleri HTML yapısını tanımlar.
- Gerekli CSS/JS bağımlılıklarını belirtir.
- Başlatma, güncelleme ve temizleme işlemlerini sağlar.
- Export sırasında gerekli bağımlılıkların eklenmesini sağlar.

Kullanıcıdan alınan keyfi script, event handler ve javascript: URL’lerini çalıştırma. İçe alınan tasarımın desteklenmeyen JavaScript etkileşimi varsa import raporunda belirt.

Akordiyonda uygun olduğunda native details/summary kullan.

10. SÜRÜMLEME, ARŞİVLEME VE KAYDETME

Blok ve paylaşılan bölge örnekleri belirli sürümlere bağlı olsun.

Yeni sürüm mevcut sayfaları kendiliğinden değiştirmesin. Kullanıcı yeni sürüme geçişi seçebilsin; alan uyumsuzluğu varsa gösterilsin.

Arşivlenen tanımlar yeni ekleme listesinden kalksın. Mevcut örnekleri açılabilsin.

Kullanımda olan sürümü kalıcı silme. Kullanılmayan tanımı silerken referansları kontrol et.

Kaydetmede revision kontrolü kullan. İki sekme aynı belgeyi değiştirdiğinde son yazma işlemi diğerini sessizce ezmesin. Çakışma durumunda kullanıcıya kurtarma seçeneği sun.

Kaydediliyor, kaydedildi, kaydedilemedi ve kaydedilmemiş değişiklik durumlarını göster. Kaydetme başarısızken başarılı mesajı verme.

11. KULLANIM ÖRNEKLERİ

SSS:
- İki sütun oluştur.
- Solda başlık ve açıklama alanları olsun.
- Sağda soru/yanıt repeater’ı bulunsun.
- Kullanıcı soru ekleyebilsin, silebilsin ve sıralayabilsin.
- Sorular manuel veya sağlayıcıdaki kayıt grubundan gelebilsin.
- Önizleme ve statik çıktıda akordiyon çalışsın.

Banner:
- Başlık, açıklama, görsel, alt metin ve isteğe bağlı buton/link alanları.
- Repeater gerekmiyorsa liste paneli gösterilmesin.

Slider:
- slides listesinde görsel, alt metin, başlık, açıklama ve bağlantı alanları.
- Manuel slayt veya desteklenen kaynak kayıtları kullanılabilsin.
- Sayfada iki slider birbirinden bağımsız çalışsın.
- Repeater değiştiğinde slider yeniden doğru biçimde başlatılsın.

Kart listesi:
- Kullanıcı kartları manuel girsin, belirli kayıtları seçsin veya sorgu kullansın.
- Backend alanları görsel/başlık/açıklama/link alanlarına eşlenebilsin.

Yeni tasarım:
- Yeni tasarım sistemi aç.
- Farklı HTML/CSS import et.
- Yeni bloklar oluştur.
- Eski tasarım sisteminin bloklarının ve kayıtlarının etkilenmediğini doğrula.

Sayfa şablonu:
- Header, içerik alanı ve footer seç.
- Bunları şablon olarak kaydet.
- Şablondan örnek sayfa oluştur.
- Kilitli bölgeleri koruyarak içerik alanına blok ekle.

12. GELİŞTİRME AŞAMALARI VE TESLİMAT

Önce yeni deponun durumunu kontrol et. Mevcut başka proje klasörüne yazma.

Kısa mimari planı ve sözleşmeleri oluşturduktan sonra şu sırayla çalışan ürünü geliştir:

Aşama 1:
- Bağımsız editör giriş noktası.
- Go kaydetme/yükleme servisi.
- Blok kataloğu ve temel yapı taşları.
- Görsel alan eşleme.
- Repeater.
- SSS ve banner örnekleri.

Aşama 2:
- HTML/CSS import.
- Tasarım varlıkları ve import raporu.
- Slider davranış eklentisi.
- Önizleme ve statik export.

Aşama 3:
- Manuel, kayıt seçimi ve sorgu modları.
- Backend alan eşleme.
- Demo sağlayıcı.
- Özel backend adapter örneği.

Aşama 4:
- Header/footer ve sayfa şablonları.
- Blok sürümleri ve güvenli arşivleme.
- Paketleme, kurulum ve entegrasyon belgeleri.

AI alan/blok önerisi bu akış tamamlandıktan sonra isteğe bağlı sağlayıcı olarak eklenebilir. AI olmadan ürün bütünüyle çalışmalıdır.

Açık kaynak dağıtımı için:
- README ve .env.example.
- Go ve frontend kurulum/başlatma komutları.
- Veritabanı migration’ları.
- OpenAPI belgesi.
- Adapter ve provider örnekleri.
- Hazır FAQ, banner, slider ve kart blokları.
- Üçüncü taraf lisans bildirimleri.
- Sürüm ve belge uyumluluğu açıklaması.

Anlamlı otomatik kontrolleri ve kullanıcı kabul akışlarını doğrula. Özellikle:
- Kaydetme/yeniden yükleme.
- Repeater kimlikleri ve sıralama.
- Kaynak modu değiştirme.
- Alan eşleme.
- Sürüm geçişi.
- CSS ve runtime bağımlılıklarının export edilmesi.
- Aynı bloktan birden fazla örneğin bağımsızlığı.
- Canvas ve panel scroll davranışı.

İlk ana kabul senaryosu:
Boş tuvalde iki sütun oluştur → sola başlık/açıklama ekle → sağa akordiyon koy → soru/yanıt repeater’ını tanımla → bloğu kaydet → örnek sayfaya bırak → üç soru ekle → kaydet ve yeniden aç → statik çıktıyı tarayıcıda aç → tasarımın ve akordiyonun çalıştığını doğrula.

Tamamlanmayan özelliği tamamlanmış gibi sunma. Her aşamada çalışan akışları, doğrulama sonucunu ve gerçek sınırlamaları kısa biçimde raporla. Gerçek bir engel yoksa işi yalnızca plan yazarak bırakma.
