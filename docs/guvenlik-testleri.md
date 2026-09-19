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

## Kopya öğrenci temizliği — silen bir betik nasıl sınandı

Öğrenciler önce numarasız eklenmişti; aynı listeler 0042'den sonra
numaralarla yeniden yüklenince her sınıf iki katına çıktı. Temizlik için
iki panel dosyası var: `panel-icin/kopya-ogrenci-raporu.sql` (salt okunur)
ve `panel-icin/kopya-ogrenci-sil.sql` (siler).

**Bu, depodaki en tehlikeli SQL.** `ogrenciler`e bağlı sekiz tablonun
tamamı `on delete cascade`: yanlış silinen bir öğrencinin ödevleri,
notları, veli yazışması ve onamı da gider. Bu yüzden testin ağırlığı
"siliyor mu"da değil, **silmemesi gerekeni silmiyor mu**da.

Silme yalnız **üç şart birden** tutuyorsa oluyor: numara yok · aynı
sınıfta aynı adda numaralı ve aktif bir ikiz var · **hiç kullanılmamış**
(`gonderimler`, `mesajlar`, `dersler`, `odemeler`, `okundu`,
`veli_onaylari`, `oturumlar` — hiçbirinde tek satırı yok). `giris_kodlari`
bilerek kullanım sayılmıyor: her öğrenciyle birlikte üretiliyor.

### Test, dosyanın KOPYASINI değil KENDİSİNİ çalıştırıyor

`testler/kopya_temizlik_testleri.sql` silme sorgusunu taşımıyor. İki panel
dosyasının metnini diskten okuyup (`SEKIZ_KOK`, `calistir.sh` veriyor)
aynen çalıştırıyor. 0041'de öğrenilen ders buydu: ölçüm, çalışan kodun
kopyasını ölçerse, kopya ile asıl ayrıştığı gün test yeşil kalır ve
yanılır.

Kurulan dünya 6K'da altı kayıt: temiz kopya (silinmeli), onun **büyük
harfli ve çift boşluklu** numaralı ikizi, gönderimi olan kullanılmış kopya
(kalmalı), onun ikizi, ikizi olmayan tekil öğrenci, ve adaşı **başka
sınıfta** olan bir öğrenci. 10 grup; rapor hem silmeden önceki hem
sonraki dünyayı doğru okumak zorunda (sayılar sabit yazılamaz).

### Kusur provası — 11 kusurdan 11'i yakalandı

Her ölçümün gerçekten ısırdığı, panel dosyasına tek tek kusur
yerleştirilerek gösterildi:

| Kusur | Testi kıran ölçüm |
| --- | --- |
| "hiç kullanılmamış" şartı düştü | `4a: KULLANILMIŞ kopya silindi — veri kaybı` |
| ikiz aramasında sınıf şartı düştü | `5d: adaşı BAŞKA sınıfta olan öğrenci silindi` |
| ikizin numaralı olma şartı düştü | `5c: ikizi olmayan öğrenci silindi` |
| Türkçe ad normalleştirmesi düştü | `3a: temiz kopya silinmedi` |
| denetim izi yazılmıyor | `6b: iz sayısı silinen sayısıyla tutmuyor` |
| iz farklı bir işlem adıyla yazılıyor | `8a: silme denetim izine yazılmadı` |
| özet yanlış sayı veriyor | `6a: özet 0 silindi diyor, gerçekte 1 satır gitti` |
| raporda gönderim kullanım sayılmıyor | `2b: silinecek sayısı 1 olmalıydı` |
| rapor sınıf sayılarını yanlış veriyor | `2a: sınıf durumu yanlış` |
| rapordan KORUNACAK bölümü çıkarıldı | `2c: kullanılmış kopya adıyla yok` |
| dosya hiç okunamadı (boş) | `0a: silme dosyası okunamadı (0 karakter)` |

Son satır ayrı bir ders: "dosya okundu mu" çıpası **ölçülen
davranışlardan biri olamaz**. İlk yazımda çıpa `ogrenci_kopya_silindi`
dizgesiydi; denetim izinin adını değiştiren kusur, testi doğru yerden
değil "dosya okunamadı" diye kırdı. Çıpa, ölçülmeyen bir yapıya
(`delete from public.ogrenciler`) taşındı.

### Panelde yalnız SON ifadenin sonucu görünüyor

Her iki dosya da **tek bir ifade**. Rapor dört bölümü `union all` ile tek
tabloda döndürüyor; silme dosyası `delete … returning`'i ve denetim izi
yazımını aynı ifadenin içinde tutup bir özet satırıyla bitiyor. Ayrı
`delete` + ayrı `select` yazılsaydı öğretmen yalnız sonuncuyu görürdü —
0041 ve 0042'de "NULL" görmesinin sebebi tam olarak buydu.

## Toplu eklemede eşleştirme (0043) — ölçümler

`toplu_eslestirme_testleri.sql`, 10 grup. Asıl ölçüm 3. grup: eşleşen
öğrencinin **giriş kodu değişmiyor**. Yenilenseydi, öğrencinin ve velinin
elindeki kâğıt sessizce geçersiz olurdu ve bu ancak biri giriş yapmayı
deneyince anlaşılırdı. İkinci ağırlık 6. grup: sınıfta aynı adda iki aktif
öğrenci varsa **hata verilip hiçbir şey yazılmıyor**.

Panel dosyasına tek tek kusur yerleştirildi; **9 kusurdan 9'u** doğru
ölçümden yakalandı:

| Kusur | Testi kıran ölçüm |
| --- | --- |
| eşleşende kodlar yenileniyor | `3b: öğrenci kodu DEĞİŞTİ` |
| aynı çağrıda dokunulanlar dışlanmıyor | `7a: iki adaş için 2 kayıt bekleniyordu, 1 var` |
| belirsizlikte hata verilmiyor | `6b: belirsiz eşleşme kabul edildi` |
| ad anahtarı Türkçeyi çevirmiyor | migration öz-doğrulaması: `_ad_anahtari Türkçeyi bozuyor` |
| bayrak yok sayılıyor | `1b: bayrak kapalıyken yeni kayıt açılmalıydı` |
| boş numara mevcut numarayı eziyor | `8a: mevcut numara silindi` |
| iz farklı işlem adıyla yazılıyor | `9a: numara güncellemesi … yazılmadı` |
| eşleşende yine de yeni kayıt açılıyor | `2a: yeni kayıt açılmış` |
| eski imza düşürülmüyor (0007) | `0043 EKSİK KALDI: eski 4 parametreli … hâlâ duruyor` |

Arayüz tarafında `toplu-ogrenci-denetimi.mjs`'e üç grup eklendi (karar
kartı, kapalı seçenekle giden bayrak, sonuç başlığı). Oraya da tek tek
**6 kusur** yerleştirildi, 6'sı da yakalandı — biri şuydu: eşleşen sayısı
`mukerrer` alanından okunduğunda önizleme "1 eşleşti" derken sunucu iki
satırı birden eşleştiriyordu.

### Bu turda bulunan ölü ölçüm

0042'nin kendi doğrulaması eski imzayı
`pg_get_function_identity_arguments(p.oid) = 'text, text, uuid'` diye
arıyordu. O fonksiyon **parametre adlarını da** döndürüyor
(`p_token text, …`), yani karşılaştırma hiçbir zaman tutmuyor: **asla
kalamayan bir ölçüm.** Canlıdaki güvence bozulmadı, çünkü yanındaki "tek
imza değil" satırı ısırıyor — ama tek başına duran bir kontrol olarak
değersizdi. 0042 çalıştırılmış bir migration olduğu için dosyasına
dokunulmadı; 0043 `oidvectortypes(p.proargtypes)` kullanıyor ve iki
kontrolün de ısırdığı geri alınarak gösterildi.

### Panel dosyası ile migration'ın ayrışması

Öğretmenin veritabanında çalışan şey `panel-icin/` altındaki dosya, depoda
sınanan şey `migrations/` altındaki. 0043'ten itibaren panel sürümü
migration gövdesini **birebir** taşıyor ve `migration-listesi.test.ts`
bunu kilitliyor. Kilidin ısırdığı, panel dosyasındaki bir şartı
zayıflatarak gösterildi: test `panel sürümünü migration'dan yeniden
üretin` diyerek kırmızı yandı.

## Öğrenci adını düzeltme (panel) — ölçümler

Uygulamada **kaydedilmiş bir öğrencinin adını değiştiren ekran yok.**
`panel-icin/ogrenci-adi-duzelt.sql` bu boşluğu geçici olarak kapatıyor;
kalıcı çözüm bir düzenleme ekranı ve hâlâ yapılmadı.

Dosyanın ağırlığı "adı değiştiriyor mu"da değil, **başka hiçbir şeye
dokunmuyor mu**da: giriş kodu, okul numarası, ödev gönderimi ve kaydın
kimliği olduğu gibi kalmalı. `ad_duzeltme_testleri.sql`, panel dosyasının
metnini okuyup yalnız `girdi` bloğunu değiştirerek çalıştırıyor — 11 grup.
Girdi bloğunun gerçekten değiştirilebildiği de ayrıca ölçülüyor; yoksa
bütün gruplar dosyanın varsayılan değerleriyle boşa dönüp yeşil kalırdı.

**10 kusurdan 10'u** yakalandı: tek eşleşme şartının düşmesi, sınıf
şartının düşmesi, izin yazılmaması, güncellemenin numarayı da silmesi,
boş/uzun ad korumalarının düşmesi, ad normalleştirmesinin düşmesi, sınıf
dökümünün verilmemesi, özetin eski adı söylememesi ve dosyanın hiç
okunamaması.

### `<>` ile yazılmış bir kontrol NULL'da sessizce geçer

"Okul numarası değişti mi" kontrolü `<> '401'` diye yazılmıştı. Güncelleme
numarayı **NULL'a** çekecek şekilde bozulduğunda `NULL <> '401'` TRUE değil
**NULL** döndü ve kontrol hiç ateşlemedi; kusuru başka bir grup yakaladı.
Bir ölçüm, yakalaması gereken kusuru başkasına bırakıyorsa kendi işini
görmüyor demektir. Kıyaslar `is distinct from`a çevrildi ve aynı kusur
tekrar yerleştirilerek doğru satırın ısırdığı gösterildi.

## Cinsiyet ve pansiyon sütunu adın içine giriyordu

Öğretmen bir öğrencinin adının yanlış kaydedildiğini bildirdi ve iki
dizgiyi verdi: PDF'te `AYŞE SARI`, SEKİZ'de `Ayşe Sarı Kız Yatılı`.

Ayrıştırıcı **"cinsiyet satırın SONUNDA"** varsayıyordu
(`(?:\s+(?:Kız|Erkek))?\s*$`). e-Okul listesinde cinsiyetten sonra bir
**pansiyon sütunu** daha var; cinsiyet artık sonda olmadığı için hiçbir
kalıp kesemedi ve ikisi birden adın içinde kaldı.

**Neden bu kadar geç fark edildi:** pansiyon sütunu yalnız YATILI
öğrencilerde dolu. Gündüzlü öğrencilerde satır `… Kız` diye bittiği için
eski kalıp doğru çalışıyordu. Otuz kişilik bir listede tek çocukta
görünen bir kusur, kendini gizler.

### Yol boyunca bulunan ikinci, daha ağır kusur

`MOBILYA` listesindeki `[/pansiyon/u, 'Tablo başlığı']` kalıbı **bütün
satırda** aranıyor ve ad çıkarılmadan ÖNCE çalışıyordu. Pansiyon değeri
`Pansiyonlu` olan bir ÖĞRENCİ satırı "tablo başlığı" sanılıp **tamamen
atılıyordu**: çocuk listeye hiç girmiyordu. Bozuk bir addan daha kötüsü,
sessizce kaybolan bir öğrencidir. Standart başlık zaten `^s\.?\s?no` ile
eleniyor; kalıp `pansiyon\s+durumu` olarak daraltıldı.

### Düzeltme: adın nerede bittiğine tek bir yer karar veriyor

`adiSutunlardanAyir()` önce ilk **cinsiyet** kelimesinde kesiyor —
arkasındaki sütunun adını bilmeye gerek kalmıyor, tanımadığımız bir
pansiyon değeri de temizleniyor. Sonra sondan **bilinen** sütun değerleri
kırpılıyor (cinsiyet sütunu olmayan listeler için). Kelime kelime
çalışıyor: "Kızılkaya" soyadı, içinde "kız" geçtiği için kırpılmasın.

**Kusur provası — 6 kusurdan 6'sı yakalandı**

| Kusur | Kıran ölçüm |
| --- | --- |
| cinsiyette kesme kalktı | `TANIMADIĞIMIZ bir pansiyon değeri de kesiliyor` |
| sondan kırpma kalktı | `cinsiyet sütunu OLMAYAN listede pansiyon…` |
| `/pansiyon/` yine geniş | `PANSİYONLU öğrenci satırı ATILMIYOR` |
| Türkçe küçük harf yerine düz `toLowerCase` | `sütunlar BÜYÜK HARFLE yazıldığında da kesiliyor` |
| alan seçiminde yalnız cinsiyet eleniyor | `sekmeli yapıştırmada KISA ad…` |
| boş sonuç kapısı kalktı | `numaralı ama ADSIZ satır öğrenci sayılmıyor` |

Tarayıcı denetiminde sahte e-Okul PDF'ine pansiyon sütunu eklendi; iki
kusur orada da geri alınarak gösterildi (biri "6 öğrenci önizlemede (5)"
diye, yani kaybolan çocuğu sayarak).

**Bir "kusur" kusur çıkmadı ve bu da kayda geçiyor.** `EOKUL_SATIRI`
kalıbından sondaki cinsiyet grubunu kaldırmak bir davranış düzeltmesi
değil: eski hâliyle de sonuç aynı çıkıyor, çünkü kesmeyi artık yeni
fonksiyon yapıyor. Geri aldığımda hiçbir test kırmızı yanmadı — doğrusu
da bu. Sadeleştirme, düzeltme değildir; ikisini aynı cümleyle anlatmak
ölçümü abartmak olurdu.

### Mevcut kayıtların onarımı

`panel-icin/ad-kuyrugu-temizle.sql` iki adımlı: `sadece_bak = true`
hiçbir şey yazmaz, yalnız "şu ad → şu ada dönecek" listesini gösterir.
Öğretmen okuduktan sonra `false` yapıp çalıştırır.
`atlanacak_numaralar` ile tek tek öneri veto edilebiliyor — soyadı
gerçekten "Erkek" olan bir öğrenciyi satıra bakarak ayırt etmek mümkün
değil, o yüzden **önce bakılıyor**.

`ad_kuyrugu_testleri.sql` (8 grup) panel dosyasının kendi metnini
çalıştırıyor. Asıl ölçüm "temiz adlara dokunmuyor": `Nehir Kızılkaya`
kırpılmıyor, adın TAMAMI sütun değeri olan bir kayda dokunulmuyor (boş ad
kalırdı). **8 kusurdan 8'i** yakalandı; biri (`son > 0` kapısının
düşürülmesi) veritabanının kendi `ogrenciler_ad_check` kısıtı tarafından,
yani ikinci bir ağ tarafından durduruldu.

## Numara sırası (0044) — ölçümler

Öğretmen istedi: sınıfa tıklayınca öğrenciler okul numarasına göre
küçükten büyüğe sıralansın. Kapsam onun kararı: **sınıf detayı · Kodlar ·
Kod fişleri**. `Öğrenciler` ekranı ada göre kaldı — orada sınıf
seçilmeden bakıldığında farklı sınıfların aynı numaraları iç içe geçerdi.

**Sıralama sunucuda, tek yerde.** `ogrenciler_listesi` sayfalı;
istemcide sıralansaydı yalnız o sayfanın içi sıralanır, sayfalar arası
karışırdı. Anahtar `_numara_sira()`: numara METİN olarak saklandığı için
(0042: baştaki sıfır korunsun) düz sıralama `'10'`u `'9'`dan önce koyar —
yalnız rakamdan oluşan numaralar sabit genişliğe sıfırla doldurularak
karşılaştırılıyor.

`numara_sirasi_testleri.sql`, 9 grup. Fixture bilerek tuzaklı: sayısal
sıra `2, 9, 10, 0601, 601, A1` iken metin sırası bambaşka. Aynı olsaydı
"numaraya göre sıralı" ölçümü, sıralama hiç yapılmasa da yeşil kalabilirdi.

**7 kusurdan 7'si yakalandı:**

| Kusur | Kıran ölçüm |
| --- | --- |
| sayısal doldurma kalktı | migration öz-doğrulaması: `_numara_sira sayısal sıralamıyor` |
| boş numara `null` olmuyor | `_numara_sira boş numarayı null yapmıyor` |
| sınıf detayı yine ada göre | `2a: sınıf detayı sırası yanlış` |
| **iç sayfalama sorgusu sıralanmıyor** | `6a: sayfalar birleştirilince sıra bozuluyor` |
| dış `jsonb_agg` sıralanmıyor | `4a: liste sırası yanlış` |
| varsayılan `'numara'` olmuş | `p_sirala varsayılanı 'ad' değil` |
| geçersiz sıralama kabul ediliyor | `8a: geçersiz sıralama kabul edildi` |

Dördüncü satır bu turun asıl dersi: sıra **iki yerde** uygulanıyor (iç
sayfalama sorgusu ve dıştaki `jsonb_agg`). Yalnız biri değişseydi sayfanın
İÇİ doğru görünür, sayfalar arası karışırdı — ve bu ancak ikinci sayfaya
bakınca fark edilirdi.

### `nulls last` bir davranış değil, bir not

`order by … nulls last` yazılı, ama PostgreSQL'de ASC için zaten
varsayılan. Geri aldığımda hiçbir ölçüm kırılmadı — doğrusu da bu; kusur
değildi. Satır yine de duruyor ve sebebi koda yazıldı: bir gün sıra DESC'e
çevrilirse varsayılan tersine döner ve numarasız öğrenciler listenin
başına geçerdi.

### Arayüz

`Kodlar` ve `Kod fişleri` ekranlarında numara **görünmüyordu**; görünmeyen
bir alana göre sıralamak sırayı keyfî gösterir. İkisine de numara
eklendi. `kod-fisi-denetimi.mjs` sahte sunucusu `p_sirala`yı gerçekten
uyguluyor — yok saysaydı, bayrağın bir işe yaradığı hiç ölçülmezdi.
**3 arayüz kusurundan 3'ü** yakalandı (sıra istenmiyor · numara fişte
gösterilmiyor · numara fişe taşınmıyor).

Yol boyunca iki ÖLÇÜM hatası çıktı ve ikisi de kayda geçiyor:
`.sk-fis > p` bütün paragrafları topladı (48 satır); ve `span.font-semibold`
seçicisi numara rozetini ad sandı, çünkü rozet de o sınıfı taşıyor. İkisi
de üründe değil ölçümdeydi.

### 0044'ten sonra: kusur kapsamdaydı, sebep ÖLÇÜLMEMİŞ OLMASIYDI

0044 yayına alındıktan sonra öğretmen "9A'yı tıkladım, numaraya göre
sıralanmamış" dedi. Sunucu doğru sırayı döndürüyordu — panelden bakılan
teşhis sorgusu (`panel-icin/sira-neden-bozuk.sql`) `601 · 602 · 603 …`
diye sıralı döndü. Öğretmen **`Öğrenciler`** ekranındaydı; o ekran turun
kapsamı dışında bırakılmıştı.

**Ürün doğru çalışıyordu; yanlış olan kapsam kararıydı.** Gerekçe
"sınıf seçmeden bakarken farklı sınıfların aynı numaraları iç içe geçer"
idi ve doğruydu; ama kural **"ekran"** düzeyinde yazılmıştı, oysa
**"sınıf seçili mi"** düzeyinde olmalıydı. Sınıf seçiliyken o itiraz
ortadan kalkıyor. Düzeltme tek satır:

```ts
p_sirala: sinifId ? 'numara' : 'ad',
```

Asıl kayıt bu değil. Asıl kayıt şu: **o iki ekranın sırası tarayıcıda
hiç ölçülmemişti.** `Kodlar` ve `Kod fişleri` ölçülmüştü; öğretmenin
gün boyu kullandığı `Sınıf detayı` ve `Öğrenciler` ekranları
ölçülmemişti. Eksik ölçüm `app/scripts/ogrenci-sirasi-denetimi.mjs` ile
kapatıldı (`npm run sira-denetim`), 11 ölçüm.

Denetim İKİ AYRI iddiayı ayırıyor:

1. **Ekran sunucunun sırasını bozmuyor.** Sahte veri bilerek
   ALFABETİK OLMAYAN numara sırasında veriliyor
   (Ela 601 · Deniz 602 · Cem 603 · Berk 604 · Ada 605). İki dizi aynı
   olsaydı ekran yeniden sıralasa bile ölçüm yeşil kalırdı.
2. **Doğru sıra isteniyor.** Sınıf seçiliyken `'numara'`, seçili
   değilken `'ad'`. Yalnız birini ölçmek, bayrağın sabit yazılmış
   olmasını fark etmezdi.

**3 kusurdan 3'ü yakalandı ve her biri kendi yerinde:**

| Yerleştirilen kusur | Denetimin dediği |
| --- | --- |
| düzeltme geri alınıp `p_sirala: 'ad'` sabitlendi | 3. grup: `'numara' isteniyor (ad)` **ve** `liste sunucunun sırasında` — yani öğretmenin bildirdiği kusurun ta kendisi |
| `SinifDetay` çizerken `.sort()` yapıyor | 1. grup: sıra ve numara rozetleri tersine döndü |
| `Öğrenciler` çizerken `.sort()` yapıyor | 3. grup: yalnız liste sırası |

### Taklit sadık değilse ölçüm kör olur

Denetim ilk yazıldığında **hiçbir öğrenci çizilmiyordu** ve kırmızı
yanıyordu. Kusur üründe değildi: sahte sunucu tanımadığı her uca boş
nesne (`{}`) döndürüyordu, `Sınıf detayı` ekranındaki konu karnesi
`kapsam.tur`'u okuyunca ekran çöküyordu. `{}` döndürmek "cevap vermek"
değil.

İkinci sadakat kuralı daha ince: sahte sunucu `ogrenciler_listesi`
çağrısında `p_sirala`yı **gerçekten uyguluyor** (sunucudaki
`_numara_sira` kuralının aynısıyla). Bayrağı yok saysaydı, ekran yanlış
bayrağı gönderse bile liste doğru sırada görünürdü — ve yukarıdaki ilk
kusur provasında **yalnız bir ölçüm** kırmızı yanardı, listenin sırası
yeşil kalırdı. Sadık taklit sayesinde ikisi birden yanıyor.

### Kendisiyle karşılaştıran test — üçüncü ölü ölçüm

Alan adı turunda (`sekizkyal.com`) `kod-fisi.test.ts` şöyle yazıyordu:

```ts
import { ADRES } from './kod-fisi';
expect(fisMetni('ogrenci').satirlar.join(' ')).toContain(ADRES);
```

Sabiti **aynı modülden import edip kendisiyle** karşılaştırıyor. Adres ne
olursa olsun bu test yeşil kalır: yanlış alan adı bassak da, hiç kimsenin
açamayacağı bir adres bassak da. Bu, 0042'de bulunan
`pg_get_function_identity_arguments(...) = 'text, text, uuid'` ölü
ölçümünün arayüz tarafındaki eşi — **kırılamayan bir ölçüm hiçbir şey
ölçmez.**

Kanıt deneysel: adres eskiye çevrildiğinde yeni testler kırmızı yandı,
**eski desen (`toContain(ADRES)`) yeşil kaldı.** Yani o satır aylarca
duruyordu ve tek bir kusur biçimini bile göremezdi.

Onarım üç parça:

| Ölçüm | Ne yakalıyor |
| --- | --- |
| `toContain('sekizkyal.com')` — düz metin | yanlış ya da değişmiş alan adı |
| `not.toContain('github.io')` · `not.toContain('/yeni/')` | eski adresin ya da kuyruğun geri sızması |
| `toContain(ADRES)` — sabit bağı **korundu** | biri sabiti bırakıp cümleye elle adres yazarsa |

Üçüncüsü bilerek duruyor: kendisiyle karşılaştıran ölçüm **tek başına**
yanıltıcıydı, düz metnin yanında ise gerçek bir şey ölçüyor.

### `CNAME` — ölçülmeyen dosya ön kapıyı kapatabilir

Aynı turun ikinci dersi: GitHub özel alan adını ayarlarken `CNAME`
dosyasını `main` dalına kendi yazdı, geliştirme dalında yoktu. Bir
yayında düşseydi alan adı aynı anda ölürdü ve **hiçbir test kırmızı
yanmazdı** — 18 tarayıcı denetiminin hepsi yerel sunucuya bakıyor, hiçbiri
kökteki bu dosyayı görmüyordu.

`kok-denetimi.mjs`'e iki ölçüm eklendi (var mı · içi doğru mu), çünkü
yalnız varlığı ölçmek yetmez: dosya yerinde ama içinde başka bir ad
yazıyorsa sonuç aynı. **3 kusurdan 3'ü** yakalandı — dosya silindi ·
ad değiştirildi · ikinci satır eklendi.

### Kod ömür boyu sabitti — kapandı (0045)

Öğretmenin sorusu bir boşluğu açtı: *"kodlarını sonra kendileri
değiştirebiliyorlar mı?"* Hayırdı — ve **öğretmen de yenileyemiyordu.**
Kod yalnız öğrenci eklenirken bir kez üretiliyor, ömür boyu aynı
kalıyordu. Yani bir sızıntının geri dönüşü yoktu.

Kod tahmine karşı zaten güçlüydü (8 karakter × 31 harf, 0028'in kilidi);
zayıf olduğu yer paylaşımdı ve tam orada hiçbir çare yoktu.

`kod_yenile(p_token, p_id, p_rol)` bunu kapatıyor. **En değerli üç
ölçüm ve yakaladıkları:**

| Ölçüm | Yerleştirilen kusur | Sonuç |
| --- | --- | --- |
| 3. grup — o rolün oturumu kapanıyor | oturum iptali tamamen silindi | `3b: … 3 açık oturum kaldı` |
| 4. grup — öteki rolün oturumu ayakta | `rol` süzgeci kaldırıldı | `4c: ÖĞRENCİ kodu yenilenince VELİ oturumu da kapandı` |
| 6. grup — iz kaydında kod yok | koda `jsonb`'ye yazıldı | `6c: İZ KAYDINDA YENİ KOD GEÇİYOR` |

### Bu turda iki ölü ölçüm bulundu — ikisi de benim yazdığım

Testler ilk yazıldığında yeşildi. İkisi yanlış sebeple yeşildi:

**1. "Eski kod reddediliyor" ölçümü istisna bekliyordu.** `giris()`
bilinmeyen kodda istisna ATMIYOR, `{"rol":"yok"}` döndürüyor — bilinçli,
çünkü hata mesajı kodun var olup olmadığını ele verirdi. Ölçüm ürün
doğru çalışırken kırmızı yanıyordu; iddia "jeton verilmemeli" olarak
düzeltildi.

**2. "NULL rol reddediliyor" ölçümü kimin reddettiğini ayırt
etmiyordu.** `is distinct from` yerine `<>` yazılan kusurlu sürüm
**bütün testleri geçti**: NULL'da bizim kontrolümüz sessizce atlanıyor
ama `giris_kodlari.rol` sütunundaki `not null` kısıtı araya girip hata
veriyor. Ölçüm "biz reddettik" ile "veritabanı kurtardı"yı
ayıramıyordu. Artık mesaj aranıyor ve kusur ısırıyor.

**3. Bir ölçüm sırası yüzünden erişilemiyordu.** Rol süzgeci
kaldırıldığında 3. grubun hazırlık kontrolü erken patlıyor ve 4. grup
hiç çalışmıyordu — yani 4. grup, yakaladığını sandığım kusuru hiç
göremiyordu. Hazırlık "var mı diye bak"tan "oturumu burada aç"a
çevrildi; şimdi her iki grup da kendi kusurunu yakalıyor.

Tarayıcı tarafında da bir kusur provası ilk denemede ısırmadı — ama
sebep denetimde değil provadaydı: React durumu aynı tikte
güncellenmediği için "onayı atla" diye yazdığım kod aslında hiçbir şey
yapmıyordu. Onay kapısını gerçekten atlayan bir kusur yazılınca
`onay öncesi kod_yenile isteği YOK` ölçümü kırmızı yandı.

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
