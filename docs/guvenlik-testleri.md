# Güvenlik Test Matrisi

**Durum: Faz 11 güvenlik denetimi yapıldı (0027 ve 0028 bu denetimin
bulgularıdır).**

Kural: **çözülmemiş risk gizlenmez.** Bir madde "test edilmedi" ise öyle
yazılır; "muhtemelen güvenli" diye geçilmez.

## Nasıl doğrulandı

Testler yerel bir PostgreSQL 16 üzerinde, migration'lar **sıfırdan**
uygulanarak çalıştırılıyor. Süit her koşuda veritabanını düşürüp yeniden
kuruyor, yani sonuçlar birikmiş veriye bağlı değil:

```bash
supabase/testler/calistir.sh
```

| Dosya | Kapsam |
|---|---|
| `guvenlik_testleri.sql` | 18 davranış grubu (Faz 1) |
| `anon_izolasyon.sql` | 13 tablo + 7 dahili fonksiyon |
| **`guvenlik_denetimi.sql`** | **Faz 11 — 22 denetim, 4 grup** |
| `app/scripts/guvenlik-denetimi.mjs` | **Faz 11 — XSS, tarayıcıda, 25 ölçüm** |

Son çalıştırma: **hepsi geçti.** Panel sürümleriyle (`supabase/panel-icin/`)
kurulan boş bir veritabanında da aynı 22 denetim geçiyor.

## Faz 11'in yöntemi — neden bu tur farklı

Faz 1'de matris yazıldığında sistemde **19 uç** vardı. Bugün anon'a açık
**48 uç** var; aradaki ~30 uç (0007–0026) o matristen hiç geçmemişti.
Her tur kendi sızıntı testini yazmıştı, ama hiçbiri diğerinin kapsadığını
varsaymadan **sistematik** olarak denenmemişti.

**ELLE LİSTE YOK.** Rol denetimi `pg_proc` gezilerek yapılıyor: anon'a
açık her uç, aşağıdaki beyaz listede değilse öğrenci ve veli jetonunu
reddetmek zorunda.

```
dosya_erisim_izni · kendi_karnem · mesaj_gonder · odev_gonder
ogrenci_mesajlari · ogrenci_odevleri · okundu_isaretle · veli_paneli
giris · cikis · pin_ayarla
```

Yarın eklenen bir uç, hiçbir şey yazılmadan kapsama giriyor ve varsayılanı
"reddetmeli" oluyor. Listeyi genişletmek bilinçli bir karar gerektiriyor.

> **Bu tasarım ölçülerek seçildi.** İlk sürüm uçları "gövdesinde
> `_ogretmen(` geçiyor mu" diye süzüyordu. Geri alma kanıtı kör noktayı
> gösterdi: **bir ucun rol şartını silince o uç testin kapsamından da
> çıkıyordu** — denetim tam da korumak istediği durumda susuyordu.

### Saldırı yüzeyi ölçüldü

| Uç grubu | Sayı |
|---|---|
| `_ogretmen(` şartlı | 37 |
| `_oturum(` şartlı (öğrenci/veli erişiyor) | 8 |
| Rol şartsız | 3 (`giris`, `cikis`, `pin_ayarla`) |

Öğrenci ve velinin ulaşabildiği 8 uçtan **yalnız üçü kimlik alıyor**:
`dosya_erisim_izni(p_yol)`, `mesaj_gonder(p_ogrenci_id)`,
`odev_gonder(p_odev, p_foto_yolu)`. Kalan beşi hiç kimlik almıyor —
başkasının verisini istemek **yapı gereği** imkânsız, denenecek bir şey
yok.

## Faz 11'de BULUNAN iki gerçek kusur

### 1. Boşluk kırpma (0027 ile kapatıldı)

Bir öğrenci ya da veli, **yalnız sekme ve satır sonundan oluşan** bir
mesaj gönderebiliyordu. Mesaj yazılıyor, öğretmenin "yanıt bekleyen
öğrenciler" listesinde görünüyor ve yazışmada boş bir balon oluyordu.

Kök neden: PostgreSQL'de tek argümanlı `btrim(metin)` **yalnız boşluk**
kırpar.

```
length(btrim(E'\t\n  '))              = 2   ← geçiyordu
length(btrim(E'\t\n  ', E' \t\r\n'))  = 0   ← doğrusu
```

**Asıl ders katmanlarla ilgili:** uç denetimi ile şema kısıtı iki
bağımsız katman gibi görünüyordu ama **aynı hatalı `btrim`'i
paylaşıyorlardı** — yani tek katman kadar koruyorlardı. İkisi ayrı ayrı
düzeltildi ve artık ayrı ayrı ölçülüyor (3d uç denetimini, 3f kısıtı).

Veri sızıntısı değildi; gürültü kusuruydu. Yine de düzeltildi.

### 2. Giriş kilidi yalnız IP bazlıydı (0028 ile kapatıldı)

Bu risk **belgede zaten yazılıydı** ve Faz 11'e bırakılmıştı. Ölçüldü,
gerçek: `_istemci_kimligi()` yalnız IP hash'i döndürüyor ve 15 dakikada 8
hatalı denemede kilitliyor. Okul ağı tek NAT arkasındaysa **tek sayaç
paylaşılıyor** — eylülün ilk haftasında 30 kişilik bir sınıfta 8 yazım
hatası çok olası ve o anda okulun tamamı 15 dakika giriş yapamıyor.

Gizlilik değil **erişilebilirlik** açığıydı.

Artık iki sayaç var:

| Sayaç | Eşik (15 dakika) |
|---|---|
| Kod başına | **8** (yeni, asıl koruma) |
| IP başına | **40** (8'den yükseltildi) |

**Eşik yükseltmesi bir zayıflatma değil ve ölçüyle gerekçelendirildi.**
`_yeni_kod()` 31 harflik alfabeden 8 karakter üretiyor → 31⁸ ≈ 8,5 × 10¹¹.
~720 geçerli kodla bir denemenin tutma olasılığı ≈ 8,5 × 10⁻¹⁰. IP eşiği
40'ta günde 3.840 deneme → ilk isabet için beklenen süre milyon yıl
mertebesinde. Buna karşılık **hedefli saldırıya karşı koruma arttı**:
bugüne kadar bir saldırgan tek bir öğrencinin kodunu farklı IP'lerden
sınırsız deneyebiliyordu; artık o kod IP'den bağımsız olarak 15 dakikada
8 denemeyle sınırlı.

Kod düz metin saklanmıyor: sayaç SHA-256 hash'i üzerinden işliyor.

## Durum etiketleri

| Etiket | Anlamı |
|---|---|
| `AÇIK` | Açık doğrulandı, henüz kapatılmadı |
| `KAPALI` | Kapatıldı ve **çalıştırılarak** doğrulandı |
| `TEST EDİLMEDİ` | Henüz denenmedi |

## Matris

| # | Saldırı | Durum | Önlem / kanıt |
|---|---|---|---|
| 1 | Öğrenci A, öğrenci B'nin verisine erişebilir mi? | **KAPALI** | Kimlik parametreden değil jetondan okunur. Faz 11 **2f**: A'nın karnesinde, ödev listesinde ve velisinin panelinde B'nin adı geçmiyor; kanıt olarak aynı ad öğretmenin ucunda **bulunuyor**. |
| 2 | Öğrenci başka bir öğrencinin gönderimine erişebilir mi? | **KAPALI** | Faz 11 **2a**: A, B'nin çözüm fotoğrafına erişemiyor; B ve öğretmen erişebiliyor (olumlu kontrol). Bucket private. |
| 3 | Öğrenci öğretmen fonksiyonlarını çağırabilir mi? | **KAPALI** | Faz 11 **1a**: beyaz liste dışı her uç × öğrenci ve veli = **74 çağrı, hepsi `42501`**. Rol denetimi argüman doğrulamasından ÖNCE çalışıyor. |
| 4 | Veli başka bir velinin verisine erişebilir mi? | **KAPALI** | `veli_paneli` parametre almıyor. Faz 11 **2e**: veli `p_ogrenci_id` verse bile mesajı kendi kanalına düşüyor. |
| 5 | Yetkisiz kullanıcı cevap anahtarına erişebilir mi? | **KAPALI** | Faz 11 **2b**: A, başka sınıfın anahtarına ve soru PDF'ine erişemiyor; teslim eden B anahtara erişebiliyor. |
| 6 | Cevap anahtarı teslim öncesi alınabilir mi? | **KAPALI** | Teslim yokken `cevap_anahtari` ve `anahtar_yolu` `null`. Karar sunucuda; istemcide gizleme yok. |
| 7 | İstemci tarafı yetkilendirme atlatılabilir mi? | **KAPALI** | Anon izolasyon: 13 tablonun tamamı `permission denied`, 7 dahili fonksiyon reddediliyor. Faz 11 **1b**: uydurma jetonla 45 uç reddediyor. |
| 8 | Giriş deneme limiti atlatılabilir mi? | **KAPALI** | Faz 11 **4b/4c/4d**: kod başına 8, IP başına 40. Bir kodun kilitlenmesi aynı ağdaki diğer öğrenciyi **etkilemiyor** (0028). |
| 9 | Dosyalara URL tahmin ederek erişilebilir mi? | **KAPALI** | Bucket `public = false`; `storage.objects` anon politikası `using (false)`. Faz 11 **2c**: yükleme yolundaki kimlik jetonla karşılaştırılıyor. |
| 10 | Mesajlar üzerinden XSS çalıştırılabilir mi? | **KAPALI (ÖLÇÜLDÜ)** | Artık tasarım iddiası değil. `guvenlik-denetimi.mjs`: 8 yük × 5 ekran, üç bağımsız kanaldan (dialog, `window` işareti, DOM düğümü) — **25 ölçüm, 0 kusur**. Delik açılarak denendi: `dangerouslySetInnerHTML` konunca denetim 12 kusur raporluyor. |
| 11 | SQL enjeksiyonu mümkün mü? | **KAPALI** | Tüm RPC parametreleri tipli. Faz 11 **3b**: `'; drop table ogrenciler; --` yükü veri olarak saklandı, tablo yerinde. |
| 12 | Öğrenci mükerrer gönderimle notu manipüle edebilir mi? | **KAPALI** | `gonderim_tek UNIQUE (odev_id, ogrenci_id)`; ikinci gönderim `unique_violation`. |
| 13 | Yeniden puanlama yetkisiz tetiklenebilir mi? | **KAPALI** | `odev_guncelle` öğretmen şartlı (1a kapsamında). Puanı değişen her öğrenci `denetim_izi`'ne yazılıyor; sessiz not değişikliği yok. |
| 14 | Silinen öğrenci erişimini koruyabilir mi? | **KAPALI** | Faz 11 **4g**: pasifleştirme oturumu **ve** kodu birlikte düşürüyor; sonraki çağrı `28000`, kodla yeniden giriş `rol: yok`. |
| 15 | Sınıf değişikliği geçmiş veriyi sızdırır mı? | **KAPALI — davranış kararlaştırıldı** | Aşağıya bakın. |
| + | Dahili fonksiyonlar dışarıdan çağrılabilir mi? | **KAPALI** | `anon_izolasyon.sql` nöbette. 0028'in yeni `_kod_kilitli_mi`'si de anon'a kapalı (migration kendi denetimiyle ölçüyor). |
| + | İlk kurulum kapısı ikinci kez açılabilir mi? | **KAPALI** | Faz 11 **4a**: `pin_ayarla` hash doluyken `42501`; sonrasında eski PIN'in hâlâ çalıştığı ayrıca ölçülüyor. Bu kapı açık kalsaydı siteye giren herkes öğretmen PIN'ini belirleyebilirdi. |
| + | Süresi dolan / iptal edilen jeton kabul edilir mi? | **KAPALI** | Faz 11 **4e/4f**: çıkıştan sonra `28000`; `son_kullanma` geçmişe çekilince `28000`. |
| + | Aşırı uzun ya da boş girdi kabul edilir mi? | **KAPALI** | Faz 11 **3c/3d/3f**: 4000 kabul, 4001 red; boş ve yalnız boşluklu mesaj hem uçta (`22023` + Türkçe mesaj) hem şema kısıtında (`23514`) reddediliyor. |

### Madde 15 — karara bağlandı

Faz 1'de "KISMEN" bırakılmıştı. Bugünkü davranış ölçüldü ve **kabul
edilen davranış** olarak yazıya geçiyor:

Öğrenci sınıf değiştirdiğinde eski sınıfın ödevleri listesinden düşer;
gönderimleri ve notları `gonderimler` tablosunda durur ve **öğretmen
onları görmeye devam eder**. Öğrenci eski sınıfın ödevlerini artık
göremez.

Bu bir sızıntı değil, tersi: öğrenci **daha az** görüyor. Kayıt
kaybolmuyor, öğretmenin karnesinde duruyor. Alternatif — öğrencinin eski
sınıfının ödevlerini görmeyi sürdürmesi — yeni sınıfının listesine
karışırdı ve istenen bir şey değil.

## Kalan riskler — gizlenmiyor

1. **Mesajlarda hız sınırı yok. ÖLÇÜLDÜ: 200 mesaj 0,03 saniyede
   yazıldı.** Bir öğrenci kendi yazışmasını binlerce mesajla
   doldurabilir. Sızıntı değil, gürültü ve yer israfı.

   **Bilerek düzeltilmedi ve sebebi:** bu bir güvenlik sınırı değil bir
   ürün kararı — meşru bir öğrenci de arka arkaya birkaç mesaj yazar ve
   yanlış konmuş bir sınır onu susturur. Ayrıca burası anonim bir
   servis değil: mesaj `ogrenci_id` ile kayıtlı, öğretmen kimin yaptığını
   anında görüyor ve öğrenciyi pasifleştirebiliyor. Sınır istenirse ayrı
   bir tur olarak konuşulmalı; sessizce eklenmedi.

2. **`ogrenciler.ad` ve `odevler.baslik` uzunluk üst sınırı ŞEMADA yok.**
   Uçlarda var (`ogrenciler_toplu_ekle` 100 karakterle sınırlıyor) ama
   kısıt veritabanında değil. İkisi de öğretmen girdisi, yani güvenlik
   sınırı değil. 0027 bu iki kısıtın boşluk kırpmasını düzeltti; uzunluk
   sınırı eklenmedi çünkü öğretmenin bir kez kaçırdığı uzun bir başlık
   yüzünden kaydın reddedilmesi istenmeyen bir davranış olurdu.

3. **Canlıda tekrar ölçülmedi.** Bütün Faz 11 denemeleri yerelde yapıldı.
   Canlıda kaba kuvvet denemek öğretmenin kendi kilit sayacını kirletir
   ve gerçek veriye dokunur. 0027 ve 0028 panelde çalıştırıldıktan sonra
   uçların **varlığı** canlıya karşı yoklanacak; saldırı denemeleri
   yerelde kalacak.

4. **Bu denetim bir sızma testi değil.** Hedefli, okunabilir denemeler
   yazıldı; otomatik bir tarayıcı çalıştırılmadı. Bulunmayan bir açık
   "yok" demek değildir — yalnız "bu denemelerle bulunamadı" demektir.

## Faz 11 geri alma kanıtı

Her denetimin gerçekten yakaladığı tek tek geri alınarak kanıtlandı:
**5 denetimden 5'i**. Beşincisi (bir öğretmen ucunun rol şartının
silinmesi) süitte daha erken koşan `bildirim_testleri` tarafından
yakalandığı için yalıtılarak ölçüldü — `1a BAŞARISIZ —
bildirim_sayilari → HATA VERMEDİ`, hem öğrenci hem veli jetonu için.

Yol boyunca **geri alma betiğinin kendisinde** iki ölçüm hatası çıktı ve
ikisi de kayda geçiyor:

1. **Başarısızlık ölçütü yanlıştı.** Betik logda `ERROR` arıyordu; oysa
   temiz süit de iki *benign* `ERROR:` satırı basıyor
   (`toplu_ogrenci_testleri` kasten hatalı girdi deneyip sunucunun
   mesajını gösteriyor). Her tur "kırıldı" görünüyordu. Ölçüt çıkış
   koduna çevrildi.
2. **Yama yanlış dosyaya uygulanmıştı.** `bildirim_sayilari` 0022'de
   tanımlanıp **0025'te yeniden tanımlanıyor**; 0022'yi yamalamak sonraki
   migration tarafından geri alınıyordu.

## Faz 0'da doğrulanmış açıklar (silinen projedeydi — tarihsel kayıt)

**A. Public storage bucket.** `/storage/v1/object/public/odevler/…`
isteği `NoSuchKey` döndürmüştü ⇒ bucket public. Faz 1'de kapatıldı.

**B. Giriş deneme limiti yok.** `giris_denemeleri` tablosu mevcut
değildi. Faz 1'de eklendi, Faz 11'de kod bazına genişletildi.

**C. Mükerrer teslim kısıtı yok.** `gonderimler`'de yalnız
`PRIMARY KEY (id)` vardı. Faz 1'de `UNIQUE (odev_id, ogrenci_id)` eklendi.

## Faz 1'de yakalanan gerçek açık (tarihsel)

**Dahili fonksiyonlar dışarıdan çağrılabiliyordu.** PostgreSQL yeni
fonksiyonlara varsayılan olarak `PUBLIC` rolüne `EXECUTE` verir. Yetkiler
`anon`'dan çekilmişti ama `PUBLIC`'ten çekilmemişti ve `anon` `PUBLIC`'ten
miras alır. Sonuç: `_oturum_ac('ogretmen', null)` anon rolüyle
çağrılabiliyordu — **PIN bilmeden öğretmen jetonu üretmek mümkündü.**
`0005_fonksiyon_yetkileri.sql` kapattı; `anon_izolasyon.sql` nöbette.
