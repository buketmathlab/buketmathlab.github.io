# SEKİZ — Tasarım sistemi

Token'ların tek kaynağı `src/styles/tokenlar.css` dosyasıdır. Bu belge o dosyanın
gerekçesidir. Çalışan hâli tarayıcıda **`/tasarim`** adresindedir — ekranlar
yazılırken oraya bakılır.

---

## 1. Marka

**SEKİZ** iki kökten beslenir ve ikisi de arayüzde karşılık bulur:

**Geometri.** Selçuklu yıldızı ve rub'ul hizb: iki karenin 45° döndürülmesiyle doğan
sekiz köşeli form. Boş ekranların illüstrasyonu (`SelcukluYildizi`) ve sınıf
panosunun yoklama hücreleri (`SekizgenHucre`) bu formdan çıkar. Süs değil, yapı öğesi.

**Sonsuzluk.** 8 yatay çevrildiğinde ∞ olur. Bu, `SekizSonsuz` bileşeninde
**fiilen yaşanır**: iki eşit daire üst üste "8"i kurar, 90° dönünce yan yana gelip
"∞" olur. Şekil değişmez — yalnız bakış açısı değişir. Uygulamanın tek süsleyici
animasyonudur; bekleme anlarında görünür ve `prefers-reduced-motion` açıkken durur.

**Kilit satırı.** "SEKİZ" markadır, altındaki satır imzadır. İkisi asla ayrılmaz;
alt satır her zaman daha küçük ve daha ince. Üst barda, giriş ekranında, tanıtım
sayfasında, raporların başlığında aynı bileşen kullanılır (`KilitSatiri`).

```
SEKİZ
Buket Topuzoğlu · Matematik
```

## 2. Renk

Kontrast oranları kağıt zemin (`#F7F5F0`) üzerine hesaplanmıştır. WCAG AA sınırı
normal metinde 4,5:1'dir.

| Token | Kod | Kullanım | Kontrast |
|---|---|---|---|
| `murekkep` | `#16233F` | Ana kurumsal renk, başlık, üst bar, birincil düğme | 14,1:1 ✅ |
| `murekkep-900` | `#0C1526` | En koyu zemin, üst bar kenarı | — |
| `murekkep-700` | `#24365C` | Hover, ikincil kurumsal | 10,3:1 ✅ |
| `murekkep-500` | `#3C5482` | Bağlantı, klavye odak halkası | 6,4:1 ✅ |
| `kagit` | `#F7F5F0` | Sayfa zemini | — |
| `kagit-yuksek` | `#FFFFFF` | Kart yüzeyi | — |
| `kagit-golge` | `#EFEBE2` | İkincil zemin, tablo şeridi | — |
| `kenar` | `#E2DCD0` | Kart ve tablo kenarı | — |
| `altin` | `#C8A24B` | Madalya, başarı vurgusu — **dolgu olarak** | 2,2:1 ⚠️ metin değil |
| `altin-koyu` | `#8A6A22` | Altın tonunda **yazı** | 4,6:1 ✅ |
| `yesil` | `#2E7D5B` | Tamamlandı, doğru cevap | 4,7:1 ✅ |
| `kirmizi` | `#B03A32` | Eksik ödev, yanlış cevap, uyarı | 5,5:1 ✅ |
| `kursun` | `#8B93A5` | Çizgi, ikon, devre dışı öğe — **metin değil** | 2,8:1 ⚠️ |
| `kursun-koyu` | `#5A6376` | İkincil metin | 5,1:1 ✅ |

**Şartnameden sapma ve gerekçesi:** Şartnamedeki palette Mühür Altını ve Kurşun
Kalem doğrudan metin rengi olarak sayılıyordu; ikisi de kağıt üzerinde AA'yı
geçmiyor. Renkler korundu ama ikiye ayrıldı: dolgu tonu (`altin`, `kursun`) ve metin
tonu (`altin-koyu`, `kursun-koyu`). Palet aynı kalıyor, erişilebilirlik sağlanıyor.

**Altın cimri kullanılır.** Tüm arayüzde yalnız başarı ve madalya bağlamında görünür.

**Renk tek başına anlam taşımaz.** Yoklama hücrelerinde durum aynı zamanda dolgu/boş
farkıyla ve ekran okuyucuya giden metinle anlatılır ("112 · Nil Aksoy — ödevi
yapmadı").

## 3. Tipografi

**Gövde:** Inter — nötr, ekranda okunaklı, tabular rakam desteği güçlü.
**Başlık:** Fraunces — karakterli serif; akademik ciddiyeti bu taşır.

Rakamlar her yerde **tabular**: puan ve ortalama sütunları hizalı durur, içerik
değişince zıplamaz (`font-variant-numeric: tabular-nums`, `temel.css`).

| Token | Boyut / satır yüksekliği | Kullanım |
|---|---|---|
| `text-ekran` | 36 / 1.1 | Giriş ve tanıtım başlığı |
| `text-b1` | 28 / 1.2 | Sayfa başlığı (h1) |
| `text-b2` | 22 / 1.25 | Bölüm başlığı (h2) |
| `text-b3` | 18 / 1.35 | Kart başlığı (h3) |
| `text-govde` | 16 / 1.6 | Gövde metni |
| `text-kucuk` | 14 / 1.5 | Yardımcı metin, rozet |
| `text-etiket` | 12 / 1.4 | Tablo başlığı, üst etiket |
| `text-rakam` | 32 / 1.0 | Panodaki büyük sayı |

Satır uzunluğu 45–75 karakter arasında tutulur (`.olcu` = `max-width: 68ch`).
Aynı seviyedeki iki başlık asla farklı boyutta olmaz.

**Türkçe:** Her iki yazı tipinde de `latin-ext` alt kümesi yüklenir; ğ İ ı ş ç ö ü
eksiksiz görünür. Büyük harf dönüşümü CSS ile değil `bicim.ts` içindeki `buyuk()`
ile yapılır — `toLocaleUpperCase('tr')` kullanılır, böylece "istanbul" → "İSTANBUL"
olur, "ISTANBUL" olmaz. Tarih, sayı ve yüzde biçimleri `tr-TR` üzerinden geçer.

## 4. Aralık

Taban birim **4px**. Kullanılan basamaklar: 4 · 8 · 12 · 16 · 24 · 32 · 48.
Ara değer (20px, 28px) kullanılmaz — dikey ritim bu kısıttan doğar.

| Değer | Nerede |
|---|---|
| 4px | İkon–metin arası |
| 8px | Satır arası, rozet iç boşluğu |
| 12px | Kart içi öğeler |
| 16px | Kart iç boşluğu, sayfa kenarı |
| 24px | Bölümler arası |
| 32px | Büyük bölüm arası |
| 48px | Sayfa üstü/altı boşluk |

Köşe yarıçapları: 2 / 4 / 8 / 12 / 16 px. Gölge tek katmandır, düşük opaklıkta —
derinlik kenarlıkla anlatılır, gölge yığınıyla değil.

## 5. Dört hâl

Her etkileşim dört durumda tasarlanır: **boş · yükleniyor · hata · dolu.**

- **Boş** (`BosDurum`): bir davettir. "Veri yok" yazılmaz; ne yapılacağı söylenir ve
  tek bir eylem sunulur. İllüstrasyon ince çizgili Selçuklu yıldızıdır.
- **Yükleniyor** (`Iskelet`, `KartIskeleti`): dönen çark değil iskelet. Gelecek
  içeriğin biçimini önceden gösterir; sayfa dolunca yerleşim zıplamaz.
- **Hata** (`HataDurumu`): özür dilemez. Ne olduğunu ve ne yapılacağını söyler.
- **Dolu**: asıl içerik.

## 6. Metin dili

Öğretmene **siz**, öğrenciye **sen** — tutarlı. Düğmeler ne yaptığını söyler:
"Ödevi yayınla", "Çözümümü gönder". Sözlük sabittir ve karıştırılmaz:

| Kelime | Anlamı |
|---|---|
| **Yayınla** | Herkese açar, geri alınması zordur |
| **Gönder** | Öğrencinin geri dönüşü olmayan teslimi |
| **Kaydet** | Taslak; henüz kimse görmüyor |
| **Onayla** | Öğretmenin son imzası |

**Geç teslim yoktur.** Ödevin durumu üç değerdir: **yaptı · yapmadı · süresi
dolmadı**. Son tarih geçtiğinde gönderim kapanır ve ödev yapılmamış sayılır; "geç"
diye bir ara durum, ara renk veya ara rozet bulunmaz. Bu yüzden uyarı, tesliminden
*sonra* değil *önce* gelir: "Bugün son gün" rozeti ve son gün bildirimi.

## 7. Yasaklar

Krem zemin + terracotta üçlüsü · mor-mavi gradyanlar · glassmorphism · gölge
yığınları · anlamsız numaralandırma (01/02/03) · serpiştirilmiş emoji · amaçsız
animasyon. Hareket yalnız anlam taşıdığı yerde kullanılır.

---

## 8. Faz 0 — Tasarım kalite kapıları denetimi

| # | Kapı | Durum |
|---|---|---|
| 1 | Önce tasarım kararı, sonra kod | ✅ Her ekran ve imza öğesinin başında karar yorumu var (`YoklamaSeridi`, `BosDurum`, `Giris`, `Tanitim`) |
| 2 | Ekran görüntüsüyle özdenetim | ✅ 360px ve 1280px'te üç ekran çekildi; iki düzeltme yapıldı (retina'da bulanık mühür, sekizgende keyfi piksel değeri) |
| 3 | Tek aralık ölçeği (4/8/12/16/24/32/48) | ✅ Taban birim 4px; kodda keyfi piksel değeri kalmadı |
| 4 | Belirli tipografik ölçek | ✅ 8 basamaklı ölçek; satır uzunluğu `.olcu` ile 68ch |
| 5 | Hizalama disiplini | ✅ Tabular rakamlar açık; sayılar sağa, metinler sola |
| 6 | Dört hâl tasarlanmış | ✅ Dördü de bileşen olarak var ve `/tasarim` sayfasında görülüyor |
| 7 | Dokunma geri bildirimi | ✅ Düğmelerde 150 ms `active:scale`; dokunma hedefi en az 44px |
| 8 | Yıkıcı işlemler iki adımlı | ⏳ `yikici` düğme tonu hazır; iki adımlı onay akışı Faz 2'de (silme/yeniden puanlama ekranlarıyla birlikte) |
| 9 | Performans bütçesi | ✅ Ana paket 76,9 KB gzip (sınır 200 KB); tasarım sayfası tembel yükleniyor |
| 10 | Tutarlılık denetimi | ✅ Tek `Buton` bileşeni; sözlük yukarıda sabitlendi |
| 11 | Türkçe dizgi | ✅ `bicim.ts` — `toLocaleUpperCase('tr')`, `tr-TR` tarih/sayı, doğal sınıf sıralaması (9A < 10A) |
| 12 | Faz sonunda denetim ve rapor | ✅ Bu tablo |

**Geçmeyen madde:** 8 numaralı kapı Faz 0 kapsamında tamamlanamaz — yıkıcı bir işlem
henüz yoktur. Faz 2'de öğrenci silme ve yeniden puanlama ekranlarıyla birlikte
kapatılacaktır.

---

## 9. Faz 1 — Tasarım kalite kapıları denetimi

Faz 1 ağırlıklı olarak sunucu tarafıdır; arayüzde giriş ekranı ve geçici panel var.

| # | Kapı | Durum |
|---|---|---|
| 1 | Önce tasarım kararı | ✅ Giriş ekranının kararı yazıldı: iki kapı, tek ekran; gözün gideceği ilk yer kod alanı |
| 2 | Ekran görüntüsüyle özdenetim | ✅ 360px'te giriş ekranı boş, dolu, bekliyor ve hata hâllerinde çekildi |
| 3 | Aralık ölçeği | ✅ Yeni ekranlarda keyfi piksel değeri yok |
| 4 | Tipografik ölçek | ✅ Mevcut ölçek kullanıldı, yeni boyut eklenmedi |
| 5 | Hizalama | ✅ Panel'de etiket/değer iki sütun; sayılar tabular |
| 6 | Dört hâl | ✅ Giriş: boş · bekliyor (düğmede tek nokta) · hata (kırmızı kutu) · başarılı (panele geçiş) |
| 7 | Dokunma geri bildirimi | ✅ Düğme 150 ms'de tepki veriyor; bekleme durumunda metin "Giriş yapılıyor" oluyor |
| 8 | Yıkıcı işlemler iki adımlı | ✅ **Bu fazda kapandı** — `sinif_sil` ve `ogrenci_sil` sunucuda iki adımlı: ilk çağrı ne olacağını yazıyla anlatır (kaç öğrenci sınıfsız kalacak, velinin erişimi kalkacak), ikinci çağrı uygular |
| 9 | Performans bütçesi | ✅ Ana paket 78,8 KB gzip; resmî Supabase kütüphanesi çıkarılarak 132 KB'dan indirildi |
| 10 | Tutarlılık | ✅ Tek `Buton`, tek `Alan`, tek `HataDurumu` kullanıldı |
| 11 | Türkçe dizgi | ✅ Sunucu hata metinleri de Türkçe ve "ne yapılacağını" söylüyor |
| 12 | Denetim ve rapor | ✅ Bu tablo |

**Metin denetimi:** Sunucudan gelen hatalar da arayüz diline uyar. Öğrenciye "sen"
("Bu kod bulunamadı. Kartındaki kodu kontrol et, sonra tekrar dene."), öğretmene
"siz" ("Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin.").

**Erişilebilirlik tabanı:** 360px'te üç ekranda da yatay taşma yok (ölçüldü) ·
klavye odağı görünür (`:focus-visible`, 2px `murekkep-500` halka) · dokunma hedefi
en az 44px · renk tek anlam taşıyıcısı değil · `prefers-reduced-motion` destekli.
