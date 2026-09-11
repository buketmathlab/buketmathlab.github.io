# KVKK ve Gizlilik Notları

**Bu belge hukuki görüş değildir.** Teknik bir envanter ve dikkat
listesidir. Doğrulanmamış hiçbir hukuki iddia yazılmamıştır. Uyum
değerlendirmesi için okul yönetimi ve gerekiyorsa hukuk desteği gerekir.

> **Son güncelleme: 0034 (veli onamı).** Bundan önceki hâli 11 Ağustos'tan
> kalmaydı ve **bayatlamıştı**: "çözüm fotoğrafları bugün korumasız"
> diyordu, oysa o açık kapatılalı çok oldu. Bir onam metni yazarken bu
> belgeye bakılacağı için önce belge gerçeğe getirildi — bayat belgeden
> yazılan onam metni veliye **yanlış** bilgi verirdi.

## Neden önemli

Sistemde **reşit olmayan öğrencilerin** kişisel verisi işleniyor. Bu, KVKK
açısından özel dikkat gerektiren bir durumdur ve velinin bilgilendirilmesi
ile okulun onayı büyük olasılıkla gerekir.

## İşlenen veri envanteri

**"Öğretmen" artık tek kişi değil.** 0033'ten sonra sistemde dört öğretmen
var. Kapsam kuralı: bir öğretmen yalnız **kendi** sınıflarını ve
öğrencilerini görüyor (`_ogretmenin_ogrencisi`, `_ogretmenin_sinifi`);
sahip hepsini görüyor. Özel ders (dersleri, ödemeleri ve o velilerle
yazışma) yalnız sahipte. Ölçümü:
`supabase/testler/ogretmen_kapsami_testleri.sql`.

| Veri | Nerede | Kim görebiliyor |
|---|---|---|
| Öğrenci adı soyadı | `ogrenciler.ad` | Kapsamındaki öğretmen, ilgili öğrenci, ilgili veli |
| Sınıf | `ogrenciler.sinif` | aynı |
| Öğrenci / veli giriş kodu | `giris_kodlari.kod` | Öğretmen üretir ve paylaşır |
| Ödev çözümü fotoğrafı | Storage `odev-dosyalari` (private) | Yalnız sahibi, velisi ve kapsamındaki öğretmen — her açışta yeni, 60 sn ömürlü imzalı URL |
| Cevaplar, puan, öğretmen yorumu | `gonderimler` | Öğretmen, öğrenci, veli |
| Öğretmen–veli mesajları | `mesajlar` (`kanal='veli'`) | Öğretmen ve ilgili veli — **öğrenci görmez** |
| Öğretmen–öğrenci mesajları | `mesajlar` (`kanal='ogrenci'`) | Öğretmen ve öğrenci — **veli görmez** |
| Ders planı | `dersler` | Özel ders öğrencisi ve velisi |
| Ödeme kaydı | `odemeler` | Özel ders **velisi** (öğrenci görmez) |
| Öğretmen PIN'i | `ogretmenler.pin_hash` | Hiç kimse — bcrypt, yedeğe de girmiyor |
| Veli onamı | `veli_onaylari` | Öğretmen (yalnız "verdi / vermedi") |

**Fotoğraf açığı KAPANDI.** Belgenin eski hâlindeki "URL'i bilen herkes"
uyarısı artık geçerli değil: bucket private, imzalı URL 60 saniyelik ve
yetki kararını Edge Function değil **veritabanı** veriyor
(`dosya_erisim_izni`; `supabase/functions/dosya-url/index.ts`). Ölçümü
`supabase/testler/guvenlik_denetimi.sql` 2a–2c.

**60 SANİYE BAKMA SÜRESİ DEĞİL, BAĞLANTININ ÖMRÜ.** Öğretmen onam metnini
okuyup haklı olarak sordu: "yani öğretmen ödev kâğıdına sadece altmış
saniye mi bakabilecek?" Hayır — ekranlar fotoğrafı **her açışta** yeniden
adresliyor (`dosyaAdresi()`; `OdevGonderimleri.tsx`, `Odevler.tsx`,
`OdevTeslim.tsx`), adres hiçbir yerde saklanmıyor. Öğretmen dilediği
zaman, dilediği kadar bakabiliyor. Kısa ömür, bağlantı kopyalanır ya da
bir kayda düşerse bir dakika içinde ölsün diye.

Onam metninden bu rakam **çıkarıldı** (sürüm 4): veliye bir şey
anlatmıyordu, yalnız yanlış anlaşılıyordu. Metin artık ne olduğunu ve ne
olmadığını birlikte söylüyor.

## Barındırma ve yurt dışı aktarım

Supabase projesi **Zürih (eu-central-2)** bölgesinde — öğretmen tarafından
teyit edildi. Yani veriler **İsviçre'de** tutuluyor.

Bu, KVKK açısından bir **yurt dışına aktarım** durumudur. Değerlendirilmesi
gereken noktalar:

- Aktarımın hangi hukuki dayanağa göre yapıldığı (açık rıza, taahhütname,
  yeterlilik kararı vb.) belirlenmelidir.
- KVKK'nın yurt dışına aktarım rejimi 2024'te değişti; güncel mevzuata göre
  değerlendirme yapılmalıdır.
- Bu belgeyi yazan taraf hukukçu değildir; **hangi dayanağın geçerli olduğu
  konusunda iddia içermez.**

**Yapılması gereken:** Okul yönetimine barındırma bölgesinin İsviçre olduğu
bildirilmeli ve uygun dayanağın belirlenmesi istenmelidir.

## Veli onamı (0034)

Veli, uygulamaya ilk girişinde bir onam metni okuyup onaylıyor.
**Onaylamayan veli panele giremiyor** — öğretmenin kararı bu yönde oldu.

- Metin: `app/src/lib/onam-metni.ts`. İçeriği bu belgedeki envantere
  dayanıyor: neye izin veriliyor, hangi veri tutuluyor, kim görüyor,
  nerede saklanıyor, onaylamamanın sonucu.
- Metin ayrıca velinin **çocuğun öğrenci uygulamasını kullanmasına** izin
  verdiğini açıkça söylüyor; ad, soyad, sınıf, ödevler ve notlar tek tek
  sayılıyor.
- **Okul adı: iki ayrı şey karıştırılmıştı (sürüm 5'te düzeltildi).**
  Şemada okul adı alanı **yok** (`siniflar` yalnız seviye + şube), yani
  okul adı **çocuğun kaydına yazılmıyor**. Ama okulun adı **uygulamanın
  kimliğinde var**: `SchoolCrest.tsx` mührün `alt` metninde tam adı
  taşıyor ve `GirisEkrani.tsx` giriş ekranında görünür metin olarak
  yazıyor — her velinin ilk gördüğü ekran. Metin bir tur boyunca "hiçbir
  yerde saklanmıyor" diyordu; bu **yanlıştı** ve öğretmen fark etti.

  **Asıl ders ölçümde:** test o yanlış cümleyi `toContain` ile
  kilitliyordu. Yanlış bir iddiayı koruyan ölçüm kusuru bulmaz, gizler.
  Yeni test metnin sözlerini değil, **ürünle çelişmediğini** ölçüyor:
  `SchoolCrest.tsx` okunuyor ve metin okul adının görünürlüğünü inkâr
  eden bir cümle taşıyamıyor.

  Sürüm 6'da maddenin sonundaki *"çocuğunuza ait bir kayıt değil"* kuyruğu
  da kaldırıldı (öğretmenin isteği): cümle zaten "kaydına yazılmıyor" diye
  başlıyordu, kuyruk aynı şeyi tekrar ediyordu.
- **Kapsam doğru anlatılıyor (sürüm 3).** Metin bir tur boyunca "matematik
  zümresindeki öğretmenler — dört kişi" diyordu; bu **yanlıştı**. 0033'ün
  kuralı: her öğretmen yalnız kendi sınıflarındaki öğrenciyi görüyor,
  sahip ise yönetim için hepsini. Metin artık bunu söylüyor.
- **Öğrencinin girişi onama bağlı değil.** Kapı yalnız veli rolünde;
  onam gelmese de çocuk ödevlerini görüp gönderebiliyor. Metin bunu
  saklamıyor ve veliye yol gösteriyor: çocuğun kullanmasını istemiyorsa
  öğretmene söyler, hesap kapatılır.
- Kayıt: `veli_onaylari` (öğrenci, **metin sürümü**, onay zamanı). Sürüm
  tutuluyor ki metin değiştiğinde eski onay yeni metni **kapsamasın**;
  `app/src/lib/onam-metni.test.ts` metnin hash'ini sürümle kilitliyor.
- Kapı **sunucuda**: veli jetonu kabul eden her RPC `_onam_kapisi()`
  çağırıyor. `veli_paneli` istisna — hata vermek yerine yalnız
  `onam_gerekli` döndürüyor ki veli metni görebilsin. Ölçümü
  `supabase/testler/onam_testleri.sql` (9 grup; 9. grup beyaz liste dışı
  her ucu tarıyor).
- **Öğrenci etkilenmiyor:** kapı yalnız veli rolünde çalışıyor.
- Onay **yedeğe giriyor** (`disa_aktar` → `geri-yukle.sql`); felaket
  provasında gerçek bir satırla ölçülüyor.
- **Onayı kimin verdiği kayıtlı (0038).** Veli onaylarken adını soyadını
  yazıyor; ad, onay tarihi ve metin sürümüyle birlikte saklanıyor.
  **Dürüst sınır:** bu ad velinin kendi beyanıdır, kimlik doğrulaması
  değildir — döküm kâğıdında da böyle yazıyor.
- **Sınıf başına onam dökümü (0038).** Veliler → bir sınıf → *Onam
  dökümü* → Yazdır → "PDF olarak kaydet". Belgede öğrenci adı, onaylayan
  velinin adı, onay zamanı, özet sayılar ve **metnin tamamı** var; yani
  "kim, ne zaman, neye" üçü de aynı kâğıtta. Kapsam kuralı burada da
  geçerli: bir öğretmen yalnız kendi sınıfının dökümünü alabiliyor
  (`onam_dokumu`, `_ogretmenin_sinifi`).

### Metnin SÖYLEMEDİKLERİ — bilinen boşluk

Öğretmenin isteğiyle sürüm 3'te üç şey çıkarıldı. İkisi zararsız: "test
puanlamasında yapay zekâ yok" ve "veli cevap anahtarını görmez" doğru olan
ama söylenmesi zorunlu olmayan güvence cümleleriydi; Kural 5 ve Kural 6
ürüne ait ve `guvenlik_testleri.sql` 8./10. gruplarında ölçülmeye devam
ediyor.

Üçüncüsü **gerçek bir boşluk**: *"Özel ders alıyorsa ders planı ve ödeme
kaydı"* satırı kaldırıldı. Oysa `dersler` ve `odemeler` özel ders
öğrencilerinde **gerçekten tutuluyor** ve veli ödemeleri kendi panelindeki
Ödemeler sekmesinde **görüyor**. Metin "aşağıda sayılanların saklanmasına
izin veriyorum" dediği için, saydıkları arasında olmayan bir veri
saklanıyor. Öğretmene bu sonuç açıkça söylendi ve kararını tekrarladı;
burada kayıt altına alınıyor. Özel ders veren tek kişi platformun sahibi
olduğu için kapsam dar, ama boşluk boşluktur.

**Bu bir hukuki uygunluk beyanı değildir.** Metin ürünün ne yaptığını
dürüstçe anlatır; mevzuata uygunluk değerlendirmesi okul yönetiminin ve
gerekiyorsa bir hukukçunun işidir.

**Henüz yok:** onayın veli tarafından geri çekilmesi (öğretmenin kararıyla
ertelendi — bugün veli öğretmene söylüyor), okul yönetimi bilgilendirme
metni, zümre öğretmenleri için kullanım taahhüdü.

## Yapay zekâ işlemesi

Faz 6'da açık uçlu ödev değerlendirmesinde yapay zekâ kullanılması
planlanıyor. Bu, **öğrenci çalışmasının üçüncü taraf bir servise
gönderilmesi** demektir ve ayrı değerlendirme gerektirir.

Şimdiden karar altına alınan kısıtlar:

- Test puanlamasında yapay zekâ **kullanılmaz** (Kural 5). Deterministik,
  denetlenebilir, tekrarlanabilir hesap yapılır.
- Yapay zekâ kullanılacaksa hangi verinin gönderildiği açıkça belgelenir.
- Yapay zekâ servisi kapalıyken ürünün geri kalanı çalışmaya devam eder.
- API anahtarları tarayıcıya **hiçbir koşulda** konmaz.
- Yapay zekâ önerisi karar değildir; öğretmen onaylar, düzenler veya
  reddeder.

Faz 6'ya gelmeden önce velinin bilgilendirilmesi gerekip gerekmediği
netleştirilmelidir.

## Veri saklama ve silme

Bugün eksik olanlar:

- **Saklama süresi tanımlı değil.** Mezun olan öğrencinin verisi ne kadar
  tutulacak?
- **Silme geri alınamaz ve izsiz.** `ogrenci_sil` tüm kayıtları siliyor;
  denetim izi yok.
- **Dışa aktarma yok.** Veli ya da öğrenci kendi verisinin kopyasını
  isteyebilir; bugün karşılığı yok.

Faz 1'de denetim izi, Faz 10'da yedekleme ve dışa aktarma planlanıyor.

## Üçüncü taraflara giden veri

| Taraf | Ne gidiyor | Durum |
|---|---|---|
| Supabase (İsviçre) | Tüm uygulama verisi | Zorunlu altyapı |
| GitHub Pages | Statik dosyalar; ziyaretçi IP'si erişim loglarında | Barındırma |
| ~~Google Fonts~~ | ~~Ziyaretçi IP'si~~ | **Kaldırıldı** — fontlar self-host |
| ~~jsDelivr / cdnjs~~ | ~~Ziyaretçi IP'si~~ | **Kaldırıldı** — CDN bağımlılığı yok |

Mevcut uygulama Google Fonts ve iki CDN kullanıyor; SEKİZ'de üçünün de
bağımlılığı kaldırıldı. Bu, üçüncü tarafa giden ziyaretçi IP'si sayısını
azaltıyor.

## Öğretmen için dikkat listesi

1. ~~Okul yönetimine sistemin varlığını ve barındırma bölgesini
   bildirin.~~ 0039 ile yapıldı: **Ayarlar → Okul yönetimi
   bilgilendirmesi** → Yazdır → PDF. Belge uygulamanın ne yaptığını,
   hangi bilgileri tuttuğunu, Zürih/İsviçre barındırmasını ve kapsam
   kuralını anlatıyor; altında okul yönetiminin dolduracağı imza bölümü
   var. **Metinde hiç sayı yok** — kaç öğretmen, kaç sınıf, kaç öğrenci,
   kaç veli onam vermiş, hepsi canlı okunuyor ki belge bayatlayamasın
   (bu belgenin başına gelen buydu). Yalnız sahip alabiliyor.
2. ~~Velileri hangi verinin işlendiği konusunda bilgilendirin.~~ 0034 ile
   yapıldı: veli, uygulamaya girerken metni okuyup onaylıyor.
3. Öğrenci ve veli kodlarını güvenli kanaldan paylaşın; kod bir şifredir.
4. Faz 6'dan önce yapay zekâ değerlendirmesi konusunda karar alın. Onam
   metni bugünkü durumu ("test puanlamasında yapay zekâ yok") söylüyor;
   bu değişirse metnin **sürümü yükseltilmeli** ve veliler yeniden
   onaylamalı.
5. ~~Çözüm fotoğrafı bağlantılarını paylaşmayın — korumasızlar.~~ Açık
   kapandı: bucket private, imzalı URL 60 saniyelik.
6. Zümredeki üç öğretmen kendi kapsamlarındaki öğrenci verisini görüyor.
   Onlar için bir kullanım taahhüdü metni **henüz yok**.
