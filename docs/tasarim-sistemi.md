# Tasarım Sistemi

Canlı vitrin: `/yeni/` — bu belgedeki her şey orada görülebilir.

## Marka fikri: 8 → ∞

Üst üste binmiş iki halka dikeyken **8**, 90° döndürülünce **∞**. Tek şekil,
iki anlam. Fikir dekoratif değil geometrik olarak gerçek — bu yüzden işe
yarıyor.

**Kullanım yeri bilinçli olarak sınırlı** (Kural 12): uygulama açılışı, ödev
teslim başarısı, ilerleme tamamlanması, tanıtım sayfası. Başka hiçbir yerde
kullanılmaz. Her yere konursa anlamını kaybeder ve süse dönüşür.

`prefers-reduced-motion: reduce` açıkken dönüş **hiç oynatılmaz**; işaret
doğrudan ∞ olarak çizilir ve `transition: none` uygulanır. Aynı anlam,
hareketsiz. Bu davranış testle korunuyor (`Sekiz8Mark.test.tsx`).

## Renk

Palet iki gerçek kaynaktan türetildi, hayal edilmedi:

1. **Okul mührünün laciverti** — piksel örneklemesiyle ölçüldü.
   PNG kaynakta baskın koyu renk `#001637`, JPEG kaynakta `#001737`
   (koyu piksellerin %40'ı bu kümede). Tek kanalda 1 birim fark, algı
   eşiğinin altında. Token **`#001737`**.
2. **Ewalu'nun kıyafet paleti** — haki ceket, krem gömlek, altın "8" arması,
   kahve deri.

Geleneksel çini renkleri (turkuaz, kobalt, mercan) **kullanılmadı**. Selçuklu
referansı geometriktir, koloristik değildir (Kural 11).

| Token | Değer | Kullanım |
|---|---|---|
| `ink` | `#001737` | ana metin, birincil buton — okul mührüyle aynı lacivert |
| `ink-soft` | `#1b3260` | hover |
| `paper` | `#fbfaf7` | sayfa zemini |
| `surface` | `#ffffff` | kart |
| `muted` | `#5d6577` | ikincil metin |
| `line` / `line-soft` | `#e2e6ee` / `#eef1f6` | kenarlık / iç ayırıcı |
| `olive` | `#4f5a3e` | ikincil aksiyon |
| `amber` | `#8a6318` | **yalnız** 8 arması, rozet, bölüm numarası |
| `success` | `#256b4c` | teslim edildi, doğru |
| `warning` | `#8a5510` | yaklaşan son tarih |
| `danger` | `#a72f26` | eksik ödev, yanlış, silme |
| `link` | `#1a4894` | bağlantı |

Zemin tonları: `success-bg`, `warning-bg`, `danger-bg`, `info-bg`.

**Yasaklar:** mor-mavi AI gradyanı, glassmorphism, ağır gölge, gereksiz altın.

### Kontrast

18 ön plan/arka plan çifti WCAG AA eşiğine karşı **her test çalışmasında**
otomatik doğrulanıyor (`src/lib/tokens.test.ts`). Faz 0 sonucu: **18/18
geçti**, en düşük oran 5.19 (altın aksan / sayfa zemini).

Palet ilk taslaktan sonra bu denetim yüzünden koyulaştırıldı: `muted`,
`amber`, `warning`, `danger`, `success`, `olive` ve `link` tokenları AA'yı
geçmek için değiştirildi. Denetim olmasaydı fark edilmezdi.

### CSS ↔ TS tutarlılığı

Renkler iki yerde tanımlı: `styles/index.css` (`@theme`) ve `lib/tokens.ts`.
Bir test bu ikisinin **birebir aynı** olduğunu doğruluyor. Biri değişip
diğeri unutulursa test kırılır.

## Tipografi

- **Fraunces** — başlık. Karakterli serif, ürüne akademik bir ağırlık veriyor.
- **Manrope** — arayüz. Yüksek okunurluk.

İkisi de Türkçe diakritiklerin tamamını taşıyor. Self-host; Google Fonts CDN
kullanılmıyor — hem performans hem KVKK (CDN ziyaretçi IP'sini üçüncü tarafa
taşır).

Gövde metni **16px'in altına inmez**. Puan, sayaç ve tablo sayıları
`tabular-nums` ile hizalanır — 88, 100 ve 7 alt alta düzgün dizilir.

## Boşluk: sekiz birimlik ritim

Ölçek 8'in katlarıyla ilerler: `8, 16, 24, 32, 48, 64, 96`. Markanın
kendisiyle aynı sayı. Tek sayı boşluk kullanılmaz — bu, ekranlar arası
hizalamayı tesadüfe bırakmaz.

Tailwind'in varsayılan 4px tabanı korunuyor; kural **çift adım kullanmak**
(`p-2`=8px, `p-4`=16px, `p-6`=24px…).

Yarıçap: `8 / 12 / 16 / tam`. Gölge yalnız iki seviye — `sm` (kart),
`md` (yüzen katman). Fazlası yok.

## Selçuklu geometrisi

Yapısal öğe, süs değil. Oranlar `lib/geometri.ts` içinde **hesaplanır**;
hiçbir SVG yolu elle yazılmaz, hepsi testlidir.

- **`OctagonFrame`** — düzgün sekizgen. Köşeler 22.5° + k·45°'te olduğu için
  üst ve alt kenar düzdür. Ewalu portrelerinin ve avatarların kabı.
- **`StarEight`** — sekiz köşeli Selçuk yıldızı (Rub el Hizb). İç yarıçap
  oranı 45° döndürülmüş iki karenin kesişiminden türetilir:
  `cos(45°)/cos(22.5°) ≈ 0.76537`. Rozet ve bölüm işareti.
- **`GeometricDivider`** — ince çizgi + ortada yıldız düğümü.

**Kural: bir ekranda en fazla bir geometrik vurgu.** Süs yığını yasak
(Kural 10). Arka plan tesselasyonu yalnız landing hero ve boş durumlarda
kullanılır; uygulama içi ekranlarda hiç yok.

### Sekizgen çerçeve neden işlevsel

Ewalu görsellerinin dikdörtgen fotoğraf arka planı var. Sekizgen maske bu
arka planı kırpıyor — yani geometri hem marka dilini taşıyor hem gerçek bir
sorunu çözüyor. Karakterin kendisine dokunulmuyor (Kural 9).

Aynı mantık okul mühründe: mühür zaten dairesel, dairesel maske beyaz kutu
zeminini kaldırıyor. Çizim değişmiyor (Kural 8).

## Ewalu

Asistandır, ürünün kahramanı değil. Dört poz, dört bağlam:

| Poz | Nerede |
|---|---|
| Karşılama | İlk kurulum, giriş ekranı, landing tanıtımı |
| Keşif | Boş durumlar — henüz ödev yok, henüz mesaj yok |
| Kutlama | Ödev teslim edildi, başarı anları |
| Çalışma | Öğretmen panosu başlığı, ödev hatırlatması, değerlendirme bekleniyor |

Poz eşlemesi kaynak dosyalar tek tek açılarak doğrulandı, dosya adından
tahmin edilmedi.

Boş durumlarda Ewalu **işlevseldir**: "hiçbir şey yok" ekranı ürünün en
soğuk anıdır; karakter bu anı insanileştirir.

**Ewalu konuşuyorsa görseli yanında durur.** Öğretmen panosunun başlığı
(`Bugün` / `Dikkat etmeniz gerekenler`) günün özetini asistanın ağzından
verir; görsel ile metin yan yana olunca cümlenin sahibi belli olur. Kalıp
giriş ekranındakiyle aynı: `EwaluFigure` + metin, `flex items-center gap-3`.

**Bir ekranda en fazla bir Ewalu.** Panoda başlıkta figür olduğu için
"öğrenci ekleyin" boş durum kartından figür çıkarıldı; ikinci bir kopya
karakteri asistan olmaktan çıkarıp süse çevirir.

Konuşan Ewalu **dekoratiftir** (`alt=""`): cümle zaten yanında görünür
metin olarak duruyor, ekran okuyucunun ayrıca pozu tarif etmesi tekrar
olurdu.

## Okul mührü

Mühür çok detaylı: dış halkada okul adı, içeride köprü, bina, meşale, defne
dalları, "MATEMATİK". 96 pikselin altında bu detaylar okunmaz hâle gelir.

Mührü yeniden çizmek yasak olduğuna göre doğru çözüm **kullanım boyutunu
sınırlamaktır**. `SchoolCrest` bileşeninin `boyut` propu 96'nın altını kabul
etmez — kural yorumla değil tip sistemiyle uygulanır.

Küçük bağlamlarda (header, favicon, avatar) mühür değil **SEKİZ marka
işareti** kullanılır. İki kimlik de doğru yerde durur.

Kurumsal onay alındı: mühür herkese açık tanıtım sayfasında kullanılabilir.

## Bileşenler

Tümü klavye erişilebilir, görünür odak halkalı, semantik HTML.

**Dokunma hedefi hiçbir bileşende 44px'in altına inmez** — `sm` ölçüsündeki
buton bile `min-height: 44px` korur, yalnız yatay dolgu daralır. Görsel
olarak küçük görünüp parmakla ıskalanan buton kabul edilmiyor.

Doğrulandı: 24 odaklanabilir öğenin **24'ünde** görünür odak halkası var;
44px altında dokunma hedefi **sıfır**.

Bazı tasarım kararları:

- **`Field`** etiket/ipucu/hata `id` bağlantılarını kendisi kurar. "Label
  unutuldu" ya da "hata mesajı ekran okuyucuya ulaşmıyor" hatası yapısal
  olarak imkânsız.
- **`Dialog`** yerel `<dialog>` öğesini kullanır — odak tuzağı, Escape,
  arka planın etkisizleşmesi ve odağın geri verilmesi tarayıcıdan gelir.
  Elle yazmak daha çok kod ve daha çok erişilebilirlik hatası demekti.
- **`Tabs`** ok tuşları, Home/End ve roving tabindex destekler.
- **`Tag`** renge tek başına anlam yüklemez; metin durumu her zaman yazar.
- **`Pagination`** mobilde sayfa numarası ızgarası göstermez — küçük ekranda
  dokunulabilir olmuyor.

## Dört durum

Veri gösteren her ekran **boş / yükleniyor / hata / hazır** dördünü de ele
almak zorunda. `AsyncBoundary` bunu tip sistemiyle zorunlu kılıyor:
`durum` bir birleşim tipi, `bos` ele alınmadan geçilemiyor.

Hata mesajları Türkçe, insan tarafından okunabilir ve **eyleme dönük**.
"Bir şeyler ters gitti" yasak. Örnek: *"Ödev yüklenemedi. İnternet
bağlantınızı kontrol edip tekrar deneyin."* Teknik yığın izi kullanıcıya
asla gösterilmez.

## Responsive

Mobile-first, 360px taban. Kırılımlar: `sm 480` / `md 768` (iPad dikey) /
`lg 1024` (iPad yatay) / `xl 1280`.

Masaüstü küçültülmüş mobil değil, ayrı düzen. Faz 2'de mobilde alt sekme
çubuğu, `lg` üstünde yan menü gelecek.

Doğrulandı: 360, 768 ve 1280 piksel genişliklerin **üçünde de yatay taşma
0px**.
