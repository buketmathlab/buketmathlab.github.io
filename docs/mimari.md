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
