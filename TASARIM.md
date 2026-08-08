# SEKİZ — Tasarım sistemi

Token'ların tek kaynağı `src/styles/tokenlar.css`. Bu belge o dosyanın
gerekçesidir. Çalışan hâli **`/tasarim`** adresindedir; yeni ekran yazarken oraya
bakılır. Sistemin gerçek ekranlarda sınanmış hâli: `/ornek/ogretmen`,
`/ornek/sinif`, `/ornek/ogrenci`, `/ornek/veli`.

---

## 1. Felsefe — "Kireç ve Nar"

Ferah kireç beyazı bir zemin, üzerinde az ama cesur renk. Enerji büyük renk
bloklarından değil, **doğru noktadaki tek vurgudan** gelir. Ekranın çoğu nefes
alanıdır. Lacivert kurumsal ciddiyeti taşır ama **zemin olmaz**.

Selçuklu mirası **renkte değil geometride** yaşar: sekizgen, simetri, ızgara
oranı. Çini turkuazı, kobalt ve firuze bilinçli olarak kullanılmaz — geleneksel
bir çini estetiği değil, çağdaş bir renk dünyası hedeflenir.

**Ayırt edici kural: anlam renkleri sakin, marka renkleri canlı.** Doğru, yanlış
ve uyarı düşük doygunlukta durur; markanın enerjisini yüksek doygunluktaki iki
vurgu taşır. Böylece "puanın açıklandı" ile "yanlış cevap" asla karışmaz.

## 2. Marka

| | Nedir | Nerede |
|---|---|---|
| **8** | Sembol | Üst bar, gezinme işareti, bekleme, boş ekran |
| **SEKİZ** | Kimlik | Wordmark; açılış, giriş, rapor başlığı |
| **∞** | Fikir | Ayrı çizilmez — 8 dönünce ortaya çıkar |

**Wordmark ölçüyle dizilir.** Açılışta "SEKİZ" kabını tam doldurur: kelime SVG
içinde çizilir ve `textLength` ile kabın genişliğine oturtulur
(`lengthAdjust="spacing"` — harf biçimleri bozulmaz, yalnız harf arası açılır).
Punto ölçümle seçildi: Instrument Serif'te "SEKİZ" 100 puntoda 202,6 birim;
43,9 punto doğal genişliği 89 birime getirir, kalan %12 harf arasına dağılır.
Sonuç: 360px telefonda da 1600px ekranda da wordmark ızgaraya milimetrik oturur.

**Noktalı İ korunur.** Afiş ölçeğinde bu nokta bağımsız bir geometrik öğeye
dönüşür ve markanın Türkçe olduğunu ilk bakışta söyler.

**Okul mührü değiştirilmez, yeniden çizilmez, rengi bozulmaz.** Etrafında en az
kendi genişliğinin dörtte biri kadar boşluk bırakılır. Her ekrana tekrarlanmaz:
yalnız tanıtım açılışı, kürsü bölümü, giriş ekranı, alt bilgi ve yazdırılan
belgelerde görünür. Uygulama içi üst bar wordmark + 8 sembolü taşır.

## 3. Renk

Kontrastlar kireç zemin (`#FBFAF8`) üzerine hesaplandı. AA sınırı 4,5:1.

### Nötrler — %65–75

| Ad | Kod | Görev | Kontrast |
|---|---|---|---|
| **Kireç** | `#FBFAF8` | Sayfa zemini, sıcak beyaz | — |
| **Tebeşir** | `#FFFFFF` | Kart yüzeyi | — |
| **Kil** | `#F2F1ED` | İkincil yüzey, tablo şeridi | — |
| **Çizgi** | `#E6E3DD` | Kenarlık, ayraç | — |
| **Mürekkep** | `#141A24` | Ana metin | 16,5:1 ✅ |
| **Kurşun** | `#69707E` | İkincil metin | 4,7:1 ✅ |

### Kurumsal — %15–20

| Ad | Kod | Görev | Kontrast |
|---|---|---|---|
| **Gece Laciverti** | `#16233F` | Wordmark, birincil düğme, tek koyu bölüm | 15,5:1 ✅ |
| **Duman Lacivert** | `#3C4A63` | Bağlantı, ikincil yapı, hover | 8,9:1 ✅ |

Lacivert **zemin olarak kullanılmaz**. Üst bar açıktır; koyu lacivert yalnız
tanıtım sayfasındaki "Öğretmen ne kazanır" bölümünde, bir kez, tam genişlik
blok olur.

### Vurgular — %5–10

| Ad | Kod | Görev | Kontrast |
|---|---|---|---|
| **Nar** | `#D81E5B` | Canlı vurgu; metin olarak da kullanılabilir | 4,7:1 ✅ |
| **Kükürt** | `#FFC400` | İkinci enerji; **yalnız dolgu**, üstünde mürekkep | 11,0:1 (mürekkep üstte) |

**Nar nerede görünür:** etkin gezinme öğesi · ilerleme çubuğunun dolan kısmı ·
açıklanan puan · odaklanılan alanın kenarlığı · bölüm etiketleri · klavye odak
halkası. **Nerede görünmez:** düğmeler, zeminler, başlıklar, gövde metni.
Birincil düğme laciverttir — sık tekrarlanan bir eyleme canlı renk verilirse
%5–10 kuralı çöker ve nar sıradanlaşır.

**Kükürt** yalnız ödül bağlamında: seri rozeti, madalya, öne çıkan alan.
Hiçbir zaman durum göstergesi olmaz.

### Anlam renkleri — kontrollü

| Ad | Kod | Görev | Kontrast |
|---|---|---|---|
| **Yaprak** | `#2E7D5B` | Doğru, tamamlandı | 4,9:1 ✅ |
| **Kehribar** | `#8A5A0F` | Uyarı metni (dolgusu `#F5E6C8`) | 6,2:1 ✅ |
| **Kiremit** | `#B03A32` | Yanlış, eksik | 5,8:1 ✅ |

**Bilinen gerilim ve önlemi:** Kükürt (marka) ile kehribar (uyarı) aynı hue
ailesinde. Ayrım doygunlukla kurulur ve kuralla sabitlenir: kükürt hiçbir zaman
durum göstergesi değildir; uyarı her zaman metinle birlikte gelir. Nar ile
kiremit ton olarak açıkça ayrıdır ve hata durumları ayrıca ✕ simgesi taşır.

**Renk tek anlam taşıyıcısı değildir.** Yoklama şeridinde durum üç sinyalle
anlatılır: doluluk (yaptı dolu / yapmadı boş), çizgi kalınlığı, ve ekran
okuyucuya giden metin. Gri tonlamada bakıldığında da okunur.

## 4. Tipografi

**Instrument Serif** — markanın sesi. Yalnız büyük puntoda: wordmark, afiş,
bölüm açılışı, açıklanan puan. Gövde metninde kullanılmaz. Modern editoryal
karakterlidir; üniversite broşürü serifi değildir.

**Archivo** — yapı, arayüz, veri. Başlık hiyerarşisi boyutla değil **ağırlıkla**
kurulur. Rakamlar her yerde tabular; puan ve ortalama sütunları hizalı durur.

| Token | Boyut | Aile | Kullanım |
|---|---|---|---|
| `text-afis` | 64 | serif | Açılış ekranı |
| `text-ekran` | 40 | serif | Bölüm açılışı, ödev başlığı |
| `text-b1` | 28 / 600 | grotesk | Sayfa başlığı |
| `text-b2` | 20 / 500 | grotesk | Bölüm başlığı |
| `text-b3` | 16 / 600 | grotesk | Kart başlığı |
| `text-govde` | 16 / 1.6 | grotesk | Gövde |
| `text-kucuk` | 14 / 1.5 | grotesk | Yardımcı metin |
| `text-etiket` | 11 / 0.14em | grotesk | Üst etiket, tablo başlığı |
| `text-rozet` | 11 / 0.04em | grotesk | Rozet (etiketten sıkı) |
| `text-rakam` | 48 | serif | Panodaki büyük sayı |

Satır uzunluğu 45–75 karakter (`.olcu` = 66ch). Türkçe: ğ Ğ ş Ş ı İ ö Ö ü Ü ç Ç —
iki ailede de `latin-ext` alt kümesi yüklü. Büyük harf dönüşümü CSS ile değil
`bicim.ts` içindeki `buyuk()` ile yapılır (`toLocaleUpperCase('tr')`).

Yazı tipleri kendi sunucumuzdan verilir; dört dosya toplam **100 KB**.

## 5. Aralık, biçim, gölge

Taban birim **4px**. Kullanılan basamaklar: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
Ara değer kullanılmaz; dikey ritim bu kısıttan doğar.

Yarıçaplar: 2 · 4 · 8 · 12 (tam daire yalnız avatarda). Aşırı yuvarlatma yok.

Gölge tek katmandır (`0 1px 2px rgb(20 26 36 / .06)`); derinlik kenarlık ve yüzey
farkıyla anlatılır. Gölge yığını yok.

**Izgara:** 4 kolon (< 640px, 16px kenar) → 8 kolon (tablet, 24px) → 12 kolon
(masaüstü, 24px), içerik en fazla 1120px (`.kap`).

## 6. Sekizgen geometri

**İmza, tema değil.** Yalnız beş yerde: yoklama hücresi, gezinme işareti, rozet
zemini, zorlanılan soru göstergesi, arka plan örgüsü. Dekoratif büyük şekil
olarak kullanılmaz.

**Sekiz örgüsü** — halkalar ızgaraya yayıldığında sekizgen boşluklar doğar:
tezyinatın ördüğü form ile bir koordinat sistemi aynı çizimde buluşur. Her zaman
metnin arkasında ve çok düşük opaklıkta. Kullanıcı 8 görmez, düzeni hisseder.

## 7. Hareket — 8 → ∞

**Sembol sürekli dönmez.** Dönüş yalnız anlamlı bir anda bir kez olur (uygulama
açılışı, gönderim tamamlanma, konu tamamlanma), 450 ms sürer ve **∞ olarak
durur**. Bekleme uzarsa dönmez, yalnız nefes alır.

Gerekçe: sürekli dönen bir sembol markanın fikrini bir yükleme çarkına indirger.
Dönüşün bir kez olması onu bir olay yapar.

Diğer hareketler: yeni bilgi 6px aşağıdan 400 ms'de belirir; düğme dokunuşa
150 ms'de küçülerek yanıt verir; yükleme opaklık nefesiyle anlatılır — dönen
çark yok. `prefers-reduced-motion` açıkken hepsi durur.

## 8. Gezinme

Masaüstünde üst barda yatay, mobilde altta (başparmak yayında, 56px yükseklik,
44px hedef). Etkin öğe hazır bir ikonla değil markanın geometrisiyle işaretlenir:
sekizgen hücre nar ile dolar. Jenerik "ev/zil/kişi" ikonografisi kullanılmaz —
ürünü her uygulamaya benzetirdi.

Etkin öğe **adresten değil anahtardan** belirlenir (`src/lib/gezinme.ts`); adres
eşleştirmesi aynı sayfaya bakan birden çok öğeyi yanlışlıkla birlikte etkin
gösteriyordu.

**Okul öğrencisinin ve velisinin listesinde ödeme ve online ders öğesi hiç
yoktur** — gizlenmez, listeye girmez. Aynı sınır veritabanında bileşik yabancı
anahtarla ayrıca zorlanır.

## 9. Metin dili

Öğretmene **siz**, öğrenciye **sen**. Öğrenciye ceza dili yok: eksik ödev
suçlama değil bilgi olarak yazılır. Veliye sayı değil cümle sunulur
("Bu hafta iki ödev verildi, ikisi de yapıldı").

Sözlük sabittir: **yayınla** (herkese açar) · **gönder** (geri dönüşü yok) ·
**kaydet** (taslak) · **onayla** (öğretmen imzası).

**Geç teslim yoktur.** Durum üç değerdir: yaptı · yapmadı · süresi dolmadı.
Uyarı tesliminden sonra değil önce gelir.

## 10. Yasaklar

Mor / eflatun / lavanta · mor-mavi gradyan · çini turkuazı, kobalt, firuze ·
krem + terracotta + altın üçlüsü · glassmorphism · gölge yığını · neon ·
karanlık pano · her yerde lacivert · aşırı yuvarlatılmış kartlar · anlamsız
numaralandırma (01/02/03) · emoji yağmuru · stok illüstrasyon · jenerik eğitim
ikonları · her şeyi karta çevirmek · amaçsız animasyon · aşırı sekizgen.

---

## 11. Faz 0 revizyonu — tasarım kalite kontrolü

| # | Soru | Sonuç |
|---|---|---|
| 1 | İlk bakışta göz nereye gidiyor? | ✅ Her ekranda tek odak: açılışta wordmark, öğretmende "3 gönderim imzanızı bekliyor", öğrencide bugünün tek ödevi, velide tek cümle |
| 2 | Ekranın tek ana amacı belli mi? | ✅ Dört örnek ekranın dördü de tek soruya cevap veriyor; karar yorumları kodda yazılı |
| 3 | Gereksiz öğe var mı? | ✅ Öğretmen panosunda kart yığını ve grafik yok; sınıf panosunda tek ödevin şeridi var, dönemin tamamı değil |
| 4 | Aralık tutarlı mı? | ✅ 4px taban, sekiz basamak; keyfi piksel değeri yok |
| 5 | Tipografi tutarlı mı? | ✅ On basamaklı ölçek; aynı seviyedeki iki başlık aynı boyutta |
| 6 | Renkler gereğinden fazla mı? | ✅ İki vurgu + üç anlam rengi; ekranların %65–75'i nötr |
| 7 | Logo doğru kullanılmış mı? | ✅ Değiştirilmedi; dört yerde, boşluklu, tekrarsız |
| 8 | Sekizgen dozu doğru mu? | ✅ Beş kullanım; dekoratif büyük şekil yok |
| 9 | Mobil kullanım rahat mı? | ✅ 360/390/820/1280'de taşma yok; alt gezinme 56px, hedefler ≥44px |
| 10 | Genç ama ciddi mi? | ✅ Nar ve kükürt gençliği, lacivert tipografi ve ferah boşluk ciddiyeti taşıyor |
| 11 | Hazır şablona benziyor mu? | ✅ Ölçüyle dizilen wordmark, sekizgen gezinme işareti ve yoklama şeridi hazır hiçbir sistemde yok |
| 12 | SEKİZ'e özgü mü? | ✅ 8 → ∞ hareketi, sekiz örgüsü ve sekizgen hücre yalnız bu markaya ait |

**Denetimde bulunup düzeltilenler:**
1. Üst ve alt gezinmede aynı sayfaya bakan öğelerin **hepsi etkin görünüyordu**
   (adres eşleştirmesi hash'i yok sayıyordu) → etkin öğe artık anahtarla belirleniyor.
2. Yoklama şeridinde **öğrenci numaraları kaybolmuştu** (yerlerini onay/çarpı
   simgesi almıştı) → numara geri geldi, renk körlüğü desteği doluluk ve çizgi
   kalınlığı farkıyla sağlandı.
3. Rozetlerde harf aralığı fazlaydı ("9 A" gibi okunuyordu) → rozet için ayrı
   tipografi token'ı eklendi.

**Açık iş:** Ekranlar canlı veriye bağlı değil; veritabanı kurulumu
(`KURULUM-SQL.md`) bekliyor. PDF görüntüleyici, grafik kütüphanesi, PWA ve
yapay zekâ katmanı sonraki fazlara ait.
