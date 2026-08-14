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

## Faz sırası

| Faz | Kapsam | Durum |
|---|---|---|
| 0 | Mimari + tasarım sistemi | **tamamlandı** |
| 1 | Veritabanı + güvenlik | sırada — RPC gövdeleri bekleniyor |
| 2–4 | Öğretmen, öğrenci, veli deneyimi | |
| 5 | Deterministik test puanlama | |
| 6 | Açık uçlu değerlendirmede AI desteği | |
| 7–8 | Analitik, iletişim, bildirimler | |
| 9 | Landing + Ewalu deneyimi | |
| 10–12 | PWA, güvenlik denetimi, son QA | |

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
