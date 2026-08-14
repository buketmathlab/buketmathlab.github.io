# Mimari

## Neden yeniden kurulum

Mevcut ürün tek bir 713 satırlık `index.html`: build yok, tip kontrolü yok,
test yok, bileşen yok, tüm durum global değişkenlerde. 200 öğrenci ölçeğinde
sayfalama, arama, analitik ve denetim izi eklemek bu yapıda mümkün değil.

SEKİZ bunu sıfırdan değil, **mevcut sistemi bozmadan yanına** kuruyor.

## Yayın modeli

```
/index.html      ← MEVCUT UYGULAMA. Canlı, öğrenciler kullanıyor. DOKUNULMAZ.
/tetik.txt       ← dokunulmaz
/app/            ← SEKİZ kaynak kodu (yayınlanmaz, derlenir)
/yeni/           ← build çıktısı — GitHub Pages buradan servis eder
/docs/           ← teknik dokümanlar
/.nojekyll       ← Pages'in Jekyll işlemesini kapatır
```

Kök adres eski uygulamada kalır; SEKİZ `/yeni/` altında gelişir. Öğretmen
onay verdiğinde kök adrese taşınır. Böylece dönem ortasında hiçbir öğrenci
ödev gönderemez duruma düşmez.

**Kaynak neden `/app` altında:** Vite, çalıştığı dizindeki `index.html`'i
giriş noktası sayar. Kaynak kökte olsaydı mevcut uygulamanın `index.html`'i
ile çakışırdı. Bu bir tercih değil, teknik zorunluluk.

**Build çıktısı neden depoda:** GitHub Pages'in varsayılan "deploy from
branch" ayarı depodaki dosyaları servis eder. Çıktıyı commit etmek, repo
ayarı değiştirmeden yayın yapmayı sağlar. Faz 10'da GitHub Actions'a
taşınabilir.

## Teknoloji

| Katman | Seçim | Gerekçe |
|---|---|---|
| Derleyici | Vite 6 | Hızlı, yapılandırması az |
| Arayüz | React 19 | Bileşen modeli, ekip bilgisi yaygın |
| Tip | TypeScript strict | `noUncheckedIndexedAccess` ve `exactOptionalPropertyTypes` dahil |
| Stil | Tailwind 4 | Tokenlar CSS'te `@theme` ile; ayrı config dosyası yok |
| Test | Vitest + Testing Library | Vite ile aynı dönüşüm hattı |
| Veri | `@supabase/supabase-js` | Mevcut altyapı |

**Eklenmeyenler:** UI kit yok, animasyon kütüphanesi yok, ikon paketi yok,
durum yönetimi kütüphanesi yok. Hepsi gerektiğinde eklenir; şimdi eklemek
paket boyutunu ve bakım yükünü karşılıksız artırır.

`react-router-dom` de bilinçli olarak **yok** — Faz 0'da gerçek rota yok.
Faz 2'de öğretmen/öğrenci/veli ekranları gelince eklenecek.

## Dizin düzeni

```
app/src/
  components/ui/      Genel primitifler (Button, Card, Field, Tabs…)
  components/brand/   Markaya özel (Sekiz8Mark, OctagonFrame, EwaluFigure…)
  pages/              Tam ekranlar
  hooks/              Paylaşılan davranış
  lib/                Saf mantık — tokenlar, geometri, kontrast hesabı
  services/           Supabase erişimi (Faz 1'de dolacak)
  types/              Paylaşılan tipler
  styles/             Tokenlar ve fontlar
  test/               Test kurulumu
app/scripts/          Varlık işleme hattı
app/kaynak-varliklar/ İşlenmemiş orijinaller (yayınlanmaz)
app/public/           Yayınlanan statik varlıklar
```

**Ayrım ilkesi:** `lib/` içindeki her şey saf ve test edilebilir olmalı —
React'e, tarayıcıya, ağa bağımlı olmamalı. Geometri oranları ve kontrast
hesabı bu yüzden orada.

## Varlık hattı

`npm run varliklar` → `kaynak-varliklar/` okur, `public/` üretir.

- Ewalu: 4 poz × (3 portre + 2 tam figür) = 20 WebP
- Okul mührü: dairesel maskeli, şeffaf, 3 WebP + 1 PNG
- Video posteri: 1 WebP

Hat tekrarlanabilir: `public/ewalu` ve `public/marka` silinip yeniden
üretilebilir. Kırpma kutuları scriptte açıkça yazılıdır ve gözle
doğrulanmıştır.

**Yalnız WebP üretiliyor** (mühürde bir PNG türevi hariç). WebP 2020'den beri
tüm hedef tarayıcılarda destekli; JPEG yedeği depoyu iki katına çıkarır ve
karşılık vermez.

## Performans

Faz 0 ölçümü:

| Varlık | Boyut | gzip |
|---|---|---|
| JS | 224 KB | 71 KB |
| CSS | 22 KB | 5 KB |
| Font (4 dosya) | 110 KB | — |

Fontlar self-host ve **alt kümelenmiş**: `@fontsource`'un hazır CSS'i
Vietnamca/Kiril/Yunan alt kümelerini de getiriyordu. `@font-face`'ler elle
yazılıp yalnız latin + latin-ext bırakıldı — Türkçe'nin tamamı bu ikisinde
(`ç ö ü` latin'de, `ğ ı İ ş` latin-ext'te). 9 dosya → 4, ~44 KB tasarruf.

Faz 10'da kod bölme ve PDF görüntüleyicinin tembel yüklenmesi gelecek.

## Arşiv

Sınıf **silinmez, arşivlenir** — geçmiş ödevler, gönderimler ve notlar sınıfa
bağlı; silmek tarihi bozar.

`arsiv` başlangıçta yalnız `siniflar_listesi`'nin süzgeciydi. Öğretmen bunu
fark etti ("bir yerde arşivlediğimde artık o sınıf başka bir yerde
görünmemeli") ve ölçüm onu doğruladı: arşivdeki sınıf Pano sayılarında,
Pano listelerinde, Ödevler'de ve Öğrenciler'de duruyordu; öğrenci hâlâ ödev
gönderebiliyordu. **0016** bunu ürün kuralına çevirdi.

**Süzülenler** — arşivdeki sınıf hiçbirinde görünmez:
`ogretmen_panosu` (dört sayı ve son gönderimler), `pano_detay` (dört türün
hepsi), `odevler_listesi`, `ogrenciler_listesi`.

**Süzülmeyen iki uç, bilerek:** `sinif_ogrencileri(p_sinif_id)` ve
`odev_gonderimleri(p_id)`. İkisi de listeleme değil, kimlikle çağrılıyor ve
**arşivden geri dönüş yolunun üzerindeler** — öğretmen Sınıflar'da
"Arşivdekileri de göster" deyip eski sınıfın karnesine bakabilmeli.

**Gönderim de kapanıyor.** `odev_gonder` arşivdeki sınıfı `22023` ile
reddediyor. Sebep: arşivden sonra ödev öğretmenin hiçbir ekranında
görünmüyor; gönderimi açık bıraksaydık öğrenci ödev yollar, ödev hiçbir yere
düşmez ve kimse fark etmez. Öğrenci **ödevlerini ve puanlarını görmeye devam
ediyor** (`ogrenci_odevleri` `sinif_arsiv` bayrağıyla nedenini söylüyor);
gizlenen bir şey yok, kapanan yalnız yeni gönderim.

**Hiçbir veri silinmiyor.** Geri alındığı anda dört liste de, gönderim de
aynen dönüyor — `arsiv_testleri.sql` 7. grubu bunu ölçüyor.

`_sinif_arsivde(uuid)` yardımcısı NULL'ı `false` sayar: `ogrenciler.sinif_id`
boş olabildiği için (sınıfa bağlanmamış özel ders öğrencisi) düz `not
s.arsiv` yazmak LEFT JOIN'de NULL üretir ve o öğrenciyi **sessizce** listeden
düşürürdü.

## Giriş kodları

Öğrenci ve veli kodları birer **şifredir**. Üç kural:

1. **Hiçbir liste ucu kod taşımaz.** `ogrenciler_listesi`, `sinif_ogrencileri`,
   `pano_detay` — hiçbiri. `kodlar_testleri.sql` 5. grubu bunu ölçüyor ve
   denetimin kendisinin işe yaradığını da ayrıca kanıtlıyor.
2. **Kodun tek çıkış kapısı `ogrenci_kodlari(p_token, p_id)`** — öğrenci
   başına. Bir sınıfın ya da tümünün kodlarını döndüren uç **yok**.
3. **Arayüz kodu ekran açılırken çekmez.** Kodlar sekmesinde sınıf açılınca
   yalnız isimler görünür; kod, dokunulan öğrenci için o an istenir. Aynı
   anda tek öğrencinin kodu açık kalır — ikinci bir isme dokunmak öncekini
   hem ekrandan hem state'ten düşürür.

**0017 bu yüzden geri alındı.** İlk sürümde `sinif_kodlari` bir sınıfın tüm
kodlarını tek yanıtta döndürüyordu. Öğretmenin isteği — "bir öğrenciye
kodunu gösterirken diğerlerininki görünmesin" — bunu hem gereksiz hem yanlış
kıldı: ekranda birini gösterip diğerlerini gizlemek, kodları ağ yanıtında ve
bellekte bırakırdı. Cevap anahtarında en baştan reddettiğimiz desenin
aynısı (Part XXI). `0018` fonksiyonu kaldırdı.

Ölçüldü: sınıf açıldığında kod isteği **0**; bir öğrenciye dokununca **tam
bir** istek ve gövdesinde yalnız o öğrencinin kimliği; ikinciye geçince
öncekinin kodu **DOM'da bile kalmıyor**.

Pasif öğrencinin kodu yoktur: `ogrenci_pasiflestir` `giris_kodlari`
satırlarını siler ve oturumlarını iptal eder.

## Veli ve mesajlaşma

Öğretmenin kararı: **veliye mesaj uygulama içinde gider** — SMS ya da
WhatsApp yok. Bunun doğrudan sonucu, veli ekranının da olması: mesaj
yazılıp hiçbir yere düşmemesi olmaz.

**Veliler sekmesi iki soruya birden cevap veriyor.** Üstte *Yanıt
bekleyenler* (sınıf ayrımı olmadan, en uzun süredir cevapsız duran üstte),
altında sınıf listesi. Diğer sekmelerdeki "önce sınıf" deseni korunuyor ama
acil olan yukarı çıkıyor; sınıfların altına gömseydik öğretmen bekleyen bir
veliyi ancak o sınıfa girerse görürdü.

**Okunmamış sayımı:** veliden gelen ve öğretmenin o yazışmayı en son
okuduğu andan sonra yazılmış mesajlar. Yazışma ekranı açılınca
`ogretmen_okudu` kendiliğinden çağrılıyor — ayrı bir "okundu işaretle"
düğmesi öğretmene iş çıkarmaktan başka bir şey yapmazdı.

**Mesaj metni listelerde yok**, yalnız sayı ve zaman. Kod listesindeki
kuralın aynısı: ortak bir ekranda bütün velilerin yazdıkları yan yana
durmasın.

### Şema kusuru — 0019'da düzeltildi

`okundu` tablosunun birincil anahtarı yalnız `ogrenci_id`'ydi; bir öğrenci
için tek satır vardı ve veli okuduğunda öğrencinin kaydı, öğrenci
okuduğunda velininki eziliyordu. Öğretmenin okuma durumuna ise hiç yer
yoktu. Bugüne kadar görünmemesinin sebebi basit: `okundu_isaretle` Faz
1'den beri **hiç çağrılmamıştı**. Anahtar `(ogrenci_id, rol)` yapıldı ve
`ogretmen` rolü eklendi.

Bu değişiklik `veli_paneli`'ni **kırdı**: `son_gorulme` alt sorgusu rol
süzgeci olmadığı için üç satır dönüp fonksiyonu çökertti. Bunu tahmin değil
test yakaladı; onarım aynı migration'da duruyor ki biri uygulanıp öbürü
unutulmasın.

### Kural 6 sınırı

**Veliye cevap anahtarı hiçbir koşulda gitmez.** `veli_paneli` anahtarı,
anahtar dosya yolunu ve anahtarın içeriğini döndürmüyor; veli
`dosya_erisim_izni` ile anahtar PDF'ini de açamıyor.
`veliler_testleri.sql` 7. grubu dördünü **ayrı ayrı** ölçüyor ve denetimin
kendisinin çalıştığını öğretmen ucuyla karşılaştırarak kanıtlıyor. En sert
durum seçildi: ödev yayında, süresi dolmuş, öğrenci teslim etmemiş.

Velinin gördüğü şey **süreç**: çocuğu ödevini yapmış mı, kaçını kaçırmış,
aldığı puan ne. Çözümler değil.

## Konu analizi ve yanlış soru numaraları (0020)

Öğretmenin iki isteği: *"hangi konuda eksiği olduğu, yani hangi konuya
çalışması gerektiği bildirilmeli"* ve *"öğretmen de hangi soruları yanlış
yaptığını görsün, veli de görebilsin."*

**Eşleme öğretmenden geliyor, tahmin edilmiyor.** `odevler.konular` soru
numarasını konu adına bağlıyor (`{"1":"Türev","2":"Türev"}`). Arayüz girişi
aralıkla kolaylaştırıyor ("1–5: Türev") ama saklama biçimi soru başına:
aralık saklansaydı tek bir sorunun konusunu değiştirmek aralığı bölmek
demek olurdu. Konu **zorunlu değil** — girilmemiş ödev eskisi gibi çalışır,
yalnız analiz çıkmaz.

**Analiz sunucuda hesaplanıyor; bu bir tercih değil zorunluluk.** Veli de
konu analizini görüyor, ama veliye cevap anahtarı gitmiyor (yukarıdaki
Kural 6 sınırı). Tarayıcıda hesaplasaydık anahtarı göndermek gerekirdi.

**`_konu_analizi` ve `_soru_dokumu`, `_puanla` ile birebir aynı dallanmayı
uyguluyor:** boş cevap boş sayılır, anahtarı olmayan soru öğrenciyi
cezalandırmaz. Ayrışsalardı öğrenci 100 alıp "şu konuda eksiğin var"
uyarısı görebilirdi. Migration kendi denetiminde bunu her uygulamada
yeniden ölçüyor; `konu_testleri.sql` 2. grubu da analizin toplamını
gönderimde **saklanan** puanla karşılaştırıyor.

**Soru numarası kime ne kadar gidiyor:**

| Kim | Ne görüyor |
|---|---|
| Öğrenci | Kendi cevabı, anahtar (teslimden sonra), konu analizi — hepsi zaten vardı |
| Öğretmen | Yanlış ve boş soru **numaraları**, öğrenci başına; sınıfın konu özeti |
| Veli | Yalnız **numara** — `Yanlış: 3, 7` |

Veliye numara gidiyor, **şık gitmiyor**: ne çocuğun işaretlediği ne de
doğru olan. Numara "hangi soruda takıldı" der ve velinin işine yarar; dört
şıklı bir soruda şıkkı göndermek anahtara doğru atılmış bir adım olurdu.
`konu_testleri.sql` 12. grubu velinin yanıtında iki şıkkın da geçmediğini
ayrı ayrı ölçüyor.

### Ödev PDF'inden okunanlar — ve neden AI yok

Öğretmen konuların AI ile tahmin edilmesini istedi. Gerçek bir ödev PDF'i
(`10C_uslu_koklu_SORULAR.pdf`) ölçüldü ve sonuç isteği **teknik olarak
imkânsız** kıldı: PDF'te metin katmanı var, ama **soruların metni yok**.
Sorular görsel olarak gömülü (4 sayfada 14 görsel, soru başına bir resim);
metin katmanında yalnız çerçeve duruyor. AI'ya gönderilecek soru metni diye
bir şey yok.

Öğretmenin kararı: **"Önce AI'sız, AI sonra."** Bu yüzden `lib/odev-pdf-ozeti.ts`
AI kullanmıyor, yalnız okunabilen çerçeveyi okuyor:

| Okunan | Nereden |
|---|---|
| Soru sayısı | Puan tablosu (`SORU 1 2 … 10 TOPLAM`) **ve** soru başlıkları (`01 10 Puan`) |
| Ödevin konusu | Başlık satırının ilk `·` parçası |
| Sınıf | Alt bilgideki `· 10C ·` |

**İki bağımsız soru sayısı sinyali birbirini denetliyor. Çelişirlerse
hiçbiri seçilmez** — ekran ikisini de gösterip kararı öğretmene bırakıyor.
Sessizce birini seçmek yanlış soru sayısı demek, yanlış soru sayısı da
cevap anahtarının kırpılması demek (`odev_guncelle`).

**Hiçbir alan kendiliğinden dolmuyor.** Kutu ne bulunduğunu söylüyor,
uygulayan öğretmen. Onayladığı konu yalnız konu ALANINI dolduruyor; hiçbir
soruya konu yazmıyor — öğretmen aralığı belirleyip "Ata"ya basana kadar
kayıt değişmiyor. Sinyal bulunamazsa ya da PDF okunamazsa kutu hiç çıkmıyor
ve ekran bugünkü gibi çalışıyor.

Testler tek bir PDF'e uydurulmadı: öğretmenin gerçek 37 satırı sabit veri
olarak duruyor, ama yanında taranmış PDF, tanınmayan şablon, çelişkili
sinyal, ardışık olmayan numaralar ve düz metinde geçen "SORU" tuzağı da
ölçülüyor. Gerekçe kayıtlı bir hata: cevap anahtarı turunda kendi ürettiğim
örneklere uyan bir desen, gerçek PDF'te 0/10 çıkmıştı.

## Özel ders: dersler ve ödemeler (0021)

Özel ders öğrencisi için ders programı ve ödeme takibi. `ders_ekle`,
`ders_sil`, `odeme_ekle`, `odeme_degistir`, `odeme_sil` 0004'ten beri
yazılıydı ve yetkileri verilmişti, ama **üçü `p_id` istiyor ve öğretmenin
o id'yi öğrenebileceği hiçbir uç yoktu**. Yani ödeme "ödendi"
işaretlenemiyor, ders silinemiyordu. 0021 tek bir okuma ucu
(`ozel_ders_detay`) ekleyerek beş yazma ucunu kullanılabilir kıldı; yeni
yazma ucu açılmadı.

### Kimin neyi gördüğü

Öğretmenin kuralı: **"Ödeme detaylarını öğrenci görmesin. Yani özel ders
öğrencim."** Para velinin ve öğretmenin meselesi; çocuk ödevine çalışırken
borç bilgisiyle karşılaşmamalı.

| | Ders programı | Ödeme tutarı | Ödeme `id` |
|---|---|---|---|
| Öğretmen — `ozel_ders_detay` | geçmiş **ve** gelecek | var | **var** |
| Veli — `veli_paneli` | yok | var | **yok** |
| Öğrenci — `ogrenci_odevleri` | yalnız gelecek | **yok** | yok |

Üç satırın gerekçesi ayrı ayrı:

- **Öğretmene geçmiş dersler de dönüyor** — "kaç ders yaptık" sorusunu o
  soruyor. Öğrenciye yalnız gelecek dönüyor, çünkü onun işine yarayan o.
- **Veliye `id` gitmiyor.** Veli parayı görmeli (ödeyen o) ama
  yönetmemeli; id göndermek silme/değiştirme yoluna açık kapı bırakırdı.
- **Öğrenciye ödemeyle ilgili hiçbir alan gitmiyor** — tutar da, alan adı
  da yok.

Sınır **sunucuda**: ayrı uçlar ve rol denetimi. Arayüzde gizlemek değil —
gizlenen veri gönderilmiş veridir (Part XXI, cevap anahtarındaki kuralın
aynısı). Öğrenci ve veli `ozel_ders_detay`'ı çağırdığında `42501` alıyor.

### Kural iki bağımsız katmanda zorlanıyor

Yazılı olmayan bir kural sessizce bozulur. Bu yüzden iki ayrı yerde
ölçülüyor:

1. **Migration'ın kendi denetimi** — `0021` uygulanırken
   `ogrenci_odevleri`'nin gövde metninde `tutar|odendi|odemeler` arıyor;
   bulursa **hata verip dağıtımı durduruyor**. Yani öğrencinin ucuna ödeme
   alanı ekleyen bir migration canlıya çıkamaz.
2. **Çalışma anı testi** — `ozel_ders_takibi_testleri.sql` 4. grubu, en
   sert durumu kuruyor (özel ders öğrencisi, ödenmemiş 800 TL borcu, dersi
   var) ve öğrencinin yanıtında hem **alan adını** hem **tutar değerini**
   ayrı ayrı arıyor. Denetimin işe yaradığı, aynı tutarın öğretmenin
   ucunda **bulunduğu** gösterilerek kanıtlanıyor — aksi hâlde boş bir
   metinde arıyor olurduk.

3. **Sayım denetimi** — yukarıdaki ikisi *bilinen* uçları koruyor. Üçüncüsü
   soruyu tersine çeviriyor: anon'un çağırabildiği, gövdesinde ödeme alanı
   geçen **her** fonksiyon ya öğretmen ya veli şartı taşımalı. Bugün altı uç
   var (`disa_aktar`, `odeme_ekle/degistir/sil`, `ozel_ders_detay` öğretmen
   şartlı; `veli_paneli` veli şartlı) ve öğrenci altısında da `42501` alıyor.

Birincisi devre dışı kalsa ikincisi yakalar. Üçüncüsü ise **yarın yazılacak**
uçlar için: paraya dokunan yeni bir uç eklendiğinde test kırılır ve yazan kişi
"öğrenci bunu görmeli mi?" sorusunu cevaplamak zorunda kalır. Kuralın yazılı
olmadığı yerde sessizce bozulmasını engelleyen şey budur.

## Ana ekrana ekleme ve sürüm denetimi

SEKİZ telefonda ana ekrana eklenebiliyor: kendi simgesi, tam ekran açılış,
adres çubuğu yok. `public/manifest.webmanifest` + `apple-touch-icon`.

**Simge marka işareti, okul mührü değil.** Mühür yalnız ≥96 px bağlamlarda
kullanılıyor (Kural 8); 48 px'lik bir ana ekran simgesinde halka yazısı ve
köprü çizgileri okunmazdı. Üç çıktı üç ayrı sebeple üretiliyor: `any`
(tarayıcının olduğu gibi kullandığı), `maskable` (Android simgeyi daireye
kırpar — çizim iç %80'e sığdırılıyor), ve iOS için **şeffaflığı olmayan**
180 px PNG (iOS şeffaf pikselleri siyah basar).

`scope` ve `start_url` **`/yeni/`** ile sınırlı: kök adresteki eski
uygulama hiçbir koşulda bu uygulamanın kapsamına girmiyor.

### `?y=N` zahmetinin sonu

GitHub Pages HTML'i `cache-control: max-age=600` ile gönderiyor (ölçüldü).
Yeni sürüm yayınlandıktan sonra 10 dakika boyunca tarayıcı eskisini
gösterebiliyordu; öğretmen bunu adres çubuğuna elle `?y=N` yazarak
aşıyordu.

Artık her yapı bir sürüm damgası alıyor (`vite.config.ts` → `surumDamgasi`).
Damga hem pakete gömülüyor hem `surum.json`'a yazılıyor. Çalışan uygulama o
dosyayı **`cache: 'no-store'`** ile okuyor — o bayrak isteğin tarayıcı
önbelleğini atlamasını sağlıyor, yani HTML eski olsa bile yeni sürüm
saniyeler içinde fark ediliyor. Açılışta, sekmeye dönüşte ve yarım saatte
bir bakılıyor.

Fark varsa üstte bir şerit çıkıyor: *"Yeni sürüm hazır · Yenile"*. Toast
değil — toast 4 saniyede kaybolur ve kaçırılırdı. "Yenile" `reload()`
yapmıyor (o yine önbellekteki HTML'i getirebilirdi), adrese `?s=<sürüm>`
ekleyip geçiyor: **öğretmenin elle yaptığı şeyin aynısı, artık uygulama
kendi yapıyor.**

### SERVICE WORKER YAZILMADI — bilinçli karar

Service worker cihaza yerleşir ve sayfayı kendisi sunmaya başlar. Hatalı
yazılırsa eski sürümü sonsuza kadar servis eder ve kullanıcı bunu
temizleyemez. Ölçüldü ki getirisi de yok:

| İstenen | SW gerekli mi | Nasıl karşılandı |
|---|---|---|
| Ana ekrana ekleme, tam ekran, simge | hayır | manifest + `apple-touch-icon` |
| Yeni sürümü fark etme | hayır | `surum.json`, `no-store` |
| Çevrimdışı çalışma | evet — **ama anlamsız** | bütün veri Supabase'den geliyor |

Tek kayıp: Android Chrome'un "Uygulamayı yükle" kutusu SW istiyor. SW'siz
de menüden "Ana ekrana ekle" çalışıyor ve manifest'e uyuyor.

`npm run pwa-denetim` **hiçbir service worker kaydedilmediğini** ölçüyor —
"eski uygulama etkilenmez" iddiasının kanıtı bu.

### Bilinen sınırlar

- Ana ekrana ekledikten sonra **bir kez daha giriş** gerekiyor: iOS'ta tam
  ekran uygulama, Safari'den ayrı bir depolama alanı kullanıyor.
- Uzun süre açılmayan uygulamada iOS oturumu düşürebilir.
- Çevrimdışı çalışmıyor; bu bilinçli.

## Bildirimler — kabuktaki rozetler (0022)

Öğretmen veliden mesaj geldiğini eskiden ancak Veliler sekmesine girerek,
puan bekleyen gönderimi ancak Pano'ya bakarak öğreniyordu. Artık iki sekmede
rozet duruyor: **Veliler** → okunmamış veli mesajı, **Ödevler** → puan
bekleyen gönderim.

| Sayı | Ölçüt |
|---|---|
| `okunmamis_mesaj` | veliden gelen, öğretmenin o yazışmayı en son okumasından **sonra** yazılmış mesajlar |
| `puan_bekleyen` | açık uçlu ödevin `durum = 'incelemede'` gönderimleri |

Arşivdeki sınıf ve pasif öğrenci **sayılmıyor**: öğretmenin hiçbir
listesinde görünmeyen bir öğrenci için rozet göstermek, tıklayınca boş
ekrana götüren bir sayı üretirdi (0016 kuralı).

**Ayrı bir uç yazıldı** (`bildirim_sayilari`) çünkü rozet her ekranda
duruyor ve aralıklı yokleniyor. `veliler_listesi` bütün aktif öğrencileri
dolaşıp her biri için iki alt sorgu çalıştırıyor — 300 öğrencide her
yoklamada 600 alt sorgu demek.

Ölçütler o iki uçtan **kopyalandı**, uçlar çağrılmadı: yeni imza açmak 0007
tuzağını davet ederdi. İki yerde iki farklı sayı çıkmasın diye test,
rozetin Pano ve Veliler sekmesiyle **birebir aynı** olduğunu ayrıca
ölçüyor.

**Rozet sıfırda hiç çizilmiyor** ve 99'dan büyük sayı `99+` oluyor. Rozet
`aria-hidden`; sayı sekmenin `aria-label`'ında geçiyor ("Veliler, 3
okunmamış mesaj") — ekran okuyucu kullanan biri rozeti göremez.

**Öğrenci ve velide rozet yok.** İkisinin de kabuğu tek ekran; rozetin
duracağı bir sekme çubuğu yok. Bilgi zaten yüzeyde: öğrencinin ödev listesi
her satırda puanı ya da "Değerlendiriliyor"u gösteriyor, veli paneli
açılınca mesajları gösterip `okundu_isaretle`'yi çağırıyor.

**Uç çalıştırılmamışsa arayüz bozulmuyor:** `bildirim_sayilari` yoksa
sayılar sıfır kalır, rozet çizilmez, hata mesajı çıkmaz ve oturum düşmez.

## Faz sırası

| Faz | Kapsam | Durum |
|---|---|---|
| 0 | Mimari + tasarım sistemi | **tamamlandı** |
| 1 | Veritabanı + güvenlik | **tamamlandı** — 0001–0021 canlıda, **0022 öğretmenin çalıştırmasını bekliyor** |
| 2 | Öğretmen: sınıf, öğrenci, ödev, cevap anahtarı | **tamamlandı** |
| 2C–2D | Öğrenci teslim ekranı, gönderim takibi, açık uçlu puanlama | **tamamlandı** |
| 3 | Pano detayları, arşiv, kodlar, veliler, mesajlaşma | **tamamlandı** |
| 3F | Konu analizi, yanlış soru numaraları, PDF'ten öneri | **tamamlandı** |
| — | Yedekleme ve geri yükleme | **tamamlandı** — `docs/yedekleme.md` |
| — | PIN değiştirme | **tamamlandı** — `/ogretmen/ayarlar` |
| — | Özel ders: dersler ve ödemeler (0021) | **tamamlandı** — `/ogretmen/ogrenciler/:id` |
| — | Ana ekrana ekleme ve sürüm denetimi | **tamamlandı** |
| — | Uygulama içi bildirimler (0022) | **tamamlandı** — kabuktaki rozetler |
| 5 | Deterministik test puanlama | `_puanla` canlıda; birim testleri Faz 11'de genişletilecek |
| 6 | Açık uçlu değerlendirmede AI desteği | **ölçüldü, ertelendi** — soru PDF'lerinde metin katmanı var ama soru metni yok; sorular görsel. Görsel okuyan AI ayrı bir tur, API anahtarı gerekiyor |
| 7 | Analitik | sırada |
| 8 | Telefona düşen bildirim | **açık karar** — dar kapsamlı bir service worker gerektiriyor |
| 9 | Landing + Ewalu deneyimi | sırada |
| 10–12 | PWA, güvenlik denetimi, son QA | sırada |

**Arayüze bağlanmamış uçlar.** Uçlar tarandığında üç gerçek boşluk
çıkmıştı — `disa_aktar` (yedek), `pin_degistir` (PIN) ve özel ders yazma
uçları. **Üçü de kapatıldı**; bugün yazılıp yetkisi verilmiş ama ekranı
olmayan uç kalmadı.

Bilerek bağlı olmayan tek uç `dosya_erisim_izni`: onu tarayıcı değil Edge
Function çağırıyor.

Veli panelindeki ödeme bölümü artık dolabiliyor — öğretmen ödemeyi
`/ogretmen/ogrenciler/:id` ekranından giriyor.

## Video varlığı

`app/public/marka/ewalu-tanitim.mp4` — Ewalu'nun okul önünde, üniformayla
kendini tanıttığı 15 saniyelik tanıtım. Giriş ekranında **kalıcı** olarak
bulunur (öğretmen kararı; Faz 9'da tanıtım sayfası gelse bile kaldırılmaz).

| Konu | Değer |
|---|---|
| Yayınlanan | 2.4 MB, H.264 CRF 26, faststart, AAC 96k |
| Orijinal | 8.5 MB — `kaynak-varliklar/ewalu-tanitim-orijinal.mp4` |
| Süre / çözünürlük | 15.0 sn / 1168×784, 24 fps |
| Poster | 87 KB WebP, 1200×805 — **öğretmenin seçtiği kadraj**, videonun oranına kırpılmış |

Sıkıştırma kararı ölçülerek verildi: CRF 26 ve CRF 30 karşılaştırıldı, okul
tabelasındaki yazı ve kürk dokusu üzerinde gözle fark bulunamadı. CRF 30
1.6 MB'ye iniyordu ama marka varlığı olduğu için kalite payı bırakıldı;
`preload="none"` sayesinde 900 KB fark zaten talep anında iniyor.

**Poster geçmişi — kayda değer bir hata.** İlk sürümde ffmpeg bulunmadığı
için poster olarak Ewalu'nun Paris sokağındaki görseli konmuştu. Video ise
okul önünde üniformalı Ewalu'yu gösteriyor; yani poster videoyu yanlış
tanıtıyordu. Öğretmen fark etti. Ders: yer tutucu varlık, temsil ettiği
şeyden görsel olarak farklıysa "marka açısından tutarlı" savunması geçerli
değildir — ya gerçeği çıkarılır ya da eksik olduğu açıkça söylenir.

Sonraki sürümde poster videonun 2. saniyesinden çıkarılmış gerçek bir
kareydi. **Bugünkü poster o da değil:** öğretmen kendi seçtiği kadrajı
gönderdi (`kaynak-varliklar/ewalu-tanitim-kare.jpg`, 1792×1008) ve posterin
bu görsel olmasını istedi. Karesinde Atatürk büstü, Türk bayrağı, okul
binası, tabelanın tam metni ve üniformalı Ewalu birlikte görünüyor.

**Kırpma öğretmenin kararı.** Kaynak 16:9 (1.778), video ise 1168×784
(1.490). Görsel olduğu gibi konsaydı tarayıcı onu video kutusuna
sığdırırken üstte ve altta bant bırakırdı. Öğretmen "kırparak hazırla"
dedi; hat kaynağı ortadan videonun oranına kırpıyor (1200×805, 1.491).
Giden kısım yalnızca kenarlardaki ağaç ve zemin — sayılan hiçbir öğe
kaybolmuyor.

ffmpeg bu ortamda `imageio-ffmpeg` paketiyle sağlandı
(`python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"`).
Varlık hattı ffmpeg'e bağımlı değil: poster kaynağı depoda duruyor.
