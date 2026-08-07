# SEKİZ — Güvenlik raporu

Şartnamenin 7. bölümü "kendi kodunu hackle" diyor. Bu belge tahmin değil **deneme
sonucudur**: göçlerin tamamı gerçek bir Postgres örneğine kuruldu ve saldırı
senaryoları tek tek çalıştırıldı. 13 denemenin 13'ü beklendiği gibi sonuçlandı.

Denemeler `supabase/migrations/` altındaki dosyaların aynısıyla yapıldı; farklı bir
"test şeması" kullanılmadı.

---

## Mimarinin dayandığı üç kural

1. **Tarayıcıdaki anahtarla hiçbir tabloya erişilemez.** 12 tablonun tamamında RLS
   açık, hiçbir politika tanımlı değil, `anon` rolünün tablo yetkisi geri alınmış.
2. **Her erişim `SECURITY DEFINER` fonksiyondan geçer** ve fonksiyon önce kim olduğunu
   sorar. `search_path` her fonksiyonda sabitlenmiştir (arama yolu ele geçirme yok).
3. **Yetki kararı sunucuda verilir.** İstemci "ben öğretmenim" diyemez; jetonun
   hangi role ait olduğunu veritabanı bilir.

---

## Deneme sonuçları

### 1. Öğrenci koduyla başka bir öğrencinin verisi çekilebilir mi?

**Risk: yüksek · Sonuç: engellendi**

`anon` rolüyle `select * from ogrenciler` denendi → `permission denied for table
ogrenciler`. Aynısı `gonderimler` için de geçerli. Öğrenci/veli fonksiyonları yalnız
jetondaki `ogrenci_id` üzerinden çalışır; parametreyle başka öğrenci sorulamaz.

**Kalan risk:** Faz 2–3'te yazılacak her yeni fonksiyonda aynı disiplin gerekir.
Önlem: öğrenci verisi dönen fonksiyonlar öğrenci kimliğini **parametre olarak
almaz**, jetondan okur. Bu kural kod incelemesinde kontrol edilecektir.

### 2. Gönderim yapmadan cevap anahtarı ağ trafiğinden alınabilir mi?

**Risk: yüksek · Sonuç: engellendi**

- `odev_anahtar` doğrudan çağrıldı → *"Cevap anahtarı, çözüm gönderildikten sonra
  açılır."*
- `odev_detay` yanıtı incelendi → `anahtar`, `anahtar_pdf_yol`, `cozum_pdf_yol`
  alanları yanıtta **hiç yok** (gizlenmiş değil, sorguya alınmamış).
- Gönderimden sonra aynı çağrı anahtarı döndürdü; aynı sınıftaki göndermemiş öğrenci
  hâlâ göremedi.

**Kalan risk:** Gönderim yapan bir öğrenci anahtarı arkadaşına iletebilir. Bu
teknik değil sınıf yönetimi meselesidir; ödev süresi dolmadan anahtarı alan öğrenci
zaten kendi gönderimini yapmıştır.

### 3. Öğretmen fonksiyonları öğrenci koduyla çağrılabilir mi?

**Risk: yüksek · Sonuç: engellendi**

Öğrenci jetonuyla beş öğretmen fonksiyonu denendi (`siniflar_listele`,
`ogrenci_ekle`, `ogrenci_sil`, `kod_yenile`, `odev_olustur`) → beşi de
*"Bu işlem için yetkiniz yok."* Öğretmen işlemleri tek bir kapıdan (`sekiz_ogretmen`)
geçer; yeni fonksiyon yazarken bu satırın unutulması tek zayıf nokta olurdu, o yüzden
kapı tek satırdır ve her fonksiyonun ilk satırıdır.

### 4. PIN kaba kuvvetle denenebilir mi?

**Risk: yüksek · Sonuç: engellendi — ama bu maddede gerçek bir hata bulundu**

Denemede **6. yanlış PIN'de 900 saniyelik kilit** devreye girdi. Kilit iki katmanlı:
aynı cihazdan 5 hata, tüm cihazlardan toplam 25 hata.

> **Denemede bulunan hata:** İlk yazımda başarısız giriş `RAISE EXCEPTION` ile
> bitiyordu. Postgres'te hata fırlatmak çağrının tamamını geri alır — yani "başarısız
> deneme" kaydı da siliniyordu. Sonuç: oran sınırlama **hiç çalışmıyordu** ve PIN
> sınırsız denenebiliyordu. Giriş fonksiyonları, başarısız sonucu hata fırlatmadan
> nesne olarak dönecek biçimde yeniden yazıldı. Bu, ancak gerçekten denendiği için
> görülebilecek bir hatadır.

PIN düz metin saklanmıyor: `ayarlar` tablosunda bcrypt hash'i (`$2a$…`) duruyor,
karşılaştırma veritabanının içinde yapılıyor. `anon` rolüyle `ayarlar` tablosu
okunamıyor.

**Kalan risk — dürüst olmak gerekirse:** Sürekli yanlış PIN gönderen biri öğretmenin
girişini kilitli tutabilir (hizmet engelleme). Kilitliyken yeni deneme
**kaydedilmediği** için 15 dakika sessizlikte kilit kendiliğinden açılır; saldırgan
en fazla 15 dakikada bir tahmin hakkı kazanır. Ders sırasında bu can sıkıcı olabilir.
Azaltma seçeneği (gerekirse eklenir): öğretmen girişini tahmin edilemez bir adrese
taşımak (`/giris/ogretmen-<rastgele>`) ya da kilit süresini cihaz bazında tutup genel
katmanı yalnız uyarıya çevirmek.

### 5. Fotoğraf/PDF adresleri tahmin edilebilir mi?

**Risk: yüksek · Sonuç: şu an dosya yok; kova kapalı kuruldu · Faz 2'de tamamlanacak**

`odev-dosyalari` kovası **özel** (public = false) oluşturuldu; `storage.objects`
üzerinde bu kovaya ait **hiçbir politika yok**, dolayısıyla tarayıcıdaki anahtarla ne
okuma ne yazma mümkün. Sunucu tarafı sınırlar da kovada tanımlı: dosya başına
**3 MB** ve yalnız JPEG/PNG/WebP/PDF.

**Dürüst durum:** İmzalı ve süreli adres üretimi Faz 2'ye kaldı. Bunun sebebi şu:
imzalı adres üretmek `service_role` anahtarı ister ve bu anahtar istemciye asla
girmez — dolayısıyla araya bir Supabase Edge Function girecek (Faz 5'teki yapay zekâ
katmanı da zaten aynı yolu kullanacak). Faz 1 kapsamında yükleme/görüntüleme ekranı
olmadığı için açıkta duran dosya da yoktur; kova kapalı olduğundan varsayılan durum
güvenlidir. Faz 2'de kapı açılırken adresler imzalı ve **60 saniye** ömürlü olacak.

### 6. Mesaj alanına yazılan `<script>` çalışır mı (XSS)?

**Risk: orta · Sonuç: engellendi**

`<script>alert(1)</script>` mesaj olarak kaydedildi; veritabanında **değiştirilmeden**
duruyor (veri bozulmuyor). Arayüz tarafında React metni kaçışlayarak basar;
projede `dangerouslySetInnerHTML` **hiç kullanılmıyor** ve kullanılmayacak.

**Kalan risk:** Faz 2–3'te bir yerde HTML basma ihtiyacı doğarsa bu kural kırılır.
Önlem: kural belgeye yazıldı; ihtiyaç doğarsa metin, HTML olarak değil biçimli metin
olarak işlenecek.

### 7. Fonksiyon parametreleri üzerinden SQL enjeksiyonu mümkün mü?

**Risk: yüksek · Sonuç: engellendi**

Giriş koduna `' or 1=1 --` yazıldı → *"Bu kod bulunamadı."* Tablolar bozulmadı.
Sebep yapısal: fonksiyonların hiçbirinde dinamik SQL (`EXECUTE`, string birleştirme
ile sorgu) yok; tüm değerler parametre olarak geçiyor.

### 8. Bir öğrenci ödevi iki kez gönderip puanını yükseltebilir mi?

**Risk: orta · Sonuç: engellendi (iki katmanda)**

İlk gönderim 66,67 puan aldı. İkinci gönderim fonksiyonda reddedildi. Fonksiyon
atlanıp doğrudan `insert` denendi — veritabanı `gonderim_tek_kez` benzersizlik
kısıtıyla onu da reddetti. Yani kod hatası olsa bile ikinci gönderim mümkün değil.

Ek olarak: test puanı **sunucuda** hesaplanıyor. Anahtar istemciye hiç gitmediği için
öğrenci "doğru cevapları görüp öyle işaretleme" yapamıyor.

### 9. A öğrencisi kodunu B'ye verirse ne olur?

**Risk: orta · Sonuç: azaltıldı, tamamen çözülemez**

Kod paylaşılırsa B, A'nın ekranını görebilir. Teknik olarak bunu tamamen engellemenin
yolu yok (paylaşılan sır, paylaşılan sırdır). Alınan önlem: öğretmen **tek dokunuşla
kodu yeniliyor**. Denemede doğrulandı — kod yenilendiğinde:

- eski kodla giriş kapandı,
- eski kodla açılmış **oturumlar da düştü** (jeton anında geçersizleşti).

**Kalan risk:** Öğretmen durumu fark edene kadar geçen süre. Azaltma önerisi (Faz 2):
bir kodla aynı anda çok sayıda farklı cihazdan giriş olursa öğretmene bilgi
bildirimi düşsün — suçlama değil, bilgi.

### 10. Ek deneme — iç fonksiyonlar ve PIN hash'i tarayıcıdan erişilebilir mi?

**Risk: yüksek · Sonuç: engellendi**

`anon` rolüyle beş iç fonksiyon (`sekiz_kod_uret`, `sekiz_ozet`, `sekiz_oturum`,
`sekiz_ogretmen`, `sekiz_kilit_saniye`) çağrılmaya çalışıldı → beşi de kapalı.
`ayarlar` (PIN hash) ve `oturumlar` (jeton özetleri) tabloları okunamadı. Tarayıcıya
açık olan yalnız giriş kapıları ve kimlik doğrulaması yapan işlem fonksiyonları.

### 11. Ek deneme — süresi dolan ödev gönderilebilir mi?

**Risk: orta (iş kuralı) · Sonuç: engellendi**

Ödevin son tarihi geçmişe alındı, gönderim denendi → *"Bu ödevin süresi doldu.
Teslim tarihinden sonra gönderim yapılamaz."* Geç teslim ara durumu yok; kural
istemcide düğme gizleyerek değil sunucuda uygulanıyor.

### 12. Ek deneme — okul öğrencisine ödeme kaydı açılabilir mi?

**Risk: yüksek (etik/yasal) · Sonuç: veritabanı düzeyinde imkânsız**

Okul öğrencisine doğrudan `insert` ile ödeme kaydı denendi → veritabanı reddetti.
`dersler` ve `odemeler` tabloları `(ogrenci_id, ogrenci_tip)` bileşik yabancı
anahtarıyla bağlı ve `ogrenci_tip` yalnız `'ozel'` olabiliyor. Bu, arayüz hatasıyla
bile aşılamayacak bir sınır.

---

## Özet

| # | Madde | Risk | Durum |
|---|---|---|---|
| 1 | Başka öğrencinin verisi | Yüksek | Engellendi |
| 2 | Anahtarın erken alınması | Yüksek | Engellendi |
| 3 | Yetki sızıntısı | Yüksek | Engellendi |
| 4 | PIN kaba kuvvet | Yüksek | Engellendi (hata bulundu ve düzeltildi) |
| 5 | Dosya adresleri | Yüksek | Kova kapalı; imzalı adres Faz 2 |
| 6 | XSS | Orta | Engellendi |
| 7 | SQL enjeksiyonu | Yüksek | Engellendi |
| 8 | İki kez gönderim | Orta | Engellendi (iki katman) |
| 9 | Kod paylaşımı | Orta | Azaltıldı; tamamen çözülemez |

**Açık kalan iki iş:** (a) imzalı dosya adresi mekanizması — Faz 2, (b) öğretmen
girişinde hizmet engelleme riski — azaltma seçenekleri yukarıda, gerekirse uygulanır.
