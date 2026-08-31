# Yedekleme ve geri yükleme

Bu ürün bir kez **canlı veritabanının tamamını kaybetti**: öğrenciler,
giriş kodları, ödevler, notlar, mesajlar. Hiçbiri geri gelmedi. Yedekleme o
olaydan sonra Faz 10'dan Faz 1'e alındı.

`disa_aktar` ucu o zaman yazıldı ve yetkisi verildi — ama **arayüze hiç
bağlanmadı**. Yani yedek alma imkânı vardı, düğmesi yoktu. Bu belge o
eksiğin kapatıldığı turun çıktısı.

---

## Yedek alma

**Pano → en altta "Verinizin yedeği" → "Yedeği indir".**

Cihazınıza `sekiz-yedek-2026-08-14.json` gibi tarihli bir dosya iner.
İndirdikten sonra kart ne yazıldığını sayılarla gösterir; "alındı" demekle
yetinmez.

Kart, bu cihazdan en son ne zaman yedek aldığınızı hatırlar ve **7 günü
geçerse sarıya döner**. Bu bilgi tarayıcıda tutulur, yani cihaz başına;
başka bir cihazdan bakarsanız "hiç almadınız" der. Yedeğin kendisi bundan
etkilenmez.

### Dosya sistemin kendisi kadar hassastır

İçinde **öğrenci ve veli giriş kodları** ile **cevap anahtarları** var.
Kimseyle paylaşmayın. Bir veliye iletmek cevap anahtarını iletmek olur
(Kural 6). Ortak bir bilgisayarın indirilenler klasöründe bırakmayın.

### Nereye kaydedilir

**Kural: iki kopya, iki ayrı yer.** En az biri, elde taşınan cihazda
**olmayacak** — iPad düşerse yedek de gitmesin.

**Önce nereye iniyor.** iPad/iPhone Safari'de Dosyalar → İndirilenler;
bilgisayarda `İndirilenler` / `Downloads`. **Burası son durak değil:**
geçici bir klasör, karışır ve zamanla temizlenir. Dosya oradan alınıp
kalıcı bir yere taşınır.

**Ana kopya — kişisel bulutta paylaşılmamış bir klasör.** iCloud Drive
ya da Drive içinde `SEKİZ yedek` gibi bir klasör açılır; şart, klasörün
**paylaşılmamış** olması. iPad'de: dosyaya basılı tut → Paylaş →
Dosyalara Kaydet.

**İkinci kopya — kendinize e-posta ya da ev bilgisayarı.** E-posta için
dürüst not: uzun ömürlü ve aranabilir, hesap ele geçerse dosya da gider.
**Kabul edilebilir bir ikinci kopya, ama tek başına dayanak değil.**

#### Nereye konmaz

| Yer | Neden |
|---|---|
| Okulun ortak bilgisayarı ya da ortak sürücüsü | İçinde öğrenci ve veli giriş kodları var |
| Paylaşılmış bir bulut klasörü | Cevap anahtarları da içinde — bir veliye ulaşırsa Kural 6 çiğnenir |
| WhatsApp'ta kendine | Telefon yedeğine girer; telefonu eline alan görür |
| Ödev PDF'leriyle aynı klasör | Yanlışlıkla paylaşma riski |

#### Biriktirilir, üzerine yazılmaz

Dosya adı tarihlidir (`yedekDosyaAdi()`, `app/src/lib/yedek.ts`), yani
hepsi aynı klasöre atılınca kendiliğinden sıralanır. **Son üç dört dosya
saklanır.**

Gerekçe somut: bugünkü yedek bir sorun sırasında alınmış olabilir. O
bozuksa dünkü işe yarar. Tek dosya tutup her seferinde üzerine yazmak
tam olarak o güvenceyi yok eder.

#### Kişisel veri

Dosyada gerçek öğrenci adları ve giriş kodları var. Ekran kilidi olan
**kişisel** bir cihazda tutulur.

**Bu belgeye kişisel e-posta adresi, telefon ya da hesap adı
yazılmıyor** — depo herkese açık (ölçüldü: oturumsuz istek `raw`
adresinden de `200` dönüyor). Yönerge bu yüzden genel: "kendinize
e-posta", adresin kendisi değil.

### Dosyada ne var, ne yok

| Var | Yok |
|---|---|
| Sınıflar | **Çözüm fotoğrafları ve PDF'ler** — Storage'da durur, dosyada yalnız adresleri vardır |
| Öğrenciler | **PIN'iniz** — geri yükledikten sonra yeniden belirlersiniz |
| Giriş kodları | Denetim izi (not değişikliklerinin geçmişi) |
| Ödevler, cevap anahtarları, konular | Okundu işaretleri |
| Gönderimler ve puanlar | Oturumlar (zaten kimlik bilgisidir, yedeğe girmemesi doğrudur) |
| Mesajlar, dersler, ödemeler | |
| **Ewalu için yazdığınız cümleler** (0032) | |

**0032 öncesi alınmış yedekler hâlâ geçerli.** Elinizdeki dosyada Ewalu
cümleleri yok; geri yükleme onu reddetmiyor, o tabloyu boş bırakıyor ve
Ewalu koddaki varsayılan cümleleri söylemeye devam ediyor. Provada
ölçüldü.

**Fotoğraflar en önemli eksik.** Proje silinirse Storage'daki dosyalar da
silinir ve JSON onları geri getirmez. Öğrencilerin çözüm fotoğrafları için
ayrı bir yedek yolu bugün yok; bilinen sınır olarak kaydedilmiştir.

---

## Geri yükleme

`supabase/geri-yukleme/geri-yukle.sql`

**Bu dosya felaket içindir.** Normal kullanımda çalıştırılmaz. Adımlar:

1. **Yeni bir Supabase projesi açın** (ya da mevcut boş projeyi kullanın).
2. **Tüm migration'ları çalıştırın** — `supabase/panel-icin/` altındaki
   dosyaları sırayla, SQL Editor'a yapıştırıp Run.
3. `geri-yukle.sql`'i açın. İçinde tek başına `BURAYA-YAPISTIRIN` yazan bir
   satır var; **onun yerine yedek dosyasının tamamını yapıştırın** (baştaki
   `{` ve sondaki `}` dahil).
4. Biraz aşağıdaki `onayliyorum boolean := false;` satırını **`true`** yapın.
5. Tamamını SQL Editor'a yapıştırıp Run.
6. Siteye girin — kurulum ekranı açılır, **PIN'inizi yeniden belirlersiniz**.

### Neden onay bayrağı var

Script sekiz tablonun **tamamını siler** ve yerine yedektekileri yazar.
Silmek zorunda: temiz kurulum sınıfları yeni kimliklerle üretiyor, yedekteki
öğrenciler ise eski sınıf kimliklerini gösteriyor. Sınıfları bırakıp yalnız
öğrencileri yazsak her öğrencinin sınıf bağı kopardı.

Bayrak `false` iken script **hiçbir şey silmez ve hiçbir şey yazmaz**;
yalnız yedekte ne bulunduğunu söyler. Ölçüldü.

### Kendini denetliyor

- Dosya SEKİZ yedeği değilse ya da bir tablosu eksikse **hiçbir şeye
  dokunmadan** reddeder.
- Yazılan satır sayısı yedektekiyle birebir tutmuyorsa hata verir. Sessizce
  eksik yazmak, felaket anında fark edilmeyen ikinci bir kayıp olurdu.
- Bir hata olursa işlem bütünüyle geri alınır; yarım geri yükleme kalmaz.

---

## Prova — denenmemiş yedek yedek değildir

```
supabase/testler/felaket-provasi.sh
```

Prova, dolu bir veritabanı kurar, gerçek `disa_aktar` ile yedeğini alır,
**sıfırdan boş bir "yeni proje"** kurar, geri yükler ve şunları ölçer:

1. Satır sayıları ve öğrenci adları birebir aynı
2. Öğrenci **eski koduyla giriş yapabiliyor**
3. Puanı (33.33), cevap anahtarı ve konu analizi yerinde
4. Veli girebiliyor, mesaj geçmişi duruyor
5. Özel ders öğrencisinin ödemesi ve tutarı (1500.50) yerinde
6. Öğretmen panosu çalışıyor
7. Eksik tablolu bir dosya **reddediliyor ve hiçbir şey silmiyor**

Veri bilerek zor seçildi: kesme işaretli ve Türkçe karakterli adlar
(`Ayşe O'Brien Çağlar`, `Öğünç Şıklıoğlu`), tırnak ve HTML içeren ödev
başlığı, ondalıklı tutar, jsonb alanlar.

### Provanın yakaladığı iki gerçek hata

Bu bölüm kayda geçiyor, çünkü ikisi de "çalışıyor gibi görünen" hatalardı.

**1. `siniflar.ad` üretilmiş bir sütun.** Düz `insert ... select *` şu
hatayla patlıyordu: *cannot insert a non-DEFAULT value into column "ad"*.
Sütun listesini elle yazmak yerine **şemadan okunuyor**; ileride eklenecek
her üretilmiş sütun kendiliğinden dışarıda kalır.

**2. Eksik tablo denetimi hiç çalışmıyordu.** `jsonb_typeof(NULL)` NULL
döner ve `NULL <> 'array'` da NULL'dur — yani `if` tetiklenmez. Eksik
tablolu bir dosya denetimden geçiyor, tablolar siliniyor ve o tablo
**sessizce boş kalıyordu**. Provada `mesajlar` tam bu şekilde kayboldu.
`coalesce(..., 'yok')` ile kapatıldı; satır sayısı denetimi de aynı NULL
tuzağına karşı `is distinct from` yapıldı.

İkisi de yalnız gerçek bir prova koşulduğu için görüldü. Yedeği "yazdım,
çalışır" diye bırakmak, felaket gününe kadar sürecek bir yanılsama olurdu.
