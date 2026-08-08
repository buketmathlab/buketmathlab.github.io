# SEKİZ — Mimari

Bu belge Faz 0'ın çıktısıdır: teknoloji seçimleri, klasör düzeni, yayın yöntemi ve
altyapı kısıtlarına verilen mimari yanıtlar. Tasarım token'ları ayrı belgededir:
[TASARIM.md](./TASARIM.md).

---

## 1. Teknoloji

| Katman | Seçim | Gerekçe |
|---|---|---|
| Derleyici | Vite 8 | Hızlı derleme, küçük çıktı, tembel yükleme yerleşik |
| Arayüz | React 19 + TypeScript (strict) | Tip güvenliği; 200 öğrenciyle çalışan ekranlarda hata payı düşer |
| Stil | Tailwind CSS 4 | Token'lar CSS'te (`@theme`) tanımlanır, ayrı yapılandırma dosyası yok |
| Yönlendirme | React Router 7 | Temiz adresler (`/ogretmen/9a`), tembel yüklenen sayfalar |
| Veri | Supabase (Postgres + Storage) | Mevcut proje korunuyor; erişim yalnız RPC üzerinden |

**Tek dosyalık HTML yasağı uygulandı.** Her bileşen kendi dosyasında, tek işi olan
ve 250 satırı geçmeyen bir parçadır. Tek istisna tasarım sistemi vitrinidir
(`src/pages/TasarimSistemi.tsx`) — üretim ekranı değil, sistemin kataloğudur.

## 2. Klasör düzeni

```
src/
  pages/        Ekranlar (yönlendirme hedefleri); pages/ornek/ tasarım kanıtı ekranları
  components/
    marka/      Kimlik: mühür, wordmark, afiş wordmark, 8→∞, sekizgen, örgü
    ui/         Genel parçalar: düğme, kart, alan, rozet, iskelet, boş/hata hâli
    duzen/      Üst bar, sayfa iskeleti, mobil alt gezinme, kurulum uyarısı
    tanitim/    Tanıtım sayfasının anlatı bölümleri
    tasarim/    Yalnız tasarım sistemi vitrininde kullanılan parçalar
    ornek/      Örnek ekranların paylaştığı parçalar
  lib/          supabase istemcisi, ortam, oturum, gezinme modeli, Türkçe biçimlendirme
  hooks/        React kancaları (Faz 1'de dolacak)
  types/        Alan modeli tipleri
  styles/       yazitipleri · tokenlar · temel · ana (giriş noktası)
  assets/fonts/ Kendi sunucumuzdan verilen woff2 dosyaları
supabase/migrations/   SQL göçleri (Faz 1)
.github/workflows/     Yayın ve uyanık tutma iş akışları
arsiv/                 v1 kaynağı (referans; yayında değil)
```

## 3. Yayın yöntemi — GitHub Pages

**Seçilen yöntem: GitHub Actions kaynağı** (`.github/workflows/yayinla.yml`).

`main` dalına her push'ta: bağımlılıklar kurulur → tip denetimi + derleme → `dist/`
klasörü Pages'e yüklenir. Depoda derlenmiş dosya tutulmaz.

**Neden bu yöntem:** Alternatif olan "derleme çıktısını depoya commit'lemek" iki
kaynak arasında tutarsızlık üretir (birinde düzeltilen hata diğerinde kalır) ve her
yayında geçmişi şişirir. Actions yöntemi tek doğru kaynağı korur: kaynak kod.

**Tek seferlik ayar (öğretmenin yapacağı):**
GitHub → depo → **Settings** → **Pages** → **Build and deployment** → **Source** =
**GitHub Actions**.

Bu ayar yapılana kadar site eski `index.html` ile yayında kalır; ayar yapıldığı anda
yeni sürüme geçer. Geri dönmek gerekirse aynı menüden `Deploy from a branch`
seçilir — `arsiv/v1-index.html` dosyası kök dizine geri taşınarak eski sürüm
çalıştırılabilir.

**Tek sayfalık uygulama sorunu ve çözümü:** `/giris` gibi bir adres doğrudan
açıldığında Pages 404 döner. Derleme sonunda `index.html`'in bir kopyası `404.html`
olarak yazılır (`vite.config.ts` içindeki küçük eklenti); Pages bilinmeyen yolda bu
dosyayı sunar, uygulama açılır ve adres istemcide çözülür. Kullanıcı hiçbir hata
görmez.

**Alan adı:** Uygulama alan adı olmadan `https://buketmathlab.github.io` üzerinde
eksiksiz çalışır. `netlify.app`, `pages.dev`, `workers.dev` Türkiye'den erişim
engeline takıldığı için önerilmez; `github.io` erişilebilir.

## 4. Anahtar yönetimi

`.env` dosyası depoda **bilerek** tutulur. İçinde yalnız istemciye açık anahtarlar
vardır (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Bu anahtarların
tarayıcıda görünmesi normaldir — veriyi koruyan şey anahtar değil, veritabanındaki
RLS ve `SECURITY DEFINER` fonksiyonlardır (Faz 1).

**`service_role` ve `sb_secret_…` anahtarları bu depoya asla girmez.** Bunlar tüm
yetkiyi taşır; sızarsa 200 öğrencinin verisi açılır.

Supabase projesi değişirse depoyu düzenlemeye gerek yoktur: GitHub → Settings →
Secrets and variables → Actions → **Variables** altına `VITE_SUPABASE_URL` ve
`VITE_SUPABASE_PUBLISHABLE_KEY` eklenirse yayın iş akışı bunları kullanır.

## 5. Veri erişim kuralı

İstemci hiçbir tabloya doğrudan erişmez. Tüm okuma/yazma `src/lib/supabase.ts`
içindeki tek kapıdan (`cagir()`) geçer ve veritabanındaki `SECURITY DEFINER`
fonksiyonlara gider. Tablolarda RLS açıktır, politika yoktur ve `anon` rolünün
tablo yetkisi geri alınmıştır — yani tarayıcıdaki anahtarla hiçbir satır okunamaz.

Gerekçe: yetki mantığı istemcide durursa "cevap anahtarı gönderim yapılmadan
dönmez" gibi kurallar uygulanamaz — ağ trafiğini açan herkes anahtarı görür. Kural
sunucuda uygulanır.

**Resmî Supabase kütüphanesi kullanılmıyor.** `@supabase/supabase-js` pakete ~55 KB
(gzip) ekliyordu — toplamın %40'ı — ve bu mimaride yalnız `.rpc()` yüzeyi
kullanılıyor. Yerine 40 satırlık bir `fetch` sarmalayıcı yazıldı; PostgREST'in RPC
uç noktası zaten sıradan bir POST isteğidir. Ana paket 132 KB'dan 79 KB'a indi.

**Oturum modeli.** Supabase Auth kullanılmıyor; kimlik doğrulama kod ve PIN ile
yapılıyor. Giriş başarılı olunca rastgele bir jeton üretilir, veritabanında yalnız
SHA-256 özeti saklanır. Öğretmen oturumu 12 saat, öğrenci/veli oturumu 30 gün
yaşar. Kod yenilendiğinde o koda ait açık oturumlar da düşer.

**Giriş fonksiyonları hata fırlatmaz, sonuç nesnesi döndürür.** Postgres'te
`RAISE EXCEPTION` çağrının tamamını geri alır; hata fırlatan bir giriş
fonksiyonunda "başarısız deneme" kaydı da silinir ve oran sınırlama hiç çalışmaz.
Bu, güvenlik denemelerinde yakalanan gerçek bir hataydı (bkz. GUVENLIK.md, madde 4).

## 5B. Güvenlik denemeleri

`npm run guvenlik` komutu, `supabase/migrations/` altındaki göçlerin tamamını gerçek
bir Postgres örneğine (PGlite/WASM) kurar ve 13 saldırı senaryosunu çalıştırır:
yetki sızıntısı, cevap anahtarının erken alınması, kaba kuvvet, SQL enjeksiyonu,
çift gönderim, geç teslim, okul öğrencisine ödeme kaydı… Ayrı bir test şeması yoktur;
üretime gidecek SQL'in aynısı sınanır.

Bu paket yayın iş akışının parçasıdır: denemeler kırmızıysa site yayınlanmaz.
Sonuç raporu: [GUVENLIK.md](./GUVENLIK.md).

## 6. Ücretsiz katman kısıtlarına mimari yanıtlar

Supabase ücretsiz katman: 500 MB veritabanı · 1 GB dosya deposu · 5 GB egress ·
otomatik yedek yok · 7 gün istek almazsa proje duraklar.

| Kısıt | Mimari yanıt | Durum |
|---|---|---|
| 7 günde duraklama | `.github/workflows/uyanik-tut.yml` — 3 günde bir REST uç noktasına istek | ✅ Faz 0'da kuruldu |
| 1 GB depo (ihtiyaç ~3,6 GB) | İstemcide agresif sıkıştırma (uzun kenar 1000–1200 px, JPEG %65–70, hedef ≤120 KB), yükleme başına boyut sınırı, dönem sonu arşivleme, panoda kullanım göstergesi | Faz 2–3 |
| 5 GB egress | Panoda küçük önizleme; tam boy yalnız tıklanınca | Faz 2 |
| Yedek yok | Haftalık otomatik dışa aktarma iş akışı + "Şimdi yedek al" düğmesi | Faz 1 (şema kurulduktan sonra) |

**Not:** Yedekleme iş akışı bilerek Faz 1'e bırakıldı — dışa aktarılacak tablo
henüz yoktur, şimdi kurulsa her hafta hata verirdi.

**Bölge:** Proje Europe (Zurich) / eu-central-2. İsviçre, AB tarafından "yeterli
koruma sağlayan ülke" olarak tanınır ve Türkiye'den gecikme ~45 ms'dir. İsviçre AB
üyesi **değildir**; veli onam metninde konum "İsviçre" olarak yazılacak, "Avrupa
Birliği" denmeyecektir.

## 7. Performans bütçesi

Hedef: 3G'de ilk açılış 3 saniyenin altında, ana paket 200 KB (gzip) altında.

Faz 0 ölçümü:

| Dosya | Ham | Gzip |
|---|---|---|
| Ana paket (JS) | 255 KB | **81,7 KB** |
| Stil (CSS) | 30,0 KB | 6,7 KB |
| Tasarım sistemi sayfası (tembel) | 16,3 KB | 5,4 KB |
| Örnek ekranlar (tembel, dördü) | 10,1 KB | 4,0 KB |
| Yazı tipleri (4 dosya, woff2) | 100 KB | — |

Yazı tipleri kendi sunucumuzdan verilir (Google Fonts'a bağlanılmaz): üçüncü taraf
isteği yok, çevrimdışı çalışır, gecikme düşer. Yalnız `latin` ve `latin-ext` alt
kümeleri taşınır; `latin-ext` Türkçe için zorunludur (ğ, ş, İ). Sanat yönetimi
yenilenirken yazı tipi ailesi de değişti (Fraunces + Inter → Instrument Serif +
Archivo) ve toplam yük 203 KB'dan 100 KB'a indi.

Grafik kütüphanesi (`recharts`) ve PDF görüntüleyici (`pdf.js`) geldiklerinde tembel
yüklenecektir — ana pakete girmeyecekler.

## 8. Teslim kuralı — geç teslim yoktur

Ödev son tarihinde kapanır. Süre dolduktan sonra gönderim **sunucu tarafında
reddedilir**; öğrenci ödevi yapmamış sayılır. Ara durum (geç teslim, kırıntılı puan)
yoktur.

Bunun mimariye üç yansıması var:

1. `odevler` tablosunda geç teslim politikası alanı **yok**; `gonderimler` tablosunda
   `gec_mi` alanı **yok**. Şema sadeleşir.
2. Kural istemcide değil, gönderim fonksiyonunun içinde uygulanır (Faz 1): son tarih
   geçmişse fonksiyon hata döndürür. İstemcide düğmeyi gizlemek yeterli değildir —
   ağ isteğini elle gönderen biri kuralı aşmamalıdır.
3. Uyarı akışı teslimden **önceye** taşınır: son gün yaklaşırken öğrenciye ve veliye
   bildirim gider. Süre dolduktan sonra gönderilen bildirim "yapılmadı" bildirimidir.

## 9. Sırada ne var

Faz 1: veri modeli ve güvenlik temeli. `siniflar` tablosu, `odevler` için ayrı
`soru_pdf_url` / `anahtar_pdf_url` alanları, RLS + `SECURITY DEFINER` fonksiyonlar,
`pgcrypto` ile PIN hash'leme, oran sınırlama, imzalı ve süreli dosya adresleri,
son tarih sonrası gönderimi reddeden kontrol.
