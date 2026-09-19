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

## Toplu öğrenci ekleme (0024)

Öğrenci eklemenin tek yolu tek tek diyalogdu: **12 sınıf × ~30 öğrenci =
360 kez**. Karnelerin, rozetlerin, konu analizinin hiçbiri öğrenci
girilmeden bir şey göstermediği için bu, bütün ürünün önündeki tıkaçtı.

**Uç: `ogrenciler_toplu_ekle(p_token, p_tur, p_sinif_id, p_adlar jsonb)`**
— öğretmene özel, en fazla 200 ad, dönen: her öğrenci için `id`, `ad` ve
iki kod. (0043'te beşinci bir parametre eklendi ve eski imza düştü:
aşağıya bakın.)

**Neden yeni uç — istemciden döngü yetmez.** 30 ayrı `ogrenci_ekle` çağrısı
30 ayrı işlem demek: ağ 17. öğrencide koparsa 16 öğrenci eklenmiş, 14'ü
eksik ve öğretmen hangisinin girdiğini bilmiyor. Tek uç tek işlem:
**hepsi ya da hiçbiri.** Geçersiz tek bir ad bütün partiyi reddediyor ve
kaçıncı satır olduğunu söylüyor.

Kod üretimi kopyalanmıyor: `_yeni_kod()` (0003) çağrılıyor — ikinci bir
üretici bir gün iki farklı alfabe ya da iki farklı uzunluk demek olurdu.

**Mükerrer ad reddedilmiyor.** Şemada `ogrenciler.ad` üzerinde UNIQUE yok
ve olmamalı: bir okulda aynı adda iki öğrenci gerçekten olur. Sunucu
ekliyor; **uyarı arayüzde**, karar öğretmenin. Arayüz hem yapıştırılan
listenin kendi içindeki hem o sınıfta zaten kayıtlı olan adları işaretliyor.

### Türkçe büyük/küçük harf tuzağı — ölçüldü

e-Okul listeleri BÜYÜK HARF geliyor. Düzeltme `lib/ogrenci-listesi.ts`
içinde ve **düz `toLowerCase()` kullanılamaz**:

```
ALİ YILMAZ IŞIK   toLowerCase()           → "ali̇ yilmaz işik"   ✗ (23 karakter)
ALİ YILMAZ IŞIK   toLocaleLowerCase('tr') → "ali yılmaz ışık"   ✓ (22 karakter)
```

Düz yol `i` harfinin ardına ayrı bir **birleşen nokta** (U+0307) ekliyor ve
`I` harfini `i` yapıyor — "IŞIK" adı "Işik" diye kaydedilirdi. Ekranda
neredeyse aynı görünür; arama tutmaz, sıralama bozulur, çocuğun adı sessizce
bozuk kalır. Testte birleşen noktanın **çıkmadığı** ayrıca ölçülüyor.

Düzeltme açılıp kapatılabiliyor; varsayılanı ölçüme göre: satırların
%80'inden fazlası tamamen büyük harfse açık geliyor. Önizlemede her zaman
**kaydedilecek hâl** görünüyor.

### Kodların dağıtımı — 0018 ile denge

Öğretmenin kararı "ikisi de olsun": sonuç ekranında hem tablo hem
indirilebilir CSV. 0018'de "bir öğrenciye kodunu gösterirken diğerlerininki
görünmesin" kuralını koymuştuk; toplu tablo o kapıyı bilerek aralıyor, o
yüzden ekranda uyarı ve tek dokunuşluk **"Kodları gizle"** var (gizleme
tabloyu DOM'dan kaldırıyor, yalnız görsel değil — testte ölçülüyor).

CSV **UTF-8 BOM** ile başlıyor ve **noktalı virgülle** ayrılıyor: BOM'suz
Excel dosyayı Windows-1254 sanıp "Çobanoğlu"yu "Ãobanoğlu" yapıyor, virgülle
ayrılsa Türkçe Excel'de her şey tek sütuna düşüyor.

**Kodlar bir kez gösteriliyor.** Sayfadan çıkınca kayboluyor; sonradan
Kodlar sekmesinden öğrenci öğrenci alınıyor (0018 yolu).

### PDF yolu buraya bağlanacak

Metin katmanlı e-Okul PDF'i geldiğinde `pdfSatirlariniOku`'nun döndürdüğü
satırlar aynı `listeyiCoz`'e verilecek; ikinci bir ayrıştırıcı yazılmayacak.
Bugün elde olan liste PDF'i taranmış bir görüntü ve o hattan sıfır satır
okunuyor — bu yüzden bu tur yapıştırmayla çalışıyor.

## Konu karnesi — dönem geneli (0023)

`konu_ozeti` (0020) **tek bir ödevin** dökümüdür; `sinif_ogrencileri` (0013)
iki ortalama verir ama konu da zaman da taşımaz. Yani *"sınıfım dönem
boyunca hangi konuda zayıf?"* sorusu 0023'e kadar hiçbir ekranda
sorulamıyordu.

**Tek uç: `konu_karnesi(p_token, p_sinif_id, p_ogrenci_id)`** — öğretmene
özel. İkisinden **tam olarak biri** verilir; ikisi birden ya da hiçbiri
`22023` ile reddedilir. Sessizce birini seçmek, öğretmenin baktığını
sandığı şeyle ekranda gösterileni ayırırdı.

| Alan | İçerik |
|---|---|
| `kapsam` | `{ tur: 'sinif' \| 'ogrenci', ad, sinif, mevcut }` |
| `odev_sayisi` | değerlendirilmiş ödev sayısı |
| `konular` | `{konu, toplam, dogru, yanlis, bos}` — **en zayıf başta** |
| `gelisim` | `{odev, tarih, tur, deger, gonderen, mevcut}` — kronolojik |

**Ölçütler kopyalanıyor, uçlar çağrılmıyor** (0022'deki desen).
"Değerlendirilmiş ödev" = yayında **ve** süresi dolmuş — `sinif_ogrencileri`
ile birebir aynı. Konu toplama `konu_ozeti` ile aynı `_konu_analizi`
çağrısını ve aynı sıralamayı kullanıyor; test eşitliği ayrıca ölçüyor.
Mevcut uçların gövdesine dokunulmuyor, imzalarına parametre eklenmiyor
(0007 tuzağı).

**Konu dökümü yalnız test ödevlerinden; `gelisim`'e açık uçlu da giriyor.**
Açık uçlunun cevap anahtarı yok — konu dökümüne girseydi her soru "boş"
sayılır ve öğretmene uydurma bir eksik listesi çıkardı. Ama puanı var,
dolayısıyla gelişimden çıkarmak resmin yarısını silerdi.

**Gönderilmeyen ödevde `deger` `null`, 0 değil.** Sıfır yazmak "sıfır aldı"
demektir; göndermemek başka bir şeydir. Kaç kişinin gönderdiği ayrı alanda.

**Hiçbir eğilim iddiası yok** — ne ok, ne "yükseliyor", ne "düşüyor". Üç
ödevden yön çıkarmak ölçülemeyecek bir iddia olurdu ve o iddia yanlışsa
öğretmen bir çocuk hakkında yanlış bir cümle kurar.

**Arşiv ve pasif — sorulan şeye göre.** Sınıf karnesinde pasif öğrenci
sayılmıyor (`sinif_ogrencileri` ile aynı). Ama uç bir liste değil, kimlikle
çağrılıyor: pasif bir öğrencinin ya da arşivlenmiş bir sınıfın karnesi
istendiğinde **yine dönüyor** — tam olarak 0016'nın `sinif_ogrencileri` ve
`odev_gonderimleri` için bilerek bıraktığı geri dönüş yolu. Bunun bilinen
bir sonucu var: `konu_ozeti` gönderimleri hiç süzmediği için pasif
öğrencinin gönderimi orada sayılır, karnede sayılmaz. Test bu farkı
gizlemiyor, beklenen büyüklükte olduğunu ölçüyor.

**Öğrenci ve veli çağıramıyor.** Dönem geneli "zayıf konular" listesini bir
çocuğa göstermek ayrı bir karardır — hangi tonda, hangi eşikten sonra,
kimin ağzından? Öğretmen istemedi.

**Ölçülen maliyet.** Uç her soruyu jsonb'den okuyor, yani tahmin edilmedi:

| Yük | Sınıf karnesi | Öğrenci karnesi |
|---|---|---|
| 30 öğrenci × 20 ödev × 10 soru | 38–45 ms | 2,7 ms |
| 35 öğrenci × 40 ödev × 20 soru (bir yıl) | **169 ms** | 6,6 ms |

Karşılaştırma: aynı veride `sinif_ogrencileri` 1,8–3,9 ms,
`odev_gonderimleri` 5 ms. Karne belirgin olarak daha pahalı; bu yüzden
**ayrı yükleniyor** (`KonuKarnesiBolumu`'nun kendi `useVeri`'si var) ve
sayfanın geri kalanı onu beklemiyor. Rozetlerin aksine yoklanmıyor: yalnız
öğretmen o sayfayı bilerek açtığında bir kez çalışıyor.

**Uç çalıştırılmamışsa ekran bozulmuyor:** PostgREST'in İngilizce
`schema cache` hatası gösterilmiyor; yerine "0023'ün panelde çalıştırılması
gerekiyor" yazan sakin bir kart çıkıyor ve sayfanın geri kalanı çalışmaya
devam ediyor.

## İki ayrı yazışma ve rol sekmeleri (0025)

Öğretmenin isteği: *"Mesajlar kısmında öğrenci öğretmenle, veli öğretmenle
olacak şekilde"*, ve öğrenci/veli girişlerine sekmeler.

### Sınır ŞEMADA, arayüzde değil

0025'e kadar `mesajlar` tablosunda öğrenci başına **tek** akış vardı.
Öğrenciye o akışı olduğu gibi açsaydık çocuk, velisinin öğretmenle
yazdıklarını okurdu — *"Ali son zamanlarda çok tembelleşti, ne
yapmalıyız?"* gibi cümleleri. Bu bir görünürlük tercihi değil; gizlenen
veri gönderilmiş veridir (Part XXI).

Bu yüzden `mesajlar.kanal` sütunu geldi (`'veli'` / `'ogrenci'`) ve
okuma uçları o sütuna göre süzüyor:

| Uç | Kime | Hangi kanal |
|---|---|---|
| `ogrenci_mesajlari` | öğrenci | yalnız `ogrenci` |
| `veli_paneli.mesajlar` | veli | yalnız `veli` |
| `mesajlar_ogretmen(…, p_kanal)` | öğretmen | seçtiği kanal |

**Rol kanalı belirliyor, parametre değil.** `mesaj_gonder`'de veli her
zaman `veli`, öğrenci her zaman `ogrenci` kanalına yazıyor; parametre
yalnız öğretmen için anlamlı. Yani veli `p_kanal='ogrenci'` göndererek
çocuğunun yazışmasına giremiyor.

### `okundu` anahtarı neden üç sütun oldu

Öğretmenin artık öğrenci başına **iki** okuma işareti var. Anahtar
`(ogrenci_id, rol)` kalsaydı veli yazışmasını okumak öğrenci yazışmasını
da okunmuş sayardı ve **çocuğun mesajı sessizce kaybolurdu** — 0019'un
bir kez düzelttiği hatanın aynısı. Anahtar `(ogrenci_id, rol, kanal)`.

### PL/pgSQL tuzağı — değişken adı sütun adıyla aynı olmamalı

`okundu_isaretle`'de yerel değişkeni `kanal` diye yazmıştım.
`insert … on conflict (ogrenci_id, rol, kanal)` hedefinde PostgreSQL
değişkenle sütunu ayıramıyor:

```
ERROR: column reference "kanal" is ambiguous
DETAIL: It could refer to either a PL/pgSQL variable or a table column.
```

Değişkenler `v_kanal` oldu. Kural: sütun adını yerel değişken adı olarak
kullanma.

### Sekmeler

| Giriş | Sekmeler |
|---|---|
| Öğrenci (okul) | Pano · Ödevler · Mesajlar |
| Öğrenci (özel ders) | Pano · Ödevler · Mesajlar |
| Veli (okul) | Pano · Ödevler · Mesajlar |
| Veli (özel ders) | Pano · Ödevler · **Ödemeler** · Mesajlar |

Üç kabuk da `components/layout/SekmeCubugu.tsx`'i kullanıyor; öğretmen
kabuğunun görünümü değişmedi. Öğrenci ve veli geniş ekranda **yatay**
sekme satırı kullanıyor, öğretmendeki gibi yan menü değil: ikisinin de
düzeni ortalanmış 880 px'lik tek sütun.

**Ödemeler sekmesi yalnız özel derste.** Rotası okul velisinde de tanımlı
(adresi elle yazan veli beyaz ekranla kalmasın), yalnız sekmesi
çizilmiyor; veri zaten sunucudan boş geliyor.

**Öğrenci ekranlarında para bilgisi yok** — öğretmenin kalıcı kuralı.
Sınır sunucuda: `ogrenci_odevleri` tutar/ödendi diye bir alan hiç
göndermiyor. `app/scripts/kabuk-denetimi.mjs` bunu üç öğrenci ekranında
hem ekran metninden hem **ağ yanıtından** ölçüyor, ve aramanın çalıştığını
aynı desenin velinin ödeme ekranında eşleştiğini göstererek kanıtlıyor.

**Ewalu yalnız öğrenci Panosunda ve ödev sonucu ekranında.** Sekmeler
gelince `Odevlerim`'deki Ewalu kaldırıldı; her sekmede karakter
göstermek Part VII'nin açıkça uyardığı şey.

### Öğretmen tarafı

Öğrenci yazışmaları **Öğrenciler** sekmesinde (öğretmenin kararı):
listenin üstünde "Yanıt bekleyen öğrenciler", öğrenci detayında Mesajlar
düğmesi. Veliler sekmesi aynen kaldı. Rozet **tek**: iki ayrı sayı
öğretmene iki ayrı yer aratırdı.

### Mesaj satırı: ad ve mesaj aynı satırda

İlk sürümde gönderen etiketi kendi satırındaydı, mesaj balonu altındaydı.
Öğretmen bunu bildirdi: *"Öğrenciden gelen mesaj öğrencinin isminin
yanında olmalı. Ayrı bir satırda olmamalı o mesajlar."*

Artık ad balonun **içinde** kalın bir ön ek, mesaj hemen yanında, saat en
sonda küçük ve soluk. Saat neden adın yanında değil: 360 px'de ad + saat +
mesaj tek satıra sığmıyor ve metin satırlarca aşağı iniyordu.

Öğretmen ekranında etiket artık **öğrencinin gerçek adı**
(`mesajlar_ogretmen.ogrenci.ad`). **Veli tarafında ad yok ve
uydurulmuyor** — şemada veli adı diye bir alan yok, yalnız veli KODU var;
orada "Veli" yazıyor.

Kim yazdı bilgisi hâlâ **renkle değil yazıyla da** veriliyor; ön ek bu
güvenceyi koruyor.

`kabuk-denetimi.mjs` bunu sınıf adına ya da HTML yapısına bakarak değil,
adın ve mesajın `getBoundingClientRect().top` değerlerini karşılaştırarak
ölçüyor — ekranda gerçekten aynı hizada mı, sorulan bu.

**Dürüst sınır:** çok uzun tek bir kelimeyle başlayan bir mesaj yine alt
satıra sarar. Bu normal metin akışı; verilen güvence "ad kendi satırına
zorlanmıyor", "hiçbir mesaj hiçbir zaman sarmaz" değil.

## Öğrenci ve veli kendi konu karnesini görüyor (0026)

0023'te konu karnesi **yalnız öğretmene** açılmıştı ve sebebi yazılıydı:
dönem geneli "zayıf konular" listesini bir çocuğa göstermek ayrı bir
karardı. Öğretmen bu turda kararı verdi.

### Yeni uç PARAMETRE ALMIYOR — ve asıl güvence bu

`kendi_karnem(p_token)`. `p_ogrenci_id` alsaydı "başkasının karnesini
isteyemez" bir DENETİM olurdu: yazılır, unutulur, bir düzenlemede düşer.
Parametre hiç olmayınca başkasının karnesini istemek **yapı gereği**
imkânsız — sorulacak bir kimlik yok, öğrenci oturumdan geliyor.
(`ogrenci_mesajlari` ve `veli_paneli` ile aynı desen.) Test, kimlik alan
bir ikinci imzanın açılmadığını ayrıca ölçüyor.

`konu_karnesi`'ye dokunulmadı: imzası ve öğretmen şartı 0023'teki gibi.

### Ne gitmiyor ve neden

| Gitmeyen | Sebep |
|---|---|
| sınıf mevcudu, ortalaması | bir çocuğa "sınıfın neresindesin" demek bu ekranın işi değil |
| başka öğrencinin verisi | sorgu kendi `ogrenci_id`'sine bağlı |
| `gelisim`'de `gonderen`/`mevcut` | sınıf bilgisi; kıyas kapısını açardı |
| cevap anahtarı | Kural 6 — `_konu_analizi` yalnız sayı döndürüyor |
| ödeme | öğretmenin kalıcı kuralı |

Öğrenci ve veli **aynı** karneyi görüyor (aynı çocuk); test bunu da
ölçüyor. Sayıların öğretmenin `konu_karnesi` çıktısıyla **birebir** aynı
olduğu bağlanmış durumda — ayrışırlarsa test kırılıyor.

### Sekme adı "Karnem" değil "Konularım"

Türkiye'de "karne" okulun resmî not karnesidir; o sekmeye basan bir çocuk
notlarını bekler, oysa içeride konu dökümü var. Etiket tek satırlık bir
değişiklik.

### Cümle taslak ve tek dosyada

`lib/karne-sozu.ts` — üç durum (veri yok / hepsi tam / eksik var), her
biri öğrenci ve veli sesiyle. `lib/ewalu-puan.ts`'teki desen: cümleler
öğretmenindir, buradakiler taslaktır ve tek dosyadan değişir.

Üçünde de **kıyas yok, eğilim iddiası yok**, çocuğu değil işi işaret
ediyor ("takılmışsın", "zayıfsın" değil) ve her cümle bir sonraki adımla
bitiyor. Test yasaklı kelime listesini üç durumda da tarıyor.

**Ewalu yalnız öğrenci karnesinde ve Panoda** — velinin ekranında yok,
onun Panosunda zaten var.

### Ölçümde düzeltilen üç kendi hatam

1. **Geri alma kanıtı hiçbir şey ölçmüyordu.** Altı zayıflatmanın altısı
   da "yakalandı" göründü, ama hepsi AYNI hatayla düşüyordu: test dosyası
   tekrar çalıştırılabilir değildi ve her koşuda sınıfa iki ödev daha
   ekleniyordu. Temizlik eklendi; sayım testi ancak temiz zeminde bir şey
   ölçer.
2. **`d.tur='test'` süzgeci normal veriyle ölçülemiyordu** (0023'teki
   aynı durum): açık uçlu ödev normal yoldan konu taşıyamıyor. Bozuk
   satırı artık test kendisi üretiyor.
3. **Yalnız sqlstate'e bakmak kördü:** rol şartını kaldırınca öğretmen bu
   kez `ogrenci_id is null` duvarına takılıp yine `42501` dönüyordu.
   Türkçe mesaj da ölçülüyor.

Tarayıcı tarafında da iki ölçüm hatası düzeltildi: sayfanın tamamındaki
ağ yanıtlarını taramak yanlıştı (öğrenci teslimden sonra anahtarı meşru
olarak alıyor — 0007), ölçüm karne ucuna daraltıldı; ve konu adını
aramak kördü, çünkü ad Ewalu'nun cümlesinde de geçiyor — listenin kendi
başlığı da aranıyor.

## Faz sırası

| Faz | Kapsam | Durum |
|---|---|---|
| 0 | Mimari + tasarım sistemi | **tamamlandı** |
| 1 | Veritabanı + güvenlik | **tamamlandı** — 0001–0023 canlıda, **0024 öğretmenin çalıştırmasını bekliyor** |
| 2 | Öğretmen: sınıf, öğrenci, ödev, cevap anahtarı | **tamamlandı** |
| 2C–2D | Öğrenci teslim ekranı, gönderim takibi, açık uçlu puanlama | **tamamlandı** |
| 3 | Pano detayları, arşiv, kodlar, veliler, mesajlaşma | **tamamlandı** |
| 3F | Konu analizi, yanlış soru numaraları, PDF'ten öneri | **tamamlandı** |
| — | Yedekleme ve geri yükleme | **tamamlandı** — `docs/yedekleme.md` |
| — | PIN değiştirme | **tamamlandı** — `/ogretmen/ayarlar` |
| — | Özel ders: dersler ve ödemeler (0021) | **tamamlandı** — `/ogretmen/ogrenciler/:id` |
| — | Ana ekrana ekleme ve sürüm denetimi | **tamamlandı** |
| — | Uygulama içi bildirimler (0022) | **tamamlandı** — kabuktaki rozetler |
| — | Konu karnesi: dönem geneli döküm ve gelişim (0023) | **tamamlandı** — sınıf ve öğrenci sayfalarında |
| — | Toplu öğrenci ekleme (0024) | **tamamlandı** — `/ogretmen/ogrenciler/toplu` |
| 5 | Deterministik test puanlama | `_puanla` canlıda; birim testleri Faz 11'de genişletilecek |
| 6 | Açık uçlu değerlendirmede AI desteği | **ölçüldü, ertelendi** — soru PDF'lerinde metin katmanı var ama soru metni yok; sorular görsel. Görsel okuyan AI ayrı bir tur, API anahtarı gerekiyor |
| 7 | Analitik | **kısmen** — dönem geneli konu karnesi ve gelişim geldi (0023). Kalan: öğrenci/veliye dönük döküm ve sınıflar arası bakış, ikisi de ayrı karar |
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

## Tanıtım sayfası (Faz 9)

Adres **`/yeni/tanitim/`** — herkese açık, giriş gerektirmeyen tek sayfa.
Hedef okuyucu okul müdürü, veli ve ürünü ilk kez duyan biri; öğrenci
değil (öğrencinin ihtiyacı giriş kutusudur ve o ekran ayrı kalıyor).

### Neden ikinci bir Vite girişi

Öğretmenin kararı adresin `#` içermemesiydi: bağlantı bir veli mesajına
ya da okul panosuna yazılacak ve bazı uygulamalar `#`ten sonrasını
bağlantıya dahil etmiyor. Uygulama `HashRouter` kullandığı için rota
olarak eklemek `/yeni/#/tanitim` üretirdi.

Bu yüzden `vite.config.ts`'e ikinci bir giriş noktası kondu:

```
index.html          → /yeni/            uygulama
tanitim/index.html  → /yeni/tanitim/    tanıtım
```

**Ölçülen yan etki: uygulamanın yükü artmadı.** İki giriş noktası Rollup'ı
ortak parça üretmeye itiyor; öğrencinin indirdiği toplam ham 406.176 →
405.277 bayt, gzip 118.869 → 118.858 bayt. Fark 11 bayt, yani yok.

Ayrıca `App.tsx:59`'daki yapı bozulmadan kaldı: giriş yapılmamışken
uygulama hâlâ doğrudan `GirisEkrani`'ni döndürüyor, `Routes`'a hiç
girmiyor. Tanıtım sayfası ayrı bir HTML olduğu için o dalı açmak
gerekmedi.

### Sayfa sunucuya hiç bağlanmıyor

`src/tanitim.tsx` ne `HashRouter`, ne oturum sağlayıcı, ne Supabase
istemcisi içe aktarıyor. Sonuç ölçülüyor (`scripts/tanitim-denetimi.mjs`
1. grup): sıfır dış istek, sıfır çerez, boş `localStorage`. Sayfa bunu
okuyucuya da yazıyor — ve yazdığı için ölçülmesi şart: ölçülmeyen bir
gizlilik iddiası iddia değil temennidir.

### Ekran görüntüleri uydurma veriyle

`scripts/tanitim-gorselleri.mjs` uygulamayı Playwright ile açıp bütün RPC
çağrılarını kesiyor ve uydurma veriyle cevaplıyor. Gerçek öğrenci verisi
hiçbir aşamada kullanılmıyor ve sayfa bunu okuyucuya açıkça söylüyor.

Betikte iki ölçüm hatası çıktı ve ikisi de kayda değer:

1. **Sahte "sızıntı" alarmı.** Gerçek sunucuya giden istekleri
   `page.on('request')` ile saymıştım; denetim "2 gerçek istek" dedi. Oysa
   o olay `route.fulfill()` ile karşılanan istekler için de tetikleniyor ve
   o istekler tarayıcıdan hiç çıkmıyor. Doğru ölçüm iki katmanlı: önce
   Supabase'e giden her şeyi yakalayıp iptal eden bir yol, sonra (kayıt
   sırasının tersinden eşleştiği için üstte kalan) RPC yolu. Böylece
   "karşılanmamış istek" sayısı gerçekten sıfır ölçülüyor.
2. **"87 gün kaldı".** Sahte son tarihleri sabit bir güne yazmıştım ama
   etiketleri uygulama gerçek saate göre hesaplıyor; iki gün sonrası için
   "87 gün kaldı" yazan bir ekran ürünü bozuk gösterirdi. Tarihler artık
   çekim anına göreli.

### Metindeki iddialar denetleniyor

Denetimin 5. grubu sayfanın metnini okuyup iki yönlü ölçüyor:
**bulunması gerekenler** (anahtarın yalnız teslimden sonra açıldığı, açık
uçlu değerlendirmenin öğretmende olduğu, kıyaslama yapılmadığı,
görsellerin uydurma olduğu, çerez/takip yapılmadığı) ve **bulunmaması
gerekenler** (çevrimdışı çalışma, bildirim gönderme, "yapay zekâ
destekli", otomatik konu önerisi — dördü de bugün YAPILMAYAN şeyler),
üstüne editoryal yasaklar.

Bir gün bu sayfaya ürünün yapmadığı bir vaat eklenirse denetim kırılır.

## Tanıtım sayfası — altı bölümlük yeniden kurulum

Öğretmen sayfa için yeni ve tam bir brief verdi: dört danışmanlı bir kurul
çerçevesi, altı bölüm ve her bölümün metni yazılmış hâlde. Üç ton kuralı
kesin — **savunmacı/olumsuz cümle yok**, **kurum adı gururla geçer**,
**yoğun paragraf yok**. Sayfa 13 paragraf ağırlıklı bölümden 6 taranabilir
bölüme indi; rol bölümleri paragraf değil **üçer madde**.

| # | Bölüm |
|---|---|
| 1 | Hero — kurum rozeti, H1 "Öğrenmenin Sürekliliği, Gelişimin Netliği.", iki çağrı |
| 2 | Felsefe — "Sadece Puan Değil, Süreç Odaklı Akademik Rutin" + üç kart |
| 3 | Ekosistem — Öğrenci / Öğretmen / Veli + Okul Yönetimi |
| 4 | Ewalu |
| 5 | Güvenilir Altyapı, Sorumlu Teknoloji |
| 6 | Künye ve kapanış |

### Ölçümle karara bağlanan beş nokta

Brief satır satır ürüne karşı ölçüldü; beş yerde ayrışma çıktı ve beşini de
öğretmen karara bağladı.

**1. Satıcı adı ve ülke sayfada geçmiyor.** Brief "İsveç merkezli …
Supabase" diyordu. Ölçüm doğrulamadı: proje bölgesi **Zürih
(eu-central-2)**, yani İsviçre; sağlayıcı şirket de İsveç merkezli değil.
Doğrulanmamış bir iddiayı yayımlamaktansa (Kural 15) öğretmenin kararıyla
**hiçbiri yazılmıyor** — ne İsveç, ne Zürih, ne İsviçre, ne satıcı adı.
Bölge bilgisi `docs/kvkk-notlari.md` içinde duruyor; kalkan yalnız tanıtım
sayfasındaki cümle.

**2. "Öğrenmenin sonu yok." tam bir kez.** Yeni H1 öğretmenin başlığı;
marka cümlesi eskiden üç yerdeydi, artık yalnız kapanışta. Denetim **kaç
kez geçtiğini** sayıyor.

**3. Okul Yönetimi bloğu ekransız ve girişsiz.** Sistemde üç rol var —
`ogretmen`, `ogrenci`, `veli`. Okul yönetimi girişi, kurum panosu ya da
idari rapor **yok**. Öğretmenin üç maddesi birebir duruyor ve zaten bir
özellik vaat etmiyor; ama diğer üç rolle birebir aynı kalıpta dursaydı
dördüncü bir giriş varmış gibi okunurdu. Çözüm bir savunmacı cümle yazmak
değil, **bloğu farklı kurmak** oldu: ekran görüntüsü yok, giriş bağlantısı
yok. Denetimin 6. grubu bunu DOM'dan ölçüyor.

**4. Cevap anahtarı güvencesi olumlu kipte.** "Ödevini teslim etmeden
cevap anahtarına erişemez" → **"Teslimden sonra açılan çözümler ve kişisel
analiz."** Aynı güvence (Kural 6 / Part XXI), tek bir olumsuz sözcük
kullanmadan. Sunucudaki kural değişmedi.

**5. Ewalu "akıllı" değil.** Ewalu bir çizim ve puan aralığına göre cümle
seçen bir kural kümesi (`lib/ewalu-puan.ts`) — yapay zekâ değil ve Kural 5
gereği testleri hiçbir zaman yapay zekâ puanlamayacak. Öğretmen aynı sıfatı
bir önceki turda video altyazısından da kendisi çıkarmıştı.

Ayrıca üç yazım düzeltmesi: "Bosphorus hattının" → **"Boğaz hattının"**
(Kural 18), bölüm numaraları 1-2-4-4 → 1-2-3-4, "imkanı" → "imkânı".

**Beş kararın beşi de denetimde kilitli.** `scripts/tanitim-denetimi.mjs`
İsveç, satıcı adı, bölge adı, "akıllı maskot/asistan", "Bosphorus" ve
dördüncü bir giriş vaadini yasaklı desen olarak arıyor; marka cümlesini
sayıyor; yönetim bloğunun görsel ve bağlantı sayısını ölçüyor. Kararların
ölçülerek uygulandığı, dokuz yamanın tek tek geri alınmasıyla kanıtlandı
(**9/9 kırıldı**).

### Bilerek dışarıda bırakılan

**Ödeme takibi.** Özel ders ödemeleri üründe var ama tanıtım sayfasında
anlatılmıyor: sayfa okulun mührünü taşıyor ve okul kimliğiyle özel ders
ücretlendirmesini aynı sayfada yan yana koymak doğru olmazdı. Karar
öğretmenin; istenirse eklenir.

### Giriş ekranına eklenen tek satır

Videonun da altında, kod kutusunun çok aşağısında bir "SEKİZ nedir?"
bağlantısı. Öğretmenin belirlediği sekiz maddelik sıraya eklenen dokuzuncu
öğe ve bilerek en altta — her gün giriş yapan öğrencinin önüne çıkmıyor.
Denetim bunu sınıf adıyla değil, bağlantının form kutusundan **aşağıda**
olduğunu ölçerek doğruluyor.

## Genel ortalama (0029)

Tanıtım sayfasının nihai metni iki yerde "genel ortalamasını takip
edebilir" diyordu. **Ölçüldü: böyle bir ekran yoktu.** `kendi_karnem`
yalnız konu dökümü ve ödev ödev değerler döndürüyordu.

Öğretmenin kararı: metne dokunma, eksik özelliği yap. 0029 `kendi_karnem`
ve `veli_paneli` gövdelerine tek alan ekliyor: `genel_ortalama`.

**Kapsam dar ve bilinçli — yalnız çocuğun KENDİ ortalaması.** Sınıf
ortalaması, sıralama ve başka öğrencinin verisi bu iki uçtan hâlâ
çıkmıyor; 0026'daki karar değişmedi.

`round(avg(coalesce(ogretmen_puan, puan)), 1)` — arayüzdeki ve
`sinif_ogrencileri`'ndeki hesabın aynısı. **Gönderilmeyen ödev 0 olarak
girmiyor:** puanlanmamış bir işi ortalamaya sıfırla katmak, öğrenciyi
yapmadığı bir sınavdan kalmış gibi gösterirdi. Pencere
`kendi_karnem.odev_sayisi` ile aynı (yayında + süresi dolmuş), yani
ekrandaki "N değerlendirilmiş ödev üzerinden" satırıyla aynı şeyden söz
ediyor. Değerlendirilmiş gönderim yoksa `null` ve satır hiç çizilmiyor.

**Gövdeler ezberden yazılmadı.** 0016'da `create or replace` için gövdeyi
yeniden yazmak iki hataya yol açmıştı; 0029 gövdeleri kaynak
migration'lardan birebir kopyalayan bir betikle üretildi ve diff'i
ölçüldü: **sıfır satır silinmiş**, yalnız 29'ar satır eklenmiş.

### 0026'nın denetimi daraltıldı, gevşetilmedi

`kendi_karnem_testleri.sql` 3c "ortalama" alt dizesini toptan
yasaklıyordu ve 0029 eklenince tetikledi. Denetim haklıydı ama ölçtüğü
şey niyetinden genişti: yasaklanan **kıyas**tır, çocuğun kendi ortalaması
değil. İzinli tek anahtar metinden çıkarılıp kalan her "ortalama" hâlâ
yakalanıyor — `sinif_ortalama`, `ortalama_tum`, `ortalama_yapan` ve
`siralama` için tek tek ölçülerek doğrulandı.

## Aynı ödevi birden çok sınıfa (0030)

Ölçüldü: `odev_olustur` tek sınıf alıyordu (`p_sinif_id uuid`). 9A, 9B ve
9C'ye aynı ödevi vermek için üç adımlı akıştan **üç kez** geçmek, iki
PDF'i **üç kez** yüklemek ve cevap anahtarını **üç kez** girmek
gerekiyordu. 12 sınıf var ve aynı seviyenin şubeleri aynı müfredatı
görüyor.

### Kopya, ortak ödev değil

`odevler.sinif_id` `not null` ve neredeyse her uç ona göre süzüyor (0013,
0016, 0020, 0023, 0026, 0029). "Tek ödev – çok sınıf" şeması o uçların
tamamını elden geçirmek demekti. Bunun yerine her sınıfın **kendi ödevi**
oluşuyor: kendi gönderimleri, kendi karnesi, kendi ortalaması.
Aralarındaki tek bağ `odevler.grup_id`; tek sınıfa verilen ödevde `null`.

### PDF bir kez yükleniyor — ve bu güvenlik sorusu doğuruyor

Dosya yolu ödevin id'sinden bağımsız üretiliyor
(`odev/<rastgele-uuid>/<tur>.pdf`, `services/dosya.ts`), dolayısıyla
kopyalar **aynı yüklenmiş dosyayı paylaşıyor**. Tarayıcıda ölçüldü: üç
sınıf, iki PDF → imzalı adres **2 kez** istendi, dosya **2 kez**
yüklendi (`coklu-sinif-denetimi.mjs`).

Paylaşılan **cevap anahtarı** ise Kural 6'yı ilgilendiriyor:
`dosya_erisim_izni` öğrenciye erişimi `d.anahtar_url = p_yol` eşleşmesi
üzerinden veriyor. Üç ödev aynı yolu taşıdığında bir sınıfın teslimi
diğerlerine anahtarı açar mıydı? **Açmıyor** — eşleşme öğrencinin KENDİ
gönderimi üzerinden kuruluyor. Bu varsayılmadı, `coklu_sinif_testleri.sql`
7. grubunda dört durumla ölçüldü: teslim etmemiş öğrenci `false`, teslim
eden `true`, başka sınıfın öğrencisi (kendi teslimi yokken) `false`,
**veli her koşulda `false`**.

### Atomiklik ve arıza enjeksiyonu

`odevler_coklu_olustur` ön denetimden sonra döngüde mevcut
`public.odev_olustur`'u **çağırıyor** — ikinci bir insert yazsaydık iki
yol bir gün ayrışırdı. Tek işlem: hepsi ya da hiçbiri.

Testin ölçtüğü şey burada dikkat istiyor: ön denetim bozuk sınıfı baştan
elediği için "geçersiz sınıf" denemesi döngünün atomikliğini **hiç
sınamaz**. Bu yüzden 4. grup ikinci sınıfın insert'inde patlayan geçici
bir tetikleyici kuruyor; birinci sınıf yazılıyor, ikincisi patlıyor ve
hiçbir satırın kalmadığı ölçülüyor. Denetim `do` bloğunun **dışında**
(0024'te öğrenilen tuzak: `exception` taşıyan blok kendi alt işlemini
açar ve fonksiyon yarım yazsa bile test geçerdi).

### Kardeşler bağımsız — ve bu ekranda yazıyor

Kopyalar oluştuktan sonra birbirinden bağımsız: cevap anahtarı
düzeltmesi yalnız düzenlenen sınıfı etkiliyor. Sessiz bırakmak, iki
sınıfta yanlış notu görünmez kılardı — 0008'in otomatik yeniden
puanlaması tam olarak bunun için yazılmıştı. Bu yüzden `odev_detay` ve
`odevler_listesi` `kardesler` alanını taşıyor; düzenleme ekranı
"buradaki değişiklik yalnız 9B'yi etkiler" diyor, liste satırı
"9A · +2 sınıf" gösteriyor.

**Düzeltmeyi kardeşlere yaymak 0030'da YAPILMADI**; tehlike gizlenmedi,
görünür kılındı. 0031 o boşluğu kapatıyor (aşağıdaki bölüm).

### 0030 çalıştırılmamışsa

Ekran bozulmuyor: uç yoksa ve tek sınıf seçiliyse eski `odev_olustur`'a
düşülüyor, çok sınıf seçiliyse Türkçe ve anlaşılır bir cümle çıkıyor
(Part VIII). Bu yüzden sürümün 0030'dan önce yayına girmesi güvenli.

### Yol boyunca bulunan iki ölçüm hatası (kendi hatalarım)

1. **Erişilebilirlik denetimi ödev OLUŞTURMA ekranını hiç gezmiyordu.**
   En çok alanı olan ekranlardan biri her turda ölçüm dışında kalmıştı;
   listeye eklendi (32 ekran).
2. **"21 sınıf reddediliyor" testi tavanı ölçmüyordu.** Aynı sınıfı 21
   kez gönderiyordum; tavan kaldırılınca mükerrer denetimi devreye girip
   test yine geçiyordu. Geri alma kanıtı yakaladı; test 21 **gerçek ve
   ayrı** sınıfla yeniden yazıldı.

## Düzeltmeyi kardeş ödevlere yayma (0031)

0030 kopyaları bağımsız bıraktı ve düzeltmeyi yaymayı **bilerek** dışarıda
bıraktı. Ölçülen sonucu şuydu: öğretmen 10U'da bir anahtar hatasını
düzeltince 10V ve 10W'de **yanlış notlar sessizce kalıyordu**. Ekran bunu
söylüyordu ("diğerlerini ayrı ayrı düzenleyin") ama bir çıkış yolu
vermiyordu. 0031 o yolu açıyor.

Tek yeni uç: **`odev_kardeslere_yay(p_token, p_id)`** — öğretmene özel.
Kaynak ödevin içeriğini aynı `grup_id`'yi paylaşan kardeşlere kopyalıyor
ve her birinin gönderimlerini yeniden puanlıyor.

### Ne taşınıyor, ne taşınmıyor — ve bu kilitli

Öğretmenin kararı: **içerik + başlık**.

| Taşınır | Taşınmaz |
|---|---|
| `cevap_anahtari`, `soru_sayisi`, `sik_sayisi` | `son_tarih` |
| `konular` | `gec_teslim` |
| `anahtar_url`, `odev_url` | `yayinda` |
| `baslik`, `aciklama` | `sinif_id`, `grup_id` |

Sağ sütun gerekçeli: **her sınıfın kendi programı var.** 10W'ye bilerek
verilen uzun süre, bir anahtar düzeltmesiyle bozulmamalı.

Bu karar yorumda bırakılmadı, **migration'ın kendi denetimi** olarak
yazıldı: gövdede `son_tarih|gec_teslim|yayinda|sinif_id` alanlarından
birine `= d.` ile atama yapılırsa migration patlıyor. Biri bir gün kapsamı
sessizce genişletemiyor. Test de aynı şeyi çalışma anında ölçüyor
(5. grup).

### `odev_guncelle`'ye DOKUNULMADI — bilinçli

İmzasına bir `p_kardeslere_yay` parametresi eklemek 0007 tuzağını davet
ederdi: eski imza `grant`'iyle birlikte ayakta kalır ve arayüz sessizce
eski davranışa düşebilirdi. Ayrı uç hem o tuzağı hiç açmıyor hem de
"kaydettikten sonra ayrı bir karar" akışının doğal karşılığı.

### Arşivdeki kardeş atlanıyor — ve raporda yazıyor

0016'nın kuralı: arşivdeki sınıf öğretmenin hiçbir listesinde yok.
Görünmeyen bir sınıfın notunu sessizce değiştirmek o kuralı delerdi. O
kardeş atlanıyor, raporda `atlandi: 'arsiv'` olarak dönüyor ve ekranda
"Atlandı — bu sınıf arşivde" diye yazıyor. Düğmenin metni de yalnız
yayılabilecek sınıfları sayıyor; yayılmayacak bir sınıfı düğmede vaat
edip raporda "atlandı" göstermek şaşırtırdı.

### Rapor yalnız GERÇEKTEN değişen puanları taşıyor

`yeniden_puanlanan`'a bir öğrenci ancak `yeni.puan is distinct from
g.puan` ise giriyor. Testte Zeynep bilerek her iki anahtarda da yanlış
olan bir cevap veriyor: puanı değişmiyor ve **raporda yer almıyor**.
"Her öğrenciyi rapora yaz" hatası böyle yakalanıyor.

Denetim izi iki katmanlı (Part XLIII): her kardeş ödev için
`kardeslere_yayildi` (eski/yeni gövdeyle), puanı değişen her gönderim
için mevcut `yeniden_puanlandi` kaydı. "Hangi düzeltme nereden geldi"
izden okunabiliyor.

### `odev_detay`: `kardes_detay` eklendi, `kardesler` AYNEN duruyor

`kardesler` yalnız sınıf **adı** dizisi döndürüyor ve yayma düğmesi için
yetmiyor. Yeni `kardes_detay` her kardeş için `id`, `sinif`,
`gonderim_sayisi`, `anahtar_ayni` ve `arsiv` taşıyor. `kardesler`'in
**şekli değişmedi**: `Odevler.tsx` onu dizi olarak kullanıyor,
değiştirmek o ekranı kırardı.

### Arayüz: onay olmadan hiçbir not değişmiyor

Kart, kaydettikten sonra ekranda kalıyor (kardeşi olan ödevde listeye
dönülmüyor — düğme tam gerektiği anda kaybolurdu). Düğme bir onay
diyaloğu açıyor; diyalog taşınacakları ve **taşınmayacakları** tek tek
yazıyor. Denetim bunu "düğme var mı" diye değil, **onaylanmadan ağa tek
bir yayma çağrısı gitmediğini sayarak** ölçüyor.

### 0031 çalıştırılmamışsa

`odev_detay` `kardes_detay` alanını hiç döndürmüyor; yayma kartı ve
düğmesi **hiç çizilmiyor** ve 0030'un bugünkü uyarısı yerinde kalıyor
(`ucYok` deseni, Part VIII). Bu yüzden sürümün 0031'den önce yayına
girmesi güvenli.

### Geri alma kanıtında bulunan iki gerçek kusur (kendi hatalarım)

1. **`kardes_detay` alanı tamamen kaldırıldığında test GEÇİYORDU.**
   `jsonb_array_length(NULL)` NULL döner ve `NULL <> 3` de NULL'dur —
   yani `if` hiç tetiklenmiyordu. Aynı NULL tuzağı geri yükleme
   betiğinde de yaşanmıştı (`docs/yedekleme.md`). Denetimler
   `is distinct from` ve `jsonb_typeof(...) is distinct from 'array'`
   ile yeniden yazıldı.
2. **Migration'ın kendi denetimi de boştu.** `pg_get_functiondef(...)
   not like '%kardes_detay%'` deseni, alan `kardes_detay_yok` diye
   yeniden adlandırıldığında da eşleşiyordu. Anahtar adı artık
   tırnaklarıyla aranıyor.

İkisi de yalnız her denetim tek tek geri alındığı için görüldü.

## Ewalu'nun cümlelerini öğretmen yazsın (0032)

Ewalu'nun puana göre söylediği beş cümle koda gömülüydü
(`lib/ewalu-puan.ts`); bir kelimesini değiştirmek bir geliştirme turu
gerektiriyordu. 0032 o kapıyı öğretmene açıyor.

### Sözleşme: varsayılanlar kodda kalıyor

**Yeni tablo BOŞ başlıyor** ve yalnız "öğretmen bu bandı DEĞİŞTİRDİ"
bilgisini taşıyor. Üç sonucu var:

1. Migration hiçbir metni sahiplenmiyor; cümlelerin tek doğruluk kaynağı
   `lib/ewalu-puan.ts` olmayı sürdürüyor. İki yerde iki "varsayılan"
   oluşup zamanla ayrışmıyor.
2. **0032 çalıştırılmasa bile ekran bugünkü gibi çalışıyor** — uç yoksa
   istemci varsayılana düşüyor (`ucYok` deseni, Part VIII).
3. **"Varsayılana dön" satırı SİLMEK demek.** Ayrı bir bayrak ya da
   varsayılan metni tabloya geri yazmak gerekmiyor: `ewalu_mesaj_yaz`'a
   `p_cumle = null` gitmesi yeterli.

### Neden `ayarlar`'a KONMADI — ölçülerek karar verildi

`disa_aktar` sekiz tabloyu yediliyordu ve **`ayarlar` aralarında yoktu**.
Cümleleri oraya koysaydım öğretmenin kendi yazdığı metinler yedeğe hiç
girmez, bir geri yüklemede **sessizce kaybolurdu**. `ayarlar`'ı yedeğe
eklemek de yanlış olurdu: içinde `ogretmen_pin_hash` var ve
`docs/yedekleme.md` PIN'in yedekte **bulunmamasını** açık bir güvence
olarak yazıyor — yedek dosyası kişisel buluta ve e-postaya gidiyor.

Ayrı tablo ikisini birden çözüyor. Yedek zinciri **üç yerde birden**
güncellendi: `disa_aktar`, `geri-yukle.sql`'in `tablolar` dizisi ve
felaket provası (özel cümle yedeklenip geri yükleniyor, parmak izinde
birebir karşılaştırılıyor).

**Eski yedekler de geri yüklenebiliyor.** `geri-yukle.sql`'in yapı
denetimi dizideki her tablonun dosyada bulunmasını şart koşuyordu; 0032
öncesi bir yedekte `ewalu_mesajlari` anahtarı yok ve kural sıkı
uygulansaydı öğretmenin elindeki mevcut yedek **felaket gününde
reddedilirdi**. Bu yüzden 0032 ve sonrası tablolar "isteğe bağlı": yoksa
boş sayılıyor — ki doğru sonuç zaten bu, özel cümle yoksa varsayılanlar
söylenir. Sekiz çekirdek tablo isteğe bağlı DEĞİL.

### `ogrenci_odevleri`'ne dokunulmadı

Cümleyi o yanıta eklemek 300 satırlık bir gövdeyi birebir kopyalamayı
gerektirirdi ve 0016'da ezberden gövde yazmak iki hataya yol açmıştı;
üstelik `ogrenci_odevleri` öğrencinin en kritik ucu. Ayrı ve küçük bir
okuma ucu (`ewalu_mesajlari`) yazıldı — 0031'de `odev_guncelle`'ye
dokunmama kararının aynısı.

Öğrencinin ekranında bu ucun **hatası bilerek yutuluyor**: bir ayar
ucunun ulaşılamaz olması, çocuğun sonuç kartını bozmamalı.

### Kim ne yapabiliyor

| | okuma | yazma |
|---|---|---|
| Öğretmen | ✓ | ✓ |
| Öğrenci | ✓ (kartındaki cümleyi o görüyor) | ✗ |
| Veli | ✗ | ✗ |

Veli sınırı ölçülmüş bir gerekçeye dayanıyor: bu cümle yalnız öğrencinin
teslim sonucu kartında çıkıyor ve "sen" diye sesleniyor; velinin hiçbir
ekranında yok. En dar yetki.

`guvenlik_denetimi.sql`'in beyaz listesi rol ayrımı yapmadığı için
`ewalu_mesajlari` oraya girdi; velinin reddedildiği daha dar kural
`ewalu_mesaj_testleri.sql` 4. grubunda ayrıca ölçülüyor. **Muafiyet dar
tutuldu:** yazma ucu `ewalu_mesaj_yaz` listede yok, yani öğretmene özel
olduğu orada ölçülmeye devam ediyor.

### Değişmeyenler — ve nedeni

- **Puan aralıkları sabit** (0–49 / 50–69 / 70–84 / 85–99 / 100).
  Aralıkları da açmak, çakışmama ve 0–100'ü boşluksuz kaplama
  denetimlerini sunucuda zorlamayı gerektirir; ayrı bir tur.
- **Poz seçilemiyor:** `kutlama` yalnız 85 ve üstünde. Öğretmenin kendi
  kararıydı; ekran onu gevşetmiyor ve `puanMesaji`'de `ozel` pozu
  etkilemiyor (testte ayrıca ölçülüyor).
- **Sistem cümlesi** ("Ödevin alındı ve puanlandı.") düzenlenemiyor —
  o "ne oldu"yu söyleyen sabit bilgi, Ewalu'nun sözü değil.

### Yasaklı kelime UYARIR, ENGELLEMEZ

Liste `lib/karne-sozu.ts`'teki `YASAKLI_KELIMELER` — ikinci bir liste
yazılmadı (aynı hata `eslint.config.js`'te iki kez yaşandı).
Engellememesi bilinçli: kural öğretmenin kendi kuralı ve kendi ürününün
metnini yazarken onu bloke etmek haddimiz değil. Denetim bunu ayrıca
ölçüyor — uyarı çıkıyor **ve** Kaydet düğmesi etkin kalıyor.

### Denetim izi

Her değişiklik `ewalu_mesaji_degisti`, her geri alma
`ewalu_mesaji_varsayilana_dondu` olarak **eski ve yeni cümleyle birlikte**
yazılıyor. Bu metin her çocuğun okuduğu metin; "ne zaman ne yazıldı,
öncesi neydi" izsiz kalmamalı (Part XLIII ruhu).

## Kod fişleri — kesilip dağıtılmak üzere (yeni SQL yok)

Okullar açılırken ~720 öğrenciye giriş kodu dağıtılacak. Ölçüldü: bugüne
kadar tek yol ya `Kodlar` sekmesinde öğrencileri **tek tek** açmak
(0018'in bilinçli kararı) ya da toplu eklerken indirilen CSV'yi saklamış
olmaktı; depoda yazdırma altyapısı hiç yoktu.

### Öğrenci fişi ve veli fişi AYRI sayfa — ölçülmüş bir zorunluluk

Tek fişe iki kodu basmak iki kuralı birden çiğniyordu:

1. `veli_paneli` özel ders öğrencisinde **ödemeleri** döndürüyor. Veli
   kodunu eline alan öğrenci borç bilgisini görürdü — öğretmenin kalıcı
   kuralı bunu yasaklıyor.
2. **0025'in bütün varlık sebebi** veli↔öğretmen yazışmasını öğrenciden
   ayırmaktı. Veli kodunu alan öğrenci o yazışmayı okurdu.

Bu yüzden iki ayrı sayfa var ve aynı anda yalnız biri **çiziliyor** —
gizlenmiyor, DOM'a hiç girmiyor. `kod-fisi-denetimi.mjs` 3. ve 4. grubu
bunu alan adına değil **gerçek kod değerlerine** bakarak ölçüyor;
denetimin işe yaradığı, aynı değerlerin kendi sayfasında bulunduğu
gösterilerek kanıtlanıyor.

### 0018 geri alınmadı

0017'nin bir sınıfın tüm kodlarını **tek yanıtta** döndüren ucu 0018'de
kaldırılmıştı. Fiş ekranı onu geri getirmiyor: `ogrenci_kodlari` öğrenci
öğrenci çağrılıyor (N istek, her biri yalnız kendi kimliğiyle) ve denetim
`sinif_kodlari`'nın çağrılmadığını ayrıca ölçüyor. **Yeni SQL yok**,
öğretmenin panelde çalıştıracağı bir dosya yok.

**Dürüst sınır:** yazdırma doğası gereği bütün sınıfın kodunu tarayıcıya
indiriyor. Bu gizlenmiyor — onay kapısı ne olacağını söylüyor, kodlar
hiçbir yere kaydedilmiyor (`localStorage`/`sessionStorage` denetimde
ayrıca ölçülüyor) ve onaylanmadan tek bir istek bile gitmiyor.

Kod görüntülemenin **denetim izi bırakmaması** bugün de böyle
(`ogrenci_kodlari` `_denetim` yazmıyor). Bu tur o açığı ne açıyor ne
kapatıyor; güvenlik turuna not.

### Kâğıt ölçüsü

A4'e 2 sütun × 5 satır = **10 fiş**, ölçüler `mm` cinsinden (`px`
yazsaydık yazıcı ölçeğine göre kayar, kesme çizgisi tutmazdı). Kabuk
yazdırmada `display:none` — bu, denetim gerçekten `media: 'print'`
kipinde bakınca "Çıkış" düğmesinin kâğıda çıktığı **ölçüldüğü için**
eklendi.

### Kendi ölçüm hatam

Ekrandan çıkınca kodları temizleyen bir `useEffect` yazmıştım. Geri alma
kanıtı onu bozduğunda **hiçbir ölçüm kırılmadı** — çünkü React zaten
unmount'ta state'i atıyor; o satır hiçbir iş yapmıyordu. Süs kod
kaldırıldı ve ölçüm gerçek bir riske çevrildi: kodların tarayıcı
deposuna yazılması.

## Tanıtım sayfası — editoryal tur (kurum kimliği başa, güven bölümü kalktı)

Öğretmen sayfayı canlıda baştan sona okuyup madde madde düzeltme verdi.
Tur kod değil **metin, sıra ve iki davranış** turuydu; hiçbir özellik ve
hiçbir SQL değişmedi.

### Sıra değişti — ve sıra denetimde kilitli

Sayfanın ilk şeyi artık **okul mührü**. Ondan sonra SEKİZ işareti, marka
cümlesi ve ürünün tanımı geliyor.

Mührün altında önce *Buket Topuzoğlu · Matematik Öğretmeni*, sonra da okul
adı ve konum duruyordu; ikisi de birer tur sonra öğretmenin kararıyla
kalktı ve sebebi aynı: **tekrardı.** Adı hemen aşağıdaki `SekizWordmark`
zaten yazıyor; okul adı da mührün kendi halkasında yazılı ("ARNAVUTKÖY
KORKMAZ YİĞİT ANADOLU LİSESİ · BEŞİKTAŞ"). Okul adı ve konum bu biçimiyle
**giriş ekranına** taşındı — orada mührün altında görünür metin olarak
duruyor.

**Mühür bu yüzden `dekoratif` DEĞİL** ve bu bir ayrıntı değil. O prop
yalnız "okul adı zaten yanında görünür metin" durumu için var; o metin
kalkınca prop yanlış bilgi verir, `alt` boşalır ve **okul adı ekran
okuyucudan sessizce düşer** — halkadaki yazı bir görsel, okunamaz. Sayfada
başka hiçbir yerde yazmadığı için kimse de fark etmez. Denetim iki şeyi
birden ölçüyor: adın mührün `alt` metninde olduğunu ve mührün
`aria-hidden` ile gizlenmediğini. Giriş ekranında durum tersine: orada ad
görünür metin, mühür `dekoratif`.

**"Bir öğretmenin gerçek sınıf deneyiminden doğdu."** künyeden ikinci
bölüme taşındı. Eskiden sayfanın en altındaydı; oraya kadar inen az kişi
ürünün kimin işi olduğunu öğreniyordu.

**Mühür tam bir yerde.** Künyeden kalktı, hero'ya geçti; iki kez durursa
tekrar öğesine dönüşür. Denetim sayıyor (`img[src*="okul-muhru"]` = 1) ve
ilk bölümün içinde olduğunu ayrıca ölçüyor — metnin sayfada bir yerde
geçmesi yetmez, KONUM ölçülüyor.

### "Eğitimde güven, sistemin temelidir." bölümü tamamen kalktı

Üç cümlesi de (barındırma altyapısının adı, Zürih/İsviçre bölgesi, yetkili
erişim notu, çerez notu) öğretmene tanıtım sayfası için gereksiz teknik
ayrıntı geldi.

**Güvence kalkmadı, yalnız cümle kalktı.** Sayfa hâlâ tek çerez yazmıyor ve
sunucuya tek istek atmıyor; `scripts/tanitim-denetimi.mjs` 1. grubu bunu
DAVRANIŞ olarak ölçmeye devam ediyor. Kaldırılan ölçüm yalnız "bu cümle
sayfada duruyor mu" idi. Söylenmeyen ama ölçülen bir güvence, söylenip
ölçülmeyenden güçlüdür.

Karar denetimde kilitli: `Supabase`, `Zürih|İsviçre` ve `Eğitimde güven`
artık yasaklı desen. Bu karar bir tur boyunca ters yönde durmuştu (o turda
cümle bilerek yazdırılmıştı); fikir yine değişirse kaldırılacak yer o üç
satır.

### Veli "destek olan" değil "dahil olan"

Öğretmenin gerekçesi kelime tercihinden ibaret değil: **veli, öğretmenden
pay alan ya da onun yerine geçen taraf gibi görünmemeli.** Yapılan şey
ödevde şeffaflık — veli sürece dahil ediliyor.

Aynı sebeple savunmacı cümleler de kalktı: *"Veri öğretmenin yerini
almaz."* silindi, yerine verinin ne YAPTIĞI yazıldı. Denetim iki yönlü
ölçüyor — `sürece dahil ol` aranıyor, `yerini alma` yasaklanıyor.

### Kelime kararları

| Eski | Yeni | Sebep |
|---|---|---|
| bütünleşik bir eğitim platformu | **bütünsel** | öğretmenin kelime tercihi |
| adlar ve puanlar **uydurmadır** | **temsilidir** | "uydurma" profesyonel durmuyor |
| Sınıfın gelişimini görür | **Sınıfın ve her öğrencinin** gelişimini görür | ürün ikisini de veriyor (`konu_karnesi`, 0023) |

Marka cümlesi **üç yerden ikiye** indi: hero ve kapanış. Felsefe
bölümündeki üçüncü tekrarı kalktı ("en üstte zaten kullandık"), yerine
sonsuzluğa bağlanan pedagojik bir cümle geldi. Sayı ölçülüyor.

### Yazarlık — sayfanın söylemesi gereken şey

Öğretmenin isteği: SEKİZ'i tasarlayanın bir yazılım şirketi değil kendisi
olduğu anlaşılsın, ama göze sokulmadan. Metin bunu söylüyor ve **"vizyoner"
kelimesi bilerek yazılmıyor** — vizyon kendini ilan ederek değil, son
paragraftaki bakışla anlaşılır. Cümle silinirse denetim kırılır.

### İki davranış değişikliği

**"SEKİZ nedir?" bağlantısı yukarı çıktı.** Giriş ekranında videonun da
altındaydı; öğretmenin ölçümü net: "çok küçük kalıyor, insanlar bunu
görmez". Artık "Giriş yap" düğmesinin hemen altında. Yine de düğme gibi
durmuyor — her gün giriş yapan öğrenci için bu bir yol ayrımı değil,
dipnot. Denetim **düğmeye uzaklığını** ölçüyor (≤ 120 px); bağlantı bir gün
tekrar aşağı kayarsa kırılır.

**8 → ∞ dönüşü yavaşladı ve doğru anda oynuyor.** Süre `700ms` → `1500ms`;
eğri `--ease-sk` (bir ease-OUT, başta hızlı) yerine yeni
`--ease-sk-yumusak`. Ama asıl kusur hız değildi: kapanıştaki işaret
`acilistaDonsun` ile sayfa YÜKLENİRKEN dönüyordu, yani okuyucu oraya
kaydırdığında hareket çoktan bitmiş oluyordu. Yeni `gorununceDonsun` propu
(`IntersectionObserver`, tek seferlik, eşik 0.6) işareti ekrana girdiğinde
oynatıyor. Gözlemci yoksa doğrudan dönüyor — işaret hiçbir koşulda 8
olarak donup kalmıyor (Part VIII). Hareket azaltma tercihi açıkken davranış
aynı: dönüş yok, doğrudan ∞.

### Ekran görüntüleri artık kendi doğruluğunu ölçüyor

`ogrenci-sonuc.webp` ESKİ Ewalu cümlesini gösteriyordu: görseller
`lib/ewalu-puan.ts` düzeltilmeden önce çekilmişti ve görsel donmuş bir
kopya olduğu için kodla birlikte güncellenmiyordu. Kimse fark etmedi.

`scripts/tanitim-gorselleri.mjs` içine `BEKLENEN_METIN` tablosu eklendi:
çekilen ekranda beklenen cümle parçası yoksa betik **çöküyor**. Yani
görseli yenilemeyi unutmak artık sessiz bir hata değil.

## Tanıtım sayfası — profesyonelleştirme turu (12 → 14 bölüm)

Öğretmen ayrıntılı bir marka ve içerik brief'i verdi. Turun tek cümlelik
kuralı onun kendi ifadesi: **"Redesign değil, refinement."** Arka plan,
renkler, tipografi, sekizgen doku, 8 → ∞ hareketi ve `Bolum` /
`EkranliBolum` / `Maddeler` düzeni değişmedi; değişen içerik, hiyerarşi
ve belirli cümleler. **Ürünün hiçbir ekranına dokunulmadı**, yeni SQL yok.

### İki yeni bölüm

**"SEKİZ neden var?"** (1. bölüm) problemi anlatıyor, çözümü değil:
ödev, teslim, sonuç ve gelişim ayrı kanallara dağıldığında öğrenme süreci
görünmez oluyor. Ziyaretçi çözümü okumadan önce soruyu okuyor.

**"SEKİZ'in arkasındaki yaklaşım"** (14. bölüm) tam künye: ad, unvan ve
rolün kapsamı. İki koyu bandın (Gelecek ve kapanış) arasında açık zemin
olarak duruyor; konumu ritim kararı.

Hero'ya adın kendisi ikinci kez girmedi. Brief hero'da tam künyeyi
istiyordu ama `SekizWordmark` adı zaten yazıyor ve öğretmen bir önceki
turda mührün altındaki ikinci ad satırını bilerek kaldırmıştı. Hero'ya
yalnız **yeni bilgi** girdi: *"Fikir, pedagojik tasarım ve yazılım
geliştirme"*.

### 8 rakamı — "8 şeklinden" değil

Öğretmenin açık talimatı: bağ bir çizim benzerliğinden değil **sayının**
matematikteki çağrışımından kurulacak. Denetim iki yönlü çalışıyor: bağın
kurulduğu (`8 rakam`) ölçülüyor ve `8 şeklinden` yasaklı desen.

**Bir önceki turun onaylanmış vurgu cümlesi geri çekildi.** *"Sonsuzluk
bir varış değil, bir yöndür…"* benim taslağımdı ve öğretmen onaylamıştı;
bu turda kullanılmamasını istedi. Yerine *"Çözülen her problem, sorulacak
yeni bir soruyu mümkün kılar."* geldi. Geri çekilen cümle **yasaklı desen
olarak** yazıldı — onaylanmış bir cümlenin geri çekilmesi tam olarak
sessizce geri gelebilecek türden bir karar.

### "Eksik" — kapsam kararı, dil değişikliği değil

Brief veli bölümünde "çocuğunuzun eksikleri" çağrışımını yasaklıyor; ama
kalıcı dil kuralı ("Yanlış kelimesini her durumda daha yumuşak bir
ifadeyle değiştirmeye çalışma") hâlâ yürürlükte. Öğretmenin kararı
çelişkiyi kapsam ayrımıyla çözdü: **"Yalnız veli bölümünde kalksın."**

Yani veliye seslenen cümlede yumuşak dil, öğrenciyi anlatan cümlede ve
ürünün kendi ekranlarında gerçek olduğu gibi. Koyu banttaki *"Yanlış
yaptığı soruları ve eksik olduğu konu alanlarını da görünür hâle
getirir."* aynen duruyor.

Denetim bunu **iki yönlü** kilitliyor ve tek yön yetmezdi:

| Ölçüm | Ne yakalıyor |
|---|---|
| Veli bölümünün KENDİ metninde `eksik` **yok** | kelimenin oraya geri gelmesi |
| Sayfada `eksik olduğu konu alanları` **var** | kelimenin her yerden silinmesi |

Yalnız birincisi ölçülseydi biri bir gün kelimeyi sayfanın tamamından
siler ve denetim geçerdi. Geri alma kanıtında ikisi **ayrı ayrı** bozulup
kırıldıkları gösterildi.

### Tamamlanmamış ödev — ölçüm taşındı, gevşetilmedi

Brief iki cümleyi düzeltti: *"teslim edilmeyi bekleyenler"* →
*"tamamlaması gereken"*, ve *"hangi ödevin henüz teslim edilmediğini"* →
*"hangi ödevlerin henüz tamamlanmadığını"*. Eski desen artık sayfada
olmayan bir cümleyi arıyordu; iddia aynı kaldı ve **iki ayrı ölçüme**
bölündü ki biri silinince öbürü örtmesin.

### Meta etiketler sayfayla çelişiyordu

Ölçülen bir çelişkiydi: `tanitim/index.html` SEKİZ'i *"matematik ödevleri
için kurulmuş bir uygulama"* diye tanıtıyordu, oysa brief bu
konumlandırmayı açıkça reddediyor. `description`, `og:description` ve
`noscript` bloğu sayfanın diline çekildi; `title`, favicon, `viewport` ve
`og:url` değişmedi. Denetim artık meta etiketleri de okuyor.

### Türkçe büyük harf tuzağı — denetimde yakalandı

Künye unvanı CSS `text-transform: uppercase` ile çiziliyor ve `innerText`
dönüşmüş hâli döndürüyor: "MATEMATİK ÖĞRETMENİ". JavaScript'in `/…/i`
bayrağı **basit kıvrım** kullanıyor ve U+0130 (İ) için `i` karşılığı yok —
yani `/matematik öğretmeni/i` bu metinle **eşleşmiyor** ve ölçüm sessizce
"cümle sayfada yok" diyor.

0024'te `toLowerCase()`'in "ALİ"yi birleşen noktalı `ali̇` yapması aynı
aileden bir tuzaktı. Denetime `kucult()` yardımcısı eklendi
(`toLocaleLowerCase('tr')`); büyük/küçük harfe duyarsız arama artık ondan
geçiyor. Veli bölümünün `eksik` kilidi de aynı yoldan geçiyor — bir
YOKLUK ölçtüğü için tuzak orada en tehlikeli hâlinde: yanlış eşleşme
sessizce "temiz" derdi.

### Geri alma kanıtı

`scripts/geri-alma-tanitim.mjs` (`npm run tanitim-geri-alma`) — 15 yama,
15'i de yakalandı. Betik **derleme kırılırsa duruyor** ve bu turda o
koruma gerçekten iş gördü: iki yama bir bileşenin JSX çağrısını silince
TS6133 ("kullanılmayan bileşen") derlemeyi kırdı ve ölçüm yapılamadı.
Koruma olmasaydı denetim sessizce ESKİ paketi ölçer, iki yama da
"yakalandı" görünürdü — 0030'da tam olarak bu yaşanmıştı. Yamalar
`{false && <Bolum />}` biçimine çevrildi: bölüm DOM'dan gerçekten kalkıyor,
bileşene yapılan başvuru duruyor.

## Tanıtım sayfası — öğretmenin yeni brief'i (metin turu)

Hero, felsefe, üç rol ve gelecek bölümlerinin metinleri birebir yazılmış
bir brief geldi. Ürünün hiçbir ekranı, hiçbir SQL ve hiçbir tasarım
tokenı değişmedi.

### Brief'i sayfaya karşı ölçtüm — beş çakışma, dördü öğretmenin kararı

| Çakışma | Kararı |
|---|---|
| Brief'in hero başlığı ile kilitli marka cümlesi | **İkisi de değil** — kendi cümlesini yazdı: *"Sonsuz bir öğrenme döngüsü için tasarlandı."*, H1 olsun |
| Brief dört bölüm, sayfa 14 bölüm | **Mevcut bölümler kalsın** |
| *"sonsuz bir yolculuğa"* ve *"8'in kesintisiz akışı"* kendi yasaklarına takılıyor | **Cümleler aynen girsin** |
| Üç rol "interactive tabs" ile isteniyor | **Mevcut madde yapısı kalsın** |

**Üçüncü kararın ölçülen sonucu.** Yasakların *desenlerini* tek tek
kontrol ettim — `öğrenme bir yolculuk`, `sınırsız yolculuk`,
`8 şeklinden|şeklinden alır`, `yan yat`, `sonsuzluk işareti`. Brief'in
iki cümlesi hiçbiriyle eşleşmiyor. **Tek bir yasak bile
gevşetilmedi**; çakışan şey kuralın ruhu, harfi değil. Denetimin
yasaklı-desen bloğu geçtiği sürece bu kanıt da duruyor.

### Marka cümlesi ikiden bire indi

H1 artık marka cümlesi olmadığı için *"Öğrenmenin sonu yok."* yalnız
kapanışta. Denetimdeki sayı kilidi `2` → **`1`**.

Bu bir gevşetme değil: sayı yine **tam** ölçülüyor, yani cümle ne
düşebilir ne çoğalabilir. Geri alma kanıtı ikisini de ayrı ayrı
gösteriyor — H1'i eski cümleye döndürünce bir ölçüm, cümleyi ikinci bir
bölüme serpiştirince başka bir ölçüm kırılıyor. Bir tur önce tersi
seçilmişti; değiştirilecek yer hero'daki `h1` ve o sayı.

### Maddeler ekleniyor, güvenceler silinmiyor

Brief'in rol maddeleri **fayda** anlatıyor; bugünkü maddeler ürünün
**ölçülen sınırlarını**. İkisi birbirinin yerini tutmuyor, bu yüzden
her rol listesi = brief'in üç maddesi + korunan güvence maddeleri:

| Korunan | Neden |
|---|---|
| "Teslimden önce açılmaz; teslimden hemen sonra açılır." | Kural 6 / Part XXI |
| "…fotoğraf yüklenmeden teslim tamamlanmaz." | ölçülen ürün davranışı |
| "…**tamamlaması gereken**…" | kalıcı dil kuralı |
| "…**henüz tamamlanmadığını** görür." | kalıcı dil kuralı |

Dördü de geri alma kanıtında **ayrı ayrı** bozulup kırıldı.

`Maddeler` bileşeni `[giriş, metin]` ikilisini de kabul ediyor; giriş
`font-semibold` çiziliyor. Yeni renk, ikon ya da kutu yok.

### Brief'in üç UX talimatı uygulanmadı — gerekçeleriyle

**Yazı tipi değişmedi.** Brief "Inter / Plus Jakarta Sans" öneriyor;
Fraunces + Manrope Faz 0'dan beri markanın kendisi ve KVKK gerekçesiyle
CDN'den değil kendi sunucumuzdan servis ediliyorlar. Brief'in kendi
üçüncü maddesi de "maintain existing background/brand aesthetics" diyor
— talimat kendi içinde çelişiyordu, marka tarafı korundu.

**`border-indigo-500` kullanılmadı.** Indigo palette'te yok; renkler okul
mührünün laciverdinden ve Ewalu'nun paletinden türetildi ve 18 token
çifti WCAG AA'dan **bir küme olarak** geçti. Dışarıdan bir renk eklemek
o denetimi anlamsız kılardı.

**Sekme kurulmadı** (öğretmenin kararı): sekme aynı anda iki rolü gizler,
altı ekran görüntüsünün üçe bölünmüş dağılımını bozar ve sayfayı arama
motoruna tek rol olarak gösterirdi.

### Türkçe düzeltmeler — brief'in kendi kuralı

Brief "sıfır Türkçe yazım hatası" istiyordu ama kendi metninde iki hata
taşıyordu: **"Motive"** (isim gerekiyor → *Motivasyon*) ve **"imkanı"**
(şapkasız → *imkânı*). Ayrıca başlıklar İngilizce Title Case yazılmıştı;
Türkçe'de bu bir çeviri izi ve sayfanın bütün başlıkları cümle
düzeninde. Üçü de düzeltildi ve **düzeltmeler ölçülüyor** — bir sonraki
kopyala-yapıştırda geri gelmesinler diye.

### Bu turda kırılan dört ölçüm — ve hepsi benim yeniden yazımım

Denetim ilk koşuda dört kusur verdi ve dördü de gerçekti: cevap anahtarı
güvencesi kalın girişli maddeye taşınınca deseni tutmadı, veli bölümünün
seçicisi eski `h2`'yi arıyordu, yazarlık cümlesi brief'in cümlesiyle
değişmişti. Dördü de **taşındı, gevşetilmedi**; yazarlık ölçümü ikiye
bölündü (kimin tasarladığı + bir yazılım şirketinin ürünü olmadığı).

### Öğretmenin madde madde düzeltmesi (aynı turun ikinci yarısı)

Sayfa yayımlanmadan önce öğretmen metni okuyup madde madde düzeltti.
Üçü **kendi önceki kararını geri alıyor** ve bu yüzden kayda geçiyor.

**Hero sadeleşti.** "Fikir, pedagojik tasarım ve yazılım geliştirme"
satırı ve brief'in alt başlığı ("…şeffaf, yönetilebilir ve anlamlı
verilerle görünür kılmak için tasarlandı.") kalktı; yerine tek tanım
cümlesi geldi:

> SEKİZ; öğrencinin öğrenme sürecini takip ettiği, öğretmenin gelişimi
> gördüğü ve velinin sürece dahil olduğu dijital eğitim platformudur.

Bu, H1'in de "…için tasarlandı." ile bitmesinden doğan tekrarı çözüyor —
bir tur önce dürüst not olarak yazmıştım, öğretmen cümleyi tamamen
kaldırarak çözdü.

Künye satırı **silinmedi, tek yerde toplandı**: aynı cümle sayfanın
sonundaki künye bölümünde duruyor. Denetim **iki yönlü** kilitliyor —
hero'da OLMADIĞI ve künyede DURDUĞU ayrı ayrı ölçülüyor.

**⚠ "eksik" veli bölümüne geri geldi.** İki tur önce açıkça sormuştum ve
cevabı *"yalnız veli bölümünde kalksın"* olmuştu; cümle çıkarılmış ve
"veli bölümünün kendi metninde `eksik` YOK" diye kilitlenmişti. Bu turda
öğretmen cümleyi kelimesi kelimesine geri yazdırdı:

> Öğrencinin eksik olduğu veya daha fazla çalışabileceği konu alanları
> veli tarafından da görülebilir.

Son talimat geçerli; **kilidin o yarısı tersine çevrildi** (artık
cümlenin DURDUĞU ölçülüyor). Asıl kural gevşemedi: `çocuğunuzun eksik…`
hâlâ yasaklı desen, yani veliye "sizin çocuğunuzun eksikleri" diye
seslenmek hâlâ imkânsız. Kalıcı dil kuralıyla da uyumlu — cümle gerçeği
söylüyor ve öğrenciyi etiketlemiyor.

**İki "tamamlanmamış" başlığı kalktı, gerçek kalktı sanılmasın.**
Öğretmen olumsuzu ayrı bir BAŞLIK olarak öne çıkarmak istemedi. Bilgi
zaten iki maddenin gövdesinde duruyor ve denetim **ikisini de ayrı ayrı**
ölçmeye devam ediyor:

| Nerede | Cümle |
|---|---|
| Öğretmen | "yalnızca **ödevin yapılıp yapılmadığını** değil…" |
| Veli | "öğrencinin **yaptığı ve yapmadığı** ödevleri…" |

Kalkan şey başlık, gerçek değil — kalıcı dil kuralı ("teslim edilmemiş
ödev gizlenmez") yerinde.

**Başlık olarak "yanlış" yasak, gövdede serbest.** Öğretmenin talimatı:
"yanlışlar ve konular" gibi bir madde başlığı olmasın. Kelime gövdede
duruyor ("doğru ve yanlış yaptığı sorular") ve o ayrıca ölçülüyor.
Denetim artık **bütün madde başlıklarını** tarayıp hiçbirinin "yanlış"
içermediğini kontrol ediyor — tek bir desen değil, kural.

Diğer düzeltmeler: öğretmen başlığı iki ölçeği birden söylüyor ("sınıfın
genel ritmini, öğrencinin bireysel gelişimini"); veli başlığı eski hâline
döndü; "Pozitif İletişim" maddesi kalktı (iletişim okulla değil
öğretmenle kuruluyor — `mesaj_gonder` yalnız veli↔öğretmen kanalı, 0025);
"karmaşık grafikler yerine" çıktı (olumsuz örnekle anlatma); "Gördükleri"
başlığı üç somut başlığa bölündü.

## Tanıtım sayfası — öğretmenin beş düzeltmesi (14 → 13 bölüm)

Öğretmen birleştirilen sayfayı canlıda okudu ve beş düzeltme verdi.
Dördü kesindi; belirsiz olanı ("bir öğretmenin sınıf deneyiminden doğdu —
yazısı tamamen çok kötü olmuş") sordum, kararı **bölüm kalsın, metni
yeniden yaz** oldu.

| Düzeltme | Sonucu |
|---|---|
| "SEKİZ neden var?" bölümü | **tamamen kalktı** — sayfa Hero'dan sonra doğrudan hikâyeyle açılıyor |
| Hikâye gövdesi | tek uzun paragraf → iki kısa paragraf |
| Felsefe başlığı | "İsmini matematiğin…" → **"SEKİZ ismini matematiğin…"** (cümlenin öznesi yoktu) |
| Felsefe gövdesi | **tamamen kalktı**; bölüm artık başlık → ayraç → vurgu cümlesi |
| Gelecek gövdesi | yeniden yazıldı (aşağıda) |
| Künyedeki "SEKİZ bu ölçüyle tasarlandı…" | **kalktı** |

### Kalkan iki şey ölçüme yasak olarak geri döndü

Bu turun deseni: kaldırılan bir cümlenin ölçümü **silinmiyor, yönü
çevriliyor**. "SEKİZ neden var?" başlığının sayfada **olmadığı** ve
künyenin ölçü cümlesinin geçmediği artık ölçülüyor. Böylece ikisi de
sessizce geri gelemez ve geri alma kanıtı bunu tek tek gösteriyor.

### Gelecek bölümü — şikâyet ölçülebilir hâle getirildi

Öğretmenin üç düzeltmesi vardı: "geliş-" kökü çok sık ve yan yana
kullanılmıştı (tek paragrafta üç kez), "SEKİZ tamamlanıp dondurulmuş…"
cümlesi en başta olmasındı, ve ilk cümle geliştirmenin süreceğini
söylemeliydi.

Metin düzeltmesi ölçülmezse ilk aceleci düzenlemede geri gelir. Bu
yüzden ikisi de kilitlendi: **ilk paragraf** "SEKİZ yenilenmeye devam
edecek." ile başlıyor **ve** "dondurulmuş" içermiyor (iki yönlü), ve
**gövdede "geliş-" kökü hiç geçmiyor**. Kelime yalnız başlıkta ve
öğretmenin kendi kapanış cümlesinde kalıyor — ölçüm o ikisini bilerek
dışarıda bırakıyor, aksi hâlde kilit hiçbir zaman tutmazdı.

### Bir kilit zayıfladı — ve gizlenmiyor

`8 → sonsuzluk bağı 8 RAKAMI üzerinden kuruluyor` ölçümü **kaldırıldı**.
Sebebi taşınacak yer olmaması: "8 rakamından alır" cümlesi öğretmenin
kaldırttığı felsefe gövdesindeydi ve sayfada başka hiçbir yerde
geçmiyor. Vurgu cümlesindeki "8'in kesintisiz akışı" zaten ayrı bir
ölçümle kilitli; aynı dizeyi ikinci bir ad altında ölçmek sayıyı
şişirir, güvenceyi artırmaz.

**Kaybolan:** "bağ sayı üzerinden anlatılıyor" iddiasının ölçülmesi.
**Duran:** `8 şeklinden|şeklinden alır`, `yan yat`,
`sonsuzluk işareti|sembolü` yasakları — şekil üzerinden bir bağ sessizce
geri gelemez, ve geri alma kanıtı başlığı "8 şeklinden alır" hâline
çevirip bunu gösteriyor.

Aynı sebeple ikinci bir ölçüm de kaldırıldı: hikâye bölümündeki
"tahta başındaki gerçek sınıf dinamiğiyle", yeniden yazımdan sonra
"SEKİZ bir yazılım şirketinin ürünü değil" ölçümüyle **aynı iddiayı**
ölçüyordu.

## Tanıtım sayfası — sadeleştirme (13 → 8 bölüm)

Öğretmenin isteği, kendi ifadesiyle: *"tek bir başlıkta daha sade, kafa
karışıklığı olmadan."*

| Değişiklik | Sonucu |
|---|---|
| "Bir öğretmenin sınıf deneyiminden doğdu." + "SEKİZ gelişmeye devam ediyor." | **tek bölüm**: "Öğretmen Deneyimiyle Şekillenen, Sürekli Gelişen Platform" — metnin üç paragrafını öğretmen yazdı ve birebir verdi |
| Slogan "8'in kesintisiz akışı…" | felsefe bölümünden **bu bölümün altına taşındı** |
| "SEKİZ ismini matematiğin sonsuzluk düşüncesinden alır." | bölüm olmaktan çıkıp **hero'da slogan** oldu |
| "Sonuç, öğrenmenin bir sonraki adımını gösterir." | **kalktı** |
| "Değerlendirme, öğrenmeyi görünür kılar." | **kalktı** |
| "Puanın ötesinde, gelişim." | **kalktı** — tek cümlesi taşındı |

Kıyaslama cümlesi ("Öğrenciye ve veliye başka öğrencilerin puanları veya
sıralamaları gösterilmez…") "Ödevden gelişime…" bölümüne taşındı; yeri
öğretmenin seçimi — üç rolü birden anlatan bölüm, cümle de hem
öğrenciden hem veliden söz ediyor.

### Başlık yazımı bir istisna ve bilinçli

Yeni başlık Title Case ve noktasız; sayfanın diğer yedi başlığı cümle
düzeninde ve noktalı. Farkı sordum, **"yazdığınız gibi kalsın"** dedi.
Denetim o yüzden birebir dizeyi arıyor.

### Koyu bant kalmadı — ve bu bir karar

Sayfada iki koyu bant vardı: biri silinen "Sonuç, öğrenmenin bir sonraki
adımını gösterir." bölümü, öbürü birleşen "SEKİZ gelişmeye devam
ediyor." bölümü. Birleşik bölümü koyu yapmayı düşündüm ama metin 180
kelime; 360 px'de ters kontrastlı 180 kelime okuma yükü ve hero'nun
hemen ardında iki tam genişlik bloğu üst üste gelirdi. İstenen şey
"sade". **Sonuç: sayfada artık orta yerde koyu bant yok**, yalnız
kapanış koyu. Tek satırlık bir değişiklik.

### ⚠ ÜÇ KİLİT KALKTI — üçü de öğretmenin açık kararıyla

Bu sayfada bugüne kadarki en ağır kaldırma ve gizlenmiyor.

**1–2. "Yanlış yaptığı soruları…" ve "eksik olduğu konu alanları".**
Silinen koyu banttaki cümle şuydu:

> SEKİZ öğrencinin yalnızca puanını göstermez. **Yanlış yaptığı
> soruları** ve **eksik olduğu konu alanlarını** da görünür hâle getirir.

Sordum ve sonucu birebir gösterdim: "yanlış yaptığı soruları" ifadesinin
sayfada **başka hiçbir yerde geçmediğini** ölçtüm, ve kendi kalıcı
kuralını hatırlattım — *"Yanlış kelimesini her durumda daha yumuşak bir
ifadeyle değiştirmeye çalışma."* Kararı: **"Kalksın."**

**Kural ürünün içinde aynen duruyor.** Bu tur hiçbir ürün ekranına
dokunulmadı: veli ekranı hâlâ "Teslim edilmedi" diyor, öğrencinin sonuç
kartı hâlâ yanlış sayısını gösteriyor. Kalkan şey yalnız tanıtım
sayfasındaki cümle.

İkincisi için ayrıca: **"eksik olduğu konu alanları" gerçeği sayfadan
kalkmadı.** Veli bölümü hâlâ "Öğrencinin eksik olduğu veya daha fazla
çalışabileceği konu alanları veli tarafından da görülebilir." diyor ve
bu **kendi ölçümüyle kilitli**. Eski deseni o cümleye uyarlamak, aynı
dizeyi ikinci bir ad altında ölçmek olurdu.

**3. "Test türündeki ödevler, önceden belirlenmiş kurallar…"**
Sordum, "Kalksın" dedi. **Kural 5 güvencesi kalkmadı — ölçüldü:**
Öğretmen bölümü zaten "Açık uçlu ödevlerde öğrencinin çözümü öğretmen
tarafından kontrol edilir ve **nihai puan öğretmen tarafından verilir**"
diyor ve denetim onu ayrıca ölçüyor. Kalkan tek şey, testin **sabit
kurallarla** puanlandığının yazılı olması.

### Kalkan başlıklar yasak oldu

Bu sayfanın kurulu deseni: bir bölüm kaldırıldığında ölçümü **silinmiyor,
yönü çevriliyor**. Altı başlığın da sayfada olmadığı ölçülüyor, geri alma
kanıtı dördünü tek tek geri koyup denetimin kırıldığını gösteriyor.

Slogan da artık **sayıyla** kilitli (tam bir yerde) — taşınırken ikinci
bir kopya bırakmak tam da sessizce olabilecek türden bir hataydı. İsim
sloganı iki yönlü: hero'da **var** ve bölüm başlığı **değil**.

## Kök adres — `/yeni/`'ye yönlendirme

**Olay.** Öğretmen 15 Eylül'de ~720 öğrenciye adres verecekti ve özel bir
alan adı (`sekiz.com` gibi) alıp alamayacağını sordu. İkisini ölçerken
gerçek bir arıza çıktı:

| Ölçüm | Sonuç |
|---|---|
| `buketmathlab.github.io/` | `200` — açılıyor, **eski uygulama** (713 satır) |
| Eski uygulamanın veritabanı `udrzjlvjkolzqtjtpkgi` | **`http=000`, DNS çözülmüyor** — Ağustos'ta silinen proje |
| `buketmathlab.github.io/yeni/` | `200`, veritabanı `oymueccauhprkgdrbqtv` → canlı |

Yani sondaki `/yeni/` kısmını yazmayı unutan herkes **çalışıyor görünen
ama hiç kimsenin giremediği** bir giriş ekranına düşüyordu. Kodunu yazıp
"olmuyor" diyecek olan 720 öğrenciydi.

Özel alan adı için de ön koşuldu: alan adı deponun **köküne** bağlanır,
yani `sekizokulu.com` alınsa bugünkü hâliyle yine ölü uygulamaya düşerdi.

### En sert kural bu turda kalktı

**"Kök `index.html` hiç değişmeyecek (md5 `6571fd91…`)"** Faz 0'dan beri
yürürlükteydi ve her turda elle doğrulanıyordu. Öğretmene üç seçenek
sundum (yönlendir / olduğu gibi bırak / yönlendir ama eskiyi `/eski/`'de
tut); kararı **yönlendirme, eski uygulama kalksın** oldu.

Eski uygulama silinmedi, git geçmişinde duruyor:
`git show c2e11dd:index.html`. Ama açık olalım — veritabanı silindiği
için geri getirilse de çalışmaz.

### Üç katman, çünkü biri yetmez

1. `<meta http-equiv="refresh">` — **JavaScript kapalıyken** çalışan tek katman
2. `location.replace('/yeni/')` — hızlı; `href` DEĞİL, çünkü `href`
   geçmişe kayıt bırakır ve geri tuşu kullanıcıyı buraya döndürüp yeniden
   yönlendirir, yani geri tuşu çalışmaz hâle gelir
3. Görünür bağlantı — ikisi de engellenirse (bazı kurumsal tarayıcılar
   meta yenilemeyi engelliyor) elle tıklanır

**Dışarıya sıfır istek — ölçülen bir iyileştirme.** Eski kök sayfa Google
Fonts, jsDelivr ve cdnjs yüklüyordu; oraya düşen herkesin IP'si üç ayrı
üçüncü tarafa gidiyordu. Yeni sayfa hiçbir dış kaynak yüklemiyor.

### Elle kontrol yerine otomatik denetim

**Ölçülen boşluk:** kök dosyanın md5'i depoda **hiçbir betikte**
kontrol edilmiyordu — yalnız `docs/mevcut-sistem-envanteri.md`'de bir
cümle olarak yazılıydı ve kontrolü her tur ben elle yapıyordum.
Alışkanlık kırıldığı gün kimse fark etmezdi.

`app/scripts/kok-denetimi.mjs` (`npm run kok-denetim`) 13 ölçüm yapıyor;
en önemlileri: dosya 4 KB'nin altında kalıyor (yeniden bir uygulamaya
dönüşemez), hedef iki katmanda da `/yeni/`, üçüncü taraf kaynak yok,
tarayıcıda gerçekten düşüyor ve **JavaScript kapalıyken de düşüyor**.

Sonuncusu tek başına önemli: `location.replace` çalışmazsa geriye yalnız
meta yenileme kalıyor. Ölçülmezse, biri bir gün o satırı silince
JavaScript'i kapalı kullanıcı **sessizce** kaybolur — geri alma kanıtı
(`npm run kok-geri-alma`, 7/7) tam olarak bunu gösteriyor.

### Özel alan adı — teknik engel kalmadı

Ölçülen durum: `sekiz.com`, `sekiz.net`, `sekiz.org`, `sekiz.app` ve
`sekizapp.com` **alınmış**; `sekizokulu.com`, `sekizplatform.com`,
`sekizogrenme.com` ve `buketmathlab.com` boşta görünüyor.

Alan adı satın alındığında yapılacaklar tek tur: `CNAME` dosyası + dört
DNS kaydı + GitHub sertifikasının beklenmesi. `CNAME` şimdiden
konmuyor — elde gerçek bir alan adı yokken anlamsız.

## Projeyi uyanık tutan zamanlayıcı (yeni SQL yok)

**Olay.** 2026 Ağustos'unda Supabase, ücretsiz plandaki projeyi 7 günlük
hareketsizlik sonrası **duraklattı**. Yaz tatiliydi, kimse girmedi. Site
açık görünüyordu (GitHub Pages 200 dönüyor) ama her veri çağrısı ölü
adrese gidiyordu: ne öğretmen, ne öğrenci, ne veli giriş yapabiliyordu.

Okul 15 Eylül'de açılıyor. O sabah sistemin kapalı olması kabul edilemez.

### Ölçüm — "birileri siteye bakar" neden yetmiyor

| Ne yapılıyor | Supabase'e istek |
|---|---|
| Tanıtım sayfasını açmak | **yok** — sayfa istemciyi hiç içe aktarmıyor |
| `/yeni/` açıp giriş ekranını görmek | **yok** — açılışta çağrılan uç yok |
| Sürüm denetimi (`surum.json`) | **yok** — GitHub Pages'e gidiyor |
| Kod yazıp "Giriş yap"a basmak | **var** (`giris`) |

Yani sayfayı açmak sayacı sıfırlamıyor; gerçek bir veritabanı çağrısı
gerekiyor.

### Yoklamanın neden zararsız olduğu — üçü de kaynaktan ölçüldü

`.github/workflows/uyanik-tut.yml`, üç günde bir `bildirim_sayilari`
ucunu **64 karakterlik geçersiz bir jetonla** çağırıyor.

1. **Yazma yok.** `_oturum`, geçersiz jetonda `oturumlar`'a tek SELECT
   atıp `28000` fırlatıyor; `update … son_gorulme` satırına hiç
   ulaşılmıyor (`0003_guvenlik_fonksiyonlari.sql`).
2. **Kilit sayacı kirlenmiyor.** `_deneme_kaydet` yalnız `giris` içinden
   çağrılıyor (0003 ve 0028). Öğretmen kendi kilidine takılmıyor.
3. **Sahte öğrenci yok.** Öğrenci eklemek `ogrenciler`, `giris_kodlari`
   ve `denetim_izi`'ne gerçek satırlar yazardı ve 720 gerçek öğrencinin
   arasında unutulmuş test kayıtları bırakırdı.

Jetonun 32 karakterden **uzun** olması bilinçli: `_oturum` kısa jetonu
veritabanına hiç gitmeden reddediyor. Uzun jeton gerçek bir sorgu
attırıyor — istenen tam olarak bu.

### Aynı dosya bir nöbetçi

Başarı ölçütü **gövdedeki `28000`**; bağlantısızlık, `5xx`, zaman aşımı
ve `PGRST202` (uç yok) başarısızlık. Yani proje yine duraklarsa ya da bir
uç kaybolursa GitHub e-posta atıyor — sorun 15 Eylül sabahı öğrencilerden
değil, üç gün içinde öğreniliyor.

**ÖLÇÜT ÖNCE YANLIŞ YAZILDI.** İlk hâli "HTTP 400 + 28000" idi. Proje
uyandıktan sonra canlıya karşı ölçüldü: Supabase `28xxx` sqlstate'ini
HTTP **403**'e eşliyor. Yani sağlıklı bir projede iş akışı her koşuda
"başarısız" diyecek, üç günde bir yanlış alarm üretecek ve öğretmeni
alarma güvenmemeye alıştıracaktı — sessiz kalan nöbetçi kadar zararlı.

Doğru sinyal HTTP kodu değil, veritabanının fonksiyonu gerçekten
çalıştırıp jetonu reddettiğinin kanıtı olan `28000`. Ölçüt buna
taşındı; Supabase eşlemeyi yarın yine değiştirse de ayakta kalır.

Karar mantığının beş yönü simüle edilerek ölçüldü (403+28000, 400+28000,
000, 521, PGRST202); ayrıca duraklamış projede nöbetçinin **öttüğü**,
uyanmış projede **sustuğu** gerçek koşuyla görüldü.

### Dürüst sınırlar

- Bu, ücretsiz planın duraklatma mekanizmasını **dolanıyor**. Supabase
  "hareket" tanımını değiştirirse çalışmayabilir; garanti yok. Pro planı
  tam olarak bu ihtiyacın karşılığı ve üstüne günlük otomatik yedek
  veriyor.
- **Duraklamış projeyi uyandırmaz.** Önce panelden uyandırılması gerekir.
- **Yedek yerine geçmez.** Uyanık kalmak, veri kaybına karşı koruma
  değil — bu depo bir veritabanını zaten bir kez kaybetti.
- GitHub, 60 gün hareketsiz depolarda zamanlanmış işleri durdurur.

## Çok öğretmenli SEKİZ — sahiplik, kapsam ve vekâlet (0033)

Zümre başkanları toplantısından sonra matematik zümresindeki üç arkadaşı
SEKİZ'i kullanmak istedi. Model "eşit öğretmenler" değil: **bir SAHİP ve
onun altında çalışan öğretmenler.** Ürünün sahibi bunu kendi cümleleriyle
tarif etti — fikir de tasarım da kendisine ait, kontrol her zaman onda
kalmalı.

### Veri neyin altında

| Okul düzeyinde (ortak) | Öğretmen düzeyinde (kapsamlı) |
|---|---|
| `siniflar`, `ogrenciler`, `giris_kodlari` | `odevler`, `mesajlar`, `dersler`, `odemeler` |

Bu ayrım bilinçli. **Öğrenci tek koda sahip**: bir çocuk dört öğretmenin
ödevini tek girişle görüyor, dört ayrı şifre taşımıyor. Sınıf ve öğrenci
ortak olduğu için, ileride diğer zümreler açıldığında canlı öğrenci
verisi yeniden taşınmayacak — genişleme bir `ogretmen_siniflari` satırı.

Kapsam mantığı **tek yerde**: `_ogretmenin_ogrencisi`,
`_ogretmenin_sinifi`, `_odev_sahibi`, `_ogrenci_sahibi`. 41 uç bu
yardımcıları çağırıyor; kural değişirse tek dosyada değişiyor.

### Sahip — şemadan zorlanan üç kural

- **Tam bir sahip olabilir.** Kısmi benzersiz indeks
  (`on ogretmenler((true)) where yonetici`) ikinci sahibi yasaklıyor.
- **Sahip pasifleştirilemez, sahipliği düşürülemez.** Aksi hâlde tek bir
  hata sistemi sahipsiz bırakırdı.
- **Sahibin PIN'i taşındı**, değişmedi: öğretmen aynı PIN'le girmeye
  devam ediyor.

### Özel ders TAMAMEN sahipte

Öğretmenin açık kuralı. Yedi uç `_yonetici` istiyor: `ders_ekle`,
`ders_sil`, `odeme_ekle`, `odeme_degistir`, `odeme_sil`,
`ozel_ders_detay`, `ogrenci_ekle(p_tur='ozel')`.

Bunun teknik bir sebebi de var: özel ders öğrencilerinin hepsi **tek bir
paylaşılan sınıfta** yaşıyor (`siniflar_tek_ozel`). Sahiplik sınıf
üzerinden kurulsaydı, o sınıfa erişen her öğretmen bütün özel ders
ödemelerini görürdü. Denetim bunu **gerçek tutar değeri** arayarak
ölçüyor, alan adına bakarak değil.

### Vekâlet — sahip başka bir öğretmenin hesabına geçiyor

`ogretmen_olarak_gir` yeni bir oturum açıyor; `oturumlar.vekil_id`
gerçekte giren kişiyi tutuyor. `_ogretmen` hedef öğretmenin kimliğini
döndürdüğü için **41 ucun hiçbiri değişmeden** doğru kapsamı görüyor.

- **Yazmak yasak, okumak serbest.** `mesaj_gonder` vekâletli oturumda
  reddediyor. Bir veli, o öğretmenin yazdığını sandığı bir mesajı
  başkasından almış olmamalı.
- **Denetim izi vekâleti taşıyor**: `_aktor` `Sahip <id> → Öğretmen <id>`
  üretiyor (Part XLIII).
- **Ekranda sessiz değil.** Kabukta kapatılamayan bir şerit duruyor. Bir
  "×" düğmesi koysaydım en çok ihtiyaç duyulan anda kapatılmış olurdu.

### Çıkarma = pasifleştirme

`aktif = false` açık oturumları düşürüyor ve PIN'i çalışmaz kılıyor;
**ödevler, notlar ve yazışmalar silinmiyor.** Sahip görmeye devam ediyor,
geri alma tek dokunuş.

### Yedek zinciri — taşıma provasında ölçülerek düzeltildi

`supabase/testler/tasima-provasi.sh` (0032 → 0033) yazılırken **gerçek
bir kusur çıktı**: `disa_aktar` satırlara `ogretmen_id`/`ekleyen_id`
yazıyor ama **kadroyu yedeğe koymuyordu**. Yani 0033'ten sonra alınan bir
yedek boş bir projeye geri yüklenemiyordu — yabancı anahtar kısıtından
düşüyordu. Yedek zinciri tam da işe yarayacağı gün kopmuş olurdu.

- `disa_aktar` artık `ogretmenler` ve `ogretmen_siniflari` yazıyor,
  **`pin_hash` hariç**: yedek öğretmenin bilgisayarına inen düz bir
  dosya, içinde dört öğretmenin PIN hash'i olmamalı.
- `geri-yukle.sql` kadroyu en başta yüklüyor ve **şemada olmayan tabloyu
  atlıyor**, böylece 0033 çalıştırılmamış bir projeye de yüklenebiliyor.
- **Öğretmenin bugün elinde duran yedek** (0033 öncesi) 0033'lü bir
  projeye yüklendiğinde artık reddedilmiyor: 0033'ün veri taşımasının
  aynısı uygulanıp tek öğretmenli sisteme çevriliyor.

Prova, dolu bir 0032 veritabanının üstünden 0033'ü geçiriyor ve
öğretmenin **uçlardan gördüğü 25 satırlık parmak izinin** birebir aynı
kaldığını ölçüyor — ham `count(*)` değil, çünkü asıl risk satırların
kaybolması değil **kapsam dışında kalması**.

### Bilerek yapılmayanlar ve kalan risk

- **Diğer zümreler açılmadı.** Şema hazır, kapsam matematik zümresi.
- **Sahip kendi panosunda herkesin verisini görmüyor.** Kendi kapsamını
  görüyor, başkasınınkine vekâletle geçiyor; aksi hâlde panosu dört
  öğretmenin gürültüsüne dönerdi.
- **Öğretmenler birbirinin ödevini göremiyor** (ortak havuz ayrı tur).
- **KALAN RİSK — öğrenci kodları sınıf düzeyinde. BU BİR KARAR, GÖZDEN
  KAÇMIŞ AÇIK DEĞİL.** Kendi sınıfındaki öğrencinin kodunu her öğretmen
  görebiliyor ve kod, öğrenci gibi giriş yapmaya yarıyor. Somut sonucu:
  o kodu alan meslektaş, çocuğun **başka öğretmenlerden** aldığı ödevleri
  ve **sahiple yazışmasını** okuyabilir (`ogrenci_mesajlari` öğretmene
  göre süzmüyor; ölçüldü).

  Risk ürünün sahibine anlatıldı, kodları sahibe kilitleyen bir uç
  (0034) yazıldı ve **sahibin kararıyla geri alındı** — depoya hiç
  girmedi. Gerekçesi kendi cümlesiyle: *"her öğretmen kendi sınıfının
  kodlarını kendi versin. Çok özel bir durum değil bu. Sonuçta tüm yetki
  bende. Ben onların her şeyini görebiliyorum. Onların sistemlerine
  girebiliyorum."* Dört tanıdık meslektaş, üstüne sahibin tam görünürlüğü
  ve vekâlet yetkisi.

  **Bu maddeyi "düzeltmeyin".** Kilit bilerek yok. Yeniden açılma koşulu
  tek: **başka zümreler eklenirse** — 20 öğretmende tanımadığınız biri
  bir öğrencinin kimliğine bürünebiliyor olmamalı. O gün kapatılacak yer
  belli: `ogrenci_kodlari`, kapısı `_ogrenci_sahibi` yerine `_yonetici`.
- **ÖLÇEK SINIRI.** Beş zümre × ~20 öğretmen × ~3.000 öğrenci olduğunda
  her gönderimin bir fotoğraf taşıması depolamayı ücretsiz planın üstüne
  çıkarır. Zümreler açılmadan önce plan ve maliyet ayrıca ölçülmeli.

## Soru kâğıdı künyesi — Claude'da üretileni içeri almak (yeni SQL yok)

Öğretmenin Claude Projects'te hazırladığı bir soru kâğıdı skill'i var;
çıktısı PDF/Word. Bunu SEKİZ'e bağlarken iki yol vardı ve **ürüne yapay
zekâ koymama** kararı verildi.

### Neden ürüne yapay zekâ konmadı

Maliyet konuşuldu ve engel o değildi: dört öğretmen ayda 20 kâğıt üretse
API ücreti ayda ~$2–8. Engel üç başka şeydi:

- **API anahtarı tarayıcıya konulamaz** (Bölüm XIV/XX) — sunucu tarafında
  yeni bir parça, yeni bir saldırı yüzeyi ve harcama tavanı gerekirdi.
- Claude aboneliği API'yi **karşılamıyor**; ayrı hesap, ayrı kart.
- **5. kuralla gerilim:** *"notlandırmada asla yapay zekâ kullanma."*
  Cevap anahtarını yapay zekâ üretirse notu fiilen o belirler.

Kâğıt Claude'da üretilmeye devam ediyor; SEKİZ yalnız **çıktıyı içeri
alıyor.** Üründe yapay zekâ, API anahtarı ve fatura yok.

### Kapatılan asıl boşluk: soru başına KONU

| Alan | Önce | Şimdi |
|---|---|---|
| Sorular PDF'i | yükleniyor | değişmedi |
| Anahtar PDF'i | yükleniyor | değişmedi |
| `cevap_anahtari` | anahtar PDF'inin metninden çıkarılmaya çalışılıyor | künyeden de dolabiliyor |
| `konular` | **her ödevde elle giriliyor** | künyeden tek dokunuşla doluyor |

Konu, öğretmenin PDF'lerinden **çıkarılamıyor**: sorular görsel olarak
gömülü, metin katmanında yok (`odev-pdf-ozeti.ts`'teki ölçüm). Oysa konu
karnesi (`konu_karnesi`) tamamen o alana dayanıyor. Kâğıdı üreten Claude
bu bilgiyi zaten biliyor; künye onu yolda kaybetmemek için var.

**Biçimi SEKİZ dayatıyor, skill ona uyuyor** — `docs/soru-kagidi-kunyesi.md`.
Böylece skill'in kendisi hiç görülmeden iki taraf anlaşıyor. Biçim
Word'deki cevap anahtarı tablosunun doğal hâli seçildi (`1  A  Türev`);
JSON daha kesin olurdu ama tek kırık tırnak bütün yapıştırmayı düşürür ve
öğretmen neyin bozuk olduğunu gözle göremezdi.

`odev_olustur` bu iki alanı zaten parametre olarak alıyordu: **panelde
çalıştırılacak yeni SQL yok.**

### Öneri, otomatik doldurma değil (Bölüm XXVIII)

Yapıştırmak hiçbir şeyi değiştirmiyor; önizleme ne okunduğunu söylüyor,
uygulayan öğretmen. 5. kuralın korunma noktası burası: anahtarı yapay
zekâ önerse de yayına öğretmen onayıyla gidiyor, ve `odev_yayinla` eksik
anahtarlı ödevi zaten reddediyor.

### Cevap anahtarının açılma anı değişmedi

Öğretmenin şartı — *"öğrenciye gönderilirken anahtar olmayacak, teslimden
sonra açılacak"* — künyeden bağımsız olarak zaten platformun kuralı:
`ogrenci_odevleri` teslim yoksa `cevap_anahtari` ve `anahtar_yolu`
alanlarını `null` döndürüyor (0025). Gerçek veritabanına karşı ölçülüyor:
`guvenlik_testleri.sql` 8. ve 10. bölümler.

### Ölçüm ve bir kör nokta

`kunye-denetimi.mjs` 22 ölçüm yapıyor. En değerlisi, sunucuya giden
istekte `p_konular`'ın **gerçekten dolu** olduğu — turun bütün sebebi o.

Geri alma kanıtı iki kör nokta buldu:

1. "Uygula'ya basılmadan bir şey değişmiyor" ölçümü `select` öğelerini
   sayıyordu; ızgarada `select` yok, sayaç hep 0 dönüyordu ve ölçüm her
   koşulda geçiyordu. Izgaranın kendi sayacı ("3/5 cevap girildi")
   okunacak şekilde yeniden yazıldı.
2. **Derleme sessizce düşerse denetim eski paketi ölçüyor.** `p_konular`
   yaması bir import'u boşta bıraktı (`error TS6133`), `npm run build`
   düştü, `yeni/` eski hâlinde kaldı ve denetim yamayı hiç görmeden
   22/0 geçti. 0030'da migration için öğrenilen dersin arayüz hâli;
   uyarı betiğin başına yazıldı.

## Veli onamı — uygulama içi açık rıza (0034)

Öğretmen sordu: *"Onam formu hazır mı?"* Değildi — hiç istenmemişti.
Kararları: onam **kâğıt değil, uygulama içinde**; muhatabı **veli**;
onaylamayan veli **giremesin**; geri çekme **şimdilik yok**.

### Kapı nerede

**Sunucuda.** Bir sınır `display:none` ile kurulmaz (Part XXI). Veli
jetonu kabul eden RPC'ler `grant execute ... to anon` verilmiş 60
fonksiyonun her birinin **en son tanımı okunarak** sayıldı — tahminle
değil — ve beşi çıktı:

| Uç | Karar |
|---|---|
| `kendi_karnem` · `okundu_isaretle` · `mesaj_gonder` · `dosya_erisim_izni` | `_onam_kapisi()` → `42501` |
| `veli_paneli` | hata **değil**, erken dönüş: `{onam_gerekli, surum}` |
| `cikis` | kapı **yok**, bilerek |

`veli_paneli` neden istisna: o da hata verseydi veli kabuğu
(`useKendiOzet('veli_paneli')`) çöker, veli onam metnini bile göremeden
beyaz ekranda kalırdı. Onam yokken çocuğa ait **tek bir alan bile
okunmuyor** — `select ... into ogr` hiç çalışmıyor.

`cikis` neden muaf: onaylamak istemeyen veliyi ekranda kilitlemek olurdu.

`_onam_kapisi` **yalnız veli rolünde** ısırıyor. `kendi_karnem` ve
`okundu_isaretle` öğrenci tarafından da kullanılıyor; kapıyı role bakmadan
kursaydık onam, **öğrencinin karnesini de kapatırdı**.
`onam_testleri.sql` 7. grup bunu ayrı bir negatif kontrol olarak ölçüyor.

### Metnin ikinci turu — öğretmen okuyunca iki eksik çıktı

İlk taslak (`2026-09-1`) yayına hiç çıkmadı. Öğretmen okuyunca iki şey
istedi: metin, velinin **çocuğun öğrenci uygulamasını kullanmasına** izin
verdiğini de söylesin; ad, soyad, ödev ve **not** açıkça sayılsın.

Üçüncü isteği — "okul adının depolanacağını kabul eden" — kontrol edilince
**yanlış çıktı**: `siniflar` yalnız `seviye` ve `sube` tutuyor, `ad` onlardan
türetiliyor ve şemada okul adı diye bir alan yok. Metne "okul adınız
saklanır" yazmak veliye yanlış bilgi vermek olurdu; metin bunun yerine
saklanmadığını söylüyor. `onam-metni.test.ts` ikisini birden tutuyor:
ileride gerçekten bir okul adı alanı eklenirse o test kırmızı olup metnin
de güncellenmesi gerektiğini söylüyor.

**Öğrencinin girişine kapı KONMADI** (öğretmenin kararı). Metin izni
kapsıyor ama çocuğun girişi teknik olarak durmuyor; bu boşluk metinde
açıkça yazıyor ve veliye gerçek bir yol veriyor: *"Çocuğunuzun uygulamayı
kullanmasını istemiyorsanız öğretmene söyleyin, hesabı kapatılır."*
Alternatifi — onam gelene kadar çocuğu da kilitlemek — hiç giriş yapmayan
tek bir veli yüzünden çocuğun ödev yapamaz hâle gelmesi demekti.

### Metin depoda, sürümü veritabanında

Metin `app/src/lib/onam-metni.ts` (statik site, ek istek yok, geçmişi
git'te). Kayda giren şey **sürüm**. Metin değişip sürüm sabit kalsaydı
eski onaylar yeni metni sessizce kapsardı — veli okumadığı bir şeyi
onaylamış sayılırdı. `onam-metni.test.ts` metnin hash'ini sürümle
kilitliyor ve migration dosyasını **gerçekten okuyarak** sunucu sürümüyle
eşleştiğini ölçüyor: ikisi ayrışsa veli düğmeye basar, hata alır ve
döngüde kalırdı.

### Bu turda ölçümlerin yakaladıkları

1. **`revoke` unutuldu.** PostgreSQL yeni fonksiyonun EXECUTE hakkını
   varsayılan olarak PUBLIC'e verir; `anon` da PUBLIC'tedir. Yani "grant
   yazmadım, demek ki kapalı" yanlıştır. `guvenlik_denetimi.sql` 1a
   yakaladı: `_onam_kapisi → HATA VERMEDİ`. İki `revoke` satırı eklendi,
   migration artık `has_function_privilege` ile kendini de denetliyor.
2. **Felaket provasında sessiz bir yanlış geçiş.** Onamsız `veli_paneli`
   `mesajlar` alanını hiç döndürmüyor; `jsonb_array_length(null) <> 1`
   NULL olduğu için `if` ateşlemiyordu ve prova **ölçmeden** geçiyordu.
   Tohuma gerçek bir onam satırı konuldu, `onam_gerekli` kontrolü eklendi;
   tohum geçici olarak kaldırılınca prova kırmızı oluyor (kanıtlandı).
3. **26 yerde eski testler onamsız veli kullanıyordu.** Elle sayım
   `bildirim_testleri.sql`'deki dört girişten üçünü kaçırmıştı; yama
   "giriş yapan ve veli kodu kullanan her atama" desenine çevrildi.

### Ölçüm

`onam_testleri.sql` 9 grup — 9. grubu varsayılan-ret: `anon`'a açık **her**
uç, beyaz liste (`giris`, `cikis`, `onam_ver`, `veli_paneli`, `pin_ayarla`)
dışındaysa onamsız veli jetonunu reddetmek zorunda. Yarın kapısız yeni bir
veli ucu eklenirse test kendiliğinden kırmızı oluyor.

`onam-denetimi.mjs` 32 ölçüm — sekmeler çizilmiyor, metnin asıl maddeleri
ekranda, doğru sürümle gönderiliyor, onaydan sonra panel açılıyor. İki
negatif kontrol: onamlı veli ekranı **hiç** görmüyor ve **0034
çalıştırılmamış** bir panelde arayüz kapıyı **uydurmuyor** (yoksa veliler
sunucuda karşılığı olmayan bir ekranda kilitlenirdi).

### Sürüm 3 — öğretmenin dört düzeltmesi

Metin yayına girdikten sonra öğretmen okudu ve üç şeyi **kaldırttı**: özel
derse ait *"ders planı ve ödeme kaydı"* satırı, *"cevap anahtarı veliye
hiçbir zaman gösterilmez"* cümlesi ve **yapay zekâ bölümünün tamamı.**

Dördüncüsü bir **hata düzeltmesi**: metin *"matematik zümresindeki
öğretmenler — dört kişi"* diyordu. Bu **yanlıştı** — 0033'ün kapsam kuralı
her öğretmeni kendi sınıflarıyla sınırlıyor (`_ogretmenin_ogrencisi`;
özel ders öğrencisini yalnız `yonetici` görüyor). Veliye "dört kişi
görüyor" demek ürünün yaptığından fazlasını söylemekti. Metin artık
"çocuğunuzun dersine giren öğretmen … her öğretmen yalnız kendi
sınıflarındaki öğrencileri görüyor" ve "platformu yöneten öğretmen,
yönetim için sistemin tamamını görebiliyor" diyor. Yönetici **isimsiz**
geçiyor (öğretmenin seçimi).

**Bilinen boşluk, sessizce geçilmedi:** ödeme satırının kalkması gerçek
bir eksiklik — `odemeler` özel ders öğrencilerinde tutuluyor ve veli
ödemeleri kendi panelinde görüyor. Öğretmene bu sonuç söylendi, kararını
tekrarladı; kayıt `docs/kvkk-notlari.md`'de.

**Kaldırma iddiası ÖLÇÜLÜYOR.** "Sildim" ölçülmemiş bir iddia olurdu; hem
vitest hem tarayıcı denetimi artık metinde/ekranda "yapay zekâ", "cevap
anahtarı", "ödeme kaydı"/"ders planı" ve yanlış olan "dört kişi"
ifadelerinin **geçmediğini** ayrıca ölçüyor. Tarayıcı tarafındaki ölçüm
daha değerli: derleme sessizce düşse "var mı" ölçümleri eski paketle yine
yeşil yanardı, "yok mu" ölçümleri yanmazdı.

### 0035 neden ayrı bir dosya

0034 **canlıda çalıştırılmıştı.** Çalışmış bir migration'ı düzenlemek,
dosyayla veritabanı arasında sessiz bir ayrışma bırakırdı. Sürüm sabiti
bu yüzden `0035_onam_metni_v3.sql` içinde `create or replace` ile
değişiyor; yeni tablo, yeni yetki, yeni kapı yok.

Sürüm testi de artık **0034'e çivili değil**: `_gecerli_onam_surumu`'nü
tanımlayan en yüksek numaralı migration'ı bulup onu okuyor. Çivili
kalsaydı 0035 sürümü yükselttiği anda test yanlış dosyaya bakardı.

### Yayın sırası — iki pencerenin küçüğü seçildi

Sürüm hem sitede hem sunucuda değişiyor; eşleşmedikleri sürece veli onay
veremiyor (`22023`).

| Sıra | Pencerede ne olur |
|---|---|
| **Önce site, sonra 0035** ← seçilen | Yalnız henüz onay vermemiş veli "metin güncellendi" uyarısı görür; onaylamış veliler çalışmaya devam eder (sunucu hâlâ v2). |
| Önce 0035, sonra site | **Bütün** veliler kapının arkasında kalır. |

0035'in çalıştığı an v2'yi onaylamış velilerin metni bir kez daha görmesi
**tasarımın kendisi**, kusur değil — ve varsayılmadı: 0034'lü bir
veritabanında onay verilip 0035 çalıştırıldı, veli yeniden soruldu, eski
onay satırı **silinmedi**, yeni metni onaylayınca panel açıldı.

### Sürüm 4 — ürünün sahibini yanıltan cümle

Öğretmen metni okuyup sordu: *"Çözüm fotoğrafları 60 saniye geçerli bir
bağlantıyla açılıyor — yani öğretmen ödev kâğıdına sadece altmış saniye mi
bakabilecek?"*

Cevap hayır: o süre **bağlantının ömrü**, bakma süresi değil. Ekranlar
fotoğrafı her açışta yeniden adresliyor (`dosyaAdresi()`), adres hiçbir
yerde saklanmıyor, öğretmen dilediği kadar bakıyor.

**Ama cümlenin kusuru gerçek.** Ürünü tasarlayan kişi yanıldıysa veli de
yanılır — ve onam metninin tek işi doğru anlaşılmak. Rakam çıkarıldı
(veliye bir şey anlatmıyordu) ve cümle ne olduğunu **ve ne olmadığını**
birlikte söyler hâle getirildi: *"Öğretmenin fotoğrafa ne kadar
bakabildiğiyle ilgisi yok — dilediği zaman, dilediği kadar açabiliyor."*

İki ölçüm kilitliyor: metinde `60 saniye`/`altmış saniye` **geçmiyor** ve
"ne kadar bakabildiğiyle ilgisi yok" cümlesi **duruyor** — hem vitest hem
tarayıcı denetiminde.

### 0035 bu kez YERİNDE düzeltildi

0034'ü düzenlememiştim çünkü **canlıda çalışmıştı**. 0035 ise hiç
çalıştırılmamıştı — ne canlıda ne öğretmende. Kural "dosya yayınlandı mı"
değil, **"bir veritabanı onu uyguladı mı"**: uygulanmamış bir migration
yerinde düzeltilebilir ve öğretmen tek SQL çalıştırır. Dosya
`0035_onam_metni_v3.sql` → `0035_onam_metni_v4.sql` olarak yeniden
adlandırıldı; eski ad depoda bırakılsaydı hangisinin yapıştırılacağı
karışırdı.

Sürüm testi dosya adına bağlı değil (sabiti tanımlayan en yüksek numaralı
migration'ı buluyor), yeniden adlandırma onu bozmadı.

### Yarım kalmış yayının bıraktığı pencere

Bu turda canlıda şöyle bir ara durum oluştu ve **kapatılması bu turun
aciliyeti oldu**: site `2026-09-3`'ü gösteriyor, veritabanı hâlâ
`2026-09-2` bekliyordu (SQL çalıştırılmamıştı). İkisi eşleşmediği için
onam **vermemiş** veliler onaylayamıyordu; onaylamış veliler
etkilenmiyordu.

Ders: sürüm yükselten bir tur, **site + SQL birlikte tamamlanana kadar
bitmiş sayılmaz.** Sıra doğruydu (önce site) ama arada beklemek pencereyi
açık tutuyor.

### Sürüm 5 — ölçüm yanlış bir cümleyi kilitlemişti

Öğretmen sordu: *"Onam metninde okulun adı saklanmıyor diyor ama logoda
var okulun adı."* **Haklıydı.**

`SchoolCrest.tsx:13` mührün `alt` metninde okulun tam adını taşıyor;
`GirisEkrani.tsx` giriş ekranında, mührün hemen altında adı **görünür
metin** olarak yazıyor. Yani okulun adı her velinin **ilk gördüğü
ekranda** duruyor.

Doğru gözlem şuydu: şemada okul adı alanı yok, yani ad **çocuğun kaydına**
yazılmıyor. Ben bunu metne *"hiçbir yerde saklanmıyor"* diye geçirdim.
"Çocuğun kaydında yok" ile "uygulamada hiçbir yerde yok" aynı şey değil.

**Asıl ders ölçümde.** Test şunu kilitliyordu:

```ts
expect(ONAM_METNI).toContain('Okulun adı SEKİZ'de hiçbir yerde saklanmıyor');
```

Yani ölçüm **yanlış iddiayı koruyordu**. Böyle bir test kusuru bulmaz,
gizler: cümle düzeltilmeye çalışılsa test kırmızı yanar ve yanlış olan
geri konur. Turun kalıcı çıktısı, testin şeklinin değişmesi:

```ts
// metnin SÖZLERİ değil, ÜRÜNLE ÇELİŞMEMESİ ölçülüyor
const tamAd = /TAM_AD = '([^']+)'/.exec(readFileSync('SchoolCrest.tsx'))?.[1];
expect(tamAd).toMatch(/Lisesi/);                       // ürünün gerçeği
expect(ONAM_METNI).not.toMatch(/hiçbir yerde saklanmıyor/i);  // metin inkâr edemez
expect(ONAM_METNI).toContain('giriş ekranında zaten');        // nerede olduğunu söylemeli
```

Geri alma kanıtı alındı: yanlış cümle geri konunca **iki** test kırmızı
oluyor (hash kilidi + çelişki testi), geri alınınca 25/25 yeşil.

**Ve bir kez daha o tuzak:** bu turda `cd app && npm run build` sessizce
düştü, denetim ESKİ paketi ölçtü ve 9 kusur bildirdi. Kusur kodda değil,
derlemedeydi. `✓ built` görülmeden denetim sonucuna bakılmaz — ne yeşiline
ne kırmızısına.

### Sürüm 6 — kuyruk kalktı, ve "hangi migration çalıştı" belirsizliği

Öğretmen okul adı maddesinin sonundaki *"çocuğunuza ait bir kayıt değil"*
kuyruğunu kaldırttı. Cümle zaten "kaydına yazılmıyor" diye başlıyordu;
kuyruk aynı şeyi ikinci kez söylüyordu.

**Asıl not, migration tarafında.** Bu tur başladığında 0036'nın canlıda
çalıştırılıp çalıştırılmadığı **bilinmiyordu** — sunucu sürümü dışarıdan
okunamıyor, çünkü `_gecerli_onam_surumu` bilerek `anon`'a kapalı.

Belirsizlikte doğru hamle, eskiye dokunmayıp **yeni dosya** yazmaktı:
0037'nin tek yaptığı sürüm sabitini `create or replace` ile yazmak, yani
sunucu 0034'te de olsa 0035'te de 0036'da da sonuç aynı. Öğretmen yine
**tek** dosya çalıştırıyor.

Bu varsayılmadı, **ölçüldü** — iki ayrı veritabanı kurulup ikisinde de
yalnız 0037 çalıştırıldı:

| Başlangıç | 0037 sonrası |
|---|---|
| 0035'te duran zincir (`2026-09-4`) | `2026-09-6` ✓ |
| 0036 çalışmış zincir (`2026-09-5`) | `2026-09-6` ✓ |

Kural netleşti: **"dosya yayınlandı mı" değil, "bir veritabanı onu
uyguladı mı"** — ve uygulanıp uygulanmadığı bilinmiyorsa, uygulanmış
kabul edilir.

## Onam dökümü ve onayı verenin adı (0038)

Öğretmen: *"Velilerin onay verdiklerini PDF olarak, her sınıfın velisinin
onayını toplu bir şekilde alabilmeliyim"* ve *"veli onay verirken adını
soyadını yazıp onaylayabilsin; ben de hem öğrencinin hem onay veren
velisinin adını göreyim."*

### PDF için kütüphane eklenmedi

Ürün PDF'i zaten tarayıcıdan üretiyor: kod fişleri `window.print()` +
`@media print` ile basılıyor, öğretmen yazdırma penceresinde "PDF olarak
kaydet" seçiyor. Onam dökümü aynı yolu kullanıyor. Bir PDF kütüphanesi
pakete yüzlerce KB bindirirdi ve karşılığında hiçbir şey kazandırmazdı.

### İmza değişti — 0007 tuzağı

`onam_ver` artık üç parametre alıyor. PostgreSQL'de imza değişikliği
**yeni bir fonksiyon** demektir; eskisi kendiliğinden kalkmaz. İki
parametreli sürüm bırakılsaydı **adı yazmadan onay vermenin yolu açık
kalırdı** — üstelik arayüz değil, doğrudan uç üzerinden. Bu yüzden önce
`drop function public.onam_ver(text, text)`, sonra yenisi ve yetkisi.

Migration bunu kendi içinde de denetliyor ve `onam_testleri.sql` 10a
grubu `pg_proc`a sorarak ölçüyor — çağırıp hata almak yeterli kanıt
değildi: fonksiyon var ama başka sebeple reddediyor olabilirdi.

### Belge kendi kendini anlatıyor

Bir isim listesi tek başına kayıt değildir. Kâğıtta sınıf, **dökümü alan
kişi**, alınma zamanı, metnin **sürümü** ve en sonda metnin **tamamı**
var: "kim, ne zaman, neye onay verdi" üçü de aynı belgede. Metin yeni
sayfadan başlıyor (`break-before: page`), tablo satırları sayfa ortasından
bölünmüyor.

**Dürüst sınır kâğıda yazılı:** velinin adı kendi beyanıdır, kimlik
doğrulaması yapılmaz. Bunu belgeden gizlemek, belgeyi olduğundan güçlü
göstermek olurdu.

### Sürüm neden yükseldi (2026-09-6 → 2026-09-7)

Metin değişmese de **velinin yaptığı şey** değişti: artık adını yazıyor.
Sürüm sabit kalsaydı adsız verilmiş eski onaylar yeni akışta adlıymış
gibi görünür, döküm boş isimlerle çıkardı. Yükselince herkes bir kez daha
onaylıyor ve döküm baştan eksiksiz oluyor. Eski satırlar **silinmiyor**;
`veli_adi` NULL olabiliyor ve dökümde "ad kaydedilmemiş" diye görünüyor.

### Yedek kendiliğinden taşıdı

`disa_aktar` tabloyu `to_jsonb(v)` ile alıyor, `geri-yukle.sql` sütunları
**şemadan** okuyor. Yeni sütun için ikisi de değiştirilmedi — ve felaket
provası bunu ölçtü: geri yüklenen veritabanında adlar yerinde
(`Ayşe'nin Velisi`, `Öğünç'ün Velisi`). Sütun listesi elle yazılmış
olsaydı bu tur onu da bozacaktı.

### "Tek dosya yeter" iddiası ölçüldü

Öğretmene "0035/0036/0037'yi çalıştırmış olun ya da olmayın, yalnız
0038'i çalıştırın" deniyor. Varsayılmadı — dört ayrı veritabanı kurulup
her birinde yalnız 0038 çalıştırıldı:

| Zincirin durduğu yer | 0038 sonrası |
|---|---|
| 0034 (`2026-09-2`) | `2026-09-7` ✓ |
| 0035 (`2026-09-4`) | `2026-09-7` ✓ |
| 0036 (`2026-09-5`) | `2026-09-7` ✓ |
| 0037 (`2026-09-6`) | `2026-09-7` ✓ |

### Yazdırma kipi de ölçülüyor

`onam-denetimi.mjs` Playwright'ın `emulateMedia({media:'print'})` kipine
geçip **kâğıda ne çıktığına** bakıyor: kabuk yok, "Yazdır" düğmesi yok,
belge duruyor. Bu ölçüm olmadan "yazdırılabilir" iddiası ekranda yeşil
görünüp kâğıtta yan menüyle çıkabilirdi — kod fişlerinde tam olarak bu
yaşanmıştı.

## Okul yönetimi bilgilendirmesi (0039)

`docs/kvkk-notlari.md`'nin dikkat listesindeki **ilk madde** buydu —
"okul yönetimine sistemin varlığını ve barındırma bölgesini bildirin" —
ve metni hiç yazılmamıştı. Öğretmen bu turda istedi.

### Belgede hiç sayı yok, ve bu ölçülüyor

Böyle bir kâğıdın en olası bozulma biçimi, yazıldığı gün doğru olup altı
ay sonra yanlış olmasıdır. Bu depoda **iki kez** yaşandı:

1. `docs/kvkk-notlari.md` bir ay boyunca "çözüm fotoğrafları korumasız"
   dedi; oysa o açık kapanmıştı.
2. Onam metni "matematik zümresindeki öğretmenler — dört kişi" dedi;
   yanlıştı ve öğretmen yakaladı.

Okula verilen bir belgede aynı şey olursa daha kötü. Kural bu yüzden
sert: **metinde hiçbir sayı geçmiyor.** Kaç öğretmen, kaç sınıf, kaç
öğrenci, kaç veli onam vermiş — hepsi `okul_bilgilendirme` ucundan canlı
gelip ayrı bir "Bugünkü durum" bölümüne basılıyor.

`okul-bilgilendirme.test.ts` bunu iki yönden tutuyor: metinde **rakam**
yok, ve "dört öğretmen" gibi **yazıyla sayı** da yok. Sayı yazmak isteyen
testi kırmak zorunda kalıyor — yani bilinçli bir karar veriyor.

**"bir" bilerek dışarıda:** Türkçede sayı değil belgeç ("başka bir
sınıfın öğretmeni"). Ve testte `\b` kullanılmıyor: JavaScript'te `ı`,
`ö`, `ğ`, `ş` kelime karakteri sayılmadığı için `sınıf\b` "sınıfın"
içinde de eşleşiyor — ilk yazımda tam olarak bu oldu ve test yanlış yere
kırmızı yandı.

### Yalnız sahip

Uç `_yonetici` kapısının arkasında: bu belge bütün okulun sayılarını
veriyor ve bir öğretmene açık olsaydı 0033'ün kapsam kuralı sessizce
delinirdi — kendi sınıfını göremediği öğrencilerin sayısını öğrenirdi.

Migration bunu kendi içinde denetliyor (`pg_get_functiondef` ile gövdede
`_yonetici` arıyor) ve `ogretmen_kapsami_testleri.sql` 4f/4g grupları
ölçüyor. **Geri alma kanıtı alındı:** kapı `_ogretmen`e çevrilince test
*"4f: A, okul bilgilendirmesini alabildi"* diye kırmızı yanıyor.

Ayrıca 4h: belgeye **tek bir öğrenci adı bile** sızmadığı ölçülüyor —
kâğıt okul yönetimine gidiyor, öğrenci listesi değil.

### İmza bölümü

Belgenin asıl değeri burada: sonunda okul yönetiminin dolduracağı boş bir
bölüm var (ad, unvan, tarih, imza). Elde, okulun bilgilendirildiğine dair
imzalı bir kâğıt kalıyor.

## Haftalık, aylık ve dönemlik sınıf analizi (0040)

Öğretmenin isteği: *"Her öğretmenin verdiği ödevinden haftalık analiz
oluşsun… o hafta ödevlerinden haftalık analiz, ödevlerin ortalaması,
haftalık olarak iyi olan konular, çalışılması gereken konular gibi
haftalık ve aylık analizler otomatik olarak gelsin. Ve dönem sonunda da o
dönemin analizi yapılsın."*

Bu **sıfırdan bir hesap değil**. Konu analizi 0020/0023'ten beri var
(`_konu_analizi`, `konu_karnesi`); eksik olan tek şey **zaman
kırılımıydı**. `sinif_analizi` hafta, ay ve aralık özetini tek uçta
döndürüyor — üç ayrı uç olsaydı ekran üç istek atar ve üçü arasında
zamanlama farkı oluşabilirdi.

### Ölçüt ürünün geri kalanıyla aynı

Analize giren ödev: **yayında + son teslim tarihi geçmiş.** `konu_karnesi`,
`kendi_karnem` ve `veli_paneli` hep bu pencereyi kullanıyor. Başka bir
ölçüt seçseydik aynı ödev iki ekranda iki farklı sonuç verir, öğretmen
hangisine inanacağını bilemezdi.

Ödev **son teslim tarihine göre** haftaya sayılıyor (öğretmenin kararı).
Oluşturma tarihine göre saysaydık, cuma verilip iki hafta sonrasına süre
tanınan bir ödev kimse teslim etmeden "o haftanın analizinde" görünür ve
hafta boş çıkardı.

Dönem = **seçilen tarih aralığı** (öğretmenin kararı). MEB takvimi her yıl
değişiyor ve ara tatiller kayıyor; "Eylül–Ocak" diye sabitlemek belgeyi
bir yıl sonra yanlış yapardı. Varsayılan son 12 hafta, çünkü "otomatik
gelsin" denmişti: ekran açılır açılmaz bir şey göstermeli.

### Çizgi bir kez yazılıyor — ve bu ölçülüyor

İlk yazımda eşikler **iki yerdeydi**: `_konu_durumu` içinde (0.70/0.50/5)
ve yanıtın `esikler` alanında ayrı bir sabit olarak (`70, 50, 5`). İkisi
de doğruydu, o yüzden hiçbir test kırmızı yanmıyordu. Ama biri değişip
öteki kalsaydı ekran *"iyi: %70 ve üstü"* yazarken sunucu %65'ten
damgalardı — **öğretmen ekranda yazana bakıp yanlış olduğunu
anlayamazdı.**

Artık tek kaynak var: `_konu_esikleri()`. Hem damga hem yanıttaki
`esikler` alanı ondan okuyor. Migration'ın kendi doğrulaması bunu
**sınır değerlerini eşiklerden türeterek** sınıyor — sınırları doğrulamaya
elle yazsaydık ölçüm de aynı sabiti tekrarlar ve ayrışmayı göremezdi:

```
if public._konu_durumu(100, e_iyi) <> 'iyi' then …
if public._konu_durumu(100, e_iyi - 1) =  'iyi' then …
```

**Geri alma kanıtı alındı:** yardımcı %65 derken damgaya eski sabit (%70)
bırakılınca doğrulama *"0040 EKSİK KALDI: %65 doğru 'iyi' sayılmıyor"*
diye düştü.

Ayrıca damga, **ekranda yazan yüzdeyle aynı sayıdan** çıkıyor. Ekran oranı
yuvarlıyor; damga yuvarlanmamış orandan çıksaydı 69,6'lık bir konu tabloda
"%70" yazıp yanında "Orta" damgası taşırdı — hemen üstünde "iyi: %70 ve
üstü" yazarken. Öğretmen ekranda kendi kendini yalanlayan bir satır
görürdü.

### Az veri gizlenmiyor, damgalanıyor

Beş sorunun altındaki konu listede **duruyor** ama `az_veri` etiketiyle;
iyi/çalışılmalı listelerine girmiyor. İki soruluk bir konuya "çalışılması
gerekiyor" demek, öğretmene olmayan bir bilgi vermek olurdu. Gizlemek de
olmazdı — dil kuralı: *gerçeği gizleme.*

### Konu damgası, öğrenci damgası değil

Bu ekranda **tek bir öğrenci adı geçmiyor**: sınıfın konu durumu var.
Öğrenci düzeyi zaten konu karnesinde, ve orada gelişim gösteriliyor.
Kapsam `_ogretmenin_sinifi` ile kapalı — her öğretmen yalnız kendi
sınıfının analizini alıyor.

### Tarayıcı denetimi neden İKİ VERİ KÜMESİYLE ölçüyor

`analiz-denetimi.mjs` ilk yazıldığında tek kümeyle 29 ölçümün hepsi geçti.
Bakınca üçü **asla kalamazdı**:

- `metin.includes('—')` — başlıktaki *"9A — ödev analizi"* tireyi zaten
  sağlıyordu. Boş haftanın "0" yazması bu ölçümü bozmazdı.
- `/\b5\b/` ödev sayısı diye ölçülüyordu; sayfadaki *"5 sorudan az"*
  ifadesi bunu her hâlükârda geçiriyordu.
- `!/Çalışılmalı\s*Köklü/` — konu listeye virgülle girseydi kalıp yine
  tutmaz, kusur geçip giderdi.

**Geçen bir ölçüm, kalabildiğini göstermedikçe bir şey kanıtlamaz.** Bu,
sürüm 5'te yanlış bir cümleyi kilitleyen testle aynı kusur ailesi.

Ekran artık **iki farklı yanıtla** iki kez ölçülüyor ve her sayı sunulan
gövdeden okunup birebir karşılaştırılıyor; sabit yazılmış ya da arayüzde
hesaplanmış bir değer ikisini birden tutturamaz. B kümesi bilerek A'nın uç
durumlarını taşıyor: ortalaması olmayan dönem, boş "iyi" listesi, hiç
aylık kırılım yok, konusuz hafta, %0 oran ve **A'dan farklı eşikler**.

Bunun kıymeti ölçüldü: ekrana `%50` sabiti gömülünce **A kümesi bunu
göremedi** (A'nın eşiği zaten 50), yalnız B yakaladı. Üç kusur
yerleştirildi, üçü de yakalandı (10 ölçüm kırmızı yandı).

Bir ara kusurlu derleme **düşünce** (`TS6133`) denetim eski paketi ölçtü ve
başka bir şey rapor etti — `✓ built` görülmeden tarayıcı denetimine
güvenilmeyecek kuralı bu turda bir kez daha işledi.

### Ondalık ayracı

Ortalama ilk yazımda `String(71.4)` ile basılıyordu: ekranda **71.4**.
Uygulamanın geri kalanı (`Gelisim.tsx`) `Intl.NumberFormat('tr-TR')`
kullanıyor: **71,4**. Aynı sayıyı iki ekranda iki türlü görmek öğretmene
iki ayrı sayı gibi gelir; analiz ekranı da tr-TR'ye çevrildi.

### Panel dosyası gerçekten aynı veritabanını kuruyor mu

`0040_donem_analizi_kisa.sql` ayrı bir veritabanına (0001–0039 + panel
dosyası) uygulandı; `analiz_testleri.sql` 9 grubu orada da geçti ve üç
fonksiyonun `pg_get_functiondef` özetleri iki veritabanında **birebir
aynı** çıktı.

## Sürüm defteri — hangi kurulum dosyası çalıştı (0041)

Öğretmenin isteği: *"Hangi SQL dosyasının canlıda çalıştığını tutan bir
kayıt yok; her seferinde benim hatırlamama kalıyor."*

**Bu belirsizlik zaten bir turluk fazladan iş olarak faturalandı.** Onam
metni sürüm 5 turunda 0035'in çalışıp çalışmadığı bilinmiyordu; emin
olunamadığı için "çalışmış da olsa çalışmamış da olsa doğru sonucu
versin" diye **fazladan** bir dosya (0036) yazıldı.

### Önce yanlış çözüm seçildi, ölçüm düzeltti

İlk seçenek "uçları dışarıdan yoklayıp rapor veren bir betik"ti — panelde
hiçbir şey çalıştırmadan sonuç verdiği için cazipti. Yazmadan önce
kapsamı ölçüldü:

```
YENİ FONKSİYON GETİREN (yoklanabilir)  : 29/40
YALNIZ GÖVDE/VERİ DEĞİŞTİREN (görünmez): 11/40
```

Görünmeyen 11'in içinde **0035, 0036, 0037** vardı: yani tam da soruyu
doğuran dosyalar. Onlar yeni bir uç eklemiyor, var olan bir fonksiyonun
gövdesini değiştiriyor; dışarıdan bakınca hiçbir iz bırakmıyorlar.

**Bir ölçüm, asıl sorulan soruyu cevaplayamıyorsa çözüm değildir.** Bu
öğretmene anlatıldı ve tablo seçildi. Tasarımı yazmadan önce yapılan bu
sayım, boşa bir tur harcamayı önledi.

### Geçmiş uydurulmuyor: çıpalar

0001–0040 çalıştı ama kimse yazmadı. Deftere körlemesine "hepsi uygulandı"
yazmak, defteri ilk gününde yalancı yapardı: **eksik kurulmuş bir
veritabanında da aynı şeyi yazardı** ve öğretmen ekrana bakıp her şeyin
yerinde olduğunu sanırdı.

Onun yerine `_defter_doldur()` çıpa nesneleri arıyor — her çıpa bir dosya
aralığını temsil ediyor, yalnız çıpası **tutan** aralık yazılıyor. Ölçüldü:
0039 ve 0040 kaldırılmış bir veritabanında defter 38 satır yazıyor ve
eksikleri adıyla bildiriyor, ekran da "çalıştırılmamış" diyor. **Eksik
kurulum kendini ihbar ediyor.**

`kaynak` alanı bir satırın NASIL bilindiğini söylüyor: `migration` →
dosyanın kendi yazdığı kesin kayıt; `geriye_donuk` → çıkarım. Ekranda da
ayrı duruyorlar. İkisini karıştırıp hepsine "uygulandı" demek, bilmediğimiz
bir şeyi biliyormuş gibi göstermek olurdu.

### Doldurma neden fonksiyon, `do $$` bloğu değil

Test, doldurmayı **çağırabilmeli**. Anonim blok olsaydı test aynı mantığın
bir KOPYASINI çalıştırmak zorunda kalır, yani asıl çalışan kodu değil
taşrasını ölçerdi. `defter_testleri.sql` 4. grubu bunu kilitliyor.

### Defter yedeğe girmiyor

`disa_aktar` değişmedi ve bu bilinçli: yedek boş bir projeye
yüklenebiliyor, orada şema yedekten değil kurulum dosyalarından gelir.
Defter yedekle taşınsaydı, migration'ları hiç çalıştırmamış bir proje
"hepsi uygulandı" derdi — ve bu, **yedeğin işe yarayacağı gün** ortaya
çıkardı. Hem migration'ın kendi doğrulaması hem testin 5. grubu bunu
sınıyor (pozitif kontrolüyle: yedek gerçekten dolu mu).

### Defterin kendisi de kayabilir — sözleşme testi

Yeni bir migration kendini deftere yazmayı unutursa defter sessizce eksik
kalır ve ekran "veritabanınız güncel" der. `migration-listesi.test.ts`
bunu engelliyor: 0041 ve sonrasındaki **her** dosya kendi adını yazan
satırı taşımalı; taşımıyorsa test, eklenecek satırı yazarak kırmızı yanıyor.

Bu test **dizinden** okuyor, üretilmiş listeden değil. İlk yazımda
üretilmiş listeden okuyordu ve ölçüldü: sahte bir `0042` eklendiğinde
**sessiz kalıyordu** — yani kuralın en çok gerektiği an, yeni dosyanın
yazıldığı an, kapsam dışındaydı.

### Tarayıcı denetimi yine iki veri kümesiyle

En tehlikeli kusur çökmek değil, **"güncel" derken yanılmak**. Ekrana
"her zaman güncel" kusuru yerleştirildi: **A kümesi (defter tam) tamamen
yeşil kaldı**, yalnız B (defter eksik) yakaladı — 5 ölçüm kırmızı yandı.
0040'ta öğrenilen ders burada da işledi.

---

## anon izolasyon testi artık sayıyor

Bu tur okunurken bulundu: `anon_izolasyon.sql` dahili fonksiyonları **elle
yazılmış** bir diziden sınıyordu ve dizi geride kalmıştı — depodaki 29
dahili fonksiyonun **14'ü** hiç süpürülmüyordu (`_denetim`, `_oturum`,
`_konu_analizi`, `_soru_dokumu`, `_aktor`, 0040'ta eklenen
`_konu_esikleri`/`_konu_durumu`, …).

Hiçbiri açık değildi — ayrıca ölçüldü, canlıda da doğrulandı (401/42501).
**Kusur açık olmaları değil, yeniden açılsalar hiçbir testin
yakalamayacak olmasıydı.** Nöbetçi kapının yarısını hiç görmüyordu.

Defter turuyla aynı hastalık: elle tutulan kayıt kayar. Liste kaldırıldı,
yerine katalogdan sayım kondu (`has_function_privilege` /
`has_table_privilege` — yetkinin kendisini soruyor, çağırmayı denemiyor;
çağırarak sınamak her fonksiyonun argüman tipini bilmeyi gerektirirdi ve
listenin en baştaki sebebi buydu). Kapsam **15 → 31 fonksiyon**, tablolar
**17 → 18**.

`like '_%'` KULLANILMADI: LIKE'da `_` tek karakter jokeri, yani her
fonksiyonu eşler ve süpürme sessizce genişlerdi. `left(proname,1) = '_'`
hem doğru hem tartışmasız.

Alt sınır kontrolü var (`sayi < 29` → hata): sayım bir gün bozulursa test
sessizce "hepsi kapalı" demesin.

Çağrılı sınama **temsilciler üzerinde duruyor**: katalog "kapalı" diyor,
gerçekten de çağrılamıyor mu — iki yol ayrışırsa görülsün.

**Geri alma kanıtı:** eski elle listenin hiç görmediği `_soru_dokumu`
anon'a açıldığında test *"KRİTİK: anon şu dahili fonksiyonları
çağırabiliyor: _soru_dokumu(...)"* diye kırmızı yandı. Eski testte bu
sessizce geçerdi.

## e-Okul sınıf listesi PDF'i (0042 — yalnız arayüz)

Öğretmen sınıflarını eklemek isterken bildirdi: *"Kız erkek cinsiyet
belirten kısımları da ayrı birer öğrenciymiş gibi alıyor."*

**Haklıydı, ama sorun bildirdiğinden büyüktü.** Gerçek bir 9. sınıf listesi
ayrıştırıcıya verildi ve sayıldı:

```
27 gerçek öğrenci → 44 "öğrenci"
```

Listeye girecek olanlar arasında şunlar vardı:

- `Sınıf Öğretmeni: <ad>` ve `Sınıf Müdür Yrd: <ad>` — **iki meslektaşın
  adı öğrenci olarak kaydedilecekti.** Cinsiyetten çok daha ciddi olan
  buydu ve kimse fark etmemişti.
- `T.C.`, `İSTANBUL VALİLİĞİ`, okulun adı, `Pansiyon Durum`, tablo
  başlığı, `… Öğrenci Sayısı : 27` altbilgisi, belge kodu.
- Ve gerçek öğrencilerin **adı da bozuktu**: ad alanı
  `601 Ali Yılmaz Erkek` diye gidiyordu — okul numarası ve cinsiyet adın
  içinde.

### Üç ayrı kusur çıktı

**1. Okuyucu boşlukları uyduruyordu.** `parcalariSatirlaraBol` parçaları
koşulsuz `' '` ile birleştiriyordu. O PDF'te `ş`, `ğ`, `İ` AYRI parça
olarak geliyor; sonuç:

```
"K ı z"                     ← "Kız"
"Beş ikta ş / Arnavutköy"   ← "Beşiktaş / Arnavutköy"
```

Yani öğrenci adları ortadan bölünüyordu. Artık boşluk, parçanın nerede
BİTTİĞİNE bakılarak konuyor (`x + width`), eşik de yazı boyunun oranı —
sabit bir punto eşiği küçük listede boşluk kaçırır, büyük başlıkta olmayan
boşluk uydururdu. `width` yoksa eski davranış sürüyor: bilgi olmadan
tahmin etmektense boşluk koymak güvenli, çünkü iki kelimeyi yapıştırmak
fazladan boşluktan kötüdür.

**Bu değişiklik ödev PDF yolunu da etkiliyor** — `kunye-denetimi` (33
ölçüm) ve `pdf-uyumluluk-denetimi` ile doğrulandı, gerileme yok.

**2. Ayrıştırıcı e-Okul listesini tanımıyordu.** Artık satır kalıbı
tanınıyor (`sıra no · okul no · ad soyad · cinsiyet`), mobilya satırları
sebebiyle eleniyor ve **adlarda rakam olamayacağı** kuralı tarih, sayfa
numarası ve belge kodunu süpürüyor.

**Elenen hiçbir satır sessizce yok olmuyor:** hepsi sebebiyle önizlemede
duruyor, kararı öğretmen veriyor.

**3. `/i` bayrağı Türkçe'yi bilmiyor.** İlk düzeltmeden sonra sayım 28'e
düştü — 27 olması gerekiyordu. Kalan tek hata `İSTANBUL VALİLİĞİ` idi:
`/Valiliği/i` bu satırla **eşleşmiyor**, çünkü JavaScript'in
ölçüt-duyarsız eşlemesi İ/ı çiftini tanımıyor. Kalıplar Türkçe küçük harfe
çevrilip karşılaştırılınca sayım **27 = 27** oldu.

### PDF artık doğrudan yükleniyor

`ogrenci-listesi.ts`'in başındaki not yıllardır şunu söylüyordu: *"PDF yolu
da buraya bağlanacak… ikinci bir ayrıştırıcı yazılmayacak."* Aynen öyle
yapıldı: PDF okunur, satırlar `\n` ile birleşir ve **yapıştırmayla aynı
yoldan** geçer.

Kopyala-yapıştır yolu duruyor ama artık tavsiye edilen yol değil: hangi
harfin nereye düşeceği okuyucudan okuyucuya değişiyor. Dosyayı biz
okuyunca o belirsizlik kalkıyor. PDF hiçbir yere gönderilmiyor — okuma
tamamen tarayıcıda.

### Denetimdeki sahte PDF neden Türkçe harf taşıyor

`toplu-ogrenci-denetimi` 8. grubu kendi e-Okul PDF'ini üretiyor —
**uydurma adlarla**, çünkü depo herkese açık ve buraya gerçek öğrenci adı
yazılmaz.

İlk yazımda satırlar ASCII'ye düşürülmüştü (`VALILIGI`) ve denetim yanlış
kırmızı yandı: kalıplar haklı olarak tutmadı, ama kusur üründe değil
ÖLÇÜMDEYDİ. **Türkçesiz bir liste, e-Okul listesi değildir.** Fonta
`/Differences` ile `gbreve`, `scedilla`, `dotlessi`, `Idotaccent`
tanıtıldı; artık fixture gerçeğe sadık.

Bir ölçüm hatası daha yapıldı ve kaydı burada duruyor: ilk sürüm sayfadaki
**bütün** listeleri tarıyordu ve "T.C. öğrenci sayılmamış" ölçümü kırmızı
yandı. Oysa elenen satırlar ekranda **bilerek** gösteriliyor. Ölçülmesi
gereken şey ekranda ne yazdığı değil, **sunucuya ne gideceği** — ölçüm
önizlemedeki ad satırlarına daraltıldı.

**Geri alma kanıtı alındı:** mobilya elemesi kapatılınca 8. grup 6 ölçümle
kırmızı yanıyor (3 yerine 8 "öğrenci"); okuyucu eski hâline döndürülünce
`pdf-metin.test.ts`'te 3 test düşüyor.

## Öğrenci numarası (0042)

Öğretmen, PDF'ten sınıf aktarırken sordu: *"PDF'den öğrencilerin
numaralarını almıyor… Onu ekletebilir miyiz?"*

Bir önceki tur numarayı **bilerek atıyordu** — şemada duracağı alan yoktu
ve adın içinde kalması kusurdu (`601 Ali Yılmaz Erkek`). Artık kendi alanı
var.

**Öğretmenin iki kararı:** numara yalnız öğrenci listelerinde görünsün;
aynı numara tekrar ederse uyarılsın ama **engellenmesin**.

### Neden null olabilir, neden metin, neden unique değil

**Null olabilir**, çünkü özel ders öğrencisinin okul numarası yoktur;
zorunlu yapmak onları kayıt dışı bırakırdı. Ekranda numarası olmayanda
"—" bile yazılmıyor: numarasızlık bir eksiklik değil, olağan durum.

**Metin, sayı değil**: okul numaraları başında sıfır taşıyabiliyor
("0601") ve sayıya çevirmek onu sessizce "601" yapardı. Numara bir
kimlik, bir miktar değil — üzerinde aritmetik yapmıyoruz.

**İndeks var, UNIQUE yok**: öğretmenin kararı gereği. Unique olsaydı,
PDF'ten yanlış okunan tek bir numara 30 kişilik sınıfın tamamının
reddedilmesine yol açardı ve hangi satır yüzünden olduğu ekrandan
anlaşılmazdı.

### 0007 tuzağı: birinde kaçınıldı, ötekinde göze alındı

`ogrenciler_toplu_ekle`'de **imza hiç değişmedi.** `p_adlar` zaten `jsonb`
olduğu için hem eski biçimi (dizgi dizisi) hem yeni biçimi (`{ad, no}`)
kabul ediyor; ayrım `_toplu_ad`/`_toplu_no` yardımcılarında **tek yerde**
yapılıyor (denetleme ve yazma geçişleri ayrışmasın diye). Ortada
düşürülecek bir imza kalmadı, eski çağrı biçimi de çalışmayı sürdürüyor —
ve bu test ediliyor.

`ogrenci_ekle`'de tuzak **gerçek**: varsayılanlı bir parametre eklemek yeni
bir fonksiyon yaratıyor, eskisi ortada kalıyor ve PostgREST çağrıyı ona
yönlendirebiliyor — o da numarayı hiç yazmıyor, yani sessiz veri kaybı.
Eski 4 parametreli imza açıkça düşürüldü; hem migration'ın kendi
doğrulaması hem 12. test grubu `ogrenci_ekle`'nin **tek imza** olduğunu
sınıyor.

### Gövdeyi hatırdan yazmak kural değiştirir

`ogrenci_ekle`'nin gövdesi ilk yazımda baştan yazılmıştı ve **üç davranış
sessizce kayboluyordu**: sahiplik kapısı `_yonetici`den `_ogretmen`e
düşmüştü (yani her öğretmen öğrenci ekleyebilecekti), özel ders
öğrencisinin sınıfını kendiliğinden seçen blok gitmişti, dönüş alanları
değişmişti. Gerçek tanımla karşılaştırılınca görüldü; gövde kopyalandı,
eklenen tek şey numara oldu.

Aynı sebeple `sinif_ogrencileri` ve `ogrenciler_listesi` gövdeleri **elle
değil betikle** kopyalandı ve içlerine tek satır eklendi.

### Defterin ilk sınavı

0041'de konan kural bu turda işledi: `migration-listesi.test.ts`, 0042
kendini deftere yazmadan geçmiyor. Kanıtlandı — kayıt satırı silinince
test *"0042_ogrenci_numarasi.sql deftere kendini kaydetmiyor — sonuna
`select public._migration_kaydet('0042');` ekleyin"* diye kırmızı yandı.

Defter testinin kendisi de bu turda düzeldi: *"41 satır"* diye
sabitlenmişti ve 0042 eklenir eklenmez kırmızı yandı — oysa defter doğru
çalışıyordu, **kırılgan olan ölçümdü**. Her yeni migration'da elle
düzeltilmesi gereken bir test gürültü üretir ve bir gün gerçek bir kusuru
da gürültü sanarsınız. Artık sayı türetiliyor: geriye dönük kısım hep
0001–0040, ondan sonrası tek tek kesin.

### Bu turda üç ölçüm hatası yapıldı

Hepsi kayıtlı, çünkü hepsi aynı aileden — **ölçüm, ölçtüğü şey değişince
kendisi de değişmek zorunda**:

1. SQL testleri yanlış `do` bloğuna eklendi (`v is not a known variable`);
   kendi bloğuna alındı.
2. Tarayıcı denetiminde ad `<p>`'si artık numara rozetini de içeriyordu,
   bu yüzden "adda rakam yok" ölçümü kırmızı yandı. Rozet çıkarılarak
   okunuyor — ölçülmek istenen şey **kaydedilecek ad**.
3. Sunucuya giden gövde `p.route` ile yakalanmaya çalışıldı, oysa bu
   denetim `fetch`i sayfanın içinde taklit ediyor ve istek ağa hiç
   çıkmıyor; kayıt sayfanın kendisinden okunuyor. Ayrıca sınıf seçimi
   atlanmıştı ve `ekle()` erken dönüyordu.

Sahte sunucunun kendisi de düzeltildi: `ad` alanını aynen yansıtıyordu ve
nesne gelince sonuç tablosu boş çıkıyordu. **Taklit gerçeğe sadık
olmalı** — gerçek sunucu da tam bu ayrımı yapıyor.

### Yedek

`disa_aktar` `to_jsonb(o)` kullandığı için yeni sütun kendiliğinden
taşınıyor. Kendiliğinden olması güvence değil: felaket provasının tohumuna
numara eklendi (önceden numarasız kuruluyordu, yani prova numara düşse de
yeşil kalırdı) ve yedek JSON'unda numaranın gerçekten durduğu ayrıca
görüldü.

### Bilerek kapsam dışı

**Kaydedilmiş bir öğrencinin numarası — ya da adı — sonradan
düzeltilemiyor.** Depoda düzenleme ucu hiç yok (`ogrenci_ekle`,
`ogrenci_pasiflestir` var; `ogrenci_guncelle` yok). İçe aktarmada bu
kapanıyor: öğretmen onaylamadan önce metin kutusunu elle düzenleyebiliyor.
Kaydettikten sonrası için ayrı bir tur gerekiyor; öğretmene söylendi.

## Çok şubeli e-Okul dosyası (0042 turunun devamı — yalnız arayüz)

Öğretmen numaraların gelip gelmediğini sorunca ölçüm yapıldı ve **başka
bir şey ortaya çıktı**: gönderdiği tek PDF, üç şube taşıyordu.

```
sayfa 1: 27 öğrenci · 9. Sınıf / A Şubesi
sayfa 2: 30 öğrenci · 9. Sınıf / B Şubesi
sayfa 3: 30 öğrenci · 9. Sınıf / C Şubesi
```

Şubeler okunmasaydı **87 öğrencinin hepsi seçilen tek sınıfa** eklenirdi.
Ekranda 87 satır görüleceği için fark edilebilirdi, ama fark edilmeden
onaylanırsa üç sınıf tek sınıfta toplanırdı.

**İlk ölçüm yanıltıcıydı ve bu da bir ders.** Önceki turda PDF'in yalnız
BİRİNCİ sayfası okunmuştu; "27 öğrenci, hepsi doğru" sonucu tek sayfa için
doğru, dosya için eksikti. Bir ölçümün kapsamı, ölçtüğü şeyin tamamını
kapsamıyorsa yanlış güven verir.

### Tekrar denetimi artık şube başına

Şubeler arasında numaralar çakışıyor (9A'da da 9B'de de 617 var). Genel
bir küme kullanılsaydı üç şubelik dosya baştan aşağı yanlış "numara
tekrarı" uyarısı verir ve **gerçek çakışmalar o gürültünün içinde
kaybolurdu**. Anahtarın başına şube kondu; gerçek PDF'te yanlış uyarı
sayısı **sıfır**.

"Sınıfta zaten kayıtlı" denetimi de şube başına: her şubenin kendi öğrenci
listesi ayrı çekiliyor. Seçili tek sınıfın listesine bakmak, 9B'de kayıtlı
bir numarayı 9A satırı için "kayıtlı" saymak olurdu.

### Eksik sınıf: uyar, oluşturmayı teklif et, ama YAZMA

Dosyadaki bir şube depoda yoksa ekleme **hiç yapılmıyor** — yarım bir
aktarım (9A yazıldı, 9C yazılmadı) öğretmeni en kötü yerde bırakırdı.
Eksik şube adıyla söyleniyor ve yanında "9C oluştur" düğmesi var
(`sinif_ekle` idempotent ve sınıfı sahibe atıyor).

### Üç çağrı atomik değil ve bu söyleniyor

Sunucu tek çağrıda tek sınıfa yazıyor; üç şube üç çağrı demek. İkincisi
düşerse birincisi yazılmış kalır. Hata mesajı **hangi şubelerin
yazıldığını adıyla** söylüyor — "bir şeyler oldu" demek, öğretmeni
veritabanını elle kurcalamaya iter.

Bunu tek çağrıda atomik yapmak yeni bir migration gerektirirdi; öğretmenin
elinde zaten çalıştırılmayı bekleyen bir SQL varken ikincisini eklemek
yerine, sınırı açıkça söylemek seçildi.

### Denetimdeki sahte PDF neden iki şubeli

Tek şubelik bir fixture bu kusurların hiçbirini göremezdi. Sahte dosya
artık 9A ve **depoda olmayan** 9C taşıyor; 601 numarası iki şubede birden
geçiyor. Ölçülenler: şube sayısı bildiriliyor, eksik şube uyarılıyor ve
oluşturulabiliyor, **eksik şube varken hiç yazma yapılmıyor**, oluşturma
sonrası her şube KENDİ sınıfına ayrı çağrıyla gidiyor.

**Geri alma kanıtı:** tekrar kapsamından şube çıkarılınca denetim
*"numara tekrarı uyarısı yalnız aynı şubede (2)"* diye kırmızı yanıyor.

Bir ölçüm hatası daha kayda geçti: önizlemedeki ad `<p>`'si artık şube
rozetini de taşıyor ve o rozet rakam içeriyor; yalnız `sk-sayi` rozetleri
çıkarıldığında "adda rakam yok" ölçümü haksız yere kırmızı yandı. Tüm
rozetler çıkarılıyor — ölçülmek istenen şey **kaydedilecek ad**.

## Toplu eklemede eşleştirme (0043)

Öğretmen sınıfları önce **numarasız** eklemişti. 0042 yayına girince aynı
e-Okul listelerini numaralarla yeniden yükledi ve **her sınıf iki katına
çıktı**: aynı çocuk hem numarasız hem numaralı kayıtla duruyor.

**Bunu ürün yaptı, öğretmen değil.** Önizleme "Sınıfta kayıtlı" diye
uyarıyordu, ama uyarı kaydetmeyi engellemiyordu ve *"bu zaten var,
numarasını yaz"* diyen bir yol **hiç yoktu**. Eksik olan tasarımdı; uyarı
vermek, yol göstermenin yerine geçmez.

### Sunucu: üç sonuçlu eşleştirme

`ogrenciler_toplu_ekle` beşinci bir parametre aldı:
`p_mevcutlari_guncelle boolean default false`. Açıkken, gelen her
`{ad, no}` için o sınıfta aktif ve aynı adlı öğrenci aranıyor:

| durum | yapılan | dönen `durum` |
| --- | --- | --- |
| hiç yok | yeni kayıt + iki yeni kod | `eklendi` |
| tam bir tane, numara farklı | numara yazılır, **yeni kayıt yok, yeni kod yok** | `guncellendi` |
| tam bir tane, numara aynı ya da yok | hiçbir şey | `degismedi` |
| birden fazla | **hata**, adı söyleyerek; hiçbir şey yazılmaz | — |

Son satır bilerek katı: belirsizken tahmin etmek, **yanlış çocuğun**
kaydını değiştirmek demek. Hata mesajı adı taşıyor ki öğretmen hangi
satıra bakacağını bilsin.

**Kod yenilenmiyor.** Eşleşen öğrencinin kodu zaten var ve büyük
olasılıkla dağıtıldı; yenilemek elindeki kâğıdı sessizce geçersiz kılardı
ve bu, ancak biri giriş yapmayı deneyince anlaşılırdı. Dönen satırda
**mevcut** kodlar var, öğretmen tek listeden okuyabilsin diye.

**Aynı çağrıda dokunulan kayıtlar eşleştirmenin dışında.** Yoksa listede
aynı ad iki kez geçtiğinde ikinci satır, az önce eklenen birinciyi
"mevcut öğrenci" sanıp onun numarasını ezerdi: iki adaştan biri kayıt dışı
kalırdı. Gerçek adaşlar bir sınıfta olur.

**Bayrak varsayılan olarak kapalı**, ve bu ölçülüyor: geride kalmış bir
arayüz sürümü sessizce kayıt güncellemeye başlamasın.

### Ad anahtarı — `_ad_anahtari(text)`

e-Okul adları BÜYÜK HARFLE veriyor, aradaki boşluk bir ya da iki olabiliyor.
`translate(btrim(ad), 'İIĞÜŞÖÇ', 'iığüşöç')` → `lower()` → boşluk
sadeleştirme. Türkçe harfler **elle** çevriliyor: `lower()` veritabanının
diline bağlı ve "İ"yi bozabiliyor; `lower(x, 'tr')` diye bir şey de yok.

Temizlik panel dosyaları (`panel-icin/kopya-ogrenci-*.sql`) bu yardımcıyı
çağırmıyor, aynı ifadeyi kendi içlerinde taşıyor — bilerek: o dosyalar bu
migration çalışmadan önce de çalışabilmeli. İki kopya da ayrı ayrı
ölçülüyor.

### 0007 tuzağı — bu sefer gerçek

Varsayılanlı parametre yeni bir fonksiyon yaratıyor; eski dört parametreli
imza kalsaydı PostgREST bayraksız çağrıyı ona yönlendirebilir ve
**eşleştirme hiç çalışmazdı**: öğretmen seçeneği işaretler, kopyalar yine
üretilirdi. Eski imza açıkça düşürülüyor.

**Bu turda ölü bir ölçüm bulundu.** 0042'nin kendi doğrulaması eski imzayı
`pg_get_function_identity_arguments(p.oid) = 'text, text, uuid'` diye
arıyordu; oysa o fonksiyon **parametre adlarını da** döndürüyor
(`p_token text, …`), yani karşılaştırma hiçbir zaman tutmuyordu —
**asla kalamayan bir ölçüm**. Orada gerçek koruma yanındaki "tek imza
değil" satırıydı ve o ısırıyor, dolayısıyla canlıdaki güvence bozulmadı.
0042 çalıştırılmış bir migration olduğu için dosyasına dokunulmadı; 0043
tür listesini `oidvectortypes(p.proargtypes)` ile okuyor ve **iki kontrol
de** geri alınarak ısırdıkları gösterildi.

İkinci bir ders aynı bloktan çıktı: "bayrak varsayılanı" kontrolü tek satır
döndüren bir alt sorguydu ve eski imza ayakta kaldığında iki satır dönüp
`more than one row returned by a subquery` hatası veriyordu — kapı
kırılıyordu ama **yanlış cümleyle**, asıl kusuru söyleyen satıra hiç sıra
gelmeden. Bir kapı, tam da işe yarayacağı anda anlaşılmaz konuşmamalı;
`exists` ile yeniden yazıldı.

### Arayüz: karar kaydetmeden önce

Önizlemede artık bir karar kartı var: *"N öğrenci sınıfta zaten kayıtlı,
M tanesi yeni"* ve iki seçenek — **numarasını güncelle** (eşleşen varsa
varsayılan) ya da **yeni öğrenci olarak ekle**. Satır etiketi de sonucu
yazıyor: "Numarası güncellenecek" / "İkinci kayıt açılacak". Gönder
düğmesi bile kararı taşıyor: `5 ekle, 1 güncelle`.

Varsayılanın "güncelle" olmasının sebebi basit: **kopya üretmek, numara
yazmaktan çok daha pahalı bir hata** — geri alması elle silmek demek.

**Önizleme sayısı `mukerrer` alanından okunamaz.** O alan tek bir değer
taşıyor: aynı ad hem yapıştırmanın içinde tekrar ediyorsa hem de sınıfta
kayıtlıysa `'liste'` yazıyor ve kayıtlı olduğu bilgisi kayboluyor. Bu
yüzden `AdSatiri`ye ondan bağımsız bir `kayitli: boolean` eklendi; ölçüm
geri alındığında önizleme "1 eşleşti" derken sunucu iki satırı da
eşleştiriyordu.

### Panel sürümü artık üretiliyor

`panel-icin/NNNN_*_kisa.sql` dosyaları elle kısaltılıyordu. Öğretmenin
veritabanında çalışan şey o dosya; depoda sınanan şey `migrations/`
altındaki. Ayrışırlarsa bütün SQL testleri **çalışmayan** bir kodu ölçer.
0043'ten itibaren panel sürümü migration'ın gövdesini birebir taşıyor ve
bunu `migration-listesi.test.ts` kilitliyor (0042 ve öncesi kapsam dışı:
çalıştırılmış migration'a dokunulmuyor).

## Kendi alan adı — `sekizkyal.com` (yeni SQL yok)

Öğretmen 17 Eylül gecesi alan adını aldı (Spaceship, **18 Eyl 2027**'de
bitiyor), DNS'i kurdu ve GitHub Pages'te özel alan adını ayarladı. Bu
tur yeni bir yetenek eklemiyor; **çalışan şeyi kırılmaz hâle getiriyor.**

### Ne nerede duruyor

| Katman | Değer |
| --- | --- |
| `sekizkyal.com` A kayıtları | `185.199.108–111.153` (GitHub Pages) |
| `www` CNAME | `buketmathlab.github.io` |
| Depodaki `CNAME` dosyası | tek satır: `sekizkyal.com` |
| Uygulama | değişmedi — hâlâ `/yeni/` altında |

Uygulama **köke taşınmadı** ve bu bilerek: kökteki yönlendirme sayfası
`sekizkyal.com` yazan herkesi zaten `/yeni/`'ye düşürüyor, yani `/yeni/`
kimsenin elle yazdığı bir şey değil. Taşımak derleme tabanını, bütün
varlık yollarını ve PWA künyesini değiştirmek olurdu — dönem ortasında,
720 öğrencinin sitesinde, karşılığı olmayan bir risk.

`manifest.webmanifest` de bu yüzden hiç değişmedi: yolları köke göreli
(`/yeni/…`), yani alan adından bağımsız. Değiştirilmemesi bir ihmal
değil, ölçülmüş bir karar.

### `CNAME` — bu turun asıl sebebi

GitHub, özel alan adı ayarlanırken `CNAME` dosyasını **`main` dalına
kendi eliyle yazdı** (`ebe19de`). Geliştirme dalında yoktu. Yani bir
sonraki yayında dal `main`'e itilirken dosya sessizce düşebilirdi ve
**alan adı aynı anda çalışmayı bırakırdı** — site 404, kimse giremez,
hiçbir ekran testi kırmızı yanmaz. Kusur ancak "giremiyoruz" diye haber
gelince anlaşılırdı.

`kok-denetimi.mjs` artık iki şeyi birden ölçüyor: dosya **duruyor mu**
ve **içi doğru mu**. İkincisi olmadan ilki yetmez — dosya yerinde ama
içinde başka bir ad yazıyorsa alan adı yine ölür. GitHub tek satır
bekliyor; ikinci satır da aynı sonucu verir. Üç kusur yerleştirildi,
üçü de yakalandı: dosya silindi · ad değiştirildi · ikinci satır eklendi.

### Eski adres ölmedi — ölçüldü

`buketmathlab.github.io/yeni/` artık **301 ile** `sekizkyal.com/yeni/`'ye
gidiyor ve yolu koruyor (`/yeni/tanitim/`, `/assets/…js` dâhil). Yani
dağıtılmış fişlerdeki eski adres çalışmaya devam ediyor; kâğıtları
toplamak gerekmedi. Bu varsayılmadı, 18 Eylül'de istek atılarak ölçüldü.

Bu yüzden `kok-denetimi.mjs`'deki "kendi adresimiz muaf" listesi **iki
ad** taşıyor. Eski adı çıkarmak, hâlâ meşru olan bir adresi üçüncü taraf
saymak olurdu.

### Fişteki adres: `sekizkyal.com`

`kod-fisi.ts`'deki `ADRES` artık `/yeni/` kuyruğunu taşımıyor. Sebep
kâğıdın kendisinde: o satırı bir çocuk telefonda **elle** yazıyor. Altı
karakter fazla yazdırmanın ve eğik çizgiyi yanlış koyan çocuğu
kaybetmenin karşılığı yok; yönlendirme zaten üç katmanlı ve JavaScript
kapalıyken bile ölçülü.

### Yenileme — ürünün en ucuz tek arıza noktası

Alan adı **18 Eylül 2027**'de bitiyor. Yenilenmezse adres ölür ve bir
süre sonra **başkası alabilir**; o gün bütün fişler ve bağlantılar
yabancı bir siteye gider.

**Tarih düzeltmesi:** önce "17 Eylül" yazılmıştı. Kayıt kuruluşunda saat
`17 Eyl 21:00 UTC`, Türkiye saatiyle bu **18 Eylül 00:00** ediyor.
İkisi de doğru ama öğretmenin Spaceship panelinde gördüğü ve nöbetçinin
e-postasında yazacak tarih **18 Eylül** — iki ayrı yerde iki ayrı gün
görünmesi, "hangisi doğru" diye bakmayı gerektirirdi.

## Fişte telefona kurulum yönergesi (yeni SQL yok)

Öğretmen istedi: *"öğrencilerin ve velilerin telefonlarına uygulama
olarak 8'i nasıl indirebilecekleri bilgisi de yazmalı kod fişlerinde.
Hem veli kod fişinde hem öğrenci kod fişinde."*

### Önce vaadin gerçek olduğu ölçüldü

Kâğıda basılan her cümle bir söz ve 720 aileye gidiyor. "Uygulama gibi
ekleyin" demeden önce dördü de yerinde mi diye bakıldı:
`apple-touch-icon` (iOS manifest simgelerini kullanmaz, ayrı etiket
ister), `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` ve
manifest'te `display: standalone`. Hepsi vardı — yani ana ekrana eklenen
SEKİZ gerçekten kendi simgesiyle, tarayıcı çubuğu olmadan açılıyor.
Olmasaydı bu tur kurulum yönergesiyle değil, o eksiklerle başlardı.

### İki satır, çünkü iki ayrı yol

`iPhone: Safari'de aç → Paylaş → Ana Ekrana Ekle` ·
`Android: Chrome'da aç → menü → Ana ekrana ekle`. Tek bir "menüden
ekleyin" cümlesi, telefonunda o menüyü bulamayan veliyi yolda bırakırdı
— iPhone'da yol "Paylaş"ın içinden geçiyor ve orayı bilmeyen kimse
bulamaz.

### Tarayıcının adı yazıyor — ve bunu bir SAHA BULGUSU ekletti

Yönerge ilk yazıldığında yalnız `Paylaş → Ana Ekrana Ekle` diyordu ve
teknik olarak doğruydu. **Öğretmen kendi iPhone'unda deneyip yapamadı.**

Sebep üründe değildi: yayındaki `manifest.webmanifest` 200 dönüyor,
doğru MIME tipiyle sunuluyor, üç simge de yerinde ve `display`
`standalone`. Hepsi ölçüldü. Sebep şuydu — bağlantı bir uygulamanın
içinden açılmıştı ve **iOS'ta uygulama içi tarayıcıda "Ana Ekrana Ekle"
seçeneği HİÇ YOKTUR.** Safari'de açınca hemen oldu.

Buradan çıkan ders, yönergenin kendisinden büyük: **ürünü en iyi bilen
kişi takıldıysa veli hiç yapamaz.** Kâğıt basılmadan önce bir gerçek
telefonda denenmesi, on ölçümün göremediğini gösterdi.

Satır artık işin nerede yapılacağını söylüyor. Anlatılan şey tarayıcının
markası değil: *bunu bir uygulamanın içindeki pencerede değil,
tarayıcının kendisinde yapacaksınız.* `kod-fisi.test.ts` tarayıcı
adlarının geçtiğini ölçüyor — biri bir gün "fiş kalabalık olmuş" deyip
atarsa test yanıyor (kusur yerleştirilip gösterildi).

Menü simgesi (⋮) yazılmadı: yazı tipine göre kutu çıkabiliyor ve Samsung
Internet'te menü altta duruyor. Kelime her yerde doğru.

Muhatap kurulum satırında da ayrı: öğrenciye *"Telefonuna … ekle"*,
veliye *"Telefonunuza … ekleyin"*. Tek ortak cümle yazmak kolaydı ama
veliye "sen" demek olurdu.

### Kâğıt ölçümü — asıl bulgu

Fiş 50 mm ve A4'e 2 sütun × 5 satır giriyor. Yönerge eklenince ızgara
**267,2 mm** oldu; yazılabilir alan **277 mm**. Yani pay **9,8 mm**,
satır başına yaklaşık 2 mm.

Buradaki asıl ders şu: denetimdeki **"sayfa başına 10 fiş"** ölçümü
JavaScript sayfalamasını (`SAYFA_BASINA`) sayıyordu, kâğıdı değil.
Fişler büyüyüp beşinci satır A4'ten taşsa DOM'da yine 10 fiş olurdu ve
ölçüm yeşil kalırdı — öğretmen bunu ancak 72 sayfa bastıktan sonra
görürdü. Kanıt deneysel: kurulum cümlesi uzatıldığında ızgara 282 mm'ye
çıktı, **yeni ölçüm kırmızı yandı, eski "10 fiş" ölçümü yeşil kaldı.**

`kod-fisi-denetimi.mjs` artık iki ayrı kusur biçimini ölçüyor:

| Ölçüm | Hangi kusuru yakalıyor | Isırdığı gösterildi |
| --- | --- | --- |
| Izgara ≤ 277 mm | metin büyüyüp sayfa taşıyor | cümle uzatıldı → 282 mm |
| Hiçbir fiş kutusundan taşmıyor | kutu içeriğinden küçük, yazı kırpılıyor | `height: 40mm` → 12 fiş taştı |

İkisi farklı şeyler: birincisinde kutu büyüyor, ikincisinde yazı
kesiliyor. Biri ötekini yakalamıyor.

## Alan adı nöbetçisi (yeni SQL yok)

Öğretmen panelden iki şeyi doğruladı ve ikisi de yerinde: Spaceship'te
**otomatik yenileme açık**, ve kayıtlı kartın geçerliliği **yenilemeden
sonra** bitiyor. Yani bugün bir arıza yok.

Nöbetçinin sebebi bu değil — **bu korumaların ikisi de sessizce
bozulabilir.** Kart son kullanma tarihinden ÖNCE de değişir (kayıp, banka
yenilemesi); yenileme e-postası spam'e düşer; DNS kaydı değişir; `CNAME`
bir yayında düşer. Hiçbirinde uyarı gelmez; kusur "giremiyoruz" diye
haber gelince öğrenilir.

`.github/workflows/alan-adi-nobetci.yml` haftada bir çalışıyor, mantık
`.github/scripts/alan-adi-denetimi.sh` içinde. **İkisi de geçmeli:**

| Ölçüm | Kusur sayılan hâl |
| --- | --- |
| Bitişe kalan gün (RDAP) | 45 günden az |
| `sekizkyal.com/yeni/` | 200 değil, ya da sayfada `manifest.webmanifest` yok |
| `buketmathlab.github.io/yeni/` | 301 vermiyor (kâğıda basılı eski adres ölmüş) |

### Neden mantık `yml`'nin içinde değil

GitHub Actions yerelde çalıştırılamaz. Mantık iş akışına gömülseydi
ısırdığı **hiç gösterilemezdi** — bu depoda kanıtsız ölçüm kabul
edilmiyor. Betik hâlinde altı senaryo yerelde sınandı ve altısı da
ısırdı: süre eşiğin altında · süre öğrenilemiyor · adres yanlış · 200
dönüyor ama SEKİZ değil · `CNAME` boş · `CNAME` yok. Çıkış kodları ayrıca
doğrulandı; iş akışının gördüğü tek şey o.

### Üç karar ve gerekçeleri

**Alan adı `CNAME`'den okunuyor, betiğe yazılmıyor.** `uyanik-tut.yml`'nin
kuralının aynısı: *"İkinci bir kopya tutulsaydı biri değişince öbürü
sessizce eskirdi."* GitHub Pages özel alan adını zaten yalnız o dosyadan
okuyor; nöbetçinin ayrı bir kopyaya bakması, gerçekte izlenmeyen bir
adresi izliyormuş gibi görünmesi demekti.

**İmza olarak `<title>` kullanılmadı.** Başlık `app/index.html`'de
duruyor; depoda değişip site henüz yayınlanmamışken nöbetçi yanlış alarm
verirdi. `uyanik-tut.yml`'nin en pahalı dersi tam buydu — *"üç günde bir
yanlış alarm, ve öğretmen alarma güvenmeyi bırakırdı."*
`manifest.webmanifest` hem sabit hem ASCII.

**"Bakamadım" da bir kusurdur.** Süre iki kaynaktan soruluyor (registry
RDAP, sonra `rdap.org`); ikisi de yanıt vermezse iş **başarısız oluyor**
ve mesaj *"süre öğrenilemedi, elle bakın"* diyor. Sessizce başarılı
saymak, bir gün nöbet tutmayı bırakmış ama hâlâ yeşil yanan bir nöbetçi
demekti.

Ağ titremesi alarm olmasın diye her HTTP denetimi üç kez, artan
beklemeyle deneniyor.

### Neden `uyanik-tut.yml`'ye eklenmedi

İki alarm birbirini maskelememeli. Aynı işe konsalardı alan adı uyarısı
yanarken Supabase nöbetçisinin ne dediği görünmezdi — oysa ikisi bambaşka
arızalar ve ikisi de kendi başına acil. Temposu da farklı: Supabase 7
günde duraklıyor, alan adı yılda bir bitiyor.

### Dürüst sınırlar

- GitHub, **60 gün hareketsiz** depolarda zamanlanmış işleri durduruyor.
  Yaz tatilinde depo sessizleşirse nöbetçi de susar. Takvim
  hatırlatmasının yerine geçmez, yanına gelir.
- Otomatik yenilemenin açık olup olmadığını **göremez**; Spaceship bunu
  dışarıya açmıyor. Ölçtüğü şey sonuç: süre azalıyor mu.
- Kartın geçerliliğini de göremez. Kart ölürse bu ancak süre eşiğin
  altına inince anlaşılır — eşik o yüzden cömert (45 gün).

## Fiş metninin editoryal turu — ve sayfaya 8 fiş

Öğretmen fişleri cümle cümle eleştirdi: açıklamalar fazla basit, kurulum
tarifi "nereye dokunacağını" söylemiyor, imza yer kaplıyor. Kâğıt 720
aileye gidiyor ve bir kez basılıyor.

### Kâğıt kararı bir ölçümle alındı, tartışmayla değil

Tarifi ayrıntılandırmak istenince önce **ne kadar yerim olduğu** ölçüldü:

| Ölçüm | Değer |
| --- | --- |
| 9 px yazıda bir satıra sığan harf (86 mm iç genişlik) | 71 |
| Bir satırın maliyeti | 2,62 mm |
| O günkü sayfa payı | 9,8 mm → fiş başına 2,0 mm |
| **Eklenebilecek satır** | **0** |

İmzayı kaldırmak da yetmiyordu. Yani "biraz sıkıştırırız" diye
başlanamazdı; istenen şey kâğıt düzenini değiştirmeden **imkânsızdı**.
Öğretmene seçenekler bedelleriyle sunuldu ve **sayfaya 8 fiş** (2 × 4)
seçildi: bir takım fiş 72 yerine 90 sayfa.

Yeni ölçüm: ızgara **273,8 mm / 277 mm**, pay **3,2 mm**. Dar, ve tam bu
yüzden `kod-fisi-denetimi.mjs`'deki A4 ölçümü artık turun en değerli
güvencesi.

### Metinler sayılarak yazıldı

Cümleler kabuklardaki gerçek sekmelerden çıktı: öğrencide Pano ·
**Ödevler** · **Konularım** · **Mesajlar**, velide Pano · **Ödevler** ·
**Konular** · **Mesajlar**; teslim fotoğrafla.

**`Ödemeler` fişte hiç geçmiyor.** O sekme yalnız özel ders velisinde
var; yazsaydık yüzlerce okul velisine olmayan bir şey vaat ederdik.
Negatif bir test bunu kilitliyor.

### Düğmenin yeri yazıyor

Öğretmenin ikinci eksiği: *"Safari'de açtıktan sonra paylaş butonunu
nereden bulacak?"* Haklıydı — iPhone'da o düğme **ekranın alt ortasında**
ve simgesi tarif edilmeden bulunmuyor; Android'de menü **sağ üstte**.
Tarif artık ikisini de söylüyor. Android satırında iki menü etiketi de
var ("Ana ekrana ekle" / "Uygulamayı yükle"), çünkü Chrome koşullara
göre ikisinden birini gösteriyor.

### Vekil ölçüm, gerçek ölçüme yenildi

`fiş metni kısa kalıyor` testi satırları 60 harfle sınırlıyordu. O sayı
"kâğıda sığsın"ın **vekiliydi** — sığmayı doğrudan ölçen bir şey yokken
mantıklıydı. Artık A4 ölçümü var ve öğretmenin isteğiyle vekil, asıl
gereksinimle çelişti. Vekili zorlamak yerine sınır gevşetildi ve
gerekçesi teste yazıldı; kâğıdı koruyan şey artık harf sayısı değil,
milimetre.

### Yanlış çıkan bir sezgi — kayda geçiyor

"Dört adlı bir öğrencide ad satırı taşar, kâğıt patlar" diye düşünüp
denetime uzun bir ad koydum. **Ölçüm beni yanlışladı:** 54 harflik ad
bile alt satıra taşmıyor, ve ad yazısı 16 px'e çıkarılarak taklit edilen
gelecekteki bir değişiklikte kısa adlı eski fixture da **aynı** kusuru
veriyordu. Yani uzun ad hiçbir şey yakalamıyor. Fixture gerçekçi veri
olarak kaldı ama bir güvence olduğu iddiası **silindi** — süs olan ölçüm,
olmayan ölçümden daha tehlikelidir.

### İkinci editoryal tur — ad yazıyla, cümleler kısa

Öğretmen fişi tekrar okudu ve dört şey söyledi:

1. **Ürünün adı yazıyla da geçsin.** "8 işareti tek başına uygulamanın
   adını söylemiyor" — haklıydı. Üstte artık `8 SEKİZ`, altında
   `Matematik`. Kendi adı yok; onu bir önceki turda kaldırttı ve kararı
   değişmedi.
2. `gir` → **`giriş yap`**.
3. `Ödevlerini görür` → **`takip eder`**, ve cümleler kısalsın.
4. **Mesajlaşma hiç anılmasın:** *"o kısma hiç girme."*

Dördüncüsü bir ürün kararı: özellik duruyor, fişte anlatılmıyor. Fiş bir
tanıtım broşürü değil, giriş kâğıdı — her yeteneği saymak yerine ilk gün
ne yapılacağını söylüyor. Negatif bir test (`yazış`/`mesaj` geçmiyor)
kararı kilitliyor.

Marka bloğu **uydurulmadı**: depoda zaten `SekizWordmark` vardı. İki
küçük ekleme yapıldı — `bicim="ders"` (ad + yalnız branş; `'tam'`
öğretmenin adını da yazıyor, o istenmiyordu) ve kâğıt için `boyut="xs"`.
İşaret yeniden çizilmedi.

### A4 ölçümü bu turda gerçekten işe yaradı

Marka bloğu iki satır getirince denetim **-8,2 mm taşma** bildirdi. Yani
kusur kâğıda gitmeden, ekranda yakalandı. Yer üç adımda geri kazanıldı
ve hiçbirinde punto düşürülmedi:

| Değişiklik | Kazanç |
| --- | --- |
| Izgara boşluğu 4 → 3 mm | 3 mm |
| Fiş dikey iç boşluğu 3 → 2,5 mm | 4 mm |
| Kurulum ayırıcısı 1,5 → 1 mm | ~4 mm |

Son durum: ızgara **274,2 mm / 277 mm**, pay **2,8 mm**. Fişte en çok
okunması gereken şeyler — kod ve tarif — aynı büyüklükte kaldı; küçülen
şey boşluklar oldu.

### Üçüncü düzeltme: iPhone'da düğme üç nokta

Öğretmen tarifi bir kez daha okudu: *"ekranın alt ortasındaki paylaş
simgesi diyor — orada üç noktalı bir simge yok mu, ona dokununca Paylaş
çıkmıyor mu?"*

**Haklıydı; eskimiş bilgiyle yazmışım.** Apple'ın kendi belgesindeki
adım bugün şu: *"Tap the share button (three dots), then tap Share."*
Öğretmen kendi telefonunda **üç nokta → Paylaş → Ana Ekrana Ekle**
yolunu doğruladı. Fiş artık bunu yazıyor.

Bu, aynı dersin üçüncü tekrarı ve artık kurala dönüştü: **telefondaki
adımlar hafızadan yazılmaz.** Cihaz öğretmende; doğrulanacak yer orası.
İlk turda "Safari" eksikti, ikincide düğmenin yeri, üçüncüde düğmenin
kendisi yanlıştı — üçünü de ölçüm değil, gerçek bir telefon buldu.

**Bilinen sınır, gizlenmiyor:** Apple aynı sayfada *"sekme düzeni Altta
ya da Üstte ise paylaş simgesine dokunun"* diyor. Yani bazı ayarlarda
orada üç nokta yerine paylaş simgesi çıkıyor. Öğretmenin telefonundaki
yol esas alındı; öteki ayardaki veli aynı listeye bir adım eksik düşüyor
ve aradığını yine buluyor.

Menü simgesi **çizilmiyor, kelimesi yazılıyor**: `⋮` ve `⋯` gibi
karakterler yazı tipine göre boş kutu çıkıyor ve kâğıtta bunu düzeltmenin
yolu yok. Bir test bu kararın geri sızmasını engelliyor.

Ölçümde bir tuzak daha kapatıldı: "üç nokta" kelimesini tek başına aramak
yetmezdi — iki satırdan biri silinse öteki satırdaki eşleşme testi yeşil
tutardı. Ölçüm artık `Alttaki üç nokta` ve `Sağ üstteki üç nokta` diye
**iki yeri ayrı ayrı** arıyor; kusur yerleştirilerek gösterildi.

### Android satırı — doğrulanmadı ve bu yazılı duruyor

Öğretmen sordu: *"Android için tarifin doğru mu, güncel mi?"* İyi soru
çıktı — **değildi.** Google'ın bugünkü belgesi şunu diyor:

> "On the right of the address bar, tap **More** → **Install and create
> shortcut** → **Install**"

Yani menü öğesi artık "Ana ekrana ekle" değil, son düğme de "Ekle"
değil "Yükle". Fişte eski Chrome'un tarifi yazıyordu.

Satır iki etiketi birden veriyor (`"Ana ekrana ekle" ya da "Yükle"`),
çünkü Chrome sürümüne göre ikisinden biri çıkıyor. **Son düğmenin adı
bilerek yazılmıyor:** sürümden sürüme değişiyor ve cihazda doğrulanmadan
söylemek, dördüncü kez yanlış yazmak olurdu.

**Dürüst sınır:** iPhone satırını öğretmen kendi telefonunda denedi,
Android satırını kimse denemedi — elimizde Android cihaz yok. Öğretmen
"şimdilik belgeye göre güncelle" dedi ve bu not o kararın karşılığı.
Kâğıt basılmadan önce bir Android telefonda denenmeli; öğrencilerin çoğu
muhtemelen Android kullanıyor, yani bu satır iPhone'dan daha çok kişiyi
ilgilendiriyor.

**Açık soru, gizlenmiyor:** depoda service worker YOK (bilinçli karar,
`pwa-denetimi.mjs` her koşuda ölçüyor). Chrome'un tam "uygulama olarak
yükleme" akışı tarihsel olarak service worker istiyordu; onsuz Android
yalnız bir KISAYOL koyabilir — simge ana ekrana gelir ama tarayıcı
içinde açılır, iPhone'daki gibi tam uygulama hissi vermez. Chrome bu
şartı gevşetti ama hangi sürümden itibaren olduğu bizde ölçülmedi. Fiş
bu yüzden "uygulama olarak ekle" diyor ve **nasıl açılacağına dair bir
söz vermiyor**.

## Kodu yenile (0045)

Öğretmen sordu: *"Veliler, öğrenciler giriş kodlarını sonra kendileri
değiştirebiliyorlar mı?"* Cevap hayırdı — ve daha kötüsü, **öğretmen de
değiştiremiyordu.** `giris_kodlari` kişi başına tek satır tutuyor ve kod
yalnız öğrenci eklenirken bir kez üretiliyordu; sonrasında değiştiren
hiçbir yol yoktu.

Sorun tahmin değil **sızma**: kod 31 harflik alfabeden 8 karakter ve
0028'in kilidi kaba kuvveti zaten imkânsız kılıyor. Ama fişler öğrenci
eliyle dağıtılacak; bir öğrenci velisinin fişini açarsa o ailenin veli
kanalı (0025'in ayırdığı öğretmen↔veli yazışması, özel derste ödemeler)
**kalıcı olarak** açık kalıyordu.

### Neden "kendileri değiştirsin" değil

Öğretmene önce bu seçenek soruldu ve çekince kayda geçti: e-posta ya da
telefon yok, yani kurtarma yolu yok — kodunu değiştirip unutan veli
tamamen kilitlenir. Dahası, velinin kodunu ele geçiren öğrenci onu
değiştirip aileyi kilitleyebilirdi; **sızıntının zararını azaltmaz,
artırırdı.** Eksik olan şey "değiştirme" değil **iptal ve yeniden
verme**, ve o sorumlu yetişkinde olmalı.

Öğretmen yine de ikisini birden istedi: **önce bu tur (öğretmende
yenileme), sonra ayrı bir turda öğrenci/veli tarafı.** Sıra zorunlu —
kilitlenen veliyi ancak öğretmen kurtarabilir.

### Üç kritik karar

**Açık oturum da ölüyor.** Yalnız kodu değiştirmek, kapıyı kilitleyip
hırsızı içeride unutmaktır. `ogrenci_pasiflestir`'in (0033) zaten
kullandığı iptal yolu.

**Ama yalnız o rolün oturumu.** `oturumlar.rol` süzgeci şart: veli
kodunu yenilemek öğrenciyi sistemden atmamalı. Süzgeç unutulursa hiçbir
hata çıkmaz, ürün sessizce yanlış davranır.

**İz kaydına kod yazılmıyor.** `denetim_izi` yalnız rolü taşıyor. Kodu
yazmak, ölmüş şifrelerin kalıcı bir arşivini kurardı.

### Kapı neden `ogrenci_kodlari` ile aynı

`_ogretmen` + `_ogrenci_sahibi`. Kodu **görebilen** öğretmen onu zaten
sızdırabilir; yenilemeyi daha dar bir kapıya koymak güvenlik katmaz,
yalnız meslektaşı kendi öğrencisinde çaresiz bırakırdı.

### Dürüst sınırlar

- Yenileme **geçmişi geri almaz**: sızdıran kişi daha önce okuduğunu
  okumuş olur. Koruma ileriye dönüktür.
- Döngü, aile **yeni fişi eline alana kadar kapanmaz**. Ürün öğretmene
  yalnız düğmeyi verir; ekran bunu açıkça yazıyor.
- **Toplu yenileme yok** (dönem sonunda bütün sınıf gibi). Bilerek
  kapsam dışı.

## Fişte "telefonun kendi tarayıcısı" (yeni SQL yok)

Öğretmen Samsung telefonunda fişteki Android tarifini denedi ve **o menüde
öyle bir seçenek yoktu.** Kendi telefonunun "Browser" adlı tarayıcısında
ise vardı ve çalıştı. Sözü:

> "Samsung'da Google'dan ya da Chrome'dan değil, kendi internet
> tarayıcısından girmek gerekiyor. Mesela Apple'da Safari'den. Bu çok
> önemli bir detay."

### Kök sebep — dört yanlış tarifin ortak kökü

Fişteki kurulum yönergesi bu turdan önce **dört kez** düzeltildi
(Safari eksikti, düğmenin yeri eksikti, düğme yanlıştı, Android tamamen
yanlıştı). Dördünün de altında tek bir şey çıktı:

> **"Uygulama olarak ekle" seçeneği tarayıcıya özgüdür.**

- iOS'ta **uygulama içi tarayıcıda** (bir mesajdaki bağlantıya dokununca
  açılan pencere) seçenek hiç yok — Safari'de var.
- Android'de **Chrome'da** öğretmenin aradığı seçenek çıkmadı; telefonun
  **kendi tarayıcısında** çıktı.

Yani düzeltilmesi gereken şey menü adımları değil, **hangi uygulamayla
açılacağıydı.** Fişin ilk satırı artık bunu bir kural olarak yazıyor ve
Chrome ile Google uygulamasını **açıkça eliyor.**

### Neden marka marka tarayıcı adı yazılmıyor

Huawei, Xiaomi, Oppo… her birinde tarayıcının adı başka ve elimizde o
cihazlar yok. Kural yazılıyor, iki örnek veriliyor (iPhone'da Safari,
Samsung'da "Browser"), son satır da başka markalarda seçeneğin **nerede**
olduğunu söylüyor — ne olduğunu değil. Olmayan bilgiyi kâğıda basmak,
dört yanlış tariften sonra yapılacak en son şey olurdu.

### Cihazda doğrulanan ilk Android yolu

Öğretmenin ekran görüntüleri: üst çubuktaki **içinde aşağı ok olan kare**
simgesi → **"uygulama olarak ekle"** → çıkan pencere *"Bu web sayfası
Uygulamalar ekranına eklensin mi?"* → **Ekle**.

Önceki Android satırları Google'ın belgesinden ya da hafızadan yazılmıştı;
bu ilk kez **görüldü.** Son düğmenin adı bu yüzden artık yazılıyor —
önceki turlarda bilerek yazılmamıştı, çünkü değiştiğini biliyorduk ama
hangisi olduğunu bilmiyorduk. **Görülmeyen yazılmıyor, görülen yazılıyor.**

### Yönerge kısaldı — 6 satır yerine 5

Kâğıt payı **9,8 mm'den 14,8 mm'ye** çıktı (tarayıcıda ölçüldü). Sayfa
başına 8 fiş değişmedi.

### İki yeni ölçüm, ikisi de kusur yerleştirilerek ısırtıldı

**1. Chrome yalnız elenerek anılabilir.** `toContain('Chrome')` demek bu
turun tam tersini de geçirirdi: *"Android: Sayfayı Chrome ile aç"* cümlesi
de Chrome içeriyor. Ölçüm artık Chrome'un ya da Google'ın geçtiği **her
satırda** "değil" arıyor.

**2. Kurulum satırları kâğıdın enine sığıyor.** Sarılan bir satır ne taşma
üretiyor (kutu büyüyor) ne de A4 ölçümünü kırmızı yakıyor (pay 14,8 mm,
bir sarma 2,5 mm) — yani cümleyi uzatan kişi **hiçbir uyarı almıyordu.**
Denetim artık her fişte `<br>` sayısından beklenen satır sayısını çıkarıp
çizilen satır sayısıyla karşılaştırıyor. Kusur provası: bir satır uzatıldı,
A4 ölçümü **yeşil kaldı**, yeni ölçüm kırmızı yandı (6 yerine 7 satır).

### Ölü bir ölçüm yakalandı ve onarıldı

Samsung satırının son düğmesi ilk yazımda bütün metinde aranıyordu:
`toContain('“Ekle”')`. Kusur provası bunun **ölü** olduğunu gösterdi —
Samsung satırının son düğmesini silsem iPhone satırındaki `→ "Ekle"`
testi yeşil tutuyordu. Ölçüm artık Samsung satırını kendi başına süzüp
içinde iki etiketi birlikte arıyor.

### Bu tur yalnız fişte

Öğretmenin isteği fiş içindi. Giriş ekranına da açılır bir tarif koyan
önceki tur (`0e292ad`) beğenilmedi ve geri alındı; oraya bir daha
dokunulmadı.
