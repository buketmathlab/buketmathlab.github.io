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
iki kod.

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
