# SEKİZ — Sanat yönetimi

Token'ların tek kaynağı `src/styles/tokenlar.css`. Bu belge o dosyanın
gerekçesidir. Çalışan hâli **`/tasarim`** adresindedir; ekran yazarken oraya bakılır.

---

## 1. Marka

Markanın üç katmanı vardır ve üçü ayrı işler yapar:

| | Nedir | Nerede |
|---|---|---|
| **8** | Sembol | Uygulama simgesi, üst bar, bekleme anı, boş ekran |
| **SEKİZ** | Kimlik | Wordmark; açılış ekranı, giriş, rapor başlığı |
| **∞** | Fikir | Hiçbir yerde çizilmez — 8 dönünce ortaya çıkar |

**∞ hiçbir zaman ayrı bir işaret olarak kullanılmaz.** Sonsuzluk anlatılmaz,
gösterilir: iki halka üst üste sekizi kurar, 90° dönünce yan yana gelip sonsuz
olur. Şekil hiç değişmez, yalnız bakış açısı değişir. Uygulamanın tek süsleyici
hareketi budur.

**Wordmark ölçüyle dizilir.** Açılış ekranında "SEKİZ" kabını tam doldurur:
kelime SVG içinde çizilir ve `textLength` ile kabın genişliğine oturtulur
(`lengthAdjust="spacing"` — harf biçimleri bozulmaz, yalnız harf arası açılır).
Punto tahminle değil ölçümle seçildi: Instrument Serif'te "SEKİZ" 100 puntoda
202,6 birim; 43,9 punto doğal genişliği 89 birime getirir, kalan %12 harf arasına
dağılır. Sonuç: 360px telefonda da 1600px ekranda da wordmark ızgaraya milimetrik
oturur.

**Noktalı İ korunur.** Wordmark'ta İ'nin noktası markanın en ayırt edici
ayrıntısıdır — Türkçe bir marka olduğunu ilk bakışta söyler. Afiş ölçeğinde bu
nokta bağımsız bir geometrik öğeye dönüşür.

**Örgü.** 8'in halkaları bir ızgaraya yayıldığında sekizgen boşluklar doğar:
tezyinatın ördüğü form ile bir koordinat sistemi aynı çizimde buluşur. Her zaman
metnin arkasında ve düşük opaklıkta. Kullanıcı 8 görmez; tasarımın kendine ait
bir geometrisi olduğunu hisseder.

**Okul mührü arayüzün taşıyıcısı değildir.** Markayı SEKİZ taşır; mühür yalnız
kurumsal yetkinin gerektiği yerde görünür: kürsü bölümü, alt bilgi, yazdırılan
dönem raporu, veli onam metni, öğrenci kod kartı.

---

## 2. Renk

**Ürün koyu zeminlidir.** Kullanıcıların %90'ı telefondan giriyor; OLED ekranda
derin siyah hem enerji harcamıyor hem de camgöbeğini mücevher gibi gösteriyor.
Açık zemin yalnız **yazdırılan** belgelerde kullanılır (rapor, kod kartı).

Oran disiplini: **%60 nötr · %30 kurumsal petrol · %10 canlı camgöbeği.**

| Ad | Kod | Görev | Kontrast (gece üstünde) |
|---|---|---|---|
| **Gece** | `#07090C` | Zemin | — |
| **Grafit** | `#12161C` | Kart ve panel yüzeyi | — |
| **Duman** | `#1B212A` | Yükseltilmiş yüzey, tablo şeridi | — |
| **Çizgi** | `#262F3A` | Kenarlık, ayraç | — |
| **Mineral** | `#8B95A3` | İkincil metin | 6,4:1 ✅ |
| **Fildişi** | `#F2EFE8` | Ana metin, birincil düğme | 16,8:1 ✅ |
| **Derin Petrol** | `#0C3A42` | Kurumsal omurga, doku, geniş bloklar | — |
| **Elektrik Camgöbeği** | `#21E0C8` | Tek canlı renk | 11,8:1 ✅ |
| **Yeşim** | `#3FB98A` | Doğru, tamamlandı | 8,0:1 ✅ |
| **Kızıl** | `#E86A78` | Yanlış, eksik | 6,3:1 ✅ |

**Camgöbeği nerede görünür:** ilerleme çubuğunun dolan kısmı · etkin sekmenin
altı · açıklanan puan · odaklanılan alanın kenarlığı · seri ve madalya rozeti ·
bölüm etiketleri. **Nerede görünmez:** düğmeler, zeminler, başlıklar, gövde
metni. Ana eylem düğmesi sık tekrarlanır; canlı rengi oraya verirsek %10 kuralı
çöker ve renk sıradanlaşır. Bu yüzden birincil düğme fildişidir.

**Yeşim ve kızıl anlam taşır, dekorasyon değildir.** Doğru/yanlış ayrımı yalnız
renge bırakılmaz: sekizgen hücrelerde doluluk farkı, onay/çarpı simgesi ve ekran
okuyucuya giden metin de durumu söyler. Renk körü bir öğretmen şeridi aynı hızda
okur.

### Şartnameden sapmalar ve gerekçeleri

1. **Lacivert `#16233F` bırakıldı, yerine Derin Petrol geldi.** İlk şartname
   laciverti omurga yapıyordu; ikinci brief "klasik okul laciverti" ve
   "geleneksel prestij klişeleri"nden kaçınmayı istiyor. Petrol laciverte komşu
   ama okul portalı çağrışımı taşımıyor ve camgöbeğiyle aynı aileden — palet tek
   bir hue ailesinde derinleşiyor, fildişi de sıcak karşı ağırlığı veriyor.
2. **Mühür Altını kaldırıldı.** Altın + lacivert, ikinci brief'in adıyla saydığı
   geleneksel prestij üçlüsünün parçası. Altın artık yalnız basılı mührün
   kendisinde yaşıyor.
3. **Selçuklu yıldızı illüstrasyonu kaldırıldı.** Boş ekranlarda çizim yerine
   markanın kendi sembolü duruyor. Anadolu bağı kayboldu sayılmaz: sekizgen
   hücre ve örgü aynı geometriden geliyor, camgöbeği ise firuzenin dijital
   torunu.
4. **A/B/C palet çalışması geçersiz.** B yönü (patlıcan moru) ikinci brief'in
   mor yasağına takılıyordu; A ve C ise açık zemin varsayıyordu.

---

## 3. Tipografi

İki aile, iki ayrı görev.

**Instrument Serif — markanın sesi.** Yalnız büyük puntoda görünür: afiş
wordmark'ı, bölüm açılışları, açıklanan puan. Gövde metninde asla kullanılmaz.
Yüksek kontrastlı bir display serifin ciddiyeti ancak ölçekte ortaya çıkar.

**Archivo — yapı, arayüz, veri.** Sıkı bir grotesk; başlık hiyerarşisi boyutla
değil **ağırlıkla** kurulur, rakamlar her yerde tabular olduğu için puan ve
ortalama sütunları hizalı durur.

| Token | Boyut | Aile | Kullanım |
|---|---|---|---|
| `text-afis` | 64 | serif | Açılış ekranı |
| `text-ekran` | 40 | serif | Bölüm açılışı |
| `text-b1` | 28 / 600 | grotesk | Sayfa başlığı |
| `text-b2` | 20 / 500 | grotesk | Bölüm başlığı |
| `text-b3` | 16 / 600 | grotesk | Kart başlığı |
| `text-govde` | 16 / 1.6 | grotesk | Gövde |
| `text-kucuk` | 14 / 1.5 | grotesk | Yardımcı metin |
| `text-etiket` | 11 / 0.14em | grotesk | Üst etiket, tablo başlığı |
| `text-rakam` | 48 | serif | Panodaki büyük sayı |

Satır uzunluğu 45–75 karakter (`.olcu` = 66ch). Türkçe: ğ İ ı ş ç ö ü — iki
ailede de `latin-ext` alt kümesi yüklü. Büyük harf dönüşümü CSS ile değil
`bicim.ts` içindeki `buyuk()` ile yapılır (`toLocaleUpperCase('tr')`).

Yazı tipleri kendi sunucumuzdan verilir; dört dosya toplam **100 KB** (önceki
sistemde 203 KB'dı).

---

## 4. Aralık ve geometri

Taban birim **4px**. Kullanılan basamaklar: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 96.
Ara değer kullanılmaz; dikey ritim bu kısıttan doğar.

Köşe yarıçapları 8'in halkasından türer: 2 · 4 · 8 · 16 · tam daire.

**Koyu zeminde derinlik gölgeyle değil yüzey farkıyla anlatılır** (gece → grafit
→ duman). Tüm sistemde iki gölge vardır: yüzen katman için bir, camgöbeğinin
ışıması için bir — ikincisi yalnız olay kartında kullanılır.

---

## 5. Hareket

- **8 → ∞** : tek imza hareketi. 4,5 saniyelik döngü; 8 durur, döner, sonsuz
  olur, durur, geri döner. Yalnız bekleme anlarında ve açılış ekranında.
- **Belirme** : yeni gelen bilgi 8px aşağıdan, 0,5 saniyede yerine oturur.
- **Dokunma** : her düğme 150 ms içinde küçülerek yanıt verir.
- **İskelet** : yükleme opaklık nefesiyle anlatılır; dönen çark yok.

`prefers-reduced-motion` açıkken imza hareketi dahil her şey durur.

---

## 6. Metin dili

Öğretmene **siz**, öğrenciye **sen** — tutarlı. Sunucudan gelen hata metinleri de
bu dile uyar. Sözlük sabittir:

| Kelime | Anlamı |
|---|---|
| **Yayınla** | Herkese açar, geri alınması zordur |
| **Gönder** | Öğrencinin geri dönüşü olmayan teslimi |
| **Kaydet** | Taslak; henüz kimse görmüyor |
| **Onayla** | Öğretmenin son imzası |

**Geç teslim yoktur.** Durum üç değerdir: yaptı · yapmadı · süresi dolmadı.
Uyarı tesliminden sonra değil önce gelir.

---

## 7. Yasaklar

Mor / eflatun / lavanta · mor-mavi gradyan · glassmorphism · gölge yığını · neon ·
gökkuşağı paleti · çocuksu yuvarlak yazı tipleri · karikatür öğrenci ve mezuniyet
külahı çizimleri · anlamsız numaralandırma (01/02/03) · serpiştirilmiş emoji ·
amaçsız animasyon · her şeyi karta çevirmek.

---

## 8. Faz 2 (sanat yönetimi) — kalite kapıları denetimi

| # | Kapı | Durum |
|---|---|---|
| 1 | Önce tasarım kararı | ✅ Açılış ekranı, olay kartı, boş ekran ve wordmark için karar yorumları kodda |
| 2 | Ekran görüntüsüyle özdenetim | ✅ 390px ve 1280px'te çekildi; iki düzeltme yapıldı (wordmark harf arası %64'ten %12'ye, İ noktasının kırpılması) |
| 3 | Aralık ölçeği | ✅ Keyfi piksel değeri yok |
| 4 | Tipografik ölçek | ✅ Dokuz basamak, her ekranda aynı |
| 5 | Hizalama | ✅ Wordmark ölçüyle kaba oturuyor; rakamlar tabular |
| 6 | Dört hâl | ✅ Dördü de `/tasarim` sayfasında görülüyor |
| 7 | Dokunma geri bildirimi | ✅ 150 ms |
| 8 | Yıkıcı işlemler iki adımlı | ✅ Sunucuda uygulanıyor (Faz 1) |
| 9 | Performans bütçesi | ✅ Ana paket 80,4 KB gzip; yazı tipleri 203 KB'dan 100 KB'a indi |
| 10 | Tutarlılık | ✅ Tek Buton, tek Alan, tek Rozet; sözlük yukarıda |
| 11 | Türkçe dizgi | ✅ İ/ı, tr-TR biçimler, latin-ext |
| 12 | Denetim ve rapor | ✅ Bu tablo |

**Açık iş:** Öğrenci ve öğretmen panoları henüz bu sistemle çizilmedi (Faz 2–3).
Sistem `/tasarim` sayfasında parça parça kanıtlandı; ürün ekranlarında sınanması
sıradaki fazın işi.
